import { GetSubscribersQueryDto, UpdateTagBodyDto, UpdateTagParamDto } from '@notifier/dtos';
import { validateBody, validateParams, validateQuery } from '@notifier/middlewares';
import { IRepoRepository, REPO_REPOSITORY } from '@notifier/subscription/repository/repo.repository.interface';
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@notifier/subscription/repository/subscription.repository.interface';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

export const internalRouter = Router();

internalRouter.use(apiKeyMiddleware);

internalRouter.get('/subscribers', validateQuery(GetSubscribersQueryDto), async (req: Request, res: Response) => {
  const repoIds = (req.query['repoIds'] as string).split(',');

  const subscriptionRepository = container.resolve<ISubscriptionRepository>(SUBSCRIPTION_REPOSITORY);
  const subscribers = await subscriptionRepository.getSubscriptionsByRepoIds(repoIds);

  res.json({ data: subscribers });
});

internalRouter.patch(
  '/repos/:id/tag',
  validateParams(UpdateTagParamDto),
  validateBody(UpdateTagBodyDto),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { tag } = req.body as UpdateTagBodyDto;

    const repoRepository = container.resolve<IRepoRepository>(REPO_REPOSITORY);
    await repoRepository.updateLastSeenTag(id, tag);

    res.json({ message: 'Tag updated' });
  },
);
