import { registerScannerModule } from '@modules/scanner/scanner.module';
import { registerSubscriptionModule } from '@modules/subscription/subscription.module';
import { registerGithubModule } from '@shared/apis/github.module';
import { registerEmailModule } from '@shared/email/email.module';
import { container } from 'tsyringe';

registerEmailModule(container);
registerGithubModule(container);
registerSubscriptionModule(container);
registerScannerModule(container);
