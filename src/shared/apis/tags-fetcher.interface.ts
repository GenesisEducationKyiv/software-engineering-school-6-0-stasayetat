import { E } from '@shared/either';
import { ApiResponseException, TagsResponse } from '@shared/types';

export const TAGS_FETCHER = Symbol.for('TagFetcher');

export interface TagFetcher {
  getTags(repo: string): Promise<E.Either<ApiResponseException, TagsResponse>>;
}
