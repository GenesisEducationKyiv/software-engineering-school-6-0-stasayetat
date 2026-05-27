import { createConsoleTransport } from '@shared/logger/transports/console.transport';
import { createElasticTransport } from '@shared/logger/transports/elastic.transport';
import winston from 'winston';

export const logger = winston.createLogger({
  transports: [createConsoleTransport(), createElasticTransport()],
});
