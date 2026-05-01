import { Request, Response, Router } from 'express';

import { register } from './metrics.registry';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
