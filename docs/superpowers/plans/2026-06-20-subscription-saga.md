# Subscription Saga Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `scanner` its own Postgres database and implement orchestrated Sagas (in `notifier`) for the subscribe and unsubscribe flows, so enrolling/un-enrolling a repo in scanner's database is a real distributed transaction with compensation.

**Architecture:** `notifier` stays the orchestrator. A generic `SagaRunner` executes an ordered list of `{ run, undo }` steps, persisting progress to a new `sagas` table, and compensates in reverse order on failure. `scanner` gains its own Postgres DB (`tracked_repos` table) and two new internal HTTP endpoints (`enroll`/`unenroll`) that `notifier` calls as saga steps. `scanner`'s scan loop reads from its own DB instead of calling notifier's `/internal/repos`.

**Tech Stack:** TypeScript, Express, drizzle-orm (postgres-js), tsyringe DI, axios, vitest, testcontainers (`@testcontainers/postgresql`).

## Global Constraints

- Do not commit anything — the user reviews and commits manually after each task (per explicit instruction). Stage nothing beyond what `git status`/`git diff` already show as your own edits; never run `git commit`.
- Follow existing patterns exactly: tsyringe `@injectable()` + interface symbol pattern for every repository/service; `E.Either<DomainError, T>` for domain-level failures; `DomainErrorCode` enum for error codes; path aliases `@shared/*`, `@notifier/*`, `@scanner/*` (see `tsconfig.json`).
- No new dependencies are required — `@testcontainers/postgresql`, `drizzle-kit`, `express`, `axios` are already installed.
- Run `pnpm type-check`, `pnpm lint`, and the relevant vitest command after every task before moving on.

---

## Task 1: Scanner environment variables

**Files:**
- Modify: `src/shared/schemas/env.schema.ts`
- Modify: `profiles/.env`, `profiles/.env.example`, `profiles/.env.test`, `profiles/.env.ci`, `profiles/.env.production`, `profiles/.env.development.local`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `env.SCANNER_POSTGRES_URL: string`, `env.SCANNER_API_URL: string`, `env.SCANNER_PORT: number` — consumed by Tasks 3, 5, 9.

- [ ] **Step 1: Add the three new vars to the env schema**

In `src/shared/schemas/env.schema.ts`, add after `NOTIFIER_API_URL: zod.string(),`:

```ts
  SCANNER_API_URL: zod.string(),
  SCANNER_PORT: zod.coerce.number(),
  SCANNER_POSTGRES_URL: zod.string(),
```

- [ ] **Step 2: Add matching values to every profile env file**

Append to `profiles/.env`, `profiles/.env.example`, `profiles/.env.development.local`:
```
SCANNER_API_URL=http://localhost:8082
SCANNER_PORT=8082
SCANNER_POSTGRES_URL=postgres://postgres:postgrespassword@localhost:5433/scanner
```

Append to `profiles/.env.test` and `profiles/.env.ci`:
```
SCANNER_API_URL=http://localhost:8082
SCANNER_PORT=8082
SCANNER_POSTGRES_URL=postgres://postgres:postgrespassword@localhost:5433/postgres
```

