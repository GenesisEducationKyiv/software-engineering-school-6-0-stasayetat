# ADR-001: [Missing email verification for subscriptions]

---

## Context

Any anonymous request can submit any email to subscribe to any repository. This cause two issues:
- We cannot assume that the person submitting the form owns the email they provided.
- Without verification the subscriptions table could accumulate thousands of unverified, maybe fake emails that waste resources during scanning

This can be done through full authentication flow or using a separate email confirmation for each subscription

---

## Decision

### 1. Full authentication (OAuth / password-based accounts)
- Pros: Strong identity guarantee, enables user dashboard, session management
- Cons: Massive scope increase, requires heavy infrastructure, too complex for a simple notification use case

### 2. Separate email confirmation per subscription
- Pros: Proves email ownership without requiring an account, low infrastructure overhead
- Cons: Adds one extra step before subscription is active, requires token storage

### 3. No verification
- Pros: Simplest implementation
- Cons: Opens the system to spam, wastes resources on notifications to fake emails

### Decision Made
Separate email confirmation per subscription

---

## Consequences

### Positive
- Only verified emails can activate subscriptions, no fake/abuse emails
- Subscriptions table is clean
- No overhead complex infrastructure, good option for small notification service
- Common email verification approach

### Negative
- Extra step before activate subscription
- Requires token storage
