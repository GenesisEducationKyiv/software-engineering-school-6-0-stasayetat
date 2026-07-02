import { env } from '@shared/env';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/apps/scanner/db/schema.ts',
  out: './migrations-scanner',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.SCANNER_POSTGRES_URL,
  },
});
