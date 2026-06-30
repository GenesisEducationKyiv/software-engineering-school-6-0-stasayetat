import { TrackedRepository } from '@scanner/db';

export const TRACKED_REPO_REPOSITORY = Symbol.for('TrackedRepoRepository');

export interface ITrackedRepoRepository {
  getAllRepos(): Promise<TrackedRepository[]>;
  updateLastSeenTag(repoId: string, tag: string): Promise<void>;
  track(id: string, repo: string, lastSeenTag: string): Promise<TrackedRepository>;
  untrack(repoId: string): Promise<void>;
}
