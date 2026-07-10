import { SubscriptionRepository } from '@notifier/subscription/repository/subscription.repository';
import { SubscriptionSagaService } from '@notifier/subscription/saga/subscription-saga.service';
import { RepoService } from '@notifier/subscription/service/repo.service';
import { SubscriptionService } from '@notifier/subscription/service/subscription.service';
import { E } from '@shared/either';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { DomainErrorCode } from '@shared/types';
import { beforeEach, describe, expect, it, MockedObject, vi } from 'vitest';

const mockRepo = {
  id: 'repo-uuid',
  repo: 'owner/repo',
  last_seen_tag: 'v1.0.0',
  checkedAt: new Date(),
};

const mockSubscription = {
  id: 'sub-uuid',
  email: 'test@gmail.com',
  repoId: 'repo-uuid',
  token: 'token-uuid',
  confirmed: false,
  createdAt: new Date(),
};

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: MockedObject<SubscriptionRepository>;
  let repoService: MockedObject<RepoService>;
  let notificationEmailService: MockedObject<NotificationEmailService>;
  let subscriptionSagaService: MockedObject<SubscriptionSagaService>;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriptionRepository = new SubscriptionRepository() as MockedObject<SubscriptionRepository>;
    repoService = new RepoService({} as any, {} as any) as MockedObject<RepoService>;
    notificationEmailService = new NotificationEmailService({} as any) as MockedObject<NotificationEmailService>;
    subscriptionSagaService = { subscribeNewRepo: vi.fn(), untrackOrphanedRepo: vi.fn() } as unknown as MockedObject<SubscriptionSagaService>;

    vi.spyOn(subscriptionRepository, 'getSubscriptionByEmailAndRepoId').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'createNewSubscription').mockResolvedValue(mockSubscription);
    vi.spyOn(subscriptionRepository, 'confirmSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'removeSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'getAllActiveSubscriptionByEmail').mockResolvedValue([]);
    vi.spyOn(subscriptionRepository, 'getSubscriptionByToken').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'countByRepoId').mockResolvedValue(0);

    vi.spyOn(repoService, 'findRepo').mockResolvedValue(mockRepo);
    vi.spyOn(repoService, 'validateNewRepo').mockResolvedValue(E.right('v1.0.0'));
    vi.spyOn(repoService, 'getRepoById').mockResolvedValue(mockRepo);

    vi.spyOn(notificationEmailService, 'sendConfirmationEmail').mockResolvedValue(E.right({ success: true }));
    vi.spyOn(notificationEmailService, 'sendReleaseNotification').mockResolvedValue(undefined);

    vi.mocked(subscriptionSagaService.subscribeNewRepo).mockResolvedValue({ repo: mockRepo, subscription: mockSubscription });
    vi.mocked(subscriptionSagaService.untrackOrphanedRepo).mockResolvedValue(undefined);

    service = new SubscriptionService(subscriptionRepository, notificationEmailService, repoService, subscriptionSagaService);
  });

  describe('subscribe', () => {
    it('should return 409 if subscription already exists and is confirmed', async () => {
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: true });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_ALREADY_EXISTS);
        expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
      }
    });

    it('should resend confirmation notification if subscription exists but not confirmed', async () => {
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
      expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
    });

    it('should create subscription for existing repo without running the saga', async () => {
      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
    });

    it('should run the subscribe saga and send a confirmation email for a brand-new repo', async () => {
      repoService.findRepo.mockResolvedValue(null);

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionSagaService.subscribeNewRepo).toHaveBeenCalledWith('test@gmail.com', 'owner/repo', 'v1.0.0');
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
    });

    it('should return REPO_HAS_NO_TAGS if the new repo has no tags', async () => {
      repoService.findRepo.mockResolvedValue(null);
      repoService.validateNewRepo.mockResolvedValue(E.left({ code: DomainErrorCode.REPO_HAS_NO_TAGS, message: 'Repository has no tags' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.REPO_HAS_NO_TAGS);
        expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
      }
    });

    it('should return SCANNER_TRACKING_FAILED if the saga throws', async () => {
      repoService.findRepo.mockResolvedValue(null);
      subscriptionSagaService.subscribeNewRepo.mockRejectedValue(new Error('scanner unreachable'));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SCANNER_TRACKING_FAILED);
        expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
      }
    });

    it('should return EMAIL_SEND_FAILURE if confirmation email fails after a successful saga', async () => {
      repoService.findRepo.mockResolvedValue(null);
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.EMAIL_SEND_FAILURE);
      }
    });
  });

  describe('confirmSubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmSubscribe('invalid-token');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_NOT_FOUND);
        expect(subscriptionRepository.confirmSubscription).not.toHaveBeenCalled();
      }
    });

    it('should confirm subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmSubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.confirmSubscription).toHaveBeenCalledWith(mockSubscription);
    });
  });

  describe('confirmUnsubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmUnsubscribe('invalid-token');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_NOT_FOUND);
        expect(subscriptionRepository.removeSubscription).not.toHaveBeenCalled();
      }
    });

    it('should remove subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.removeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should run the untrack saga if no subscriptions are left for the repo', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);

      await service.confirmUnsubscribe('token-uuid');

      expect(subscriptionSagaService.untrackOrphanedRepo).toHaveBeenCalledWith(mockRepo);
    });

    it('should not run the untrack saga if other subscriptions exist', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(1);

      await service.confirmUnsubscribe('token-uuid');

      expect(subscriptionSagaService.untrackOrphanedRepo).not.toHaveBeenCalled();
    });

    it('should still return success if the untrack saga throws', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);
      subscriptionSagaService.untrackOrphanedRepo.mockRejectedValue(new Error('scanner unreachable'));

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
    });
  });

  describe('getAllSubscriptionsByEmail', () => {
    it('should return empty array if no subscriptions found', async () => {
      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('should return mapped subscriptions with repo data', async () => {
      subscriptionRepository.getAllActiveSubscriptionByEmail.mockResolvedValue([
        { subscriptions: mockSubscription, repos: mockRepo },
      ] as any);

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.value).toEqual([{
          email: 'test@gmail.com',
          repo: 'owner/repo',
          confirmed: true,
          last_seen_tag: 'v1.0.0',
        }]);
      }
    });
  });
});
