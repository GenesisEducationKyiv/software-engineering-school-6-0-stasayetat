import 'reflect-metadata';
import './container';
import '@notifier/subscription/subscription.cron-controller';

import { db, repos, subscriptions } from '@shared/db';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { activeSubscriptionCount, totalReposCount } from '@shared/metrics';
import { count } from 'drizzle-orm';

import { startGrpcServer } from './grpc/grpc.server';
import { server } from './server';

process.on('unhandledRejection', reason => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error.message}`);
});

async function bootstrap() {
  const [{ value: subsCount }] = await db.select({ value: count() }).from(subscriptions);
  const [{ value: reposCount }] = await db.select({ value: count() }).from(repos);
  activeSubscriptionCount.set(Number(subsCount));
  totalReposCount.set(Number(reposCount));

  server.listen(env.PORT, err => {
    if (err) {
      logger.error(err.message);
    } else {
      logger.info('Notifier server started on port: ' + env.PORT);
    }
  });

  startGrpcServer(env.GRPC_PORT);
}

void bootstrap();
