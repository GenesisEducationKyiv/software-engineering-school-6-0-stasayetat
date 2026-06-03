import { subscriptionRouter } from '@notifier/subscription';
import { env } from '@shared/env';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('tsyringe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tsyringe')>();

  const mockSubscriptionService = {
    subscribe: vi.fn(),
    confirmSubscribe: vi.fn(),
    confirmUnsubscribe: vi.fn(),
    getAllSubscriptionsByEmail: vi.fn()
  };

  return {
    ...actual,
    container: {
      resolve: vi.fn().mockReturnValue(mockSubscriptionService),
    },
  };
});

const app = express();
app.use(express.json());
app.use('/notifier', subscriptionRouter);

const authed = (req: request.Test) => req.set('x-api-key', env.APP_API_KEY);

describe('POST /notifier/subscribe', () => {
  it('should return 400 for invalid notification', async () => {
    const res = await authed(request(app).post('/api/subscribe'))
      .send({ email: 'not-an-notification', repo: 'owner/repo' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid repo format', async () => {
    const res = await authed(request(app).post('/api/subscribe'))
      .send({ email: 'test@gmail.com', repo: 'invalid-repo' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing fields', async () => {
    const res = await authed(request(app).post('/api/subscribe'))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /notifier/confirm/:token', () => {
  it('should return 400 for invalid token', async () => {
    const res = await request(app)
      .get('/api/confirm/not-a-uuid');

    expect(res.status).toBe(400);
  });
});

describe('GET /notifier/unsubscribe/:token', () => {
  it('should return 400 for invalid token', async () => {
    const res = await request(app)
      .get('/api/unsubscribe/not-a-uuid');

    expect(res.status).toBe(400);
  });
});

describe('GET /notifier/subscriptions', () => {
  it('should return 400 for invalid notification', async () => {
    const res = await authed(request(app).get('/api/subscriptions?email=not-an-notification'));
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing notification', async () => {
    const res = await authed(request(app).get('/api/subscriptions'));
    expect(res.status).toBe(400);
  });
});

describe('Auth middleware — x-notifier-key', () => {
  it('should return 401 for POST /notifier/subscribe without API key', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .send({ email: 'test@gmail.com', repo: 'owner/repo' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /notifier/subscribe with wrong API key', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('x-api-key', 'wrong-key')
      .send({ email: 'test@gmail.com', repo: 'owner/repo' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /notifier/subscriptions without API key', async () => {
    const res = await request(app)
      .get('/api/subscriptions?email=test@gmail.com');

    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /notifier/subscriptions with wrong API key', async () => {
    const res = await request(app)
      .get('/api/subscriptions?email=test@gmail.com')
      .set('x-api-key', 'wrong-key');

    expect(res.status).toBe(401);
  });
});
