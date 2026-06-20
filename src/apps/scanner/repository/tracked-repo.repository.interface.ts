import { TrackedRepository } from '@scanner/db';

export const TRACKED_REPO_REPOSITORY = Symbol.for('TrackedRepoRepository');

export interface ITrackedRepoRepository {
  getAllRepos(): Promise<TrackedRepository[]>;
  updateLastSeenTag(repoId: string, tag: string): Promise<void>;
  enroll(id: string, repo: string, lastSeenTag: string): Promise<TrackedRepository>;
  unenroll(repoId: string): Promise<void>;
}