Append to `profiles/.env.production`:
```
SCANNER_API_URL=http://scanner:8082
SCANNER_PORT=8082
```
(`SCANNER_POSTGRES_URL` for production is supplied via `docker-compose.yml`'s `environment:` block in Step 3, matching how `POSTGRES_URL` is already handled there — do not hardcode it in `.env.production`.)

- [ ] **Step 3: Add a second Postgres service and wire env vars in docker-compose.yml**

Add a new service after the existing `postgres:` block:

```yaml
  scanner-postgres:
    container_name: github-scanner-postgres
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: scanner
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5433:5432"
    volumes:
      - scanner_postgres_data:/var/lib/postgresql/data
```

Add `scanner_postgres_data:` under the existing `volumes:` section at the bottom of the file.

In the `scanner:` service block, add a `depends_on: scanner-postgres: condition: service_started` entry, add to its `environment:` block:
```yaml
      SCANNER_POSTGRES_URL: postgresql://postgres:postgrespassword@scanner-postgres:5432/scanner
      SCANNER_API_URL: http://scanner:8082
```
add a `ports: - "8082:8082"` entry, and change its `command:` to run the scanner migration first (mirrors the notifier service's pattern):
```yaml
    command: sh -c "node .build/apps/scanner/db/migrate.js && node .build/apps/scanner/main.js"
```

- [ ] **Step 4: Verify**

Run: `pnpm type-check`
Expected: no errors (env schema change only adds required fields; profile files aren't type-checked, but Step 2 must have already filled them in or `env.schema.ts` parsing will throw at runtime in later tasks).

---

## Task 2: Scanner-owned database — schema, connection, migration tooling

**Files:**
- Create: `src/apps/scanner/db/schema.ts`
- Create: `src/apps/scanner/db/db.ts`
- Create: `src/apps/scanner/db/index.ts`
- Create: `src/apps/scanner/db/migrate.ts`
- Create: `src/apps/scanner/db/tracked-repository.types.ts`
- Create: `drizzle.config.scanner.ts` (repo root)
- Modify: `package.json`

**Interfaces:**
- Produces: `trackedRepos` table, `scannerDb` (drizzle instance), `TrackedRepository` type — consumed by Task 4.

- [ ] **Step 1: Create the scanner schema**

`src/apps/scanner/db/schema.ts`:
```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const trackedRepos = pgTable('tracked_repos', {
  id: uuid('id').primaryKey(),
  repo: text('repo').notNull().unique(),
  last_seen_tag: text('last_seen_tag').notNull(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});
```

- [ ] **Step 2: Create the scanner DB connection**

`src/apps/scanner/db/db.ts`:
```ts
import { env } from '@shared/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(env.SCANNER_POSTGRES_URL);
export const scannerDb = drizzle(client);
```

`src/apps/scanner/db/index.ts`:
```ts
export * from './db';
export * from './schema';
export * from './tracked-repository.types';
```

- [ ] **Step 3: Create the TrackedRepository type**

`src/apps/scanner/db/tracked-repository.types.ts`:
```ts
import { InferSelectModel } from 'drizzle-orm';

import { trackedRepos } from './schema';

export type TrackedRepository = InferSelectModel<typeof trackedRepos>;
```

- [ ] **Step 4: Create the scanner migration runner**

`src/apps/scanner/db/migrate.ts`:
```ts
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

void (async () => {
  const client = postgres(env.SCANNER_POSTGRES_URL, {
    onnotice: () => {},
  });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './migrations-scanner' });
  await client.end();

  logger.info('Scanner migrations complete');
})();
```

- [ ] **Step 5: Create the drizzle-kit config for scanner**

`drizzle.config.scanner.ts` (repo root, next to existing `drizzle.config.ts`):
```ts
import { env } from '@shared/env';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/apps/scanner/db/schema.ts',
  out: './migrations-scanner',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.SCANNER_POSTGRES_URL,
  },
});
```

- [ ] **Step 6: Add package.json scripts**

In `package.json` `scripts`, add next to the existing `db:*`/`migrate` entries:
```json
    "db:generate:scanner": "drizzle-kit generate --config=drizzle.config.scanner.ts",
    "db:migrate:scanner": "drizzle-kit migrate --config=drizzle.config.scanner.ts",
    "migrate:scanner": "node .build/apps/scanner/db/migrate.js",
```

- [ ] **Step 7: Start scanner-postgres and generate the migration**

Run: `docker compose up -d scanner-postgres`
Expected: container starts and is healthy on port 5433.

Run: `pnpm db:generate:scanner`
Expected: creates `migrations-scanner/0000_<name>.sql` containing the `CREATE TABLE "tracked_repos"` statement, plus `migrations-scanner/meta/`.

- [ ] **Step 8: Apply the migration and verify**

Run: `SCANNER_POSTGRES_URL=postgres://postgres:postgrespassword@localhost:5433/scanner pnpm db:migrate:scanner`
Expected: "migrations applied" / drizzle-kit success output, no errors.

Run: `pnpm type-check`
Expected: no errors.

---

## Task 3: Scanner TrackedRepo repository + DI registration

**Files:**
- Create: `src/apps/scanner/repository/tracked-repo.repository.interface.ts`
- Create: `src/apps/scanner/repository/tracked-repo.repository.ts`
- Create: `tests/unit/scanner/tracked-repo.repository.unit.test.ts`
- Modify: `src/apps/scanner/container.ts`

**Interfaces:**
- Consumes: `scannerDb`, `trackedRepos`, `TrackedRepository` from `@scanner/db` (Task 2).
- Produces: `TRACKED_REPO_REPOSITORY` symbol, `ITrackedRepoRepository` — consumed by Tasks 4 and 6.

- [ ] **Step 1: Write the interface**

`src/apps/scanner/repository/tracked-repo.repository.interface.ts`:
```ts
import { TrackedRepository } from '@scanner/db';

export const TRACKED_REPO_REPOSITORY = Symbol.for('TrackedRepoRepository');

export interface ITrackedRepoRepository {
  getAllRepos(): Promise<TrackedRepository[]>;
  updateLastSeenTag(repoId: string, tag: string): Promise<void>;
  enroll(id: string, repo: string, lastSeenTag: string): Promise<TrackedRepository>;
  unenroll(repoId: string): Promise<void>;
}
```

- [ ] **Step 2: Write the failing unit test**

`tests/unit/scanner/tracked-repo.repository.unit.test.ts`:
```ts
import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { scannerDb } from '@scanner/db';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@scanner/db', () => ({
  scannerDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  trackedRepos: { id: 'id', repo: 'repo', last_seen_tag: 'last_seen_tag', checkedAt: 'checkedAt' },
}));

describe('TrackedRepoRepository', () => {
  it('enroll upserts on conflicting id', async () => {
    const repository = new TrackedRepoRepository();
    const onConflictDoUpdate = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'repo-1', repo: 'owner/repo', last_seen_tag: 'v1', checkedAt: new Date() }]),
    });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    vi.mocked(scannerDb.insert).mockReturnValue({ values } as any);

    const result = await repository.enroll('repo-1', 'owner/repo', 'v1');

    expect(values).toHaveBeenCalledWith({ id: 'repo-1', repo: 'owner/repo', last_seen_tag: 'v1' });
    expect(result.id).toBe('repo-1');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest:unit tests/unit/scanner/tracked-repo.repository.unit.test.ts`
Expected: FAIL — `Cannot find module '@scanner/repository/tracked-repo.repository'`.

- [ ] **Step 4: Implement the repository**

`src/apps/scanner/repository/tracked-repo.repository.ts`:
```ts
import { scannerDb, trackedRepos, TrackedRepository } from '@scanner/db';
import { eq } from 'drizzle-orm';
import { injectable } from 'tsyringe';

import { ITrackedRepoRepository } from './tracked-repo.repository.interface';

@injectable()
export class TrackedRepoRepository implements ITrackedRepoRepository {
  getAllRepos(): Promise<TrackedRepository[]> {
    return scannerDb.select().from(trackedRepos);
  }

  async updateLastSeenTag(repoId: string, tag: string): Promise<void> {
    await scannerDb.update(trackedRepos).set({ last_seen_tag: tag, checkedAt: new Date() }).where(eq(trackedRepos.id, repoId));
  }

  async enroll(id: string, repo: string, lastSeenTag: string): Promise<TrackedRepository> {
    const [enrolled] = await scannerDb
      .insert(trackedRepos)
      .values({ id, repo, last_seen_tag: lastSeenTag })
      .onConflictDoUpdate({
        target: trackedRepos.id,
        set: { repo, last_seen_tag: lastSeenTag },
      })
      .returning();

    return enrolled;
  }

  async unenroll(repoId: string): Promise<void> {
    await scannerDb.delete(trackedRepos).where(eq(trackedRepos.id, repoId));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest:unit tests/unit/scanner/tracked-repo.repository.unit.test.ts`
Expected: PASS.

- [ ] **Step 6: Register in scanner's DI container**

In `src/apps/scanner/container.ts`, add:
```ts
import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
```
and the registration line:
```ts
container.registerSingleton(TRACKED_REPO_REPOSITORY, TrackedRepoRepository);
```

- [ ] **Step 7: Verify**

Run: `pnpm type-check && pnpm vitest:unit tests/unit/scanner`
Expected: all pass.

---

## Task 4: Shared API-key middleware + scanner internal HTTP API

**Files:**
- Create: `src/shared/middlewares/api-key.middleware.ts`
- Delete: `src/apps/notifier/middlewares/api-key.middleware.ts`
- Modify: `src/apps/notifier/middlewares/index.ts` (or wherever it's re-exported — check `@notifier/middlewares` usage)
- Modify: `src/apps/notifier/routes/internal.router.ts` (import path only)
- Create: `src/apps/scanner/routes/internal.router.ts`
- Create: `src/apps/scanner/server.ts`
- Modify: `src/apps/scanner/main.ts`
- Create: `tests/unit/scanner/internal-router.unit.test.ts`

**Interfaces:**
- Consumes: `TRACKED_REPO_REPOSITORY`/`ITrackedRepoRepository` (Task 3), `env.SCANNER_PORT` (Task 1).
- Produces: `POST /internal/repos/enroll`, `DELETE /internal/repos/:id` on scanner — consumed by Task 9 (notifier's `ScannerApiClient`).

- [ ] **Step 1: Move the API-key middleware to shared**

Find the current re-export: run `grep -rn "api-key.middleware" src` to confirm every import site (expected: `src/apps/notifier/middlewares/index.ts` and `src/apps/notifier/routes/internal.router.ts`).

Create `src/shared/middlewares/api-key.middleware.ts` with the exact contents currently in `src/apps/notifier/middlewares/api-key.middleware.ts`:
```ts
import { env } from '@shared/env';
import { NextFunction, Request, Response } from 'express';

export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.APP_API_KEY) {
    res.status(401).json({ message: 'Unauthorized' });

    return;
  }

  return next();
};
```

Delete `src/apps/notifier/middlewares/api-key.middleware.ts`. Update every import found by the grep above (notifier's middlewares index re-export and `internal.router.ts`) to import from `@shared/middlewares/api-key.middleware` instead of `@notifier/middlewares/api-key.middleware`.

- [ ] **Step 2: Run notifier's existing tests to confirm the move didn't break anything**

Run: `pnpm vitest:unit tests/unit/subscription/subscription-router.unit.test.ts`
Expected: PASS (unchanged behavior, just a new import path).

- [ ] **Step 3: Write the failing test for scanner's internal router**

`tests/unit/scanner/internal-router.unit.test.ts`:
```ts
import { internalRouter } from '@scanner/routes/internal.router';
import { TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { env } from '@shared/env';
import express from 'express';
import request from 'supertest';
import { container } from 'tsyringe';
import { describe, expect, it, vi } from 'vitest';

describe('scanner internal router', () => {
  const app = express();
  app.use(express.json());
  app.use('/internal', internalRouter);

  it('rejects requests without a valid api key', async () => {
    const response = await request(app).post('/internal/repos/enroll').send({ id: 'a', repo: 'b', lastSeenTag: 'v1' });

    expect(response.status).toBe(401);
  });

  it('enrolls a repo', async () => {
    const enroll = vi.fn().mockResolvedValue({ id: 'a', repo: 'owner/repo', last_seen_tag: 'v1', checkedAt: new Date() });
    container.registerInstance(TRACKED_REPO_REPOSITORY, { enroll, unenroll: vi.fn() } as any);

    const response = await request(app)
      .post('/internal/repos/enroll')
      .set('x-api-key', env.APP_API_KEY)
      .send({ id: 'a', repo: 'owner/repo', lastSeenTag: 'v1' });

    expect(response.status).toBe(201);
    expect(enroll).toHaveBeenCalledWith('a', 'owner/repo', 'v1');
  });

  it('unenrolls a repo', async () => {
    const unenroll = vi.fn().mockResolvedValue(undefined);
    container.registerInstance(TRACKED_REPO_REPOSITORY, { enroll: vi.fn(), unenroll } as any);

    const response = await request(app).delete('/internal/repos/a').set('x-api-key', env.APP_API_KEY);

    expect(response.status).toBe(200);
    expect(unenroll).toHaveBeenCalledWith('a');
  });
});
```

Check `supertest` is already a devDependency: run `grep '"supertest"' package.json`. It is — used by `tests/integration/subscription/subscription.api.int.test.ts`.

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm vitest:unit tests/unit/scanner/internal-router.unit.test.ts`
Expected: FAIL — `Cannot find module '@scanner/routes/internal.router'`.

- [ ] **Step 5: Implement the scanner internal router**

`src/apps/scanner/routes/internal.router.ts`:
```ts
import { TRACKED_REPO_REPOSITORY, ITrackedRepoRepository } from '@scanner/repository/tracked-repo.repository.interface';
import { apiKeyMiddleware } from '@shared/middlewares/api-key.middleware';
import { Request, Response, Router } from 'express';
import { container } from 'tsyringe';

export const internalRouter = Router();

internalRouter.use(apiKeyMiddleware);

internalRouter.post('/repos/enroll', async (req: Request, res: Response) => {
  const { id, repo, lastSeenTag } = req.body as { id: string; repo: string; lastSeenTag: string };

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  const enrolled = await trackedRepoRepository.enroll(id, repo, lastSeenTag);

  res.status(201).json({ data: enrolled });
});

internalRouter.delete('/repos/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
  await trackedRepoRepository.unenroll(id);

  res.json({ message: 'Repo unenrolled' });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest:unit tests/unit/scanner/internal-router.unit.test.ts`
Expected: PASS.

- [ ] **Step 7: Create scanner's express server**

`src/apps/scanner/server.ts`:
```ts
import { internalRouter } from '@scanner/routes/internal.router';
import { errorHandler } from '@shared/utils';
import express from 'express';

export const server = express();

server.use(express.json());

server.get('/', (_req, res) => {
  res.json({ message: 'Scanner service' });
});

server.use('/internal', internalRouter);
server.use(errorHandler);
```

Check `errorHandler` export path: run `grep -rn "export.*errorHandler" src/shared/utils`. Use whatever path that shows (it's used the same way in `src/apps/notifier/server.ts`).

- [ ] **Step 8: Wire the server into scanner's main.ts**

In `src/apps/scanner/main.ts`, add the import and a `server.listen` call inside `bootstrap()`, mirroring notifier's `main.ts`:
```ts
import { server } from './server';
```
Inside `async function bootstrap()`, before the `cron.schedule` call:
```ts
  server.listen(env.SCANNER_PORT, err => {
    if (err) {
      logger.error(err.message);
    } else {
      logger.info('Scanner server started on port: ' + env.SCANNER_PORT);
    }
  });
```

- [ ] **Step 9: Verify**

Run: `pnpm type-check && pnpm vitest:unit tests/unit/scanner`
Expected: all pass.

Run: `pnpm dev:scanner` (with `scanner-postgres`, `redis`, `rabbitmq` up via `pnpm docker:up:local`), then in another terminal:
`curl -X POST http://localhost:8082/internal/repos/enroll -H "x-api-key: $APP_API_KEY" -H "Content-Type: application/json" -d '{"id":"11111111-1111-1111-1111-111111111111","repo":"facebook/react","lastSeenTag":"v1.0.0"}'`
Expected: `201` with the enrolled row JSON. Stop the dev server after confirming.

---

## Task 5: Switch scanner's scan loop to its own database

**Files:**
- Modify: `src/apps/scanner/service/scanner.data-fetcher.ts`
- Modify: `src/apps/scanner/service/repo-tag.fetcher.ts`
- Modify: `src/apps/scanner/scanner.types.ts`
- Modify: `src/apps/notifier/routes/internal.router.ts` (remove now-unused `GET /repos`)
- Modify: `tests/integration/scanner/scanner.service.int.test.ts`

**Interfaces:**
- Consumes: `ITrackedRepoRepository`/`TRACKED_REPO_REPOSITORY` (Task 3), `TrackedRepository` (Task 2).
- Produces: `ScannerDataFetcher.getAllRepos(): Promise<TrackedRepository[]>` — internal to scanner, no other task depends on this signature beyond what already calls it.

This task fixes a correctness gap introduced by giving scanner its own DB: scanner previously relied on notifier's `ReleaseNotificationService` updating `last_seen_tag` after sending emails. Once scanner owns its own copy, nothing updates it unless scanner does so itself — without this fix, scanner would re-detect and re-publish the same release every cron cycle forever.

- [ ] **Step 1: Update scanner's domain types to use TrackedRepository**

In `src/apps/scanner/scanner.types.ts`, replace the import and all three usages of `Repository` with `TrackedRepository`:
```ts
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
```

`src/apps/scanner/scanner.utils.ts` needs no change — it only destructures fields off `RepoScanSuccess`, so it stays type-correct automatically.

- [ ] **Step 2: Update RepoTagFetcher's signature**

In `src/apps/scanner/service/repo-tag.fetcher.ts`, replace `import { Repository } from '@shared/types/repository.types';` with `import { TrackedRepository } from '@scanner/db';` and change both occurrences of the `Repository` type annotation (the `getTags` parameter and the private `fetchTagsInfo` parameter) to `TrackedRepository`.

- [ ] **Step 3: Rewrite ScannerDataFetcher to use scanner's own repository, and fix the last-seen-tag gap**

`src/apps/scanner/service/scanner.data-fetcher.ts`:
```ts
import { TrackedRepository } from '@scanner/db';
import { ITrackedRepoRepository, TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { logger } from '@shared/logger';
import { EventPublisher } from '@shared/rabbitmq/event-publisher';
import { EVENT_PUBLISHER } from '@shared/rabbitmq/rabbitmq.module';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ScannerDataFetcher {
  constructor(
    @inject(TRACKED_REPO_REPOSITORY) private readonly trackedRepoRepository: ITrackedRepoRepository,
    @inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async getAllRepos(): Promise<TrackedRepository[]> {
    const repos = await this.trackedRepoRepository.getAllRepos();

    logger.info(`Fetched ${repos.length} repos from scanner's own database`);

    return repos;
  }

  async notifyNewRelease(repoId: string, tag: string): Promise<void> {
    await this.trackedRepoRepository.updateLastSeenTag(repoId, tag);
    await this.eventPublisher.publish('releases', 'new_release_detected', { repoId, tag });
  }
}
```

This folds the last-seen-tag fix directly into the existing `notifyNewRelease` call site, so `ScannerService.run` needs no changes — it already calls `dataFetcher.notifyNewRelease(currentRepo.id, latestTag)` for every repo with a new release.

- [ ] **Step 4: Remove the now-unused GET /repos endpoint from notifier**

In `src/apps/notifier/routes/internal.router.ts`, delete the entire `internalRouter.get('/repos', ...)` block. Leave `/subscribers` and `/repos/:id/tag` untouched — out of scope for this plan.

- [ ] **Step 5: Confirm the scanner unit test still passes unchanged**

Run: `pnpm vitest:unit tests/unit/scanner/scanner.service.unit.test.ts`
Expected: PASS — `dataAdapter` there is already a hand-rolled `{ getAllRepos, notifyNewRelease }` mock, not a real `ScannerDataFetcher`, so it's unaffected by Step 3's constructor change.

- [ ] **Step 6: Rewrite the scanner integration test to seed scanner's own DB**

Replace `tests/integration/scanner/scanner.service.int.test.ts` entirely:
```ts
import { ScannerService } from '@scanner';
import { scannerDb, trackedRepos } from '@scanner/db';
import { TrackedRepoRepository } from '@scanner/repository/tracked-repo.repository';
import { RepoTagFetcher } from '@scanner/service/repo-tag.fetcher';
import { ScannerDataFetcher } from '@scanner/service/scanner.data-fetcher';
import { TagFetcher } from '@shared/apis/tags-fetcher.interface';
import { E } from '@shared/either';
import { DomainErrorCode, TagsResponse } from '@shared/types';
import { randomUUID } from 'crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyNewRelease = vi.fn().mockResolvedValue(undefined);

const seedTrackedRepo = async (repo: string, lastSeenTag: string) => {
  const [newRepo] = await scannerDb.insert(trackedRepos).values({ id: randomUUID(), repo, last_seen_tag: lastSeenTag }).returning();

  return newRepo;
};

describe('ScannerService (integration)', () => {
  let service: ScannerService;
  let mockTagFetcher: TagFetcher;

  afterAll(async () => {
    await scannerDb.delete(trackedRepos);
    await scannerDb.$client.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    await scannerDb.delete(trackedRepos);

    mockTagFetcher = {
      getTags: vi.fn(),
    };

    const trackedRepoRepository = new TrackedRepoRepository();

    service = new ScannerService(
      {
        getAllRepos: () => trackedRepoRepository.getAllRepos(),
        notifyNewRelease: mockNotifyNewRelease,
      } as unknown as ScannerDataFetcher,
      new RepoTagFetcher(mockTagFetcher),
    );
  });

  describe('run', () => {
    it('should return early if no repos in DB', async () => {
      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });

    it('should not notify if tag has not changed', async () => {
      await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v1.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });

    it('should notify when new release found', async () => {
      const repo = await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v2.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo.id, 'v2.0.0');
    });

    it('should skip repo if github fetch fails and continue with others', async () => {
      const repo1 = await seedTrackedRepo('facebook/react', 'v1.0.0');
      const repo2 = await seedTrackedRepo('microsoft/typescript', 'v4.0.0');

      vi.mocked(mockTagFetcher.getTags)
        .mockResolvedValueOnce(E.left({ code: DomainErrorCode.GITHUB_API_ERROR, message: 'Error' }))
        .mockResolvedValueOnce(E.right([{ name: 'v5.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).toHaveBeenCalledTimes(1);
      expect(mockNotifyNewRelease).toHaveBeenCalledWith(repo2.id, 'v5.0.0');
    });

    it('should not notify if no repos have new releases', async () => {
      await seedTrackedRepo('facebook/react', 'v1.0.0');

      vi.mocked(mockTagFetcher.getTags).mockResolvedValue(E.right([{ name: 'v1.0.0' }] as TagsResponse));

      await service.run();

      expect(mockNotifyNewRelease).not.toHaveBeenCalled();
    });
  });
});
```

`repo1`/`repo2` ordering matters for the "skip repo if github fetch fails" test — `getAllRepos()` must return them in insertion order for the two `mockResolvedValueOnce` calls to line up with `repo1`/`repo2` respectively, matching the original test's assumption.

- [ ] **Step 7: Run all affected tests and type-check**

Run: `pnpm type-check`
Expected: no errors.

Run: `pnpm vitest:unit tests/unit/scanner`
Expected: all PASS.

Run: `docker compose up -d scanner-postgres` then `LAUNCH_TEST_CONTAINERS=true pnpm vitest:integration tests/integration/scanner/scanner.service.int.test.ts`
Expected: all PASS. (This test now talks to a real `scannerDb` pointed at `env.SCANNER_POSTGRES_URL`; Task 13 adds a dedicated testcontainer so CI doesn't depend on a pre-existing container.)

---

## Task 6: notifier `sagas` table and types

**Files:**
- Modify: `src/shared/db/schema.ts`
- Create: `src/shared/types/saga.types.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/types/common.types.ts` (new `DomainErrorCode`)

**Interfaces:**
- Produces: `sagas` table, `Saga`, `SagaType`, `SagaStatus` types — consumed by Task 7.

- [ ] **Step 1: Add the sagas table to notifier's schema**

In `src/shared/db/schema.ts`, add `pgEnum`, `jsonb` to the existing `drizzle-orm/pg-core` import, and append:
```ts
export const sagaTypeEnum = pgEnum('saga_type', ['SUBSCRIBE', 'UNSUBSCRIBE']);
export const sagaStatusEnum = pgEnum('saga_status', ['STARTED', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED']);

export const sagas = pgTable('sagas', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: sagaTypeEnum('type').notNull(),
  status: sagaStatusEnum('status').notNull().default('STARTED'),
  payload: jsonb('payload').notNull(),
  stepsDone: jsonb('steps_done').notNull().default([]),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- [ ] **Step 2: Add the Saga types**

`src/shared/types/saga.types.ts`:
```ts
import { sagas } from '@shared/db';
import { InferSelectModel } from 'drizzle-orm';

export type Saga = InferSelectModel<typeof sagas>;
export type SagaType = Saga['type'];
export type SagaStatus = Saga['status'];
```

In `src/shared/types/index.ts`, add `export * from './saga.types';`.

- [ ] **Step 3: Add the new DomainErrorCode**

In `src/shared/types/common.types.ts`, add to the `DomainErrorCode` enum:
```ts
  SCANNER_ENROLLMENT_FAILED = 'SCANNER_ENROLLMENT_FAILED',
```

- [ ] **Step 4: Generate and apply the notifier migration**

Run: `pnpm db:generate`
Expected: new file `migrations/0001_<name>.sql` containing `CREATE TYPE "saga_type"`, `CREATE TYPE "saga_status"`, and `CREATE TABLE "sagas"`.

Run: `docker compose up -d postgres` (if not already running), then `POSTGRES_URL=postgres://postgres:postgrespassword@localhost:5432/github_notifier pnpm db:migrate`
Expected: success, no errors.

- [ ] **Step 5: Verify**

Run: `pnpm type-check`
Expected: no errors.

---

## Task 7: Saga repository + generic SagaRunner

**Files:**
- Create: `src/apps/notifier/subscription/saga/saga.repository.interface.ts`
- Create: `src/apps/notifier/subscription/saga/saga.repository.ts`
- Create: `src/apps/notifier/subscription/saga/saga-runner.ts`
- Create: `tests/unit/subscription/saga-runner.unit.test.ts`

**Interfaces:**
- Consumes: `sagas` table, `Saga`/`SagaType` (Task 6).
- Produces: `SAGA_REPOSITORY` symbol, `ISagaRepository`, `SagaRunner.run<Ctx>(type, payload, steps, ctx): Promise<void>`, `SagaStep<Ctx> = { name: string; run: (ctx: Ctx) => Promise<void>; undo: (ctx: Ctx) => Promise<void> }` — consumed by Task 9 (`SubscriptionSagaService`).

- [ ] **Step 1: Write the saga repository interface**

`src/apps/notifier/subscription/saga/saga.repository.interface.ts`:
```ts
import { Saga, SagaType } from '@shared/types';

export const SAGA_REPOSITORY = Symbol.for('SagaRepository');

export interface ISagaRepository {
  create(type: SagaType, payload: object): Promise<Saga>;
  markStepDone(sagaId: string, stepName: string): Promise<void>;
  markCompleted(sagaId: string): Promise<void>;
  markCompensating(sagaId: string, error: string): Promise<void>;
  markCompensated(sagaId: string): Promise<void>;
  markFailed(sagaId: string, error: string): Promise<void>;
}
```

- [ ] **Step 2: Implement the saga repository**

`src/apps/notifier/subscription/saga/saga.repository.ts`:
```ts
import { db, sagas } from '@shared/db';
import { Saga, SagaType } from '@shared/types';
import { eq, sql } from 'drizzle-orm';
import { injectable } from 'tsyringe';

import { ISagaRepository } from './saga.repository.interface';

@injectable()
export class SagaRepository implements ISagaRepository {
  async create(type: SagaType, payload: object): Promise<Saga> {
    const [saga] = await db.insert(sagas).values({ type, payload, status: 'STARTED', stepsDone: [] }).returning();

    return saga;
  }

  async markStepDone(sagaId: string, stepName: string): Promise<void> {
    await db
      .update(sagas)
      .set({ stepsDone: sql`${sagas.stepsDone} || ${JSON.stringify([stepName])}::jsonb`, updatedAt: new Date() })
      .where(eq(sagas.id, sagaId));
  }

  async markCompleted(sagaId: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPLETED', updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markCompensating(sagaId: string, error: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPENSATING', error, updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markCompensated(sagaId: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPENSATED', updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markFailed(sagaId: string, error: string): Promise<void> {
    await db.update(sagas).set({ status: 'FAILED', error, updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }
}
```

- [ ] **Step 3: Write the failing test for SagaRunner**

`tests/unit/subscription/saga-runner.unit.test.ts`:
```ts
import { ISagaRepository } from '@notifier/subscription/saga/saga.repository.interface';
import { SagaRunner, SagaStep } from '@notifier/subscription/saga/saga-runner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SagaRunner', () => {
  let sagaRepository: ISagaRepository;
  let runner: SagaRunner;

  beforeEach(() => {
    sagaRepository = {
      create: vi.fn().mockResolvedValue({ id: 'saga-1' }),
      markStepDone: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markCompensating: vi.fn().mockResolvedValue(undefined),
      markCompensated: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    runner = new SagaRunner(sagaRepository);
  });

  it('runs all steps and marks the saga completed on success', async () => {
    const ctx = { value: 0 };
    const steps: SagaStep<typeof ctx>[] = [
      { name: 'step1', run: async c => { c.value += 1; }, undo: vi.fn() },
      { name: 'step2', run: async c => { c.value += 10; }, undo: vi.fn() },
    ];

    await runner.run('SUBSCRIBE', { foo: 'bar' }, steps, ctx);

    expect(ctx.value).toBe(11);
    expect(sagaRepository.markStepDone).toHaveBeenNthCalledWith(1, 'saga-1', 'step1');
    expect(sagaRepository.markStepDone).toHaveBeenNthCalledWith(2, 'saga-1', 'step2');
    expect(sagaRepository.markCompleted).toHaveBeenCalledWith('saga-1');
  });

  it('compensates completed steps in reverse order when a later step fails', async () => {
    const calls: string[] = [];
    const steps: SagaStep<object>[] = [
      { name: 'step1', run: async () => { calls.push('run1'); }, undo: async () => { calls.push('undo1'); } },
      { name: 'step2', run: async () => { throw new Error('boom'); }, undo: vi.fn() },
    ];

    await expect(runner.run('SUBSCRIBE', {}, steps, {})).rejects.toThrow('boom');

    expect(calls).toEqual(['run1', 'undo1']);
    expect(sagaRepository.markCompensating).toHaveBeenCalledWith('saga-1', 'boom');
    expect(sagaRepository.markCompensated).toHaveBeenCalledWith('saga-1');
    expect(sagaRepository.markCompleted).not.toHaveBeenCalled();
  });

  it('marks the saga FAILED if a compensation step itself throws', async () => {
    const steps: SagaStep<object>[] = [
      { name: 'step1', run: async () => {}, undo: async () => { throw new Error('undo failed'); } },
      { name: 'step2', run: async () => { throw new Error('boom'); }, undo: vi.fn() },
    ];

    await expect(runner.run('SUBSCRIBE', {}, steps, {})).rejects.toThrow('boom');

    expect(sagaRepository.markFailed).toHaveBeenCalledWith('saga-1', 'undo failed');
    expect(sagaRepository.markCompensated).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm vitest:unit tests/unit/subscription/saga-runner.unit.test.ts`
Expected: FAIL — `Cannot find module '@notifier/subscription/saga/saga-runner'`.

- [ ] **Step 5: Implement SagaRunner**

`src/apps/notifier/subscription/saga/saga-runner.ts`:
```ts
import { getErrorMessage } from '@shared/utils';
import { SagaType } from '@shared/types';
import { inject, injectable } from 'tsyringe';

import { ISagaRepository, SAGA_REPOSITORY } from './saga.repository.interface';

export type SagaStep<Ctx> = {
  name: string;
  run: (ctx: Ctx) => Promise<void>;
  undo: (ctx: Ctx) => Promise<void>;
};

@injectable()
export class SagaRunner {
  constructor(@inject(SAGA_REPOSITORY) private readonly sagaRepository: ISagaRepository) {}

  async run<Ctx>(type: SagaType, payload: object, steps: SagaStep<Ctx>[], ctx: Ctx): Promise<void> {
    const saga = await this.sagaRepository.create(type, payload);
    const done: SagaStep<Ctx>[] = [];

    try {
      for (const step of steps) {
        await step.run(ctx);
        await this.sagaRepository.markStepDone(saga.id, step.name);
        done.push(step);
      }

      await this.sagaRepository.markCompleted(saga.id);
    } catch (error) {
      const message = getErrorMessage(error);
      await this.sagaRepository.markCompensating(saga.id, message);

      try {
        for (const step of done.reverse()) {
          await step.undo(ctx);
        }

        await this.sagaRepository.markCompensated(saga.id);
      } catch (undoError) {
        await this.sagaRepository.markFailed(saga.id, getErrorMessage(undoError));
      }

      throw error;
    }
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest:unit tests/unit/subscription/saga-runner.unit.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `pnpm type-check`
Expected: no errors.

---

## Task 8: ScannerApiClient (notifier → scanner HTTP calls)

**Files:**
- Create: `src/apps/notifier/subscription/saga/scanner-api.client.interface.ts`
- Create: `src/apps/notifier/subscription/saga/scanner-api.client.ts`
- Create: `tests/unit/subscription/scanner-api.client.unit.test.ts`

**Interfaces:**
- Consumes: `env.SCANNER_API_URL`, `env.APP_API_KEY` (Task 1).
- Produces: `SCANNER_API_CLIENT` symbol, `IScannerApiClient.enrollRepo(id, repo, lastSeenTag): Promise<void>`, `IScannerApiClient.unenrollRepo(id): Promise<void>` — consumed by Task 9.

- [ ] **Step 1: Write the interface**

`src/apps/notifier/subscription/saga/scanner-api.client.interface.ts`:
```ts
export const SCANNER_API_CLIENT = Symbol.for('ScannerApiClient');

export interface IScannerApiClient {
  enrollRepo(id: string, repo: string, lastSeenTag: string): Promise<void>;
  unenrollRepo(id: string): Promise<void>;
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/subscription/scanner-api.client.unit.test.ts`:
```ts
import { ScannerApiClient } from '@notifier/subscription/saga/scanner-api.client';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

vi.mock('axios');

describe('ScannerApiClient', () => {
  it('posts to the enroll endpoint', async () => {
    const post = vi.fn().mockResolvedValue({ status: 201 });
    vi.mocked(axios.create).mockReturnValue({ post, delete: vi.fn() } as any);

    const client = new ScannerApiClient();
    await client.enrollRepo('repo-1', 'owner/repo', 'v1.0.0');

    expect(post).toHaveBeenCalledWith('/internal/repos/enroll', { id: 'repo-1', repo: 'owner/repo', lastSeenTag: 'v1.0.0' });
  });

  it('deletes the unenroll endpoint', async () => {
    const del = vi.fn().mockResolvedValue({ status: 200 });
    vi.mocked(axios.create).mockReturnValue({ post: vi.fn(), delete: del } as any);

    const client = new ScannerApiClient();
    await client.unenrollRepo('repo-1');

    expect(del).toHaveBeenCalledWith('/internal/repos/repo-1');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest:unit tests/unit/subscription/scanner-api.client.unit.test.ts`
Expected: FAIL — `Cannot find module '@notifier/subscription/saga/scanner-api.client'`.

- [ ] **Step 4: Implement the client**

`src/apps/notifier/subscription/saga/scanner-api.client.ts`:
```ts
import { env } from '@shared/env';
import axios, { AxiosInstance } from 'axios';
import { injectable } from 'tsyringe';

import { IScannerApiClient } from './scanner-api.client.interface';

@injectable()
export class ScannerApiClient implements IScannerApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.SCANNER_API_URL,
      headers: { 'x-api-key': env.APP_API_KEY },
    });
  }

  async enrollRepo(id: string, repo: string, lastSeenTag: string): Promise<void> {
    await this.http.post('/internal/repos/enroll', { id, repo, lastSeenTag });
  }

  async unenrollRepo(id: string): Promise<void> {
    await this.http.delete(`/internal/repos/${id}`);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest:unit tests/unit/subscription/scanner-api.client.unit.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify**

Run: `pnpm type-check`
Expected: no errors.

---

## Task 9: RepoRepository.recreateRepo + RepoService refactor

**Files:**
- Modify: `src/apps/notifier/subscription/repository/repo.repository.interface.ts`
- Modify: `src/apps/notifier/subscription/repository/repo.repository.ts`
- Modify: `src/apps/notifier/subscription/service/repo.service.ts`

**Interfaces:**
- Produces (new `RepoService` public API, replacing `findOrCreateRepo`/`removeRepo`):
  - `findRepo(repo: string): Promise<Repository | null>`
  - `getRepoById(repoId: string): Promise<Repository | null>`
  - `validateNewRepo(repo: string): Promise<E.Either<DomainError, string>>` (resolves to the latest tag name)
  - `createRepoRecord(repo: string, lastSeenTag: string): Promise<Repository>`
  - `deleteRepoRecord(repoId: string): Promise<void>`
  - `recreateRepoRecord(repo: Repository): Promise<void>`
  - consumed by Task 10 (`SubscriptionSagaService`) and Task 11 (`SubscriptionService`).

- [ ] **Step 1: Add recreateRepo to the repository interface and implementation**

In `src/apps/notifier/subscription/repository/repo.repository.interface.ts`, add to `IRepoRepository`:
```ts
  recreateRepo(repo: Repository): Promise<void>;
```

In `src/apps/notifier/subscription/repository/repo.repository.ts`, add:
```ts
  async recreateRepo(repo: Repository): Promise<void> {
    await db.insert(repos).values({ id: repo.id, repo: repo.repo, last_seen_tag: repo.last_seen_tag, checkedAt: repo.checkedAt });
  }
```

- [ ] **Step 2: Replace RepoService's public API**

Rewrite `src/apps/notifier/subscription/service/repo.service.ts`:
```ts
import { TagFetcher, TAGS_FETCHER } from '@shared/apis/tags-fetcher.interface';
import { E } from '@shared/either';
import { totalReposCount } from '@shared/metrics';
import { DomainError, DomainErrorCode } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { inject, injectable } from 'tsyringe';

import { IRepoRepository, REPO_REPOSITORY } from '../repository/repo.repository.interface';

@injectable()
export class RepoService {
  constructor(
    @inject(REPO_REPOSITORY) private readonly repoRepository: IRepoRepository,
    @inject(TAGS_FETCHER) private readonly repoTagFetcher: TagFetcher,
  ) {}

  findRepo(repo: string): Promise<Repository | null> {
    return this.repoRepository.findByRepo(repo);
  }

  getRepoById(repoId: string): Promise<Repository | null> {
    return this.repoRepository.getRepoById(repoId);
  }

  async validateNewRepo(repo: string): Promise<E.Either<DomainError, string>> {
    const tagsResponseEither = await this.repoTagFetcher.getTags(repo);

    if (E.isLeft(tagsResponseEither)) {
      return tagsResponseEither;
    }

    const tags = tagsResponseEither.value;

    if (!tags.length) {
      return E.left({ code: DomainErrorCode.REPO_HAS_NO_TAGS, message: 'Repository has no tags' });
    }

    return E.right(tags[0].name);
  }

  async createRepoRecord(repo: string, lastSeenTag: string): Promise<Repository> {
    const newRepo = await this.repoRepository.createRepo(repo, lastSeenTag);

    totalReposCount.inc();

    return newRepo;
  }

  async deleteRepoRecord(repoId: string): Promise<void> {
    await this.repoRepository.deleteRepo(repoId);

    totalReposCount.dec();
  }

  async recreateRepoRecord(repo: Repository): Promise<void> {
    await this.repoRepository.recreateRepo(repo);

    totalReposCount.inc();
  }
}
```

This removes `findOrCreateRepo`, `createNewRepo`, and `removeRepo` — Task 11 updates the only caller (`SubscriptionService`).

- [ ] **Step 3: Verify**

Run: `pnpm type-check`
Expected: errors in `src/apps/notifier/subscription/service/subscription.service.ts` and `tests/unit/subscription/subscription.service.unit.test.ts` (they still call the old `RepoService` API) — this is expected and resolved by Task 11. Confirm the errors are exactly there and nowhere else (no other file references `findOrCreateRepo`/`removeRepo`): run `grep -rn "findOrCreateRepo\|repoService.removeRepo" src tests`.

---

## Task 10: SubscriptionSagaService (subscribe + unsubscribe sagas)

**Files:**
- Create: `src/apps/notifier/subscription/saga/subscription-saga.service.ts`
- Create: `tests/unit/subscription/subscription-saga.service.unit.test.ts`

**Interfaces:**
- Consumes: `SagaRunner`, `SagaStep` (Task 7), `IScannerApiClient`/`SCANNER_API_CLIENT` (Task 8), `RepoService` (Task 9), `ISubscriptionRepository`/`SUBSCRIPTION_REPOSITORY` (existing).
- Produces:
  - `subscribeNewRepo(email: string, repo: string, lastSeenTag: string): Promise<{ repo: Repository; subscription: Subscription }>`
  - `unenrollOrphanedRepo(repo: Repository): Promise<void>`
  - consumed by Task 11.

- [ ] **Step 1: Write the failing test**

`tests/unit/subscription/subscription-saga.service.unit.test.ts`:
```ts
import { SagaRunner } from '@notifier/subscription/saga/saga-runner';
import { IScannerApiClient } from '@notifier/subscription/saga/scanner-api.client.interface';
import { SubscriptionSagaService } from '@notifier/subscription/saga/subscription-saga.service';
import { ISubscriptionRepository } from '@notifier/subscription/repository/subscription.repository.interface';
import { RepoService } from '@notifier/subscription/service/repo.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRepo = { id: 'repo-1', repo: 'owner/repo', last_seen_tag: 'v1.0.0', checkedAt: new Date() };
const mockSubscription = { id: 'sub-1', email: 'test@gmail.com', repoId: 'repo-1', token: 'token-1', confirmed: false, createdAt: new Date() };

describe('SubscriptionSagaService', () => {
  let sagaRunner: SagaRunner;
  let repoService: RepoService;
  let subscriptionRepository: ISubscriptionRepository;
  let scannerApiClient: IScannerApiClient;
  let service: SubscriptionSagaService;

  beforeEach(() => {
    sagaRunner = { run: vi.fn() } as unknown as SagaRunner;
    repoService = {
      createRepoRecord: vi.fn().mockResolvedValue(mockRepo),
      deleteRepoRecord: vi.fn().mockResolvedValue(undefined),
      recreateRepoRecord: vi.fn().mockResolvedValue(undefined),
    } as unknown as RepoService;
    subscriptionRepository = {
      createNewSubscription: vi.fn().mockResolvedValue(mockSubscription),
      removeSubscription: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISubscriptionRepository;
    scannerApiClient = {
      enrollRepo: vi.fn().mockResolvedValue(undefined),
      unenrollRepo: vi.fn().mockResolvedValue(undefined),
    };

    service = new SubscriptionSagaService(sagaRunner, repoService, subscriptionRepository, scannerApiClient);
  });

  describe('subscribeNewRepo', () => {
    it('runs the create-then-enroll steps and returns repo + subscription', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        for (const step of steps) await step.run(ctx);
      });

      const result = await service.subscribeNewRepo('test@gmail.com', 'owner/repo', 'v1.0.0');

      expect(repoService.createRepoRecord).toHaveBeenCalledWith('owner/repo', 'v1.0.0');
      expect(subscriptionRepository.createNewSubscription).toHaveBeenCalledWith('test@gmail.com', 'repo-1');
      expect(scannerApiClient.enrollRepo).toHaveBeenCalledWith('repo-1', 'owner/repo', 'v1.0.0');
      expect(result).toEqual({ repo: mockRepo, subscription: mockSubscription });
    });

    it('undoing step 1 removes the subscription then deletes the repo', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        await steps[0].run(ctx);
        await steps[0].undo(ctx);
      });

      await service.subscribeNewRepo('test@gmail.com', 'owner/repo', 'v1.0.0');

      expect(subscriptionRepository.removeSubscription).toHaveBeenCalledWith(mockSubscription);
      expect(repoService.deleteRepoRecord).toHaveBeenCalledWith('repo-1');
    });

    it('undoing step 2 unenrolls the repo from scanner', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        await steps[0].run(ctx);
        await steps[1].undo(ctx);
      });

      await service.subscribeNewRepo('test@gmail.com', 'owner/repo', 'v1.0.0');

      expect(scannerApiClient.unenrollRepo).toHaveBeenCalledWith('repo-1');
    });
  });

  describe('unenrollOrphanedRepo', () => {
    it('runs unenroll then delete', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        for (const step of steps) await step.run(ctx);
      });

      await service.unenrollOrphanedRepo(mockRepo);

      expect(scannerApiClient.unenrollRepo).toHaveBeenCalledWith('repo-1');
      expect(repoService.deleteRepoRecord).toHaveBeenCalledWith('repo-1');
    });

    it('undoing delete recreates the repo locally', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        await steps[1].undo(ctx);
      });

      await service.unenrollOrphanedRepo(mockRepo);

      expect(repoService.recreateRepoRecord).toHaveBeenCalledWith(mockRepo);
    });

    it('undoing unenroll re-enrolls the repo in scanner', async () => {
      vi.mocked(sagaRunner.run).mockImplementation(async (_type, _payload, steps, ctx) => {
        await steps[0].undo(ctx);
      });

      await service.unenrollOrphanedRepo(mockRepo);

      expect(scannerApiClient.enrollRepo).toHaveBeenCalledWith('repo-1', 'owner/repo', 'v1.0.0');
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest:unit tests/unit/subscription/subscription-saga.service.unit.test.ts`
Expected: FAIL — `Cannot find module '@notifier/subscription/saga/subscription-saga.service'`.

- [ ] **Step 3: Implement SubscriptionSagaService**

`src/apps/notifier/subscription/saga/subscription-saga.service.ts`:
```ts
import { ISubscriptionRepository, SUBSCRIPTION_REPOSITORY } from '@notifier/subscription/repository/subscription.repository.interface';
import { RepoService } from '@notifier/subscription/service/repo.service';
import { Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { inject, injectable } from 'tsyringe';

import { SagaRunner, SagaStep } from './saga-runner';
import { IScannerApiClient, SCANNER_API_CLIENT } from './scanner-api.client.interface';

type SubscribeCtx = { repo?: Repository; subscription?: Subscription };

@injectable()
export class SubscriptionSagaService {
  constructor(
    private readonly sagaRunner: SagaRunner,
    private readonly repoService: RepoService,
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(SCANNER_API_CLIENT) private readonly scannerApiClient: IScannerApiClient,
  ) {}

  async subscribeNewRepo(email: string, repo: string, lastSeenTag: string): Promise<{ repo: Repository; subscription: Subscription }> {
    const ctx: SubscribeCtx = {};

    const steps: SagaStep<SubscribeCtx>[] = [
      {
        name: 'createRepoAndSubscriptionLocally',
        run: async c => {
          c.repo = await this.repoService.createRepoRecord(repo, lastSeenTag);
          c.subscription = await this.subscriptionRepository.createNewSubscription(email, c.repo.id);
        },
        undo: async c => {
          if (c.subscription) {
            await this.subscriptionRepository.removeSubscription(c.subscription);
          }

          if (c.repo) {
            await this.repoService.deleteRepoRecord(c.repo.id);
          }
        },
      },
      {
        name: 'enrollRepoInScanner',
        run: async c => {
          await this.scannerApiClient.enrollRepo(c.repo!.id, c.repo!.repo, c.repo!.last_seen_tag);
        },
        undo: async c => {
          if (c.repo) {
            await this.scannerApiClient.unenrollRepo(c.repo.id);
          }
        },
      },
    ];

    await this.sagaRunner.run('SUBSCRIBE', { email, repo }, steps, ctx);

    return { repo: ctx.repo!, subscription: ctx.subscription! };
  }

  async unenrollOrphanedRepo(repo: Repository): Promise<void> {
    const steps: SagaStep<object>[] = [
      {
        name: 'unenrollRepoInScanner',
        run: async () => {
          await this.scannerApiClient.unenrollRepo(repo.id);
        },
        undo: async () => {
          await this.scannerApiClient.enrollRepo(repo.id, repo.repo, repo.last_seen_tag);
        },
      },
      {
        name: 'deleteRepoLocally',
        run: async () => {
          await this.repoService.deleteRepoRecord(repo.id);
        },
        undo: async () => {
          await this.repoService.recreateRepoRecord(repo);
        },
      },
    ];

    await this.sagaRunner.run('UNSUBSCRIBE', { repoId: repo.id, repo: repo.repo }, steps, {});
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest:unit tests/unit/subscription/subscription-saga.service.unit.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `pnpm type-check`
Expected: same pre-existing errors as end of Task 9 (subscription.service.ts and its test) — resolved next in Task 11.

---

## Task 11: Wire SubscriptionSagaService into SubscriptionService

**Files:**
- Modify: `src/apps/notifier/subscription/service/subscription.service.ts`
- Modify: `src/apps/notifier/subscription/subscription.module.ts`
- Modify: `tests/unit/subscription/subscription.service.unit.test.ts`

**Interfaces:**
- Consumes: `RepoService.findRepo/getRepoById/validateNewRepo` (Task 9), `SubscriptionSagaService.subscribeNewRepo/unenrollOrphanedRepo` (Task 10).
- No new public interface — `SubscriptionService.subscribe`/`confirmUnsubscribe` signatures are unchanged (`Promise<E.Either<DomainError, void>>`), so the router/gRPC layers calling them need no changes.

- [ ] **Step 1: Rewrite SubscriptionService.subscribe and confirmUnsubscribe**

In `src/apps/notifier/subscription/service/subscription.service.ts`, add the import and constructor param, and replace the two methods:

```ts
import { SubscriptionSagaService } from '../saga/subscription-saga.service';
import { getErrorMessage } from '@shared/utils';
```

Constructor becomes:
```ts
  constructor(
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(NOTIFICATION_SERVICE) private readonly notificationService: NotificationService,
    private readonly repoService: RepoService,
    private readonly subscriptionSagaService: SubscriptionSagaService,
  ) {}
```

Replace `subscribe`:
```ts
  async subscribe(email: string, repo: string): Promise<E.Either<DomainError, void>> {
    const end = subscriptionOperationDuration.startTimer({ type: 'subscribe' });

    try {
      const existingRepo = await this.repoService.findRepo(repo);

      if (existingRepo) {
        return await this.subscribeToExistingRepo(email, existingRepo);
      }

      const validatedEither = await this.repoService.validateNewRepo(repo);

      if (E.isLeft(validatedEither)) {
        logger.info(`Something went wrong. Message: ${JSON.stringify(validatedEither.value.message)}`);

        return validatedEither;
      }

      let sagaResult: { subscription: Subscription };

      try {
        sagaResult = await this.subscriptionSagaService.subscribeNewRepo(email, repo, validatedEither.value);
      } catch (error) {
        logger.error(`Failed to enroll ${repo} in scanner: ${getErrorMessage(error)}`);

        return E.left({ code: DomainErrorCode.SCANNER_ENROLLMENT_FAILED, message: getErrorMessage(error) });
      }

      const responseEither = await this.sendConfirmationOrFail(email, sagaResult.subscription.token, repo);

      if (E.isLeft(responseEither)) {
        return responseEither;
      }

      logger.info(`Email for ${repo} successfully sent to ${email}`);

      subscriptionsTotal.inc({ status: 'sent' });

      return responseEither;
    } finally {
      end();
    }
  }
```

Replace the `confirmUnsubscribe` block that handles the orphaned repo (everything from `const repoId = ...` to the `if (!subscriptionsCount)` block):
```ts
      const repoId = foundSubscriptionEither.value.repoId;

      const subscriptionsCount = await this.subscriptionRepository.countByRepoId(repoId);

      if (!subscriptionsCount) {
        const orphanedRepo = await this.repoService.getRepoById(repoId);

        if (orphanedRepo) {
          try {
            await this.subscriptionSagaService.unenrollOrphanedRepo(orphanedRepo);
          } catch (error) {
            logger.error(`Failed to unenroll orphaned repo ${orphanedRepo.repo} from scanner: ${getErrorMessage(error)}`);
          }
        }
      }
```
(unsubscribe must succeed regardless of repo cleanup outcome — the saga's own `FAILED`/`COMPENSATED` state is the audit trail; the user-facing response doesn't change.)

- [ ] **Step 2: Register the new dependencies**

In `src/apps/notifier/subscription/subscription.module.ts`, add imports and registrations:
```ts
import { SagaRepository } from './saga/saga.repository';
import { SAGA_REPOSITORY } from './saga/saga.repository.interface';
import { SagaRunner } from './saga/saga-runner';
import { ScannerApiClient } from './saga/scanner-api.client';
import { SCANNER_API_CLIENT } from './saga/scanner-api.client.interface';
import { SubscriptionSagaService } from './saga/subscription-saga.service';
```
and inside `registerSubscriptionModule`:
```ts
  container.registerSingleton(SAGA_REPOSITORY, SagaRepository);
  container.registerSingleton(SagaRunner);
  container.registerSingleton(SCANNER_API_CLIENT, ScannerApiClient);
  container.registerSingleton(SubscriptionSagaService);
```

- [ ] **Step 3: Rewrite subscription.service.unit.test.ts**

Replace `tests/unit/subscription/subscription.service.unit.test.ts` entirely:
```ts
import { SubscriptionRepository } from '@notifier/subscription/repository/subscription.repository';
import { SubscriptionSagaService } from '@notifier/subscription/saga/subscription-saga.service';
import { RepoService } from '@notifier/subscription/service/repo.service';
import { SubscriptionService } from '@notifier/subscription/service/subscription.service';
import { E } from '@shared/either';
import { NotificationEmailService } from '@shared/notification/notification.email-service';
import { DomainErrorCode } from '@shared/types';
import { beforeEach, describe, expect, it, MockedObject, vi } from 'vitest';

const mockRepo = {
  id: 'repo-uuid',
  repo: 'owner/repo',
  last_seen_tag: 'v1.0.0',
  checkedAt: new Date(),
};

const mockSubscription = {
  id: 'sub-uuid',
  email: 'test@gmail.com',
  repoId: 'repo-uuid',
  token: 'token-uuid',
  confirmed: false,
  createdAt: new Date(),
};

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: MockedObject<SubscriptionRepository>;
  let repoService: MockedObject<RepoService>;
  let notificationEmailService: MockedObject<NotificationEmailService>;
  let subscriptionSagaService: MockedObject<SubscriptionSagaService>;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriptionRepository = new SubscriptionRepository() as MockedObject<SubscriptionRepository>;
    repoService = new RepoService({} as any, {} as any) as MockedObject<RepoService>;
    notificationEmailService = new NotificationEmailService({} as any) as MockedObject<NotificationEmailService>;
    subscriptionSagaService = { subscribeNewRepo: vi.fn(), unenrollOrphanedRepo: vi.fn() } as unknown as MockedObject<SubscriptionSagaService>;

    vi.spyOn(subscriptionRepository, 'getSubscriptionByEmailAndRepoId').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'createNewSubscription').mockResolvedValue(mockSubscription);
    vi.spyOn(subscriptionRepository, 'confirmSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'removeSubscription').mockResolvedValue(undefined);
    vi.spyOn(subscriptionRepository, 'getAllActiveSubscriptionByEmail').mockResolvedValue([]);
    vi.spyOn(subscriptionRepository, 'getSubscriptionByToken').mockResolvedValue(null);
    vi.spyOn(subscriptionRepository, 'countByRepoId').mockResolvedValue(0);

    vi.spyOn(repoService, 'findRepo').mockResolvedValue(mockRepo);
    vi.spyOn(repoService, 'validateNewRepo').mockResolvedValue(E.right('v1.0.0'));
    vi.spyOn(repoService, 'getRepoById').mockResolvedValue(mockRepo);

    vi.spyOn(notificationEmailService, 'sendConfirmationEmail').mockResolvedValue(E.right({ success: true }));
    vi.spyOn(notificationEmailService, 'sendReleaseNotification').mockResolvedValue(undefined);

    vi.mocked(subscriptionSagaService.subscribeNewRepo).mockResolvedValue({ repo: mockRepo, subscription: mockSubscription });
    vi.mocked(subscriptionSagaService.unenrollOrphanedRepo).mockResolvedValue(undefined);

    service = new SubscriptionService(subscriptionRepository, notificationEmailService, repoService, subscriptionSagaService);
  });

  describe('subscribe', () => {
    it('should return 409 if subscription already exists and is confirmed', async () => {
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: true });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_ALREADY_EXISTS);
        expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
      }
    });

    it('should resend confirmation notification if subscription exists but not confirmed', async () => {
      subscriptionRepository.getSubscriptionByEmailAndRepoId.mockResolvedValue({ ...mockSubscription, confirmed: false });

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
      expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
    });

    it('should create subscription for existing repo without running the saga', async () => {
      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
    });

    it('should run the subscribe saga and send a confirmation email for a brand-new repo', async () => {
      repoService.findRepo.mockResolvedValue(null);

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionSagaService.subscribeNewRepo).toHaveBeenCalledWith('test@gmail.com', 'owner/repo', 'v1.0.0');
      expect(notificationEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@gmail.com', mockSubscription.token, 'owner/repo');
    });

    it('should return REPO_HAS_NO_TAGS if the new repo has no tags', async () => {
      repoService.findRepo.mockResolvedValue(null);
      repoService.validateNewRepo.mockResolvedValue(E.left({ code: DomainErrorCode.REPO_HAS_NO_TAGS, message: 'Repository has no tags' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.REPO_HAS_NO_TAGS);
        expect(subscriptionSagaService.subscribeNewRepo).not.toHaveBeenCalled();
      }
    });

    it('should return SCANNER_ENROLLMENT_FAILED if the saga throws', async () => {
      repoService.findRepo.mockResolvedValue(null);
      subscriptionSagaService.subscribeNewRepo.mockRejectedValue(new Error('scanner unreachable'));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SCANNER_ENROLLMENT_FAILED);
        expect(notificationEmailService.sendConfirmationEmail).not.toHaveBeenCalled();
      }
    });

    it('should return EMAIL_SEND_FAILURE if confirmation email fails after a successful saga', async () => {
      repoService.findRepo.mockResolvedValue(null);
      notificationEmailService.sendConfirmationEmail.mockResolvedValue(E.left({ success: false, message: 'SMTP error' }));

      const result = await service.subscribe('test@gmail.com', 'owner/repo');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.EMAIL_SEND_FAILURE);
      }
    });
  });

  describe('confirmSubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmSubscribe('invalid-token');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_NOT_FOUND);
        expect(subscriptionRepository.confirmSubscription).not.toHaveBeenCalled();
      }
    });

    it('should confirm subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmSubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.confirmSubscription).toHaveBeenCalledWith(mockSubscription);
    });
  });

  describe('confirmUnsubscribe', () => {
    it('should return 404 if token not found', async () => {
      const result = await service.confirmUnsubscribe('invalid-token');

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.value.code).toBe(DomainErrorCode.SUBSCRIPTION_NOT_FOUND);
        expect(subscriptionRepository.removeSubscription).not.toHaveBeenCalled();
      }
    });

    it('should remove subscription for valid token', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
      expect(subscriptionRepository.removeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should run the unenroll saga if no subscriptions are left for the repo', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);

      await service.confirmUnsubscribe('token-uuid');

      expect(subscriptionSagaService.unenrollOrphanedRepo).toHaveBeenCalledWith(mockRepo);
    });

    it('should not run the unenroll saga if other subscriptions exist', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(1);

      await service.confirmUnsubscribe('token-uuid');

      expect(subscriptionSagaService.unenrollOrphanedRepo).not.toHaveBeenCalled();
    });

    it('should still return success if the unenroll saga throws', async () => {
      subscriptionRepository.getSubscriptionByToken.mockResolvedValue(mockSubscription);
      subscriptionRepository.countByRepoId.mockResolvedValue(0);
      subscriptionSagaService.unenrollOrphanedRepo.mockRejectedValue(new Error('scanner unreachable'));

      const result = await service.confirmUnsubscribe('token-uuid');

      expect(E.isRight(result)).toBe(true);
    });
  });

  describe('getAllSubscriptionsByEmail', () => {
    it('should return empty array if no subscriptions found', async () => {
      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('should return mapped subscriptions with repo data', async () => {
      subscriptionRepository.getAllActiveSubscriptionByEmail.mockResolvedValue([
        { subscriptions: mockSubscription, repos: mockRepo },
      ] as any);

      const result = await service.getAllSubscriptionsByEmail('test@gmail.com');

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.value).toEqual([{
          email: 'test@gmail.com',
          repo: 'owner/repo',
          confirmed: true,
          last_seen_tag: 'v1.0.0',
        }]);
      }
    });
  });
});
```

- [ ] **Step 4: Run the rewritten test**

Run: `pnpm vitest:unit tests/unit/subscription/subscription.service.unit.test.ts`
Expected: all PASS.

- [ ] **Step 5: Full verification**

Run: `pnpm type-check && pnpm lint`
Expected: no errors.

Run: `pnpm vitest:unit`
Expected: all PASS across the whole unit suite.

---

## Task 12: Update the existing subscription API integration test for the saga

**Files:**
- Modify: `tests/integration/subscription/subscription.api.int.test.ts`

**Interfaces:**
- Consumes: `SCANNER_API_CLIENT`/`IScannerApiClient` (Task 8), `SAGA_REPOSITORY`/`SagaRunner` (Task 7), `sagas` table (Task 6).

This existing test hits notifier's real Express server end-to-end. Since `subscribe`/`confirmUnsubscribe` now run through the saga for new repos, this test must mock the scanner boundary (`IScannerApiClient`) the same way it already mocks `TagFetcher` and `NotificationService`, and register the real saga classes so DI resolution succeeds.

- [ ] **Step 1: Register the saga dependencies and a mocked ScannerApiClient**

At the top of `tests/integration/subscription/subscription.api.int.test.ts`, add imports:
```ts
import { SagaRepository } from '@notifier/subscription/saga/saga.repository';
import { SAGA_REPOSITORY } from '@notifier/subscription/saga/saga.repository.interface';
import { SagaRunner } from '@notifier/subscription/saga/saga-runner';
import { IScannerApiClient, SCANNER_API_CLIENT } from '@notifier/subscription/saga/scanner-api.client.interface';
import { SubscriptionSagaService } from '@notifier/subscription/saga/subscription-saga.service';
import { db, repos, sagas, subscriptions } from '@shared/db';
```
(replace the existing `import { db, repos, subscriptions } from '@shared/db';` with the line above, adding `sagas`).

Add the mock and its registration next to `mockTagFetcher`/`mockNotificationService`:
```ts
const mockScannerApiClient = {
  enrollRepo: vi.fn(),
  unenrollRepo: vi.fn(),
} satisfies IScannerApiClient;

