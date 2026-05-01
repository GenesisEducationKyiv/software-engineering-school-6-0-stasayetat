import { hasNewRelease } from '@modules/scanner';
import { describe, expect, it } from 'vitest';

const mockRepo = {
  id: 'repo-uuid',
  repo: 'owner/repo',
  last_seen_tag: 'v1.0.0',
  checkedAt: new Date(),
};

describe('hasNewRelease', () => {
  it('should return true when tags differ', () => {
    const result = hasNewRelease({
      currentRepo: mockRepo,
      latestTag: 'v2.0.0',
    });

    expect(result).toBe(true);
  });

  it('should return false when tags are the same', () => {
    const result = hasNewRelease({
      currentRepo: mockRepo,
      latestTag: 'v1.0.0',
    });

    expect(result).toBe(false);
  });
});
