import { env } from '@shared/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(env.SCANNER_POSTGRES_URL);
export const scannerDb = drizzle(client);
