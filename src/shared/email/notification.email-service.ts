import { EmailApiClient } from '@shared/apis';
import {
  confirmationEmailTemplate,
  EMAIL_SUBJECT_CONFIRMATION,
  EMAIL_SUBJECT_RELEASE_NOTIFICATION,
  releaseNotificationTemplate,
} from '@shared/email/email.utils';
import { logger } from '@shared/logger';
import { emailSentTotal } from '@shared/metrics';
import { E, FailureResult, SuccessResult } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { getErrorMessage } from '@shared/utils';

export class NotificationEmailService {
  async sendConfirmationEmail(
    to: string,
    token: string,
    repo: string,
  ): Promise<E.Either<FailureResult, SuccessResult>> {
    try {
      await EmailApiClient.sendEmail(to, EMAIL_SUBJECT_CONFIRMATION, confirmationEmailTemplate(token, repo));

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
      await EmailApiClient.sendEmail(
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
