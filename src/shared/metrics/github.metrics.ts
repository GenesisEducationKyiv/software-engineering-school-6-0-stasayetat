import { Counter, Histogram } from 'prom-client';

export const githubApiRequestsTotal = new Counter({
  name: 'github_api_requests_total',
  help: 'Total number of GitHub API requests',
  labelNames: ['status'],
});

export const githubApiDuration = new Histogram({
  name: 'github_api_request_duration_seconds',
  help: 'Duration of GitHub API requests in seconds',
  labelNames: ['status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
