import { TrackRepoDto } from '@scanner/dtos';
import { ITrackedRepoRepository, TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { validateBody } from '@shared/middlewares/validation.middleware';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

export const internalRouter = Router();

internalRouter.use(apiKeyMiddleware);

internalRouter.post('/repos/track', validateBody(TrackRepoDto), async (req: Request, res: Response) => {
  const { id, repo, lastSeenTag } = req.body as TrackRepoDto;

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  const tracked = await trackedRepoRepository.track(id, repo, lastSeenTag);

  res.status(201).json({ data: tracked });
});

internalRouter.delete('/repos/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  await trackedRepoRepository.untrack(id);

  res.json({ message: 'Repo untracked' });
});
