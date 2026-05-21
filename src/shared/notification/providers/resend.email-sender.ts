import { env } from '@shared/env';
import { EmailSender } from '@shared/notification/email-sender.interface';
import Bottleneck from 'bottleneck';
import { Resend } from 'resend';
import { injectable } from 'tsyringe';

@injectable()
export class ResendEmailSender implements EmailSender {
  private readonly limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 1000 / 3,
  });

  private readonly resend = new Resend(env.SMTP_PASS);

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.limiter.schedule(() =>
      this.resend.emails.send({
        from: env.SMTP_SENDER_EMAIL,
        to,
        subject,
        html,
      }),
    );
  }
}
