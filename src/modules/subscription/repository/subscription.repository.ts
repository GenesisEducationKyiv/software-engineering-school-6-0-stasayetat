import { db, repos, subscriptions } from '@shared/db';
import { Subscription } from '@shared/types';
import { and, eq, inArray } from 'drizzle-orm';

export class SubscriptionRepository {
  async createNewSubscription(email: string, repoId: string) {
    const [newSubscription] = await db.insert(subscriptions).values({ email, repoId }).returning();

    return newSubscription;
  }

  async confirmSubscription(subscription: Subscription) {
    await db.update(subscriptions).set({ confirmed: true }).where(eq(subscriptions.id, subscription.id));
  }

  async removeSubscription(subscription: Subscription) {
    await db.delete(subscriptions).where(eq(subscriptions.id, subscription.id));
  }

  getAllActiveSubscriptionByEmail(email: string) {
    return db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.email, email), eq(subscriptions.confirmed, true)))
      .innerJoin(repos, eq(subscriptions.repoId, repos.id));
  }

  async getSubscriptionByEmailAndRepoId(email: string, repoId: string): Promise<Subscription | null> {
    const [found] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.email, email), eq(subscriptions.repoId, repoId)))
      .limit(1);

    return found ?? null;
  }

  async getSubscriptionByToken(token: string, isConfirmed: boolean): Promise<Subscription | null> {
    const [found] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.token, token), eq(subscriptions.confirmed, isConfirmed)))
      .limit(1);

    return found ?? null;
  }

  getSubscriptionsByRepoIds(repoIds: string[]): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(and(inArray(subscriptions.repoId, repoIds), eq(subscriptions.confirmed, true)));
  }

  countByRepoId(repoId: string): Promise<number> {
    return db.$count(subscriptions, eq(subscriptions.repoId, repoId));
  }
}
