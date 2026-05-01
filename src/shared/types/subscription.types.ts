import { subscriptions } from '@shared/db';
import { InferSelectModel } from 'drizzle-orm';

export type Subscription = InferSelectModel<typeof subscriptions>;

export type MinifiedSubscription = {
  email: string;
  repo: string;
  confirmed: boolean;
  last_seen_tag: string;
};

export type GetSubscriptionsResponse = { status: number; data: MinifiedSubscription[] };
