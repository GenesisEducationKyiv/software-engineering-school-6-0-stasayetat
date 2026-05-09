import { RepoTagFetcher } from '@modules/scanner/service/repo-tag.fetcher';
import { ScannerService } from '@modules/scanner/service/scanner.service';
import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { REPO_REPOSITORY } from '@modules/subscription/repository/repo.repository.interface';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from '@modules/subscription/repository/subscription.repository.interface';
import { RepoService } from '@modules/subscription/service/repo.service';
import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { GithubApiClient } from '@shared/apis';
import { TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { EMAIL_SENDER } from '@shared/email/email-sender.interface';
import { NotificationEmailService } from '@shared/email/notification.email-service';
import { ResendEmailSender } from '@shared/email/providers/resend.email-sender';
import { SmtpEmailSender } from '@shared/email/providers/smtp.email-sender';
import { env } from '@shared/env';
import { container } from 'tsyringe';

if (env.NODE_ENV === 'production') {
  container.registerSingleton(EMAIL_SENDER, ResendEmailSender);
} else {
  container.registerSingleton(EMAIL_SENDER, SmtpEmailSender);
}

container.registerSingleton(REPO_REPOSITORY, RepoRepository);
container.registerSingleton(SUBSCRIPTION_REPOSITORY, SubscriptionRepository);
container.registerSingleton(RepoTagFetcher);
container.registerSingleton(NotificationEmailService);
container.registerSingleton(RepoService);
container.registerSingleton(SubscriptionService);
container.registerSingleton(ScannerService);
container.registerSingleton(TAGS_FETCHER, GithubApiClient);
