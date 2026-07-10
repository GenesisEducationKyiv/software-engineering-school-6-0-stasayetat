import { TagFetcher, TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { E } from '@shared/either';
import { totalReposCount } from '@shared/metrics';
import { DomainError, DomainErrorCode } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { inject, injectable } from 'tsyringe';

import { IRepoRepository, REPO_REPOSITORY } from '../repository/repo.repository.interface';

@injectable()
export class RepoService {
  constructor(
    @inject(REPO_REPOSITORY) private readonly repoRepository: IRepoRepository,
    @inject(TAGS_FETCHER) private readonly repoTagFetcher: TagFetcher,
  ) {}

  findRepo(repo: string): Promise<Repository | null> {
    return this.repoRepository.findByRepo(repo);
  }

  getRepoById(repoId: string): Promise<Repository | null> {
    return this.repoRepository.getRepoById(repoId);
  }

  async validateNewRepo(repo: string): Promise<E.Either<DomainError, string>> {
    const tagsResponseEither = await this.repoTagFetcher.getTags(repo);

    if (E.isLeft(tagsResponseEither)) {
      return tagsResponseEither;
    }

    const tags = tagsResponseEither.value;

    if (!tags.length) {
      return E.left({ code: DomainErrorCode.REPO_HAS_NO_TAGS, message: 'Repository has no tags' });
    }

    return E.right(tags[0].name);
  }

  async createRepoRecord(repo: string, lastSeenTag: string): Promise<Repository> {
    const newRepo = await this.repoRepository.createRepo(repo, lastSeenTag);

    totalReposCount.inc();

    return newRepo;
  }

  async deleteRepoRecord(repoId: string): Promise<void> {
    await this.repoRepository.deleteRepo(repoId);

    totalReposCount.dec();
  }

  async recreateRepoRecord(repo: Repository): Promise<void> {
    await this.repoRepository.recreateRepo(repo);

    totalReposCount.inc();
  }
}
