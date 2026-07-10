import { db } from '@shared/db';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { launchTestContainers } from '@shared/tests/launch-testcontainers';
import { postgresContainer } from '@shared/tests/testcontainers/postgres.container';
import { redisContainer } from '@shared/tests/testcontainers/redis.container';
import { scannerPostgresContainer } from '@shared/tests/testcontainers/scanner-postgres.container';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

let runningContainers: void | (() => any);

export const spinUpDockerContainers = async () => {
  runningContainers = await launchTestContainers([redisContainer, postgresContainer, scannerPostgresContainer]).catch(
    (error: unknown) => {
      logger.error('Error launching test containers', { error });
    },
  );

  logger.info(`all containers launched`);

  await migrate(db, { migrationsFolder: './migrations' });

  const scannerClient = postgres(env.SCANNER_POSTGRES_URL);
  await migrate(drizzle(scannerClient), { migrationsFolder: './migrations-scanner' });
  await scannerClient.end();

  logger.info('migrations applied');
};

export const tearDownAllDependencies = async () => {
  if (!runningContainers) {
    return;
  }

  logger.info(`stopping all test docker containers`);

  await runningContainers();
};
