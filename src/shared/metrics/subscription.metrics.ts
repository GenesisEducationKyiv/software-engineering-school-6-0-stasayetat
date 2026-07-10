import { Counter, Gauge, Histogram } from 'prom-client';

export const subscriptionOperationDuration = new Histogram({
  name: 'subscription_operation_duration_seconds',
  help: 'Duration of subscription operations in seconds',
  labelNames: ['type'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

export const activeSubscriptionCount = new Gauge({
  name: 'active_subscriptions_count',
  help: 'Current number of active subscriptions',
});

export const subscriptionsTotal = new Counter({
  name: 'subscriptions_total',
  help: 'Total number of subscriptions',
  labelNames: ['status'],
});

export const totalReposCount = new Gauge({
  name: 'total_repos_count',
  help: 'Current number of repos',
});
