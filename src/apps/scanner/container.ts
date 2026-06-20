import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { ScannerService } from '@scanner/service/scanner.service';
import { registerGithubModule } from '@shared/apis/github.module';
import { container } from 'tsyringe';

registerGithubModule(container);

container.registerSingleton(ScannerDataFetcher);
container.registerSingleton(RepoTagFetcher);
container.registerSingleton(ScannerService);
