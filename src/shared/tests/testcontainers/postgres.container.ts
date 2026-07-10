import { env } from '@shared/env';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const { pathname, password, username } = new URL(env.POSTGRES_URL);

export const postgresContainer = new PostgreSqlContainer('postgres:16-alpine')
  .withExposedPorts({
    container: 5432,
    host: 5432,
  })
  .withNetworkAliases('postgres')
  .withDatabase(pathname.substring(1))
  .withUsername(username)
  .withPassword(password);
