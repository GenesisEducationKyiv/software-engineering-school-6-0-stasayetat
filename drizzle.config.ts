import { env } from '@shared/env';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.POSTGRES_URL,
  },
});
