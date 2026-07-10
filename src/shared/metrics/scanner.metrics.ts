import { Counter, exponentialBuckets, Histogram } from 'prom-client';

export const scannerRunsTotal = new Counter({
  name: 'scanner_runs_total',
  help: 'Total number of scanner runs',
  labelNames: ['status'],
});

export const scannerRunDuration = new Histogram({
  name: 'scanner_run_duration_seconds',
  help: 'Duration of scanner run in seconds',
  buckets: exponentialBuckets(1, 5, 10),
});
