import { SubscriptionService } from '@modules/subscription';
import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { GithubApiClient } from '@shared/apis/github.api-client';
import { NotificationEmailService } from '@shared/email/notification.email-service';
import { E } from '@shared/types';
import { beforeEach, describe, expect, it, MockedObject, vi } from 'vitest';

vi.mock('@shared/apis/github.api-client', () => ({
  GithubApiClient: {
    getTags: vi.fn(),
  },
}));

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

const mockTagsResponse = [{ name: 'v1.0.0' }];

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: MockedObject<SubscriptionRepository>;
  let repoRepository: MockedObject<RepoRepository>;
  let notificationEmailService: MockedObject<NotificationEmailService>;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriptionRepository = new SubscriptionRepository() as MockedObject<SubscriptionRepository>;
    repoRepository = new RepoRepository() as MockedObject<RepoRepository>;
    notificationEmailService = new NotificationEmailService() as MockedObject<NotificationEmailService>;

    vi.spyOn(subscriptionRepository, 'getSubscriptionByEmailAndRepoId').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'createNewSubscription').mockResolvedValue(mockSubscription);
    vi.spyOn(subscriptionRepository, 'confirmSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'removeSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'getAllActiveSubscriptionByEmail').mockResolvedValue([]);
    vi.spyOn(subscriptionRepository, 'getSubscriptionByToken').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'countByRepoId').mockResolvedValue(0);

    vi.spyOn(repoRepository, 'findByRepo').mockResolvedValue(null);
    vi.spyOn(repoRepository, 'createRepo').mockResolvedValue(mockRepo);
    vi.spyOn(repoRepository, 'deleteRepo').mockResolvedValue(undefined);

    vi.spyOn(notificationEmailService, 'sendConfirmationEmail').mockResolvedValue(E.right({ success: true }));
    vi.spyOn(notificationEmailService, 'sendReleaseNotification').mockResolvedValue(undefined);

    vi.mocked(GithubApiClient.getTags).mockResolvedValue(E.right(mockTagsResponse as any));

    service = new SubscriptionService(subscriptionRepository, repoRepository, notificationEmailService);
  });

  describe('subscribe', () => {
    it('should return 409 if subscription already exists and is confirmed', async () => {
      repoRepository.findByRepo.mockResolvedValue(mockRepo);
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: true });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(409);
      expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should resend confirmation email if subscription exists but not confirmed', async () => {
      repoRepository.findByRepo.mockResolvedValue(mockRepo);
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(200);
      expect(result.message).toBe('Confirmation email resent');
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
    });

    it('should return 500 if confirmation email fails on resend', async () => {
      repoRepository.findByRepo.mockResolvedValue(mockRepo);
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(500);
    });

    it('should return 404 if github repo has no tags', async () => {
      vi.mocked(GithubApiClient.getTags).mockResolvedValue(E.left({ status: 404, message: 'Not found' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(404);
      expect(subscriptionRepository.createNewSubscription).not.toHaveBeenCalled();
    });

    it('should return 404 if repo has no tags', async () => {
      vi.mocked(GithubApiClient.getTags).mockResolvedValue(E.right([]));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(404);
      expect(result.message).toBe('Repository has no tags');
    });

    it('should create new repo and subscription and send confirmation email', async () => {
      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(200);
      expect(result.message).toBe('Confirmation email sent');
      expect(repoRepository.createRepo).toHaveBeenCalledWith('owner/repo', mockTagsResponse[0].name);
      expect(subscriptionRepository.createNewSubscription).toHaveBeenCalledWith('test@gmail.com', mockRepo.id);
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
    });

    it('should return 500 if confirmation email fails on new subscription', async () => {
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(500);
    });

    it('should create subscription for existing repo', async () => {
      repoRepository.findByRepo.mockResolvedValue(mockRepo);

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(200);
      expect(repoRepository.createRepo).not.toHaveBeenCalled();
      expect(subscriptionRepository.createNewSubscription).toHaveBeenCalledWith('test@gmail.com', mockRepo.id);
    });

    it('should return 500 if confirmation email fails for existing repo new subscription', async () => {
      repoRepository.findByRepo.mockResolvedValue(mockRepo);
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(result.status).toBe(500);
    });
  });

  describe('confirmSubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmSubscribe('invalid-token');

      expect(result.status).toBe(404);
      expect(subscriptionRepository.confirmSubscription).not.toHaveBeenCalled();
    });

    it('should confirm subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmSubscribe('token-uuid');

      expect(result.status).toBe(200);
      expect(subscriptionRepository.confirmSubscription).toHaveBeenCalledWith(mockSubscription);
    });
  });

  describe('confirmUnsubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmUnsubscribe('invalid-token');

      expect(result.status).toBe(404);
      expect(subscriptionRepository.removeSubscription).not.toHaveBeenCalled();
    });

    it('should remove subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(result.status).toBe(200);
      expect(subscriptionRepository.removeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should delete repo if no subscriptions left', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);

      await service.confirmUnsubscribe('token-uuid');

      expect(repoRepository.deleteRepo).toHaveBeenCalledWith(mockSubscription.repoId);
    });

    it('should not delete repo if other subscriptions exist', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(1);

      await service.confirmUnsubscribe('token-uuid');

      expect(repoRepository.deleteRepo).not.toHaveBeenCalled();
    });
  });

  describe('getAllSubscriptionsByEmail', () => {
    it('should return empty array if no subscriptions found', async () => {
      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(result.status).toBe(200);
      expect(result.data).toEqual([]);
    });

    it('should return mapped subscriptions with repo data', async () => {
      subscriptionRepository.getAllActiveSubscriptionByEmail.mockResolvedValue([
        { subscriptions: mockSubscription, repos: mockRepo },
      ] as any);

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(result.status).toBe(200);
      expect(result.data).toEqual([{
        email: 'test@gmail.com',
        repo: 'owner/repo',
        confirmed: true,
        last_seen_tag: 'v1.0.0',
      }]);
    });

    it('should return all subscriptions for email', async () => {
      subscriptionRepository.getAllActiveSubscriptionByEmail.mockResolvedValue([
        { subscriptions: mockSubscription, repos: mockRepo },
        { subscriptions: { ...mockSubscription, id: 'sub-uuid-2' }, repos: { ...mockRepo, repo: 'owner/repo2' } },
      ] as any);

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(2);
    });
  });
});
