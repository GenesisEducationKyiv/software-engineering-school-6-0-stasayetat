import path from 'path';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    include: ['tests/**/*.unit.{spec,test}.ts'],
    env: {
      DOTENV_CONFIG_PATH: 'profiles/.env.test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'json'],
      reportOnFailure: true,
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
});

export default config;
