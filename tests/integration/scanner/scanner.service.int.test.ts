import { RepoRepository } from '@notifier/subscription/repository/repo.repository';
import { ScannerService } from '@scanner';
import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { TagFetcher } from '@shared/apis/tags-fetcher.interface';
import { db, repos, subscriptions } from '@shared/db';
import { E } from '@shared/either';
import { DomainErrorCode, TagsResponse } from '@shared/types';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyNewRelease = vi.fn().mockResolvedValue(undefined);

const seedRepo = async (repo: string, lastSeenTag: string) => {
  const [newRepo] = await db.insert(repos).values({ repo, last_seen_tag: lastSeenTag }).returning();

  return newRepo;
};

const seedConfirmedSubscription = async (email: string, repoId: string) => {
  const [sub] = await db.insert(subscriptions).values({ email, repoId, confirmed: true }).returning();

  return sub;
};

describe('ScannerService (integration)', () => {
  let service: ScannerService;
  let mockTagFetcher: TagFetcher;

  afterAll(async () => {
    await db.delete(subscriptions);
    await db.delete(repos);
    await db.$client.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    await db.delete(subscriptions);
    await db.delete(repos);

    mockTagFetcher = {
      getTags: vi.fn(),
    };

    const repoRepository = new RepoRepository();

    service = new ScannerService(
      {
        getAllRepos: () => repoRepository.getAllRepos(),
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
      const repo = await seedRepo('facebook/react', 'v1.0.0');
      await seedConfirmedSubscription('test@gmail.com', repo.id);

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(
        E.right([{ name: 'v1.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });

    it('should notify when new release found', async () => {
      const repo = await seedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(
        E.right([{ name: 'v2.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo.id, 'v2.0.0');
    });

    it('should skip repo if github fetch fails and continue with others', async () => {
      const repo1 = await seedRepo('facebook/react', 'v1.0.0');
      const repo2 = await seedRepo('microsoft/typescript', 'v4.0.0');
      await seedConfirmedSubscription('test@gmail.com', repo1.id);
      await seedConfirmedSubscription('test@gmail.com', repo2.id);

      vi.mocked(mockTagFetcher.getTags)
        .mockResolvedValueOnce(E.left({ code: DomainErrorCode.GITHUB_API_ERROR, message: 'Error' }))
        .mockResolvedValueOnce(E.right([{ name: 'v5.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledTimes(1);
      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo2.id, 'v5.0.0');
    });

    it('should not notify if no repos have new releases', async () => {
      await seedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(
        E.right([{ name: 'v1.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });
  });
});
