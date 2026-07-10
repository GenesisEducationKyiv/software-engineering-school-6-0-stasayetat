/* eslint-disable no-console */
import { EnvironmentSchema } from '@shared/schemas';
import dotenvExpand from 'dotenv-expand';
import dotenvFlow from 'dotenv-flow';

if (!process.env.NODE_ENV) {
  console.log(`NODE_ENV is not set. Using default 'development'`);
  process.env.NODE_ENV = 'development';
}

const loadedEnvironments = dotenvFlow.config({
  path: `./profiles`,
  silent: true,
});

dotenvExpand.expand(loadedEnvironments);

export const env = EnvironmentSchema.parse(process.env);
