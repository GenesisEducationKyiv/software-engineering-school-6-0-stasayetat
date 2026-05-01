import { ScannerService } from '@modules/scanner';
import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { GithubApiClient } from '@shared/apis/github.api-client';
import { db, repos, subscriptions } from '@shared/db';
import { E, TagsResponse } from '@shared/types';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/apis/github.api-client', () => ({
  GithubApiClient: {
    getTags: vi.fn(),
  },
}));

const mockNotifierService = {
  sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendReleaseNotification: vi.fn().mockResolvedValue(undefined),
};

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

  beforeEach(async () => {
    vi.clearAllMocks();

    await db.delete(subscriptions);
    await db.delete(repos);

    service = new ScannerService(
      new RepoRepository(),
      new SubscriptionRepository(),
      mockNotifierService as any,
    );
  });

  describe('run', () => {
    it('should return early if no repos in DB', async () => {
      await service.run();

      expect(mockNotifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      const repo = await seedRepo('facebook/react', 'v1.0.0');
      await seedConfirmedSubscription('test@gmail.com', repo.id);

      vi.mocked(GithubApiClient.getTags).mockResolvedValue(
        E.right([{ name: 'v1.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifierService.sendReleaseNotification).not.toHaveBeenCalled();

      const repoInDb = (await db.select().from(repos))[0];
      expect(repoInDb.last_seen_tag).toBe('v1.0.0');
    });

    it('should notify subscribers and update last_seen_tag when new release found', async () => {
      const repo = await seedRepo('facebook/react', 'v1.0.0');
      await seedConfirmedSubscription('test@gmail.com', repo.id);

      vi.mocked(GithubApiClient.getTags).mockResolvedValue(
        E.right([{ name: 'v2.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifierService.sendReleaseNotification).toHaveBeenCalledWith(
        'test@gmail.com',
        repo,
        'v2.0.0',
        expect.any(String),
      );

      const repoInDb = (await db.select().from(repos))[0];
      expect(repoInDb.last_seen_tag).toBe('v2.0.0');
    });

    it('should notify multiple subscribers for the same repo', async () => {
      const repo = await seedRepo('facebook/react', 'v1.0.0');
      await seedConfirmedSubscription('user1@gmail.com', repo.id);
      await seedConfirmedSubscription('user2@gmail.com', repo.id);

      vi.mocked(GithubApiClient.getTags).mockResolvedValue(
        E.right([{ name: 'v2.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifierService.sendReleaseNotification).toHaveBeenCalledTimes(2);
    });

    it('should skip repo if github api fails and continue with others', async () => {
      const repo1 = await seedRepo('facebook/react', 'v1.0.0');
      const repo2 = await seedRepo('microsoft/typescript', 'v4.0.0');
      await seedConfirmedSubscription('test@gmail.com', repo1.id);
      await seedConfirmedSubscription('test@gmail.com', repo2.id);

      vi.mocked(GithubApiClient.getTags)
        .mockResolvedValueOnce(E.left({ status: 500, message: 'Error' }))
        .mockResolvedValueOnce(E.right([{ name: 'v5.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifierService.sendReleaseNotification).toHaveBeenCalledTimes(1);
      expect(mockNotifierService.sendReleaseNotification).toHaveBeenCalledWith(
        'test@gmail.com',
        repo2,
        'v5.0.0',
        expect.any(String),
      );

      const repo2InDb = (await db.select().from(repos).where(eq(repos.id, repo2.id)))[0];
      expect(repo2InDb.last_seen_tag).toBe('v5.0.0');
    });

    it('should not notify unconfirmed subscribers', async () => {
      const repo = await seedRepo('facebook/react', 'v1.0.0');
      await db.insert(subscriptions).values({ email: 'test@gmail.com', repoId: repo.id, confirmed: false });

      vi.mocked(GithubApiClient.getTags).mockResolvedValue(
        E.right([{ name: 'v2.0.0' }] as TagsResponse),
      );

      await service.run();

      expect(mockNotifierService.sendReleaseNotification).not.toHaveBeenCalled();
    });
  });
});
