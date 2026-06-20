import { ScannerApiClient } from '@notifier/subscription/saga/scanner-api.client';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

vi.mock('axios');

describe('ScannerApiClient', () => {
  it('posts to the enroll endpoint', async () => {
    const post = vi.fn().mockResolvedValue({ status: 201 });
    vi.mocked(axios.create).mockReturnValue({ post, delete: vi.fn() } as any);

    const client = new ScannerApiClient();
    await client.enrollRepo('repo-1', 'owner/repo', 'v1.0.0');

    expect(post).toHaveBeenCalledWith('/internal/repos/enroll', { id: 'repo-1', repo: 'owner/repo', lastSeenTag: 'v1.0.0' });
  });

  it('deletes the unenroll endpoint', async () => {
    const del = vi.fn().mockResolvedValue({ status: 200 });
    vi.mocked(axios.create).mockReturnValue({ post: vi.fn(), delete: del } as any);

    const client = new ScannerApiClient();
    await client.unenrollRepo('repo-1');

    expect(del).toHaveBeenCalledWith('/internal/repos/repo-1');
  });
});
