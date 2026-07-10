import { env } from '@shared/env';
import client from 'prom-client';

import { name, version } from '../../../package.json';

client.register.setDefaultLabels({
  appName: name,
  envName: env.NODE_ENV,
  version,
});

client.collectDefaultMetrics();

export const register = client.register;
