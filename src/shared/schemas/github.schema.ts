import zod from 'zod';

export const TagsResponseSchema = zod.array(
  zod.object({
    name: zod.string(),
  }),
);

export const RepositoryResponseSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  full_name: zod.string(),
  private: zod.boolean(),
  owner: zod.object({
    login: zod.string(),
    id: zod.number(),
    avatar_url: zod.string(),
  }),
});
