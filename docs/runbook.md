# Runbook

Operations manual for the shop app. Keep this current. If a procedure changes, update it in the same pull request.

---

## 1. Environments

| Environment | Supabase | Cloudflare | Purpose |
|---|---|---|---|
| Local | Staging project (or local Supabase with Docker) | Vite dev server | Development |
| Staging | Supabase `staging` | Optional preview | Migration testing, UAT |
| Production | Supabase `production` | Workers static assets | The shop |

The Supabase Free plan allows two active projects. Do not create a third without pausing one.

---

## 2. Deploy

### Normal deploy

1. Merge a pull request to `main`.
2. GitHub Actions runs typecheck, lint, format, unit tests, database tests, build, and E2E.
3. On success, the deploy workflow applies pending migrations with `supabase db push --remote "$SUPABASE_DB_URL"` using the CI secret. If the secret is missing or the migration fails, the deploy stops.
4. The deploy job then builds and runs `wrangler deploy`.
5. Open the production URL and run the smoke test on staging or with a real order:
   - sign in as Dad or Uncle,
   - open **Orders**, change the date, and confirm today’s totals load,
   - create an order with one catalog item, labor, a cash payment, and check the daily total,
   - open the order and share its digital receipt,
   - open **Reports** and confirm the month total,
   - open **GCash** and confirm the shop-held balance,
   - do not leave a fake order in production reports. Use staging for destructive smoke tests.

### Manual deploy (incident only)

```bash
npm ci
npm run check
npx supabase db push --remote "$SUPABASE_DB_URL" --yes
npm run deploy
```

Record why the normal path was bypassed.

### PWA updates

- The service worker uses `prompt`, not auto-update. Staff see **A new version is ready** and tap **Update now**.
- Never force a reload while an order form is open.
- The service worker is `NetworkOnly` for every `*.supabase.co` request. Do not add runtime caching for Supabase.
- If a device is stuck on an old shell, close every app tab and reopen the PWA. As a last resort, clear site data for the app origin; this also clears the local PIN and requires a password sign-in.

---

## 3. Rollback

1. Find the last known-good commit on `main`.
2. Revert the bad commit with a pull request, or redeploy the previous commit through Actions.
3. If Cloudflare has a previous version, `wrangler rollback` is the fastest option.
4. Run the smoke test again.
5. If the database migration is the problem, roll forward with a new migration. Do not edit an applied migration.

---

## 4. Migrations

1. Write the migration in `supabase/migrations`.
2. Run `npx supabase db reset` locally if Docker is available, then `npm run test:db`.
3. If Docker is unavailable, push the branch and let CI run the database job.
4. Apply to staging first with `npm run db:push`, then test the app.
5. After the migration is applied, run `npm run db:types` if the project has `src/types/database.types.ts`, and commit it.
6. Apply to production only after CI and staging pass.

```bash
# after creating a migration
npm run db:push        # apply to the linked project (staging first)
npm run db:types       # regenerate types when the generated file exists
npm run db:types:check # confirm the generated file is current
```

Rules:

- Apply to staging, test, then production.
- Never edit an applied migration. Roll forward with a new one.
- Never change the schema in the Supabase dashboard.
- Back up before a destructive migration.
- A migration that drops or renames a column needs a data migration and a rollback note.

---

## 5. Backups

### Automatic

- `.github/workflows/backup.yml` runs `pg_dump` nightly at 16:00 UTC (midnight Manila).
- The dump is uploaded as a workflow artifact and kept for 90 days.
- Required secret: `SUPABASE_DB_URL` (the production Postgres connection string, including the password).
- On the first day of each month, copy the latest artifact to the private backup location. GitHub artifacts expire.
- The receipt HMAC secret is backed up separately in GitHub Actions secrets. Without it, old receipt codes cannot be verified.

### Required deployment secrets

| Secret | Used by | Purpose |
|---|---|---|
| `SUPABASE_DB_URL` | `backup.yml` | Production `pg_dump` |
| `SUPABASE_URL` | `keepalive.yml` | Daily `ping()` endpoint |
| `SUPABASE_ANON_KEY` | `keepalive.yml` | Public anon key for `ping()` |
| `VITE_SUPABASE_URL` | `deploy.yml` | Baked into the production SPA build |
| `VITE_SUPABASE_ANON_KEY` | `deploy.yml` | Baked into the production SPA build |
| `CLOUDFLARE_API_TOKEN` | `deploy.yml` | Deploy the static Worker |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml` | Select the Cloudflare account |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public by design, but they still belong in GitHub secrets so the production build never points at staging by mistake. The deploy workflow will not build without them.

`SUPABASE_DB_URL` must be the Supabase **Session pooler** connection string, not the direct `db.<ref>.supabase.co` host. GitHub-hosted runners do not have IPv6, and the direct database host resolves to IPv6. The pooler URL looks like:

```text
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Get it from Supabase **Connect → Session pooler**. The transaction pooler on port 6543 does not support `pg_dump`.

Never put the service-role key in a `VITE_*` variable or the browser. `SUPABASE_DB_URL` and the service-role key are CI-only.

### Manual backup before a risky change

```bash
pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges --file="backup-$(date +%F).dump"
```

### Restore drill (quarterly)

