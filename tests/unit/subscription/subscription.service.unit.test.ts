import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { RepoService } from '@modules/subscription/service/repo.service';
import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { ApiResponseExceptionCode, E } from '@shared/types';
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

  beforeEach(() => {
    vi.resetAllMocks();

    subscriptionRepository = new SubscriptionRepository() as MockedObject<SubscriptionRepository>;
    repoService = new RepoService({} as any, {} as any) as MockedObject<RepoService>;
    notificationEmailService = new NotificationEmailService({} as any) as MockedObject<NotificationEmailService>;

    vi.spyOn(subscriptionRepository, 'getSubscriptionByEmailAndRepoId').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'createNewSubscription').mockResolvedValue(mockSubscription);
    vi.spyOn(subscriptionRepository, 'confirmSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'removeSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'getAllActiveSubscriptionByEmail').mockResolvedValue([]);
    vi.spyOn(subscriptionRepository, 'getSubscriptionByToken').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'countByRepoId').mockResolvedValue(0);

    vi.spyOn(repoService, 'findOrCreateRepo').mockResolvedValue(E.right(mockRepo));
    vi.spyOn(repoService, 'removeRepo').mockResolvedValue(undefined);

    vi.spyOn(notificationEmailService, 'sendConfirmationEmail').mockResolvedValue(E.right({ success: true }));
    vi.spyOn(notificationEmailService, 'sendReleaseNotification').mockResolvedValue(undefined);

    service = new SubscriptionService(subscriptionRepository, notificationEmailService, repoService);
  });

  describe('subscribe', () => {
    it('should return 409 if subscription already exists and is confirmed', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.right(mockRepo));
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: true });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.ALREADY_EXISTS);
        expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
      }
    });

    it('should resend confirmation notification if subscription exists but not confirmed', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.right(mockRepo));
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
    });

    it('should return 500 if confirmation notification fails on resend', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.right(mockRepo));
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.GENERAL_FAILURE);
      }
    });

    it('should return 404 if repo service returns an error', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.left({ code: ApiResponseExceptionCode.NOT_FOUND, message: 'Not found' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.NOT_FOUND);
        expect(subscriptionRepository.createNewSubscription).not.toHaveBeenCalled();
      }
    });

    it('should return 404 if repo has no tags', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.left({ code: ApiResponseExceptionCode.NOT_FOUND, message: 'Repository has no tags' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.NOT_FOUND);
        expect(result.value.message).toBe('Repository has no tags');
      }
    });

    it('should create new subscription and send confirmation notification', async () => {
      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(subscriptionRepository.createNewSubscription).toHaveBeenCalledWith('test@gmail.com', mockRepo.id);
        expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
      }

    });

    it('should return 500 if confirmation notification fails on new subscription', async () => {
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.GENERAL_FAILURE);
      }
    });

    it('should create subscription for existing repo', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.right(mockRepo));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.createNewSubscription).toHaveBeenCalledWith('test@gmail.com', mockRepo.id);
    });

    it('should return 500 if confirmation notification fails for existing repo new subscription', async () => {
      repoService.findOrCreateRepo.mockResolvedValue(E.right(mockRepo));
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.GENERAL_FAILURE);
        expect(result.value.message).toBe('SMTP error');
      }
    });
  });

  describe('confirmSubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmSubscribe('invalid-token');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(ApiResponseExceptionCode.NOT_FOUND);
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
        expect(result.value.code).toBe(ApiResponseExceptionCode.NOT_FOUND);
        expect(subscriptionRepository.removeSubscription).not.toHaveBeenCalled();
      }

    });

    it('should remove subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.removeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should delete repo if no subscriptions left', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);

      await service.confirmUnsubscribe('token-uuid');

      expect(repoService.removeRepo).toHaveBeenCalledWith(mockSubscription.repoId);
    });

    it('should not delete repo if other subscriptions exist', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(1);

      await service.confirmUnsubscribe('token-uuid');

      expect(repoService.removeRepo).not.toHaveBeenCalled();
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

    it('should return all subscriptions for notification', async () => {
      subscriptionRepository.getAllActiveSubscriptionByEmail.mockResolvedValue([
        { subscriptions: mockSubscription, repos: mockRepo },
        { subscriptions: { ...mockSubscription, id: 'sub-uuid-2' }, repos: { ...mockRepo, repo: 'owner/repo2' } },
      ] as any);

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');


      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.value).toHaveLength(2);
      }
    });
  });
});
