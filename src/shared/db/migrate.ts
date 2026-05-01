import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

void (async () => {
  const client = postgres(env.POSTGRES_URL, {
    onnotice: () => {},
  });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './migrations' });
  await client.end();

  logger.info('Migrations complete');
})();
