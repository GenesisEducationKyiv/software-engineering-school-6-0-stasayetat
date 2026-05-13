import { TagFetcher } from '@shared/apis/tags-fetcher.interface';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { githubApiDuration, githubApiRequestsTotal } from '@shared/metrics/github.metrics';
import { getOrSet } from '@shared/redis';
import { ApiResponseException, ApiResponseExceptionCode, E, TagsResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils';
import { resolveRetryAfterMs } from '@shared/utils/github.utils';
import axios, { AxiosRequestConfig } from 'axios';
import ms from 'ms';
import { injectable } from 'tsyringe';

@injectable()
export class GithubApiClient implements TagFetcher {
  private readonly baseUrl = 'https://api.github.com';

  private readonly GITHUB_AUTH_HEADERS: AxiosRequestConfig = {
    validateStatus: status => [200, 404, 429].includes(status),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
  };

  getTags = (repo: string): Promise<E.Either<ApiResponseException, TagsResponse>> => {
    return getOrSet(
      `github:tags:${repo}`,
      ms('10 minutes'),
      () => this.getSimple<TagsResponse>(`/repos/${repo}/tags`),
      either => E.isRight(either),
    );
  };

  getSimple = async <T>(path: string): Promise<E.Either<ApiResponseException, T>> => {
    const end = githubApiDuration.startTimer();

    try {
      const response = await axios.get<T>(this.baseUrl + path, this.GITHUB_AUTH_HEADERS);

      if (response.status === 429) {
        const retryAfterMs = resolveRetryAfterMs(response);

        githubApiRequestsTotal.inc({ status: 'rate_limited' });
        end({ status: 'rate_limited' });

        return E.left({
          code: ApiResponseExceptionCode.RATE_LIMIT,
          body: `Retry after ${retryAfterMs}ms`,
          message: `GitHub API rate limit exceeded. Retry after ${retryAfterMs}ms`,
        });
      }

      if (response.status === 404) {
        githubApiRequestsTotal.inc({ status: 'failed' });
        end({ status: 'rate_limited' });

        return E.left({ code: ApiResponseExceptionCode.NOT_FOUND, message: JSON.stringify(response.data) });
      }

      githubApiRequestsTotal.inc({ status: 'success' });
      end({ status: 'success' });

      return E.right(response.data);
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      githubApiRequestsTotal.inc({ status: 'error' });

      logger.error(`Error getting latest release: ${message}`);

      return E.left({ code: ApiResponseExceptionCode.GENERAL_FAILURE, message });
    }
  };
}
