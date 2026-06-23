import zod from 'zod';

import { CoerceStringToBoolean } from '../utils/zod.utils';

export const EnvironmentSchema = zod.object({
  PORT: zod.coerce.number(),
  GRPC_PORT: zod.coerce.number(),
  NODE_ENV: zod.enum(['development', 'production', 'test', 'ci']),
  APP_URL: zod.string(),
  POSTGRES_URL: zod.string(),
  GITHUB_AUTH_TOKEN: zod.string(),
  SMTP_HOST: zod.string(),
  SMTP_PORT: zod.coerce.number(),
  SMTP_USER: zod.string(),
  SMTP_PASS: zod.string(),
  SMTP_SENDER_EMAIL: zod.string(),

  REDIS_URL: zod.string(),

  APP_API_KEY: zod.string(),

  LAUNCH_TEST_CONTAINERS: CoerceStringToBoolean,

  ELASTICSEARCH_URL: zod.string(),

  NOTIFIER_API_URL: zod.string(),
  SCANNER_API_URL: zod.string(),
  SCANNER_PORT: zod.coerce.number(),
  SCANNER_GRPC_URL: zod.string(),
  SCANNER_GRPC_PORT: zod.coerce.number(),
  SCANNER_POSTGRES_URL: zod.string(),

  RABBITMQ_URL: zod.string(),
});
