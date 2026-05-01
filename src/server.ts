import { subscriptionRouter } from '@modules/subscription';
import { metricsRouter } from '@shared/metrics';
import { errorHandler } from '@shared/utils';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./swagger.yaml') as object;

export const server = express();

server.use(cors());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.get('/', (_req, res) => {
  res.json({ message: 'Hello World' });
});

server.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
server.use('/api', subscriptionRouter);
server.use(metricsRouter);
server.use(errorHandler);
