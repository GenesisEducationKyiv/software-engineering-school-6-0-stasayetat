import { scannerDb, trackedRepos, TrackedRepository } from '@scanner/db';
import { eq } from 'drizzle-orm';
import { injectable } from 'tsyringe';

import { ITrackedRepoRepository } from './tracked-repo.repository.interface';

@injectable()
export class TrackedRepoRepository implements ITrackedRepoRepository {
  getAllRepos(): Promise<TrackedRepository[]> {
    return scannerDb.select().from(trackedRepos);
  }

  async updateLastSeenTag(repoId: string, tag: string): Promise<void> {
    await scannerDb
      .update(trackedRepos)
      .set({ last_seen_tag: tag, checkedAt: new Date() })
      .where(eq(trackedRepos.id, repoId));
  }

  async track(id: string, repo: string, lastSeenTag: string): Promise<TrackedRepository> {
    const [tracked] = await scannerDb
      .insert(trackedRepos)
      .values({ id, repo, last_seen_tag: lastSeenTag })
      .onConflictDoUpdate({
        target: trackedRepos.id,
        set: { repo, last_seen_tag: lastSeenTag },
      })
      .returning();

    return tracked;
  }

  async untrack(repoId: string): Promise<boolean> {
    const deleted = await scannerDb.delete(trackedRepos).where(eq(trackedRepos.id, repoId)).returning();

    return deleted.length > 0;
  }
}
