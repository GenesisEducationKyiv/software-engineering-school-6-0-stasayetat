import { Counter, Gauge } from 'prom-client';

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
