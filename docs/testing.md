# Testing

## Requirements

Integration tests use `Testcontainers` to spin up Postgres and Redis automatically, so no manual `docker-compose` needed

---

## Running tests

### Unit tests

```bash
pnpm vitest:unit run
```

### Integration tests

Docker must be running. Everything else starts automatically.

```bash
pnpm vitest:integration run
```

### All tests at once

```bash
pnpm vitest:unit run && pnpm vitest:integration run
```
