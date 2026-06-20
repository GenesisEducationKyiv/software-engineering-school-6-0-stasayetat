import { ITrackedRepoRepository, TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

export const internalRouter = Router();

internalRouter.use(apiKeyMiddleware);

internalRouter.post('/repos/enroll', async (req: Request, res: Response) => {
  const { id, repo, lastSeenTag } = req.body as { id: string; repo: string; lastSeenTag: string };

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  const enrolled = await trackedRepoRepository.enroll(id, repo, lastSeenTag);

  res.status(201).json({ data: enrolled });
});

internalRouter.delete('/repos/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  await trackedRepoRepository.unenroll(id);

  res.json({ message: 'Repo unenrolled' });
});
