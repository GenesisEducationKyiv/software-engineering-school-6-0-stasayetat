import { apiKeyMiddleware } from '@notifier/middlewares/api-key.middleware';
import { IRepoRepository, REPO_REPOSITORY } from '@notifier/subscription/repository/repo.repository.interface';
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@notifier/subscription/repository/subscription.repository.interface';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

export const internalRouter = Router();

internalRouter.use(apiKeyMiddleware);

internalRouter.get('/repos', async (_req: Request, res: Response) => {
  const repoRepository = container.resolve<IRepoRepository>(REPO_REPOSITORY);
  const repos = await repoRepository.getAllRepos();

  res.json({ data: repos });
});

internalRouter.get('/subscribers', async (req: Request, res: Response) => {
  const repoIds = ((req.query['repoIds'] as string) ?? '').split(',').filter(Boolean);

  const subscriptionRepository = container.resolve<ISubscriptionRepository>(SUBSCRIPTION_REPOSITORY);
  const subscribers = await subscriptionRepository.getSubscriptionsByRepoIds(repoIds);

  res.json({ data: subscribers });
});

internalRouter.patch('/repos/:id/tag', async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const { tag } = req.body as { tag: string };

  const repoRepository = container.resolve<IRepoRepository>(REPO_REPOSITORY);
  await repoRepository.updateLastSeenTag(id, tag);

  res.json({ message: 'Tag updated' });
});
