# 0004 — No local Docker at the start

**Status:** Accepted
**Date:** 2026-11-15

## Context

The development laptop runs Windows and does not have Docker installed. Supabase's local development stack requires Docker. Installing and maintaining Docker Desktop adds setup time and resource use before any product code exists.

GitHub Actions' Ubuntu runners have Docker, so database integration tests can run there without local Docker.

## Decision

- Use a free Supabase `staging` project for manual development.
- Use the second free project for `production`.
- Run database integration tests in GitHub Actions with `supabase start`.
- Do not require Docker on the laptop for phase 1.
- Add Docker later only if local database tests become necessary.

## Consequences

- Local database tests are not available without Docker; `npm run test:db` may be skipped locally and must pass in CI.
- The staging project must be treated carefully: never run destructive commands against it without a backup.
- `db:reset` is local-only and must refuse to run against a linked remote project.
- Two active Supabase projects is the free-tier limit; do not create a third.
- CI is the authoritative database test environment.
