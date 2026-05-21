import { RepoScanError, RepoScanSuccess } from '@modules/scanner/scanner.types';
import { TagFetcher, TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { E } from '@shared/either';
import { DomainErrorCode } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import Bottleneck from 'bottleneck';
import ms from 'ms';
import { inject, injectable } from 'tsyringe';

@injectable()
export class RepoTagFetcher {
  constructor(@inject(TAGS_FETCHER) private readonly tagFetcher: TagFetcher) {}

  private readonly scannerLimiter = new Bottleneck({
    reservoir: 5000,
    reservoirRefreshAmount: 5000,
    reservoirRefreshInterval: ms('1 hour'),
    maxConcurrent: 10,
  });

  getTags(repo: Repository) {
    return this.scannerLimiter.schedule(() => this.fetchTagsInfo(repo));
  }

  private async fetchTagsInfo(repo: Repository): Promise<E.Either<RepoScanError, RepoScanSuccess>> {
    const tagsResponseEither = await this.tagFetcher.getTags(repo.repo);

    if (E.isLeft(tagsResponseEither)) {
      return E.left({
        currentRepo: repo,
        error: tagsResponseEither.value,
      });
    }

    if (!tagsResponseEither.value.length) {
      return E.left({
        currentRepo: repo,
        error: { code: DomainErrorCode.REPO_HAS_NO_TAGS, message: 'Repository has no tags' },
      });
    }

    return E.right({
      currentRepo: repo,
      latestTag: tagsResponseEither.value[0].name,
    });
  }
}
