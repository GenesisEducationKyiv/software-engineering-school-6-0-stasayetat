import { env } from '@shared/env';
import { EmailSender } from '@shared/notification/email-sender.interface';
import nodemailer from 'nodemailer';
import { injectable } from 'tsyringe';

@injectable()
export class SmtpEmailSender implements EmailSender {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_SENDER_EMAIL,
      to,
      subject,
      html,
    });
  }
}
