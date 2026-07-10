import { InferSelectModel } from 'drizzle-orm';

import { trackedRepos } from './schema';

export type TrackedRepository = InferSelectModel<typeof trackedRepos>;
