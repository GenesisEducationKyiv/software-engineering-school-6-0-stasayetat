import { env } from '@shared/env';
import { RedisContainer } from '@testcontainers/redis';

const { port } = new URL(env.REDIS_URL);

process.env.REDIS_CONNECT_URL = `redis://127.0.0.1:${port}`;

export const redisContainer = new RedisContainer('redis:7-alpine')
  .withExposedPorts({
    container: 6379,
    host: Number(port),
  })
  .withNetworkAliases('redis')
  .withCommand(['redis-server']);
