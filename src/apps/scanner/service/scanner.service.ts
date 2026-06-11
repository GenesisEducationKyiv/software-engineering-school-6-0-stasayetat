import { E } from '@shared/either';
import { logger } from '@shared/logger';
import { scannerRunDuration, scannerRunsTotal } from '@shared/metrics';
import { Repository } from '@shared/types/repository.types';
import { getErrorMessage } from '@shared/utils';
import { injectable } from 'tsyringe';

import { RepoScanError, RepoScanSuccess } from '../scanner.types';
import { hasNewRelease } from '../scanner.utils';
import { RepoTagFetcher } from './repo-tag.fetcher';
import { ScannerDataFetcher } from './scanner.data-fetcher';

@injectable()
export class ScannerService {
  constructor(
    private readonly dataFetcher: ScannerDataFetcher,
    private readonly repoTagFetcher: RepoTagFetcher,
  ) {}

  async run(): Promise<void> {
    const end = scannerRunDuration.startTimer();

    try {
      logger.info('Start scanning...');
      const allRepos = await this.dataFetcher.getAllRepos();

      if (!allRepos.length) {
        logger.info(`There is no repos. Finishing job...`);

        return;
      }

      const successful = await this.scanAllRepos(allRepos);

      logger.info(`Scanned ${successful.length} repos`);

      const reposToNotify = successful.filter(hasNewRelease);

      if (!reposToNotify.length) {
        logger.info('No repos to notify. Finishing job...');

        return;
      }

      logger.info(`Repos ready to notify: ${reposToNotify.length}`);

      await Promise.allSettled(
        reposToNotify.map(({ currentRepo, latestTag }) => this.dataFetcher.notifyNewRelease(currentRepo.id, latestTag)),
      );

      logger.info(`Scanning successfully end`);
      scannerRunsTotal.inc({ status: 'success' });
    } catch (error) {
      const message = getErrorMessage(error);

      logger.error(`Something went wrong while scanning repos: ${message}`);
      scannerRunsTotal.inc({ status: 'error' });
    } finally {
      end();
    }
  }

  private async scanAllRepos(allRepos: Repository[]) {
    const resultEithers = await Promise.all(allRepos.map(repo => this.repoTagFetcher.getTags(repo)));

    const { successful, failed } = resultEithers.reduce<{
      successful: RepoScanSuccess[];
      failed: RepoScanError[];
    }>(
      (acc, result) => {
        if (E.isRight(result)) {
          acc.successful.push(result.value);
        } else {
          acc.failed.push(result.value);
        }

        return acc;
      },
      { successful: [], failed: [] },
    );

    for (const { currentRepo, error } of failed) {
      logger.warn(`Failed to fetch repo ${currentRepo.repo}: ${error.message}`);
    }

    return successful;
  }
}
