import { AxiosResponse } from 'axios';
import ms from 'ms';

export const resolveRetryAfterMs = (response: AxiosResponse): number => {
  const retryAfter = response.headers['retry-after'] as string | undefined;

  if (retryAfter) {
    return Number(retryAfter) * 1000;
  }

  const resetAt = response.headers['x-ratelimit-reset'] as string | undefined;

  if (resetAt) {
    return Math.max(0, Number(resetAt) * 1000 - Date.now());
  }

  return ms('1 minute');
};
