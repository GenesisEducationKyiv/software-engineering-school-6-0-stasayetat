import { RepoScanSuccess } from './scanner.types';

export const hasNewRelease = ({ currentRepo, latestTag }: RepoScanSuccess) => {
  return currentRepo.last_seen_tag !== latestTag;
};
