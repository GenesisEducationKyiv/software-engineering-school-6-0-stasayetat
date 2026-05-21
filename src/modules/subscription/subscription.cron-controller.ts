import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@modules/subscription/repository/subscription.repository.interface';
import cron from 'node-cron';
import { container } from 'tsyringe';

const subscriptionRepository = container.resolve<ISubscriptionRepository>(SUBSCRIPTION_REPOSITORY);

const task = cron.schedule('0 * * * *', async () => {
  await subscriptionRepository.deleteExpiredUnconfirmed();
});

void task.start();
