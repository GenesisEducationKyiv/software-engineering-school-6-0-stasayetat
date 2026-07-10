import { EmailSenderFactory } from '@shared/notification/email-sender.factory';
import { EMAIL_SENDER } from '@shared/notification/email-sender.interface';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { NOTIFICATION_SERVICE } from '@shared/notification/notification-service.interface';
import { DependencyContainer } from 'tsyringe';

export function registerEmailModule(container: DependencyContainer): void {
  container.registerSingleton(EMAIL_SENDER, EmailSenderFactory.resolve());
  container.registerSingleton(NOTIFICATION_SERVICE, NotificationEmailService);
}
