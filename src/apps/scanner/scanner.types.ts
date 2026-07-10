import { TrackedRepository } from '@scanner/db';
import { DomainError, Subscription } from '@shared/types';

export type RepoScanError = {
  currentRepo: TrackedRepository;
  error: DomainError;
};

export type RepoScanSuccess = {
  currentRepo: TrackedRepository;
  latestTag: string;
};

export type RepoNotifyInfo = {
  repo: TrackedRepository;
  newTag: string;
  subscribers: Subscription[];
};
