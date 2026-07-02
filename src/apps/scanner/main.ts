import 'reflect-metadata';
import './container';

import { ScannerService } from '@scanner/service/scanner.service';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { RabbitMQClient } from '@shared/rabbitmq';
import cron from 'node-cron';
import { container } from 'tsyringe';

import { startGrpcServer } from './grpc/grpc.server';
import { server } from './server';

process.on('unhandledRejection', reason => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error.message}`);
});

async function bootstrap() {
  logger.info(`Scanner service starting. API target: ${env.NOTIFIER_API_URL}`);

  const rabbitMQClient = container.resolve(RabbitMQClient);
  await rabbitMQClient.connect();
  logger.info('RabbitMQ connected');

  const scanner = container.resolve(ScannerService);

  server.listen(env.SCANNER_PORT, err => {
    if (err) {
      logger.error(err.message);
    } else {
      logger.info('Scanner server started on port: ' + env.SCANNER_PORT);
    }
  });

  startGrpcServer(env.SCANNER_GRPC_PORT);

  const task = cron.schedule('*/30 * * * *', async () => {
    await scanner.run();
  });

  void task.start();
  void scanner.run();

  logger.info('Scanner service started');
}

void bootstrap();