container.register(SCANNER_API_CLIENT, { useValue: mockScannerApiClient });
container.registerSingleton(SAGA_REPOSITORY, SagaRepository);
container.registerSingleton(SagaRunner);
container.registerSingleton(SubscriptionSagaService);
```

- [ ] **Step 2: Reset the mock and clean up the sagas table around each test**

In the `beforeEach`, add:
```ts
    mockScannerApiClient.enrollRepo.mockResolvedValue(undefined);
    mockScannerApiClient.unenrollRepo.mockResolvedValue(undefined);
    await db.delete(sagas);
```
In the `afterAll`, add `await db.delete(sagas);` before `await db.$client.end();`.

- [ ] **Step 3: Run the existing suite to confirm nothing else broke**

Run: `LAUNCH_TEST_CONTAINERS=true pnpm vitest:integration tests/integration/subscription/subscription.api.int.test.ts`
Expected: all pre-existing tests PASS (they now implicitly exercise the saga's happy path, since `mockScannerApiClient.enrollRepo` resolves successfully).

- [ ] **Step 4: Add saga-specific failure-path tests**

Inside the `describe('POST /notifier/subscribe', ...)` block, add:
```ts
    it('should return 500 and roll back the subscription if scanner enrollment fails', async () => {
      mockScannerApiClient.enrollRepo.mockRejectedValue(new Error('scanner unreachable'));

      const res = await authed(request(server).post('/notifier/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });

      expect(res.status).toBe(500);

      const subsInDb = await db.select().from(subscriptions);
      const reposInDb = await db.select().from(repos);
      expect(subsInDb).toHaveLength(0);
      expect(reposInDb).toHaveLength(0);

      const [saga] = await db.select().from(sagas);
      expect(saga.status).toBe('COMPENSATED');
    });
```

Inside the `describe('GET /notifier/unsubscribe/:token', ...)` block, add:
```ts
    it('should still remove the subscription even if scanner unenrollment fails', async () => {
      await authed(request(server).post('/notifier/subscribe'))
        .send({ email: 'test@gmail.com', repo: 'owner/repo' });
      const [sub] = await db.select().from(subscriptions);
      await request(server).get(`/notifier/confirm/${sub.token}`);

      mockScannerApiClient.unenrollRepo.mockRejectedValue(new Error('scanner unreachable'));

      const res = await request(server).get(`/notifier/unsubscribe/${sub.token}`);
      expect(res.status).toBe(200);

      const subsInDb = await db.select().from(subscriptions);
      expect(subsInDb).toHaveLength(0);

      const [saga] = await db.select().from(sagas).orderBy(sagas.createdAt);
      expect(saga.status).toBe('FAILED');
    });
```

Check the swagger/route-level error mapping returns `500` for `SCANNER_ENROLLMENT_FAILED`: run `grep -n "DomainErrorCode\." src/apps/notifier/subscription/subscription.router.ts` to see the existing status-code mapping switch/if-chain, and add a case for `SCANNER_ENROLLMENT_FAILED -> 500` following the same pattern used for other unmapped/server-side error codes there (e.g. `EMAIL_SEND_FAILURE`).

- [ ] **Step 5: Run the full integration suite**

Run: `LAUNCH_TEST_CONTAINERS=true pnpm vitest:integration tests/integration/subscription`
Expected: all PASS.

---

## Task 13: Dedicated scanner-postgres testcontainer for CI

**Files:**
- Create: `src/shared/tests/testcontainers/scanner-postgres.container.ts`
- Modify: `src/shared/tests/testEnv.ts`

**Interfaces:**
- Consumes: `env.SCANNER_POSTGRES_URL` (Task 1).
- Produces: an additional container launched by `spinUpDockerContainers()`, with scanner's migrations applied — removes the Task 5/2 dependency on a manually pre-started `scanner-postgres` container for CI runs.

- [ ] **Step 1: Create the scanner postgres testcontainer**

`src/shared/tests/testcontainers/scanner-postgres.container.ts`:
```ts
import { env } from '@shared/env';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const { pathname, password, username, port } = new URL(env.SCANNER_POSTGRES_URL);

export const scannerPostgresContainer = new PostgreSqlContainer('postgres:16-alpine')
  .withExposedPorts({
    container: 5432,
    host: Number(port),
  })
  .withNetworkAliases('scanner-postgres')
  .withDatabase(pathname.substring(1))
  .withUsername(username)
  .withPassword(password);
```

- [ ] **Step 2: Launch it and migrate scanner's schema in testEnv.ts**

In `src/shared/tests/testEnv.ts`, add the import and include it in the container list, then run the scanner migration after the notifier one:
```ts
import { scannerPostgresContainer } from '@shared/tests/testcontainers/scanner-postgres.container';
```
```ts
export const spinUpDockerContainers = async () => {
  runningContainers = await launchTestContainers([redisContainer, postgresContainer, scannerPostgresContainer]).catch((error: unknown) => {
    logger.error('Error launching test containers', { error });
  });

  logger.info(`all containers launched`);

  await migrate(db, { migrationsFolder: './migrations' });

  const scannerClient = postgres(env.SCANNER_POSTGRES_URL);
  await migrate(drizzle(scannerClient), { migrationsFolder: './migrations-scanner' });
  await scannerClient.end();

  logger.info('migrations applied');
};
```
Add the two new imports needed for the inline scanner migration: `import { drizzle } from 'drizzle-orm/postgres-js';` and `import postgres from 'postgres';`.

- [ ] **Step 3: Verify both integration suites pass end-to-end without any manually pre-started containers**

Run: `docker compose down` (stop any manually started local containers so the test run is fully isolated), then:
`LAUNCH_TEST_CONTAINERS=true pnpm vitest:integration`
Expected: all integration tests PASS, including `tests/integration/scanner/scanner.service.int.test.ts` and `tests/integration/subscription/subscription.api.int.test.ts`, with no manual `docker compose up` step required beforehand.

---

## Task 14: One-off backfill script for already-tracked repos

**Files:**
- Create: `scripts/backfill-tracked-repos.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: notifier's `repos` table (existing), `IScannerApiClient.enrollRepo` (Task 8).

This is a one-time operational script for environments that already have rows in notifier's `repos` table before this change ships — it enrolls each one into scanner's new `tracked_repos` table so scanning doesn't silently stop for pre-existing subscriptions. It is not part of the saga code path and is run manually, once, after deploying.

- [ ] **Step 1: Write the script**

`scripts/backfill-tracked-repos.ts`:
```ts
import 'reflect-metadata';

import { db, repos } from '@shared/db';
import { env } from '@shared/env';
import { logger } from '@shared/logger';
import axios from 'axios';

async function backfill() {
  const allRepos = await db.select().from(repos);

  logger.info(`Backfilling ${allRepos.length} repos into scanner`);

  const http = axios.create({
    baseURL: env.SCANNER_API_URL,
    headers: { 'x-api-key': env.APP_API_KEY },
  });

  for (const repo of allRepos) {
    await http.post('/internal/repos/enroll', { id: repo.id, repo: repo.repo, lastSeenTag: repo.last_seen_tag });
    logger.info(`Enrolled ${repo.repo}`);
  }

  await db.$client.end();

  logger.info('Backfill complete');
}

void backfill();
```

- [ ] **Step 2: Add a package.json script to run it**

```json
    "backfill:tracked-repos": "ts-node scripts/backfill-tracked-repos.ts",
```

- [ ] **Step 3: Verify it runs against local dev containers**

Run: `pnpm docker:up:local` then (with notifier and scanner dev servers running via `pnpm dev:app -- src/apps/notifier/main.ts` and `pnpm dev:scanner` in separate terminals) `pnpm backfill:tracked-repos`
Expected: logs one "Enrolled ..." line per pre-existing row in notifier's `repos` table (zero lines on a fresh dev DB is also correct — confirms the script runs without error).

---

## Plan-level final verification

- [ ] Run `pnpm type-check && pnpm lint && pnpm vitest:unit`
Expected: all pass, zero lint errors.
- [ ] Run `LAUNCH_TEST_CONTAINERS=true pnpm vitest:integration`
Expected: all pass.
- [ ] Manually smoke-test the full subscribe → confirm → unsubscribe cycle against `pnpm docker:up:local` and confirm rows appear/disappear in both `github_notifier` and `scanner` databases, and that `sagas` rows end up `COMPLETED`.
