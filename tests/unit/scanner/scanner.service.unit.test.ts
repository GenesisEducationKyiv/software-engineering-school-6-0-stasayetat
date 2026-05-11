import { RepoTagFetcher } from '@modules/scanner/service/repo-tag.fetcher';
import { ScannerService } from '@modules/scanner/service/scanner.service';
import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { E } from '@shared/types';
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
  confirmed: true,
  createdAt: new Date(),
};

describe('ScannerService', () => {
  let service: ScannerService;
  let repoRepository: MockedObject<RepoRepository>;
  let repoTagFetcher: MockedObject<RepoTagFetcher>;
  let subscriptionRepository: MockedObject<SubscriptionRepository>;
  let notifierService: MockedObject<NotificationEmailService>;

  beforeEach(() => {
    vi.clearAllMocks();

    repoRepository = new RepoRepository() as MockedObject<RepoRepository>;
    repoTagFetcher = new RepoTagFetcher({} as any) as MockedObject<RepoTagFetcher>;
    subscriptionRepository = new SubscriptionRepository() as MockedObject<SubscriptionRepository>;
    notifierService = new NotificationEmailService({} as any) as MockedObject<NotificationEmailService>;

    vi.spyOn(repoRepository, 'getAllRepos').mockResolvedValue([]);
    vi.spyOn(repoRepository, 'updateLastSeenTag').mockResolvedValue(undefined);
    vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));
    vi.spyOn(subscriptionRepository, 'getSubscriptionsByRepoIds').mockResolvedValue([]);
    vi.spyOn(notifierService, 'sendReleaseNotification').mockResolvedValue(undefined);

    service = new ScannerService(repoRepository, repoTagFetcher, subscriptionRepository, notifierService);
  });

  describe('run', () => {
    it('should return early if there are no repos', async () => {
      repoRepository.getAllRepos.mockResolvedValue([]);

      await service.run();

      expect(subscriptionRepository.getSubscriptionsByRepoIds).not.toHaveBeenCalled();
    });

    it('should return early if there are no subscriptions', async () => {
      repoRepository.getAllRepos.mockResolvedValue([mockRepo]);
      repoTagFetcher.getTags.mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      subscriptionRepository.getSubscriptionsByRepoIds.mockResolvedValue([]);

      await service.run();

      expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      repoRepository.getAllRepos.mockResolvedValue([mockRepo]);
      repoTagFetcher.getTags.mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));

      await service.run();

      expect(subscriptionRepository.getSubscriptionsByRepoIds).not.toHaveBeenCalled();
      expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should notify subscribers and update tag when new release found', async () => {
      repoRepository.getAllRepos.mockResolvedValue([mockRepo]);
      repoTagFetcher.getTags.mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      subscriptionRepository.getSubscriptionsByRepoIds.mockResolvedValue([mockSubscription]);

      await service.run();

      expect(notifierService.sendReleaseNotification).toHaveBeenCalledWith(
        'test@gmail.com',
        mockRepo,
        'v2.0.0',
        'token-uuid',
      );
      expect(repoRepository.updateLastSeenTag).toHaveBeenCalledWith('repo-uuid', 'v2.0.0');
    });

    it('should continue notifying other repos if fetching tags fails for one', async () => {
      const mockRepo2 = { ...mockRepo, id: 'repo-uuid-2', repo: 'owner/repo2' };

      repoRepository.getAllRepos.mockResolvedValue([mockRepo, mockRepo2]);
      repoTagFetcher.getTags
        .mockResolvedValueOnce(E.left({ currentRepo: mockRepo, error: { status: 500, message: 'Error' } }))
        .mockResolvedValueOnce(E.right({ currentRepo: mockRepo2, latestTag: 'v2.0.0' }));

      subscriptionRepository.getSubscriptionsByRepoIds.mockResolvedValue([
        { ...mockSubscription, repoId: 'repo-uuid-2' },
      ]);

      await service.run();

      expect(notifierService.sendReleaseNotification).toHaveBeenCalledTimes(1);
      expect(repoRepository.updateLastSeenTag).toHaveBeenCalledWith('repo-uuid-2', 'v2.0.0');
    });

    it('should notify multiple subscribers for the same repo', async () => {
      repoRepository.getAllRepos.mockResolvedValue([mockRepo]);
      repoTagFetcher.getTags.mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      subscriptionRepository.getSubscriptionsByRepoIds.mockResolvedValue([
        mockSubscription,
        { ...mockSubscription, id: 'sub-uuid-2', email: 'test2@gmail.com', token: 'token-uuid-2' },
      ]);

      await service.run();

      expect(notifierService.sendReleaseNotification).toHaveBeenCalledTimes(2);
      expect(notifierService.sendReleaseNotification).toHaveBeenCalledWith('test@gmail.com', mockRepo, 'v2.0.0', 'token-uuid');
      expect(notifierService.sendReleaseNotification).toHaveBeenCalledWith('test2@gmail.com', mockRepo, 'v2.0.0', 'token-uuid-2');
    });
  });
});
