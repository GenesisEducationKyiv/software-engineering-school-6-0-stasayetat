import { RepoTagFetcher } from '@modules/scanner/service/repo-tag.fetcher';
import { ScannerService } from '@modules/scanner/service/scanner.service';
import { DependencyContainer } from 'tsyringe';

export function registerScannerModule(container: DependencyContainer): void {
  container.registerSingleton(RepoTagFetcher);
  container.registerSingleton(ScannerService);
}
