import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { REPO_REPOSITORY } from '@modules/subscription/repository/repo.repository.interface';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from '@modules/subscription/repository/subscription.repository.interface';
import { RepoService } from '@modules/subscription/service/repo.service';
import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { TagFetcher, TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { db, repos, subscriptions } from '@shared/db';
import { env } from '@shared/env';
import { NOTIFICATION_SERVICE, NotificationService } from '@shared/notification/notification-service.interface';
import { ApiResponseExceptionCode, E, TagsResponse } from '@shared/types';
import request from 'supertest';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../src/server';

const mockTagFetcher = { getTags: vi.fn() } satisfies TagFetcher;
const mockNotificationService = {
  sendConfirmationEmail: vi.fn(),
  sendReleaseNotification: vi.fn(),
} satisfies NotificationService;

container.register(TAGS_FETCHER, { useValue: mockTagFetcher });
container.register(NOTIFICATION_SERVICE, { useValue: mockNotificationService });
container.registerSingleton(REPO_REPOSITORY, RepoRepository);
container.registerSingleton(SUBSCRIPTION_REPOSITORY, SubscriptionRepository);
container.registerSingleton(RepoService);
container.registerSingleton(SubscriptionService);

const authed = (req: request.Test) => req.set('x-api-key', env.APP_API_KEY);

describe('Subscription API (integration)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete(subscriptions);
    await db.delete(repos);
    mockTagFetcher.getTags.mockResolvedValue(E.right([{ name: 'v1.0.0' }] as TagsResponse));
    mockNotificationService.sendConfirmationEmail.mockResolvedValue(E.right({ success: true }));
    mockNotificationService.sendReleaseNotification.mockResolvedValue(undefined);
  });

  describe('POST /api/subscribe', () => {
    it('returns 401 without API key', async () => {
      const res = await request(server)
        .post('/api/subscribe')
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid email', async () => {
      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'not-an-email', repo: 'owner/repo' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid repo format', async () => {
      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'invalid-repo' });
      expect(res.status).toBe(400);
    });

    it('returns 201 and creates subscription in DB', async () => {
      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });

      expect(res.status).toBe(201);

      const subsInDb = await db.select().from(subscriptions);
      expect(subsInDb).toHaveLength(1);
      expect(subsInDb[0].email).toBe('test@gmail.com');
      expect(subsInDb[0].confirmed).toBe(false);
      expect(mockNotificationService.sendConfirmationEmail).toHaveBeenCalledWith(
        'test@gmail.com',
        subsInDb[0].token,
        'owner/repo',
      );
    });

    it('returns 409 when subscription is already confirmed', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });

      const [sub] = await db.select().from(subscriptions);
      await request(server).get(`/api/confirm/${sub.token}`);

      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      expect(res.status).toBe(409);
    });

    it('returns 201 and resends email when subscription exists but not confirmed', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });

      mockNotificationService.sendConfirmationEmail.mockClear();

      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      expect(res.status).toBe(201);
      expect(mockNotificationService.sendConfirmationEmail).toHaveBeenCalledTimes(1);

      const subsInDb = await db.select().from(subscriptions);
      expect(subsInDb).toHaveLength(1);
    });

    it('returns 404 when GitHub repo does not exist', async () => {
      mockTagFetcher.getTags.mockResolvedValue(
        E.left({ code: ApiResponseExceptionCode.NOT_FOUND, message: 'Not Found' }),
      );

      const res = await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'nonexistent/repo' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/confirm/:token', () => {
    it('returns 400 for non-UUID token', async () => {
      const res = await request(server).get('/api/confirm/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown token', async () => {
      const res = await request(server).get('/api/confirm/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 200 and sets subscription as confirmed', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      const [sub] = await db.select().from(subscriptions);

      const res = await request(server).get(`/api/confirm/${sub.token}`);
      expect(res.status).toBe(200);

      const [updated] = await db.select().from(subscriptions);
      expect(updated.confirmed).toBe(true);
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('returns 400 for non-UUID token', async () => {
      const res = await request(server).get('/api/unsubscribe/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown token', async () => {
      const res = await request(server).get('/api/unsubscribe/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 200 and removes confirmed subscription', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      const [sub] = await db.select().from(subscriptions);
      await request(server).get(`/api/confirm/${sub.token}`);

      const res = await request(server).get(`/api/unsubscribe/${sub.token}`);
      expect(res.status).toBe(200);

      const subsInDb = await db.select().from(subscriptions);
      expect(subsInDb).toHaveLength(0);
    });

    it('removes repo when last subscriber unsubscribes', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      const [sub] = await db.select().from(subscriptions);
      await request(server).get(`/api/confirm/${sub.token}`);
      await request(server).get(`/api/unsubscribe/${sub.token}`);

      const reposInDb = await db.select().from(repos);
      expect(reposInDb).toHaveLength(0);
    });
  });

  describe('GET /api/subscriptions', () => {
    it('returns 401 without API key', async () => {
      const res = await request(server).get('/api/subscriptions?email=test@gmail.com');
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid email', async () => {
      const res = await authed(request(server).get('/api/subscriptions?email=not-an-email'));
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing email', async () => {
      const res = await authed(request(server).get('/api/subscriptions'));
      expect(res.status).toBe(400);
    });

    it('returns 200 with empty array when no confirmed subscriptions', async () => {
      const res = await authed(request(server).get('/api/subscriptions?email=nobody@gmail.com'));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns 200 with confirmed subscriptions only', async () => {
      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      const [sub] = await db.select().from(subscriptions);
      await request(server).get(`/api/confirm/${sub.token}`);

      await authed(request(server).post('/api/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo2' });

      const res = await authed(request(server).get('/api/subscriptions?email=test@gmail.com'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].repo).toBe('owner/repo');
    });
  });
});
