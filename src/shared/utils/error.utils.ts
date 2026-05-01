import { logger } from '@shared/logger';
import { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const message = getErrorMessage(err);

  logger.error(message);

  res.status(500).json({ message: 'Internal server error' });
};

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Unknown');
