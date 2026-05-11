import { logger } from '@shared/logger';
import { emailSentTotal } from '@shared/metrics';
import {
  confirmationEmailTemplate,
  EMAIL_SUBJECT_CONFIRMATION,
  EMAIL_SUBJECT_RELEASE_NOTIFICATION,
  releaseNotificationTemplate,
} from '@shared/notification/email.utils';
import { EMAIL_SENDER, EmailSender } from '@shared/notification/email-sender.interface';
import { NotificationService } from '@shared/notification/notification-service.interface';
import { E, FailureResult, SuccessResult } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { getErrorMessage } from '@shared/utils';
import { inject, injectable } from 'tsyringe';

@injectable()
export class NotificationEmailService implements NotificationService {
  constructor(@inject(EMAIL_SENDER) private readonly emailSender: EmailSender) {}

  async sendConfirmationEmail(
    to: string,
    token: string,
    repo: string,
  ): Promise<E.Either<FailureResult, SuccessResult>> {
    try {
      await this.emailSender.send(to, EMAIL_SUBJECT_CONFIRMATION, confirmationEmailTemplate(token, repo));

      logger.info(`User ${to} has received confirmation email`);

      emailSentTotal.inc({ type: 'confirmation', status: 'success' });

      return E.right({ success: true });
    } catch (error) {
      const message = getErrorMessage(error);

      emailSentTotal.inc({ type: 'confirmation', status: 'failed' });

      logger.error(`Failed to send confirmation ${to}: ${message}`);

      return E.left({ success: false, message });
    }
  }

  async sendReleaseNotification(to: string, repo: Repository, tag: string, unsubscribeToken: string) {
    try {
      await this.emailSender.send(
        to,
        EMAIL_SUBJECT_RELEASE_NOTIFICATION(repo.repo, tag),
        releaseNotificationTemplate(repo, tag, unsubscribeToken),
      );

      logger.info(`User ${to} has received release notification about ${repo.repo}`);

      emailSentTotal.inc({ type: 'release', status: 'success' });
    } catch (error) {
      const message = getErrorMessage(error);

      emailSentTotal.inc({ type: 'release', status: 'failed' });

      logger.error(`Failed to notify ${to}: ${message}`);
    }
  }
}
