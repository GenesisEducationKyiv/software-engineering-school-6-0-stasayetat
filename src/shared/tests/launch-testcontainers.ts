import { logger } from '@shared/logger';
import { Network, StartedTestContainer, TestContainer } from 'testcontainers';

const testContainers: StartedTestContainer[] = [];

export const launchTestContainers = async (containers: TestContainer[]) => {
  try {
    logger.info('Launching test containers');

    await createNetwork();

    const startedTestContainers = await Promise.all(containers.map(container => container.start()));

    logger.info('Test containers started');

    testContainers.push(...startedTestContainers);

    return async () => {
      await Promise.all(startedTestContainers.map(container => container.stop()));
      testContainers.splice(0, testContainers.length);
    };
  } catch (error) {
    logger.error(`Error starting test containers`, { error });
    process.exit(1);
  }
};

const createNetwork = async () => {
  try {
    await new Network().start();
  } catch (error) {
    logger.warn(`Error creating network: ${JSON.stringify(error)}`);
  }
};

process.on('SIGTERM', () => {
  void Promise.all(testContainers.map(container => container.stop()));
});
