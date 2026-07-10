import cron from 'node-cron';
import { container } from 'tsyringe';

import { ISubscriptionRepository, SUBSCRIPTION_REPOSITORY } from './repository/subscription.repository.interface';

const subscriptionRepository = container.resolve<ISubscriptionRepository>(SUBSCRIPTION_REPOSITORY);

const task = cron.schedule('0 * * * *', async () => {
  await subscriptionRepository.deleteExpiredUnconfirmed();
});

void task.start();
