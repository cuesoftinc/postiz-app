import { Injectable } from '@nestjs/common';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';
import { ResendProvider } from '@gitroom/nestjs-libraries/emails/resend.provider';
import { EmptyProvider } from '@gitroom/nestjs-libraries/emails/empty.provider';
import { NodeMailerProvider } from '@gitroom/nestjs-libraries/emails/node.mailer.provider';
import { TemporalService } from 'nestjs-temporal-core';
import { timer } from '@gitroom/helpers/utils/timer';
import { sanitizeForLog } from '@gitroom/helpers/utils/sanitize.log';
import { escapeHtml } from '@gitroom/helpers/utils/escape.html';

// Per-attempt wall clock for one SMTP/API send. The nodemailer transport
// already fails fast on its own socket timeouts, so this only catches a
// provider that hangs without ever timing out: without it, one wedged send
// would occupy a dispatch slot for the life of the process.
const SEND_ATTEMPT_TIMEOUT = 30_000;
// How many sends may be in flight at once. Notification fan-out is per
// recipient, so this is the only thing standing between a 40-user org and 40
// simultaneous SMTP handshakes.
const SEND_CONCURRENCY = 2;
// Backstop on the dispatch backlog. If SMTP is down, sends retry for ~1 minute
// each, so the backlog can grow much faster than it drains; past this point the
// oldest queued mail is already stale and holding its HTML in memory is the
// bigger problem. Shedding is logged, never silent.
const SEND_QUEUE_MAX = 500;

@Injectable()
export class EmailService {
  emailService: EmailInterface;
  // Fire-and-forget dispatch queue, see sendEmail(). In-process and
  // deliberately NOT durable: it exists to keep SMTP latency out of the
  // caller's path, not to guarantee delivery.
  private _queue: (() => Promise<void>)[] = [];
  private _inFlight = 0;
  constructor(private _temporalService: TemporalService) {
    this.emailService = this.selectProvider(process.env.EMAIL_PROVIDER!);
    console.log('Email service provider:', this.emailService.name);
    for (const key of this.emailService.validateEnvKeys) {
      if (!process.env[key]) {
        console.error(`Missing environment variable: ${key}`);
      }
    }
  }

  hasProvider() {
    return !(this.emailService instanceof EmptyProvider);
  }

