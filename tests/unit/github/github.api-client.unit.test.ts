import { GithubApiClient } from '@shared/apis';
import { redis } from '@shared/redis';
import { E } from '@shared/types';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
vi.mock('@shared/redis/redis.client', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

const mockRelease = {
  tag_name: 'v1.0.0',
  id: 1,
  name: 'v1.0.0',
  url: 'https://api.github.com/repos/owner/repo/releases/1',
  body: '',
  created_at: new Date(),
  published_at: new Date(),
  author: { login: 'octocat', avatar_url: '' },
};

describe('GithubApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  describe('getLatestRelease', () => {
    it('should return cached result from Redis', async () => {
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ tag: 'right', value: { data: mockRelease } }));

      const result = await GithubApiClient.getTags('owner/repo');

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return right with data on success', async () => {
      vi.mocked(axios.get).mockResolvedValue({ status: 200, data: mockRelease });

      const result = await GithubApiClient.getTags('owner/repo');

      expect(result.tag).toBe('right');
    });

    it('should return left with 404 status when repo not found', async () => {
      vi.mocked(axios.get).mockResolvedValue({ status: 404, data: 'Not Found' });

      const result = await GithubApiClient.getTags('owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.status).toBe(404);
      }
    });

    it('should return left with 429 status on rate limit', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 429,
        data: {},
        headers: { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) },
      });

      const result = await GithubApiClient.getTags('owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.status).toBe(429);
      }
    });

    it('should return left on unexpected error', async () => {
      vi.mocked(axios.get).mockRejectedValue(new TypeError('Network Error'));

      const result = await GithubApiClient.getTags('owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.status).toBe(500);
      }
    });
  });
});
