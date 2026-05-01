import { env } from '@shared/env';
import { spinUpDockerContainers, tearDownAllDependencies } from '@shared/tests';

export default async function setup() {
  console.warn('Global setup');


  if (env.LAUNCH_TEST_CONTAINERS) {
    await spinUpDockerContainers();
  }

  return async () => {
    console.warn('Global teardown');

    if (process.env.LAUNCH_TEST_CONTAINERS) {
      await tearDownAllDependencies();
    }
  };
}
