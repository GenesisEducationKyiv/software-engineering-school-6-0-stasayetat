import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { ConfirmDto, GetSubscriptionsDto, SubscribeDto, UnsubscribeDto } from '@shared/dtos';
import { validateBody, validateParams, validateQuery } from '@shared/middlewares';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { unpackOrThrowException } from '@shared/utils';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

const getSubscriptionService = () => container.resolve(SubscriptionService);

export const subscriptionRouter = Router();

subscriptionRouter.post(
  '/subscribe',
  apiKeyMiddleware,
  validateBody(SubscribeDto),
  async (req: Request, res: Response) => {
    const { email, repo } = req.body as SubscribeDto;

    const subscribeResultEither = await getSubscriptionService().subscribe(email, repo);

    unpackOrThrowException(subscribeResultEither);

    return res.status(201).json({ message: 'Email notification sent' });
  },
);

subscriptionRouter.get('/confirm/:token', validateParams(ConfirmDto), async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };

  const confirmSubscriptionEither = await getSubscriptionService().confirmSubscribe(token);

  unpackOrThrowException(confirmSubscriptionEither);

  return res.status(200).json({ message: 'Subscription confirmed successfully' });
});

subscriptionRouter.get('/unsubscribe/:token', validateParams(UnsubscribeDto), async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };

  const confirmUnsubscriptionEither = await getSubscriptionService().confirmUnsubscribe(token);

  unpackOrThrowException(confirmUnsubscriptionEither);

  return res.status(200).json({ message: 'Subscription removed successfully' });
});

subscriptionRouter.get(
  '/subscriptions',
  apiKeyMiddleware,
  validateQuery(GetSubscriptionsDto),
  async (req: Request, res: Response) => {
    const { email } = req.query as { email: string };

    const allSubscriptionsEither = await getSubscriptionService().getAllSubscriptionsByEmail(email);

    const data = unpackOrThrowException(allSubscriptionsEither);

    return res.status(200).json({ data });
  },
);
