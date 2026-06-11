import 'reflect-metadata';
import './container';

import { ScannerService } from '@scanner/service/scanner.service';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import cron from 'node-cron';
import { container } from 'tsyringe';

process.on('unhandledRejection', reason => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error.message}`);
});

function bootstrap() {
  logger.info(`Scanner service starting. API target: ${env.NOTIFIER_API_URL}`);

  const scanner = container.resolve(ScannerService);

  const task = cron.schedule('*/30 * * * *', async () => {
    await scanner.run();
  });

  void task.start();
  void scanner.run();

  logger.info('Scanner service started');
}

void bootstrap();
