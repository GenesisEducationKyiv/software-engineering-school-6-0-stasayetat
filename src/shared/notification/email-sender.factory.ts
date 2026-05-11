import { env } from '@shared/env';
import { EmailSender } from '@shared/notification/email-sender.interface';
import { ResendEmailSender } from '@shared/notification/providers/resend.email-sender';
import { SmtpEmailSender } from '@shared/notification/providers/smtp.email-sender';

type EmailProvider = 'resend' | 'smtp';

const providers: Record<EmailProvider, new () => EmailSender> = {
  resend: ResendEmailSender,
  smtp: SmtpEmailSender,
};

export class EmailSenderFactory {
  static resolve(): new () => EmailSender {
    const provider: EmailProvider = env.NODE_ENV === 'production' ? 'resend' : 'smtp';
    const Sender = providers[provider];

    if (!Sender) {
      throw new Error(`Unknown email provider: "${provider}"`);
    }

    return Sender;
  }
}
