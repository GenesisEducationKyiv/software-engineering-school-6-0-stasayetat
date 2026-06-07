import { Repository } from '@shared/types/repository.types';

export const REPO_REPOSITORY = Symbol.for('RepoRepository');

export interface IRepoRepository {
  findByRepo(repo: string): Promise<Repository | null>;
  getRepoById(id: string): Promise<Repository | null>;
  createRepo(repo: string, lastSeenTag: string): Promise<Repository>;
  deleteRepo(repoId: string): Promise<void>;
  getAllRepos(): Promise<Repository[]>;
  updateLastSeenTag(repoId: string, tag: string): Promise<void>;
}
