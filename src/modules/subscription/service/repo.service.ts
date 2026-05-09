import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { GithubApiClient } from '@shared/apis';
import { logger } from '@shared/logger';
import { totalReposCount } from '@shared/metrics';
import { ApiResponse, E } from '@shared/types';
import { Repository } from '@shared/types/repository.types';

export class RepoService {
  constructor(private readonly repoRepository = new RepoRepository()) {}

  async findOrCreateRepo(repo: string): Promise<E.Either<ApiResponse, Repository>> {
    const foundRepo = await this.repoRepository.findByRepo(repo);

    if (foundRepo) {
      return E.right(foundRepo);
    }

    return await this.createNewRepo(repo);
  }

  async removeRepo(repoId: string) {
    await this.repoRepository.deleteRepo(repoId);

    totalReposCount.dec();
  }

  private async createNewRepo(repo: string): Promise<E.Either<ApiResponse, Repository>> {
    const tagsResponseEither = await GithubApiClient.getTags(repo);

    if (E.isLeft(tagsResponseEither)) {
      logger.info(`Something went wrong. Message: ${JSON.stringify(tagsResponseEither.value.message)}`);

      return tagsResponseEither;
    }

    const tags = tagsResponseEither.value;

    if (!tags.length) {
      return E.left({ status: 404, message: 'Repository has no tags' });
    }

    const newRepo = await this.repoRepository.createRepo(repo, tags[0].name);

    totalReposCount.inc();

    return E.right(newRepo);
  }
}
