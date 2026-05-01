import { CoerceStringToBoolean } from '@shared/utils';
import zod from 'zod';

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
});
