import { redis } from './redis.client';

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
  shouldCache: (result: T) => boolean = () => true,
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as T;
  }

  const result = await fn();

  if (shouldCache(result)) {
    await redis.set(key, JSON.stringify(result), 'PX', ttlSeconds);
  }

  return result;
}
