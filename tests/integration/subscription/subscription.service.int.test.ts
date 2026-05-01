import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { GithubApiClient } from '@shared/apis/github.api-client';
import { db, repos, subscriptions } from '@shared/db';
import { E, TagsResponse } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/apis/github.api-client', () => ({
  GithubApiClient: {
    getTags: vi.fn(),
  },
}));

describe('SubscriptionService (integration)', () => {
  let service: SubscriptionService;

  beforeEach(async () => {
    vi.clearAllMocks();

    await db.delete(subscriptions);
    await db.delete(repos);

    vi.mocked(GithubApiClient.getTags).mockResolvedValue(
      E.right([{ name: 'v1.0.0' } ] as TagsResponse),
    );

    const mockEmailService = {
      sendConfirmationEmail: vi.fn().mockResolvedValue(E.right({ success: true })),
      sendReleaseNotification: vi.fn().mockResolvedValue(undefined),
    };

    service = new SubscriptionService(
      new SubscriptionRepository(),
      new RepoRepository(),
      mockEmailService as any,
    );
  });

  describe('subscribe', () => {
    it('should create repo and subscription in DB', async () => {
      const result = await service.subscribe('test@gmail.com', 'facebook/react');

      expect(result.status).toBe(200);

      const repoInDb = await db.select().from(repos);
      expect(repoInDb).toHaveLength(1);
      expect(repoInDb[0].repo).toBe('facebook/react');

      const subscriptionInDb = await db.select().from(subscriptions);
      expect(subscriptionInDb).toHaveLength(1);
      expect(subscriptionInDb[0].email).toBe('test@gmail.com');
      expect(subscriptionInDb[0].confirmed).toBe(false);
    });

    it('should return 409 if subscription already confirmed', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      await service.confirmSubscribe(
        (await db.select().from(subscriptions))[0].token,
      );

      const result = await service.subscribe('test@gmail.com', 'facebook/react');

      expect(result.status).toBe(409);
    });

    it('should resend confirmation if subscription exists but not confirmed', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      const result = await service.subscribe('test@gmail.com', 'facebook/react');

      expect(result.status).toBe(200);
      expect(result.message).toBe('Confirmation email resent');

      const subscriptionsInDb = await db.select().from(subscriptions);
      expect(subscriptionsInDb).toHaveLength(1);
    });

    it('should reuse existing repo for different subscribers', async () => {
      await service.subscribe('user1@gmail.com', 'facebook/react');
      await service.subscribe('user2@gmail.com', 'facebook/react');

      const reposInDb = await db.select().from(repos);
      expect(reposInDb).toHaveLength(1);

      const subscriptionsInDb = await db.select().from(subscriptions);
      expect(subscriptionsInDb).toHaveLength(2);
    });

    it('should return 404 if github repo has no releases', async () => {
      vi.mocked(GithubApiClient.getTags).mockResolvedValue(
        E.left({ status: 404, message: 'Not found' }),
      );

      const result = await service.subscribe('test@gmail.com', 'nonexistent/repo');

      expect(result.status).toBe(404);

      const reposInDb = await db.select().from(repos);
      expect(reposInDb).toHaveLength(0);
    });
  });

  describe('confirmSubscribe', () => {
    it('should confirm subscription in DB', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      const token = (await db.select().from(subscriptions))[0].token;

      const result = await service.confirmSubscribe(token);

      expect(result.status).toBe(200);

      const subscriptionInDb = (await db.select().from(subscriptions))[0];
      expect(subscriptionInDb.confirmed).toBe(true);
    });

    it('should return 404 for invalid token', async () => {
      const result = await service.confirmSubscribe('00000000-0000-0000-0000-000000000000');

      expect(result.status).toBe(404);
    });
  });

  describe('confirmUnsubscribe', () => {
    it('should remove subscription from DB', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      const token = (await db.select().from(subscriptions))[0].token;
      await service.confirmSubscribe(token);

      const unsubscribeToken = (await db.select().from(subscriptions))[0].token;
      const result = await service.confirmUnsubscribe(unsubscribeToken);

      expect(result.status).toBe(200);

      const subscriptionsInDb = await db.select().from(subscriptions);
      expect(subscriptionsInDb).toHaveLength(0);
    });

    it('should delete repo when last subscriber unsubscribes', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      const token = (await db.select().from(subscriptions))[0].token;
      await service.confirmSubscribe(token);

      const unsubscribeToken = (await db.select().from(subscriptions))[0].token;
      await service.confirmUnsubscribe(unsubscribeToken);

      const reposInDb = await db.select().from(repos);
      expect(reposInDb).toHaveLength(0);
    });

    it('should keep repo when other subscribers exist', async () => {
      await service.subscribe('user1@gmail.com', 'facebook/react');
      await service.subscribe('user2@gmail.com', 'facebook/react');

      const allSubs = await db.select().from(subscriptions);
      await service.confirmSubscribe(allSubs[0].token);
      await service.confirmUnsubscribe(allSubs[0].token);

      const reposInDb = await db.select().from(repos);
      expect(reposInDb).toHaveLength(1);
    });
  });

  describe('getAllSubscriptionsByEmail', () => {
    it('should return only confirmed subscriptions', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');
      const token = (await db.select().from(subscriptions))[0].token;
      await service.confirmSubscribe(token);

      await service.subscribe('test@gmail.com', 'microsoft/typescript');

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].repo).toBe('facebook/react');
    });

    it('should return empty array if no confirmed subscriptions', async () => {
      await service.subscribe('test@gmail.com', 'facebook/react');

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(0);
    });
  });
});
