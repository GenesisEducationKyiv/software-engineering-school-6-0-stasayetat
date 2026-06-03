import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataService } from '@scanner/service/scanner.data-service';
import { ScannerService } from '@scanner/service/scanner.service';
import { E } from '@shared/either';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { DomainErrorCode } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  let dataAdapter: ScannerDataService;
  let repoTagFetcher: RepoTagFetcher;
  let notifierService: NotificationEmailService;

  beforeEach(() => {
    vi.clearAllMocks();

    dataAdapter = {
      getAllRepos: vi.fn().mockResolvedValue([]),
      getSubscribersByRepoIds: vi.fn().mockResolvedValue([]),
      updateLastSeenTag: vi.fn().mockResolvedValue(undefined),
    } as unknown as ScannerDataService;

    repoTagFetcher = new RepoTagFetcher({} as any);
    notifierService = {
      sendConfirmationEmail: vi.fn(),
      sendReleaseNotification: vi.fn(),
    } as unknown as NotificationEmailService;

    vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));
    vi.spyOn(notifierService, 'sendReleaseNotification').mockResolvedValue(undefined);

    service = new ScannerService(dataAdapter, repoTagFetcher, notifierService);
  });

  describe('run', () => {
    it('should return early if there are no repos', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([]);

      await service.run();

      expect(dataAdapter.getSubscribersByRepoIds).not.toHaveBeenCalled();
    });

    it('should return early if there are no subscriptions', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      vi.mocked(dataAdapter.getSubscribersByRepoIds).mockResolvedValue([]);

      await service.run();

      expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));

      await service.run();

      expect(dataAdapter.getSubscribersByRepoIds).not.toHaveBeenCalled();
      expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should notify subscribers and update tag when new release found', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      vi.mocked(dataAdapter.getSubscribersByRepoIds).mockResolvedValue([mockSubscription]);

      await service.run();

      expect(notifierService.sendReleaseNotification).toHaveBeenCalledWith(
        'test@gmail.com',
        mockRepo,
        'v2.0.0',
        'token-uuid',
      );
      expect(dataAdapter.updateLastSeenTag).toHaveBeenCalledWith('repo-uuid', 'v2.0.0');
    });

    it('should continue notifying other repos if fetching tags fails for one', async () => {
      const mockRepo2 = { ...mockRepo, id: 'repo-uuid-2', repo: 'owner/repo2' };

      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo, mockRepo2]);
      vi.spyOn(repoTagFetcher, 'getTags')
        .mockResolvedValueOnce(E.left({ currentRepo: mockRepo, error: { code: DomainErrorCode.GITHUB_API_ERROR, message: 'Error' } }))
        .mockResolvedValueOnce(E.right({ currentRepo: mockRepo2, latestTag: 'v2.0.0' }));
      vi.mocked(dataAdapter.getSubscribersByRepoIds).mockResolvedValue([
        { ...mockSubscription, repoId: 'repo-uuid-2' },
      ]);

      await service.run();

      expect(notifierService.sendReleaseNotification).toHaveBeenCalledTimes(1);
      expect(dataAdapter.updateLastSeenTag).toHaveBeenCalledWith('repo-uuid-2', 'v2.0.0');
    });

    it('should notify multiple subscribers for the same repo', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));
      vi.mocked(dataAdapter.getSubscribersByRepoIds).mockResolvedValue([
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
