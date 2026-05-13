import { ApiResponseException, Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';

export type RepoScanError = {
  currentRepo: Repository;
  error: ApiResponseException;
};

export type RepoScanSuccess = {
  currentRepo: Repository;
  latestTag: string;
};

export type RepoNotifyInfo = {
  repo: Repository;
  newTag: string;
  subscribers: Subscription[];
};
