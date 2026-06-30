import { scannerDb } from '@scanner/db';
import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@scanner/db', () => ({
  scannerDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  trackedRepos: { id: 'id', repo: 'repo', last_seen_tag: 'last_seen_tag', checkedAt: 'checkedAt' },
}));

describe('TrackedRepoRepository', () => {
  it('track upserts on conflicting id', async () => {
    const repository = new TrackedRepoRepository();
    const onConflictDoUpdate = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'repo-1', repo: 'owner/repo', last_seen_tag: 'v1', checkedAt: new Date() }]),
    });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    vi.mocked(scannerDb.insert).mockReturnValue({ values } as any);

    const result = await repository.track('repo-1', 'owner/repo', 'v1');

    expect(values).toHaveBeenCalledWith({ id: 'repo-1', repo: 'owner/repo', last_seen_tag: 'v1' });
    expect(result.id).toBe('repo-1');
  });
});
