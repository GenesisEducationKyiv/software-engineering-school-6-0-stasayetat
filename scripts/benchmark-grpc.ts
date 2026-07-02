import { env } from '@shared/env';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

import { trackedRepos } from '../src/apps/scanner/db/schema';

const protoPath = path.resolve(__dirname, '../src/apps/scanner/grpc/tracked_repo.proto');

const payloads = Array.from({ length: 5000 }, () => {
  const id = randomUUID();

  return { id, repo: `bench/${id}`, lastSeenTag: 'v1.0.0' };
});

const dataFile = path.resolve(__dirname, '.bench-grpc-data.json');
fs.writeFileSync(dataFile, JSON.stringify(payloads));

const result = spawnSync(
  'ghz',
  [
    '--insecure',
    '--proto',
    protoPath,
    '--call',
    'trackedrepo.v1.TrackedRepoService.TrackRepo',
    '--data-file',
    dataFile,
    '-m',
    JSON.stringify({ 'x-api-key': env.APP_API_KEY }),
    '-c',
    '50',
    '-z',
    '20s',
    `localhost:${env.SCANNER_GRPC_PORT}`,
  ],
  { stdio: 'inherit' },
);

fs.unlinkSync(dataFile);

if (result.error) {
  // eslint-disable-next-line no-console
  console.error('ghz is required on PATH. Install: https://github.com/bojand/ghz/releases');
  process.exitCode = 1;
}

void (async () => {
  const client = postgres(env.SCANNER_POSTGRES_URL);
  const db = drizzle(client);
  await db.delete(trackedRepos).where(like(trackedRepos.repo, 'bench/%'));
  await client.end();
})();
