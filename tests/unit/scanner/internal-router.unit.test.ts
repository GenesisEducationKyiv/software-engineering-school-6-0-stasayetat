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
    const response = await request(app).post('/internal/repos/enroll').send({ id: 'a', repo: 'b', lastSeenTag: 'v1' });

    expect(response.status).toBe(401);
  });

  it('enrolls a repo', async () => {
    const enroll = vi.fn().mockResolvedValue({ id: 'a', repo: 'owner/repo', last_seen_tag: 'v1', checkedAt: new Date() });
    container.registerInstance(TRACKED_REPO_REPOSITORY, { enroll, unenroll: vi.fn() } as any);

    const response = await request(app)
      .post('/internal/repos/enroll')
      .set('x-api-key', env.APP_API_KEY)
      .send({ id: 'a', repo: 'owner/repo', lastSeenTag: 'v1' });

    expect(response.status).toBe(201);
    expect(enroll).toHaveBeenCalledWith('a', 'owner/repo', 'v1');
  });

  it('unenrolls a repo', async () => {
    const unenroll = vi.fn().mockResolvedValue(undefined);
    container.registerInstance(TRACKED_REPO_REPOSITORY, { enroll: vi.fn(), unenroll } as any);

    const response = await request(app).delete('/internal/repos/a').set('x-api-key', env.APP_API_KEY);

    expect(response.status).toBe(200);
    expect(unenroll).toHaveBeenCalledWith('a');
  });
});
