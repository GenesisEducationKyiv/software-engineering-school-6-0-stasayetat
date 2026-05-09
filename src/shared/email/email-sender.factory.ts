import { EmailSender } from '@shared/email/email-sender.interface';
import { ResendEmailSender } from '@shared/email/providers/resend.email-sender';
import { SmtpEmailSender } from '@shared/email/providers/smtp.email-sender';
import { env } from '@shared/env';

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
