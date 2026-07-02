import { ScannerService } from '@scanner';
import { scannerDb, trackedRepos } from '@scanner/db';
import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { TagFetcher } from '@shared/apis/tags-fetcher.interface';
import { E } from '@shared/either';
import { DomainErrorCode, TagsResponse } from '@shared/types';
import { randomUUID } from 'crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyNewRelease = vi.fn().mockResolvedValue(undefined);

const seedTrackedRepo = async (repo: string, lastSeenTag: string) => {
  const [newRepo] = await scannerDb.insert(trackedRepos).values({ id: randomUUID(), repo, last_seen_tag: lastSeenTag }).returning();

  return newRepo;
};

describe('ScannerService (integration)', () => {
  let service: ScannerService;
  let mockTagFetcher: TagFetcher;

  afterAll(async () => {
    await scannerDb.delete(trackedRepos);
    await scannerDb.$client.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    await scannerDb.delete(trackedRepos);

    mockTagFetcher = {
      getTags: vi.fn(),
    };

    const trackedRepoRepository = new TrackedRepoRepository();

    service = new ScannerService(
      {
        getAllRepos: () => trackedRepoRepository.getAllRepos(),
        notifyNewRelease: mockNotifyNewRelease,
      } as unknown as ScannerDataFetcher,
      new RepoTagFetcher(mockTagFetcher),
    );
  });

  describe('run', () => {
    it('should return early if no repos in DB', async () => {
      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v1.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });

    it('should notify when new release found', async () => {
      const repo = await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v2.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo.id, 'v2.0.0');
    });

    it('should skip repo if github fetch fails and continue with others', async () => {
      await seedTrackedRepo('facebook/react', 'v1.0.0');
      const repo2 = await seedTrackedRepo('microsoft/typescript', 'v4.0.0');

      vi.mocked(mockTagFetcher.getTags)
        .mockResolvedValueOnce(E.left({ code: DomainErrorCode.GITHUB_API_ERROR, message: 'Error' }))
        .mockResolvedValueOnce(E.right([{ name: 'v5.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledTimes(1);
      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo2.id, 'v5.0.0');
    });

    it('should not notify if no repos have new releases', async () => {
      await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v1.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });
  });
});
