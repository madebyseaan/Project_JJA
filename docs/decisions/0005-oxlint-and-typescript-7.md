# 0005 — Oxlint + Prettier instead of ESLint

**Status:** Accepted
**Date:** 2026-11-15

## Context

The Vite 9 React + TypeScript template ships TypeScript 7.0.2. The current `typescript-eslint` release (8.72.2) declares a peer range of `typescript >=4.8.4 <6.1.0`, so it does not support the project's TypeScript version. Installing ESLint would require downgrading TypeScript or running an unsupported parser.

The template already includes Oxlint, a fast Rust-based linter with React, TypeScript, accessibility, and import rules. Type errors are covered separately by `tsc -b`.

## Decision

- Lint with **Oxlint** via `npm run lint`.
- Format with **Prettier** via `npm run format` and `npm run format:check`.
- Keep rules in `.oxlintrc.json`.
- Do not add ESLint in phase 1.

## Consequences

- Lint runs in milliseconds with no type-aware rules; `tsc -b` remains the type gate.
- If `typescript-eslint` adds TypeScript 7 support and the project needs type-aware lint rules, revisit this decision with a new ADR.
- The `npm run check` pipeline is unchanged: typecheck, lint, format check, unit tests, build.
