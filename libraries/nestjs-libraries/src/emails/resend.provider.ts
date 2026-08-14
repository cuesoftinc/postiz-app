import { Resend } from 'resend';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';
import { htmlToPlainText } from '@gitroom/helpers/utils/html.to.plain.text';

const resend = new Resend(process.env.RESEND_API_KEY || 're_132');

export class ResendProvider implements EmailInterface {
  name = 'resend';
  validateEnvKeys = ['RESEND_API_KEY'];
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    emailFromName: string,
    emailFromAddress: string,
    replyTo?: string
  ) {
    try {
      const sends = await resend.emails.send({
        from: `${emailFromName} <${emailFromAddress}>`,
        to,
        subject,
        html,
        // Resend never had `text: html`, but it sent no text part at all, so
        // an HTML-only message is what a text-only client and the spam
        // scorers saw. Same derived alternative as the nodemailer path.
        text: htmlToPlainText(html),
        ...(replyTo && { reply_to: replyTo }),
      });

      return sends;
    } catch (err) {
      console.log(err);
    }

    return { sent: false };
  }
}
