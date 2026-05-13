import { ApiResponseException, E, TagsResponse } from '@shared/types';

export const TAGS_FETCHER = Symbol.for('TagFetcher');

export interface TagFetcher {
  getTags(repo: string): Promise<E.Either<ApiResponseException, TagsResponse>>;
}
