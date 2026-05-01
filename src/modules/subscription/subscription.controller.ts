import { subscriptionService } from '@modules/subscription/index';
import { ConfirmDto, GetSubscriptionsDto, SubscribeDto, UnsubscribeDto } from '@shared/dtos';
import { validateBody, validateParams, validateQuery } from '@shared/middlewares';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { Request, Response, Router } from 'express';

export const subscriptionRouter = Router();

subscriptionRouter.post(
  '/subscribe',
  apiKeyMiddleware,
  validateBody(SubscribeDto),
  async (req: Request, res: Response) => {
    const { email, repo } = req.body as SubscribeDto;

    const { status, message } = await subscriptionService.subscribe(email, repo);

    return res.status(status).json({ message });
  },
);

subscriptionRouter.get('/confirm/:token', validateParams(ConfirmDto), async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };

  const { status, message } = await subscriptionService.confirmSubscribe(token);

  return res.status(status).json({ message });
});

subscriptionRouter.get('/unsubscribe/:token', validateParams(UnsubscribeDto), async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };

  const { status, message } = await subscriptionService.confirmUnsubscribe(token);

  return res.status(status).json({ message });
});

subscriptionRouter.get(
  '/subscriptions',
  apiKeyMiddleware,
  validateQuery(GetSubscriptionsDto),
  async (req: Request, res: Response) => {
    const { email } = req.query as { email: string };

    const { status, data } = await subscriptionService.getAllSubscriptionsByEmail(email);

    return res.status(status).json({ data });
  },
);
