import { E, FailureResult, SuccessResult } from '@shared/types';
import { Repository } from '@shared/types/repository.types';

export const NOTIFICATION_SERVICE = Symbol.for('NotificationService');

export interface NotificationService {
  sendConfirmationEmail(to: string, token: string, repo: string): Promise<E.Either<FailureResult, SuccessResult>>;
  sendReleaseNotification(to: string, repo: Repository, tag: string, unsubscribeToken: string): Promise<void>;
}
