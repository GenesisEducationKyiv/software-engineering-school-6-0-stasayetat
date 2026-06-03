import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataService } from '@scanner/service/scanner.data-service';
import { ScannerService } from '@scanner/service/scanner.service';
import { registerGithubModule } from '@shared/apis/github.module';
import { registerEmailModule } from '@shared/notification/email.module';
import { container } from 'tsyringe';

registerEmailModule(container);
registerGithubModule(container);

container.registerSingleton(ScannerDataService);
container.registerSingleton(RepoTagFetcher);
container.registerSingleton(ScannerService);
