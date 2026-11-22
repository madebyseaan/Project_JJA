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
3. On success, the deploy job builds and runs `wrangler deploy`.
4. Open the production URL and run the smoke test:
   - sign in as the mechanic,
   - create a test ticket,
   - add a part,
   - complete with cash,
   - open the receipt,
   - verify the receipt,
   - check that stock decreased,
   - sign in as the owner and confirm the sale appears,
   - void the test sale or leave it as a training record (do not leave fake money in the drawer).

### Manual deploy (incident only)

```bash
npm ci
npm run check
npm run deploy
```

Record why the normal path was bypassed.

### PWA updates

- The service worker uses `prompt`, not auto-update. Staff see **A new version is ready** and tap **Update now**.
- Never force a reload while a ticket form is open.
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

```bash
# after creating a migration
npm run db:push        # apply to the linked project (staging first)
npm run db:types       # regenerate types
npm run db:types:check # confirm the generated file is current
```

Rules:

- Apply to staging, test, then production.
- Never edit an applied migration.
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

### Receipt HMAC secret

The secret is stored in `private.app_secrets` and backed up in GitHub Actions. Rotating it invalidates verification for old receipts unless you keep the old key for verification. For phase 1, do not rotate it. If it is exposed, plan a migration that stores a `key_version` per receipt and keeps old keys for verification.

---

## 9. Add or change staff

1. Choose an employee ID, e.g. `JJA-003`.
2. Create the user in Supabase Auth with the hidden email `<employee-id>@staff.jja.internal` (lowercase), a password, and **Auto Confirm User** on. The address is never used for mail.
3. The `profiles` trigger creates a `mechanic` profile with the employee ID.
4. Set `display_name` and, if needed, role to `owner` or `mechanic` deliberately.
5. Ask the user to sign in with the employee ID, set a PIN, and install the PWA.
6. Test the role: a mechanic must not see owner routes or be able to call owner functions.

---

## 10. Daily close

1. Owner opens **Owner → Day Close**.
2. Compare expected cash with the physical drawer.
3. Enter the counted cash and notes.
4. Investigate any variance above the shop's tolerance. Check:
   - voided sales,
   - deposits,
   - GCash/Maya references,
   - missing receipt numbers in the integrity report.
5. The close is a snapshot; it does not lock the day.

---

## 11. Receipt integrity

Owner → Audit → **Check integrity**.

It reports:

- receipts whose stored hash does not match the recomputed hash,
- missing receipt numbers for each business date,
- voided sales.

If a mismatch appears:

1. Do not edit the row.
2. Compare the snapshot with the ticket and payments.
3. Check the audit log and Supabase database logs.
4. If the database was tampered with, restore from the last known-good backup and investigate access.
5. Rotate credentials if compromise is suspected.

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
5. Is data wrong? Check the audit log and stock ledger before changing anything.
6. Is a receipt disputed? Verify the number and code; compare the snapshot.
7. Is a device lost? Revoke sessions and change the password.
8. Write down what happened and update this runbook.
