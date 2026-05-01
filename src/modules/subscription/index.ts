import { SubscriptionService } from './service/subscription.service';

export * from './service/subscription.service';
export * from './subscription.controller';

export const subscriptionService = new SubscriptionService();
