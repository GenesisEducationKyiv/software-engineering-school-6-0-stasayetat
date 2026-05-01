import { db } from '@shared/db';
import { logger } from '@shared/logger';
import { launchTestContainers } from '@shared/tests/launch-testcontainers';
import { postgresContainer } from '@shared/tests/testcontainers/postgres.container';
import { redisContainer } from '@shared/tests/testcontainers/redis.container';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

let runningContainers: void | (() => any);

export const spinUpDockerContainers = async () => {
  runningContainers = await launchTestContainers([redisContainer, postgresContainer]).catch((error: unknown) => {
    logger.error('Error launching test containers', { error });
  });

  logger.info(`all containers launched`);

  await migrate(db, { migrationsFolder: './migrations' });

  logger.info('migrations applied');
};

export const tearDownAllDependencies = async () => {
  if (!runningContainers) {
    return;
  }

  logger.info(`stopping all test docker containers`);

  await runningContainers();
};
