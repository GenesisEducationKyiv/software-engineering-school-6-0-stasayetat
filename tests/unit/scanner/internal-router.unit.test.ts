import { TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { internalRouter } from '@scanner/routes/internal.router';
import { env } from '@shared/env';
import express from 'express';
import request from 'supertest';
import { container } from 'tsyringe';
import { describe, expect, it, vi } from 'vitest';

describe('scanner internal router', () => {
  const app = express();
  app.use(express.json());
  app.use('/internal', internalRouter);

  it('rejects requests without a valid api key', async () => {
    const response = await request(app).post('/internal/repos/track').send({ id: 'a', repo: 'b', lastSeenTag: 'v1' });

    expect(response.status).toBe(401);
  });

  it('tracks a repo', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const track = vi.fn().mockResolvedValue({ id, repo: 'owner/repo', last_seen_tag: 'v1', checkedAt: new Date() });
    container.registerInstance(TRACKED_REPO_REPOSITORY, { track, untrack: vi.fn() } as any);

    const response = await request(app)
      .post('/internal/repos/track')
      .set('x-api-key', env.APP_API_KEY)
      .send({ id, repo: 'owner/repo', lastSeenTag: 'v1' });

    expect(response.status).toBe(201);
    expect(track).toHaveBeenCalledWith(id, 'owner/repo', 'v1');
  });

  it('untracks a repo', async () => {
    const untrack = vi.fn().mockResolvedValue(undefined);
    container.registerInstance(TRACKED_REPO_REPOSITORY, { track: vi.fn(), untrack } as any);

    const response = await request(app).delete('/internal/repos/a').set('x-api-key', env.APP_API_KEY);

    expect(response.status).toBe(200);
    expect(untrack).toHaveBeenCalledWith('a');
  });
});
