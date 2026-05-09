import { RepoScanError, RepoScanSuccess } from '@modules/scanner/scanner.types';
import { GithubApiClient } from '@shared/apis';
import { E } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import Bottleneck from 'bottleneck';
import ms from 'ms';

export class RepoTagFetcher {
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
    const tagsResponseEither = await GithubApiClient.getTags(repo.repo);

    if (E.isLeft(tagsResponseEither)) {
      return E.left({
        currentRepo: repo,
        error: tagsResponseEither.value,
      });
    }

    if (!tagsResponseEither.value.length) {
      return E.left({
        currentRepo: repo,
        error: { status: 404, message: 'Repository has no tags' },
      });
    }

    return E.right({
      currentRepo: repo,
      latestTag: tagsResponseEither.value[0].name,
    });
  }
}
