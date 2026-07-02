import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { ScannerService } from '@scanner/service/scanner.service';
import { registerGithubModule } from '@shared/apis/github.module';
import { registerRabbitMQModule } from '@shared/rabbitmq';
import { container } from 'tsyringe';

registerRabbitMQModule(container);
registerGithubModule(container);

container.registerSingleton(ScannerDataFetcher);
container.registerSingleton(RepoTagFetcher);
container.registerSingleton(ScannerService);
container.registerSingleton(TRACKED_REPO_REPOSITORY, TrackedRepoRepository);
