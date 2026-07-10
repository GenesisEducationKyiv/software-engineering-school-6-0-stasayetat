import { RepositoryResponseSchema, TagsResponseSchema } from '@shared/schemas';
import zod from 'zod';

export type TagsResponse = zod.infer<typeof TagsResponseSchema>;

export type RepositoryResponse = zod.infer<typeof RepositoryResponseSchema>;
