import { env } from '@shared/env';
import { NextFunction, Request, Response } from 'express';

export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.APP_API_KEY) {
    res.status(401).json({ message: 'Unauthorized' });

    return;
  }

  return next();
};
