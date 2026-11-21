# 0006 — Autonomous phase-1 build with delegated approval

**Status:** Accepted
**Date:** 2026-11-21

## Context

The roadmap normally gates every step on the architect's review: build one step, demo it, wait for **approved**, then start the next. On 21 Nov 2026 the architect asked for the remaining phase-1 build to run autonomously while he was unavailable, with the instruction to make best-practice decisions and not ask questions.

The engineering contract still requires evidence, database enforcement, tests, and `npm run check` for every step. Those rules do not relax because the review pause is suspended.

## Decision

- Treat the 21 Nov instruction as delegated approval for Steps 03–08.
- Keep the roadmap as the delivery order and update each step to **Done — verified** only after `npm run check` and the CI database job pass.
- Merge each step through a pull request after CI is green; do not merge a red branch.
- Keep every database change in a migration, every money/stock change behind an RPC, and every stock change in the ledger.
- Stop at external-account boundaries: Cloudflare, production Supabase secrets, UptimeRobot, and real-device UAT are not invented or faked.
- Record decisions that would normally be asked as questions in the plan, the roadmap, or this ADR.

## Consequences

- The architect still owns launch approval and real-shop UAT; the delegation does not claim that a real sale has been tested.
- A decision made autonomously can be reversed later, but it must be recorded rather than discovered in the diff.
- Screenshots captured with mocked auth/data are layout evidence only; they are labelled as such.
- If a later review rejects a step, the fix is a new pull request; completed migrations are never edited after they reach `main`.
