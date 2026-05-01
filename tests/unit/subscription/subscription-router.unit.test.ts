import { subscriptionRouter } from '@modules/subscription';
import { env } from '@shared/env';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const app = express();
app.use(express.json());
app.use('/api', subscriptionRouter);

const authed = (req: request.Test) => req.set('x-api-key', env.APP_API_KEY);

describe('POST /api/subscribe', () => {
  it('should return 400 for invalid email', async () => {
    const res = await authed(request(app).post('/api/subscribe'))
      .send({ email: 'not-an-email', repo: 'owner/repo' });
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

describe('GET /api/confirm/:token', () => {
  it('should return 422 for invalid token', async () => {
    const res = await request(app)
      .get('/api/confirm/not-a-uuid');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/unsubscribe/:token', () => {
  it('should return 422 for invalid token', async () => {
    const res = await request(app)
      .get('/api/unsubscribe/not-a-uuid');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/subscriptions', () => {
  it('should return 400 for invalid email', async () => {
    const res = await authed(request(app).get('/api/subscriptions?email=not-an-email'));
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing email', async () => {
    const res = await authed(request(app).get('/api/subscriptions'));
    expect(res.status).toBe(400);
  });
});

describe('Auth middleware — x-api-key', () => {
  it('should return 401 for POST /api/subscribe without API key', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .send({ email: 'test@gmail.com', repo: 'owner/repo' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /api/subscribe with wrong API key', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('x-api-key', 'wrong-key')
      .send({ email: 'test@gmail.com', repo: 'owner/repo' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /api/subscriptions without API key', async () => {
    const res = await request(app)
      .get('/api/subscriptions?email=test@gmail.com');

    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /api/subscriptions with wrong API key', async () => {
    const res = await request(app)
      .get('/api/subscriptions?email=test@gmail.com')
      .set('x-api-key', 'wrong-key');

    expect(res.status).toBe(401);
  });
});