  selectProvider(provider: string) {
    switch (provider) {
      case 'resend':
        return new ResendProvider();
      case 'nodemailer':
        return new NodeMailerProvider();
      default:
        return new EmptyProvider();
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    addTo: 'top' | 'bottom',
    replyTo?: string
  ) {
    // Cuesoft fork: upstream routes every transactional email through a single
    // long-lived Temporal workflow (`sendEmailWorkflow`, signalWithStart /
    // USE_EXISTING on the `main` queue). On this self-hosted instance that
    // singleton wedges after container recreates — signals are accepted but the
    // workflow task times out (`WorkflowTaskTimedOut`) and its queue never
    // drains, so password resets / invites / activations are silently dropped
    // (the endpoint still returns success). Our volume is tiny, so we send
    // synchronously through the same nodemailer path (with its own 3-attempt
    // retry) and skip Temporal entirely. `addTo` only ordered the workflow
    // queue and is irrelevant for an immediate send.
    //
    // ...but the send does NOT happen in the caller's path. Every caller of
    // this method (notification fan-out, invites, resets, billing) is on a
    // request or a publish workflow activity, and none of them inspects the
    // outcome, while NotificationService.sendEmailsToOrg awaits us once per
    // recipient. Awaiting an SMTP handshake there made publish latency scale
    // with org size and put a dead mail host inside the publish path: the
    // inAppNotification activity has a 10 minute startToCloseTimeout, and a
    // handful of recipients times three attempts each is enough to blow it,
    // which retries the activity (duplicate in-app rows) and can fail the
    // workflow for a post that already published.
    //
    // So: hand the send to the bounded in-process queue below and return.
    // Nothing here can reject into the caller, and the fan-out cost no longer
    // accumulates in the publish path. Failures are logged by the queue.
    // Delivery stays best effort, exactly as before, since sendEmailSync has
    // never surfaced a failure to callers either.
    this.enqueue(to, subject, html, replyTo);
  }

  /** Queue one send for background dispatch. Nothing awaits the result: the
   *  only report of a failed notification is the log line. */
  private enqueue(
    to: string,
    subject: string,
    html: string,
    replyTo?: string
  ) {
    if (this._queue.length >= SEND_QUEUE_MAX) {
      console.error(
        `Email queue full (${SEND_QUEUE_MAX}), dropping email to ${sanitizeForLog(
          to
        )}: ${sanitizeForLog(subject)}`
      );
      return;
    }
    this._queue.push(() => this.sendEmailSync(to, subject, html, replyTo));
    this.drain();
  }

  private drain() {
    while (this._inFlight < SEND_CONCURRENCY && this._queue.length) {
      const task = this._queue.shift()!;
      this._inFlight++;
      // sendEmailSync swallows send failures itself; this catch is for the
      // unexpected (a provider throwing outside its retry loop), because an
      // unhandled rejection here would take the whole worker down.
      task()
        .catch((err) => console.error('Email dispatch failed:', err))
        .finally(() => {
          this._inFlight--;
          this.drain();
        });
    }
  }

  // `subject` is escaped centrally where it is interpolated into the <h1>
  // below, because every caller passes plain text and several build it from
  // user-controlled values (an invite subject is
  // `${user.name} invited you to join "${org.name}"`). `html` is deliberately
  // NOT escaped: callers pass real markup and the template wraps it, so
  // escaping here would render every templated email as source. Callers that
  // interpolate user values into `html` must escape those values themselves.
  async sendEmailSync(
    to: string,
    subject: string,
    html: string,
    replyTo?: string
  ) {
    if (to.indexOf('@') === -1) {
      return;
    }

    if (!process.env.EMAIL_FROM_ADDRESS || !process.env.EMAIL_FROM_NAME) {
      console.log(
        'Email sender information not found in environment variables'
      );
      return;
    }

    const modifiedHtml = `
    <div style="
        background: linear-gradient(to bottom right, #e6f2ff, #f0e6ff);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    ">
        <div style="
            background-color: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(4px);
            border-radius: 0.5rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 48rem;
            width: 100%;
            padding: 2rem;
        ">
            <h1 style="
                font-size: 1.875rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                text-align: left;
                color: #1f2937;
            ">${escapeHtml(subject)}</h1>
            
            <div style="
                margin-bottom: 2rem;
                color: #374151;
            ">
                ${html}
            </div>
            
            <div style="
                display: flex;
                align-items: center;
                border-top: 1px solid #e5e7eb;
                padding-top: 1.5rem;
            ">
                <div>
                    <h2 style="
                        font-size: 1.25rem;
                        font-weight: 600;
                        color: #1f2937;
                        margin: 0;
                    ">${process.env.EMAIL_FROM_NAME}</h2>
                    <div style="font-size: 12px">
                      You can change your notification preferences in your <a href="${process.env.FRONTEND_URL}/settings">account settings.</a>
                     </div>
                </div>
            </div>
        </div>
    </div>
    `;

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sends = await this.withTimeout(
          this.emailService.sendEmail(
            to,
            subject,
            modifiedHtml,
            process.env.EMAIL_FROM_NAME,
            process.env.EMAIL_FROM_ADDRESS,
            replyTo
          )
        );
        // The provider echoes the recipient and subject back in its response,
        // and both start life in a request body, so a newline in either would
        // otherwise let a caller forge log lines.
        console.log('Email sent', sanitizeForLog(sends));
        return;
      } catch (err) {
        lastErr = err;
        console.log(`Email attempt ${attempt + 1}/3 failed:`, err);
        if (attempt < 2) {
          await timer(700);
        }
      }
    }
    console.log(
      `Email to ${sanitizeForLog(to)} failed after 3 attempts:`,
      lastErr
    );
  }

  /** Caps one provider call by wall clock. A rejected race counts as a failed
   *  attempt, so the caller's retry loop and its final log line still apply. */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let handle: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        handle = setTimeout(
          () =>
            reject(
              new Error(`Email send timed out after ${SEND_ATTEMPT_TIMEOUT}ms`)
            ),
          SEND_ATTEMPT_TIMEOUT
        );
      }),
    ]).finally(() => {
      if (handle) clearTimeout(handle);
    });
  }
}
