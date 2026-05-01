import { Counter } from 'prom-client';

export const emailSentTotal = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of email sent',
  labelNames: ['type', 'status'],
});