1. Create or reset a staging database.
2. Restore the latest dump.
3. Run `npm run db:types` and the smoke test against staging.
4. Confirm a sample receipt still verifies, including the HMAC code.
5. Record the date and result in the team notes.

A backup that has never been restored is not a backup.

---

## 6. Supabase project paused

Symptom: the app shows network errors; the Supabase dashboard says the project is paused.

1. Open the Supabase dashboard and resume the project. Paused projects can be restored for up to one year.
2. Confirm the keep-alive workflow has been running. Check its recent runs.
3. If the keep-alive is failing, fix the workflow and run it manually.
4. Run the smoke test.
5. Post-mortem: why did the project see no activity? The daily `ping()` should prevent this.

---

## 7. Lost or shared device

1. Sign in to the Supabase dashboard as the project owner.
2. Revoke the user's sessions (Auth → Users → sign out) or reset the password.
3. If the device is lost, change the password and rotate any device-stored session.
4. The local PIN is not a security boundary; assume the session could be used until revoked.
5. Review the audit log for unexpected activity.

---

## 8. Rotate keys

### Supabase anon key

1. Rotate the anon key in the Supabase dashboard.
2. Update the GitHub Actions secret and `.env.local`.
3. Redeploy.
4. Old clients fail until they reload; acceptable for a two-device shop.

### Supabase service-role key

1. Rotate in the dashboard.
2. Update GitHub Actions secrets.
3. Never put it in the frontend.

### Legacy receipt HMAC secret

The secret is stored in `private.app_secrets` and backed up in GitHub Actions. It is used only by the legacy receipt and verification functions. New sales-log digital receipts use a random public token and do not use HMAC. Do not rotate the legacy secret unless old receipt verification is intentionally retired; if it is exposed, plan a migration that stores a `key_version` per old receipt and keeps old keys for verification.

---

## 9. Add or change staff

1. Choose an employee ID, e.g. `JJA-003`.
2. Create the user in Supabase Auth with the hidden email `<employee-id>@staff.jja.internal` (lowercase), a password, and **Auto Confirm User** on. The address is never used for mail.
3. The `profiles` trigger creates a `mechanic` profile with the employee ID.
4. Set `display_name`. The sales log does not use the legacy `owner`/`mechanic` role for access.
5. Ask the user to sign in with the employee ID, set a PIN, and install the PWA.
6. Test access: the new user must see **Orders**, **Items**, **Reports**, and **Settings**, and must be able to create an order. Anon users must not read sales tables.

---

## 10. Daily sales review

1. Open **Orders** and confirm today’s date.
2. Check parts, labor, cash, GCash, and the order count.
3. Open each order if a number looks wrong; edit the order while the month is open.
4. Open **Reports** for the month and compare the daily rows with the paper record.
5. Open **GCash** and confirm who is holding shop money.
6. Record any transfer to the shop bank as soon as it happens.
7. Month close, QuickBooks export, and month lock arrive in the next step; until then, do not promise a locked month.

### Import the QuickBooks item list

1. In QuickBooks Desktop, export **Lists → Item List → Excel/CSV**.
2. Run the one-time importer with a staff account and the private CSV:

```bash
SUPABASE_URL=... \
SUPABASE_ANON_KEY=... \
STAFF_EMPLOYEE_ID=JJA-001 \
STAFF_PASSWORD=... \
node scripts/import-quickbooks-items.mjs --file draft.CSV
```

3. Expect counts such as `1,053 new, 0 updated, 266 skipped`. A second run must show `0 new, 1,053 updated`.
4. Only active **Inventory Part** rows are imported. Stock quantities are ignored.
5. The CSV stays outside the repository. Never commit it.

---

## 11. Digital receipt checks

- The receipt is optional and public at `/s/<token>`.
- It shows the order number, date, items, labor, optional tip, total charged, payments, change, and net paid.
- It never shows the internal labor split, costs, or notes.
- If a customer disputes a receipt, open the order in **Orders** and compare the values. There is no verification code in the current phase.
- The old `/r/<token>` receipt and `/verify` page remain only for legacy links and old records.

---

## 12. Free-tier limits

| Resource | Free limit | What to watch |
|---|---|---|
| Database | 500 MB | Years away for this shop |
| Storage | 1 GB | Phase 2 photos; 150 KB each |
| Egress | 5 GB/month | A small shop is far below |
| Realtime | 2M messages/month, 200 connections | Two devices |
| Projects | 2 active | Staging + production |
| Pausing | After 7 days of low activity | Daily keep-alive |
| Backups | None | Nightly dump is mandatory |

If a limit is approached, export data and review the paid plan. The upgrade path is Supabase Pro at $25/month; the data remains portable PostgreSQL.

---

## 13. Incident checklist

1. Is the app reachable? Check UptimeRobot and Cloudflare.
2. Is Supabase paused or erroring? Check the dashboard.
3. Is it a bad deploy? Roll back.
4. Is it a bad migration? Roll forward with a fix; do not edit history.
5. Is data wrong? Check the order, GCash allocations, audit events, and database logs before changing anything.
6. Is a receipt disputed? Open the order by number and compare the digital receipt. There is no verification code in the current phase.
7. Is a device lost? Revoke sessions and change the password.
8. Write down what happened and update this runbook.
