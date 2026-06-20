import { internalRouter } from '@scanner/routes/internal.router';
import { errorHandler } from '@shared/utils';
import express from 'express';

export const server = express();

server.use(express.json());

server.get('/', (_req, res) => {
  res.json({ message: 'Hello World!' });
});

server.use('/internal', internalRouter);
server.use(errorHandler);
