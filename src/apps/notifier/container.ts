import { ReleaseNotificationConsumer } from '@notifier/subscription/release-notification.consumer';
import { registerSubscriptionModule } from '@notifier/subscription/subscription.module';
import { registerGithubModule } from '@shared/apis/github.module';
import { registerEmailModule } from '@shared/notification/email.module';
import { registerRabbitMQModule } from '@shared/rabbitmq';
import { container } from 'tsyringe';

registerRabbitMQModule(container);
registerEmailModule(container);
registerGithubModule(container);
registerSubscriptionModule(container);
container.registerSingleton(ReleaseNotificationConsumer);
