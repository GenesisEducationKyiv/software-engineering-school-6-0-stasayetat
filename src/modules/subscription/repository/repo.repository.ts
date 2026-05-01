import { db, repos } from '@shared/db';
import { Repository } from '@shared/types/repository.types';
import { eq } from 'drizzle-orm';

export class RepoRepository {
  async findByRepo(repo: string): Promise<Repository | null> {
    const [found] = await db.select().from(repos).where(eq(repos.repo, repo)).limit(1);

    return found ?? null;
  }

  async createRepo(repo: string, lastSeenTag: string): Promise<Repository> {
    const [newRepo] = await db.insert(repos).values({ repo, last_seen_tag: lastSeenTag }).returning();

    return newRepo;
  }

  async deleteRepo(repoId: string): Promise<void> {
    await db.delete(repos).where(eq(repos.id, repoId));
  }

  getAllRepos(): Promise<Repository[]> {
    return db.select().from(repos);
  }

  async updateLastSeenTag(repoId: string, tag: string): Promise<void> {
    await db.update(repos).set({ last_seen_tag: tag, checkedAt: new Date() }).where(eq(repos.id, repoId));
  }
}
