import { EmailSenderFactory } from '@shared/email/email-sender.factory';
import { EMAIL_SENDER } from '@shared/email/email-sender.interface';
import { NotificationEmailService } from '@shared/email/notification.email-service';
import { DependencyContainer } from 'tsyringe';

export function registerEmailModule(container: DependencyContainer): void {
  container.registerSingleton(EMAIL_SENDER, EmailSenderFactory.resolve());
  container.registerSingleton(NotificationEmailService);
}
