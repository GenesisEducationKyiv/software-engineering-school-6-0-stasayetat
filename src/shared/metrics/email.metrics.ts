import { Counter, Histogram } from 'prom-client';

export const emailSentTotal = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of email sent',
  labelNames: ['type', 'status'],
});

export const emailSendDuration = new Histogram({
  name: 'email_send_duration_seconds',
  help: 'Duration of email send operations in seconds',
  labelNames: ['type'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
