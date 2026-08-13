import nodemailer from 'nodemailer';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: +process.env.EMAIL_PORT!,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Cuesoft fork: transactional email is sent directly through this transport
  // rather than via Temporal (see EmailService.sendEmail), so an SMTP stall must
  // fail fast. Sends now run on EmailService's bounded background queue, where a
  // hung handshake no longer stalls a request or a publish, but it does hold one
  // of only two dispatch slots, so every later notification queues behind it.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

export class NodeMailerProvider implements EmailInterface {
  name = 'nodemailer';
  validateEnvKeys = [
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_SECURE',
    'EMAIL_USER',
    'EMAIL_PASS',
  ];
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    emailFromName: string,
    emailFromAddress: string
  ) {
    const sends = await transporter.sendMail({
      from: `${emailFromName} <${emailFromAddress}>`, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      text: html, // plain text body
      html: html, // html body
    });

    return sends;
  }
}
