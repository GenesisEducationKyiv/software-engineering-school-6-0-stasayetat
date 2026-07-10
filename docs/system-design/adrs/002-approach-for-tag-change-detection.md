# ADR-002: [Approach for Tag Change Detection]

---

## Context

The system needs to detect new tag releases in GitHub repositories and subscribed users when changes happen.
This can be done through two approaches: fetching tags using GitHub API or use real-time webhooks from GitHub API.
Project is in early stage, so delivery time are not yet critical concerns

---

## Decisions

### 1. Polling using cron job
- Pros: Simple to implement, easy to debug, popular approach
- Cons: Introduces up to 30 minutes notification delay, makes redundant API calls even when nothing changed

### 2. GitHub WebHooks
- Pros: Real-time delivery, better resources consuming, scales efficiently
- Cons: Complex implementation, subscription for each repository

### Decision Made
Polling using cron job

---

## Consequences

### Positive
- Fast to implement without additional infrastructure
- Cron job is easy to adjust without big changes

### Negative
- Notifications are delayed by up to 30 minutes after a tag is released
- Will not scale well as the number of tracked repositories grows
- GitHub API is called on every tick even when nothing changes, which wastes rate limit quota.

