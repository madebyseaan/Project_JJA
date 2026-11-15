# 0001 — Static SPA + Supabase, no Next.js server

**Status:** Accepted
**Date:** 2026-11-15

## Context

The original plan used Next.js 16 with the OpenNext Cloudflare adapter, server-rendered on Cloudflare Workers Free. Workers Free allows 10ms of CPU per request. Next.js server rendering regularly exceeds that, especially on cold starts, and a low-traffic shop hits cold starts constantly. The result would be random 1102 errors in production.

The app is also almost entirely interactive client-side work: catalog search, cart, bay queue, inventory tables. There is no page whose value depends on server rendering, and there are no SEO requirements.

## Decision

Build the front end as a static React + Vite single-page application, hosted on Cloudflare Workers static assets. Use Supabase for authentication, PostgreSQL, Realtime, and (phase 2) storage. Do not run any server code.

## Consequences

- ₱0 hosting remains realistic: static asset requests do not consume Worker CPU.
- No Next.js, OpenNext, Serwist, or server actions.
- Dynamic routes use the SPA fallback (`/ticket/:id`, `/r/:token`).
- Authentication is handled by Supabase Auth in the browser.
- All sensitive logic lives in PostgreSQL functions, not an API layer.
- The app cannot pre-render a public catalog for search engines. That is irrelevant for a local shop and can be addressed later if needed.
- Deployments are a static file upload, which is fast and easy to roll back.
