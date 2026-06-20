import path from 'path';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    setupFiles: ['tests/unit/setup.ts'],
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
      '@notifier': path.resolve(__dirname, './src/apps/notifier'),
      '@scanner': path.resolve(__dirname, './src/apps/scanner'),
    },
  },
});

export default config;
