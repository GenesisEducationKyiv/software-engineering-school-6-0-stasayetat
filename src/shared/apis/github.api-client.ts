import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { githubApiDuration, githubApiRequestsTotal } from '@shared/metrics/github.metrics';
import { getOrSet } from '@shared/redis';
import { ApiResponse, E, TagsResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils';
import { resolveRetryAfterMs } from '@shared/utils/github.utils';
import axios, { AxiosRequestConfig } from 'axios';
import ms from 'ms';

export namespace GithubApiClient {
  const baseUrl = 'https://api.github.com';

  const GITHUB_AUTH_HEADERS: AxiosRequestConfig = {
    validateStatus: status => [200, 404, 429].includes(status),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
  };

  export const getTags = (repo: string): Promise<E.Either<ApiResponse, TagsResponse>> => {
    return getOrSet(
      `github:tags:${repo}`,
      ms('10 minutes'),
      () => getSimple<TagsResponse>(`/repos/${repo}/tags`),
      either => E.isRight(either),
    );
  };

  const getSimple = async <T>(path: string): Promise<E.Either<ApiResponse, T>> => {
    const end = githubApiDuration.startTimer();

    try {
      const response = await axios.get<T>(baseUrl + path, GITHUB_AUTH_HEADERS);

      if (response.status === 429) {
        const retryAfterMs = resolveRetryAfterMs(response);

        githubApiRequestsTotal.inc({ status: 'rate_limited' });
        end({ status: 'rate_limited' });

        return E.left({
          status: 429,
          retryAfterMs,
          message: `GitHub API rate limit exceeded. Retry after ${retryAfterMs}ms`,
        });
      }

      if (response.status !== 200) {
        githubApiRequestsTotal.inc({ status: 'failed' });
        end({ status: 'rate_limited' });

        return E.left({ status: response.status, message: JSON.stringify(response.data) });
      }

      githubApiRequestsTotal.inc({ status: 'success' });
      end({ status: 'success' });

      return E.right(response.data);
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      githubApiRequestsTotal.inc({ status: 'error' });

      logger.error(`Error getting latest release: ${message}`);

      return E.left({ status: 500, message });
    }
  };
}
