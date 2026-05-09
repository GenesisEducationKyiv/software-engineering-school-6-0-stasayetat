import { Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';

export const SUBSCRIPTION_REPOSITORY = Symbol.for('SubscriptionRepository');

export interface ISubscriptionRepository {
  createNewSubscription(email: string, repoId: string): Promise<Subscription>;
  confirmSubscription(subscription: Subscription): Promise<void>;
  removeSubscription(subscription: Subscription): Promise<void>;
  getAllActiveSubscriptionByEmail(email: string): Promise<{ repos: Repository; subscriptions: Subscription }[]>;
  getSubscriptionByEmailAndRepoId(email: string, repoId: string): Promise<Subscription | null>;
  getSubscriptionByToken(token: string, isConfirmed: boolean): Promise<Subscription | null>;
  getSubscriptionsByRepoIds(repoIds: string[]): Promise<Subscription[]>;
  countByRepoId(repoId: string): Promise<number>;
}
