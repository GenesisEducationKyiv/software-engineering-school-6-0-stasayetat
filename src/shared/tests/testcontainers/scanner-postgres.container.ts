import { env } from '@shared/env';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const { pathname, password, username, port } = new URL(env.SCANNER_POSTGRES_URL);

export const scannerPostgresContainer = new PostgreSqlContainer('postgres:16-alpine')
  .withExposedPorts({
    container: 5432,
    host: Number(port),
  })
  .withNetworkAliases('scanner-postgres')
  .withDatabase(pathname.substring(1))
  .withUsername(username)
  .withPassword(password);
