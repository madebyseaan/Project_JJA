# 0002 — Database functions only for writes

**Status:** Accepted
**Date:** 2026-11-15

## Context

The Supabase anon key is public by design. Row Level Security can protect reads, but a client that can insert or update rows directly can forge prices, quantities, payments, and receipts. A small shop cannot afford inventory drift or a receipt that does not match the money in the drawer.

## Decision

- Reads use PostgREST with RLS.
- All transactional writes go through `security definer` PostgreSQL functions.
- The functions validate inputs, check roles, lock stock rows, compute totals, write the ledger and audit trail, and return the result — all in one transaction.
- Direct `INSERT`, `UPDATE`, and `DELETE` grants on transactional tables are revoked from `authenticated`.
- Functions set `search_path = ''`, fully qualify object names, revoke execution from `PUBLIC`, and grant execution explicitly.
- Secrets, counters, and helper functions live in the `private` schema, which is not exposed by the API.

## Consequences

- The database is the security boundary, not the UI.
- Business rules are testable with database integration tests.
- More work per feature than direct table access, but far fewer integrity bugs.
- Schema changes require migrations and regenerated TypeScript types.
- The browser can only do what a function allows, even if the UI is bypassed.
- Service-role access is limited to CI and administrative scripts.
