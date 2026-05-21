import { GithubApiClient } from '@shared/apis/github.api-client';
import { TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { DependencyContainer } from 'tsyringe';

export function registerGithubModule(container: DependencyContainer): void {
  container.registerSingleton(TAGS_FETCHER, GithubApiClient);
}
