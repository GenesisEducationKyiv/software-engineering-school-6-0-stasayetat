import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

void (async () => {
  const client = postgres(env.SCANNER_POSTGRES_URL, {
    onnotice: () => {},
  });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './migrations-scanner' });
  await client.end();

  logger.info('Scanner migrations complete');
})();
