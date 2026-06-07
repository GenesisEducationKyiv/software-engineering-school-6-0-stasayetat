import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { ScannerService } from '@scanner/service/scanner.service';
import { E } from '@shared/either';
import { DomainErrorCode } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRepo = {
  id: 'repo-uuid',
  repo: 'owner/repo',
  last_seen_tag: 'v1.0.0',
  checkedAt: new Date(),
};

describe('ScannerService', () => {
  let service: ScannerService;
  let dataAdapter: ScannerDataFetcher;
  let repoTagFetcher: RepoTagFetcher;

  beforeEach(() => {
    vi.clearAllMocks();

    dataAdapter = {
      getAllRepos: vi.fn().mockResolvedValue([]),
      notifyNewRelease: vi.fn().mockResolvedValue(undefined),
    } as unknown as ScannerDataFetcher;

    repoTagFetcher = new RepoTagFetcher({} as any);

    vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));

    service = new ScannerService(dataAdapter, repoTagFetcher);
  });

  describe('run', () => {
    it('should return early if there are no repos', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([]);

      await service.run();

      expect(dataAdapter.notifyNewRelease).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v1.0.0' }));

      await service.run();

      expect(dataAdapter.notifyNewRelease).not.toHaveBeenCalled();
    });

    it('should notify when new release found', async () => {
      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo]);
      vi.spyOn(repoTagFetcher, 'getTags').mockResolvedValue(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }));

      await service.run();

      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledWith('repo-uuid', 'v2.0.0');
    });

    it('should continue notifying other repos if fetching tags fails for one', async () => {
      const mockRepo2 = { ...mockRepo, id: 'repo-uuid-2', repo: 'owner/repo2' };

      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo, mockRepo2]);
      vi.spyOn(repoTagFetcher, 'getTags')
        .mockResolvedValueOnce(E.left({ currentRepo: mockRepo, error: { code: DomainErrorCode.GITHUB_API_ERROR, message: 'Error' } }))
        .mockResolvedValueOnce(E.right({ currentRepo: mockRepo2, latestTag: 'v2.0.0' }));

      await service.run();

      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledTimes(1);
      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledWith('repo-uuid-2', 'v2.0.0');
    });

    it('should notify for each repo with a new release', async () => {
      const mockRepo2 = { ...mockRepo, id: 'repo-uuid-2', repo: 'owner/repo2', last_seen_tag: 'v3.0.0' };

      vi.mocked(dataAdapter.getAllRepos).mockResolvedValue([mockRepo, mockRepo2]);
      vi.spyOn(repoTagFetcher, 'getTags')
        .mockResolvedValueOnce(E.right({ currentRepo: mockRepo, latestTag: 'v2.0.0' }))
        .mockResolvedValueOnce(E.right({ currentRepo: mockRepo2, latestTag: 'v4.0.0' }));

      await service.run();

      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledTimes(2);
      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledWith('repo-uuid', 'v2.0.0');
      expect(dataAdapter.notifyNewRelease).toHaveBeenCalledWith('repo-uuid-2', 'v4.0.0');
    });
  });
});
