import { env } from '@shared/env';
import autocannon from 'autocannon';
import { randomUUID } from 'crypto';

async function main() {
  const url = `http://localhost:${env.SCANNER_PORT}/internal/repos/track`;

  const result = await autocannon({
    url,
    method: 'POST',
    connections: 50,
    duration: 20,
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.APP_API_KEY,
    },
    setupClient: client => {
      const id = randomUUID();
      client.setBody(JSON.stringify({ id, repo: `bench/${id}`, lastSeenTag: 'v1.0.0' }));
    },
  });

  // eslint-disable-next-line no-console
  console.log(autocannon.printResult(result));
}

void main();
