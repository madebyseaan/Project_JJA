# Setup

First-run setup for the shop app. Keep this current when the process changes.

**Project:** one Supabase project (`jja-pos-staging`) and one Cloudflare account.
**Production:** a second Supabase project is created at launch, not now.

---

## 1. Requirements

- Node.js 24+
- npm 11+
- A Supabase account with the project already created
- The project's database password, saved in a password manager
- Docker is optional. Database tests can run against the staging project, and CI runs them in Docker.

---

## 2. App environment

`.env.local` is gitignored. It holds the public connection details:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

The publishable key is safe in the browser. Never put a `service_role` or secret key in this file.

Run:

```bash
npm install
npm run dev
```

The app opens on the Vite URL, usually `http://localhost:5173`.

Verification commands:

```bash
npm run check       # typecheck, lint, format, file size, unit tests, build
npm run test:e2e    # Playwright; mocked auth and data, no Supabase needed
npm run test:db     # real database; needs .env.test.local (never production)
```

The PWA is disabled in `npm run dev` so the service worker does not hide code changes. Test install and update behavior with `npm run build && npm run preview`.

---

## 2b. One-command setup (recommended)

If you do not want to use the SQL editor and the Users page, let the setup script do it.

1. Create `.env.setup.local` in the repo root. It is gitignored.

```dotenv
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>

# Optional. If omitted, strong passwords are generated and printed once.
JJA_001_PASSWORD=
JJA_002_PASSWORD=
```

2. Get the two values:
   - **Supabase → Connect** → **Direct connection** or **Session pooler**. Copy the full URI including the password. Do not use the transaction pooler for migrations.
   - **Project Settings → API → Secret keys** → copy the service-role/secret key.

3. Run:

```bash
npm run setup:supabase
```

The script applies the migrations if needed, creates `JJA-001` (Dad) and `JJA-002` (Uncle), and sets the display names. Both accounts have the same sales-log access; the legacy `owner`/`mechanic` role is kept only for compatibility. If it generates passwords, it writes them to `.staff-credentials.local` (gitignored) instead of printing them.

4. Save the generated passwords, then delete both `.staff-credentials.local` and `.env.setup.local`. Rotate the secret key if you want.

The manual sections below remain as a fallback.

---

## 3. Supabase project settings

In the dashboard:

1. **Authentication → Settings**: disable **Allow new users to sign up**. Only the two staff accounts should exist.
2. **Project Settings → General**: confirm the region is **Southeast Asia (Singapore)**. The region cannot be changed later.
3. **Project Settings → API**: copy the project URL and the publishable key into `.env.local`.

---

## 4. Apply the database migrations

The migrations create `profiles`, the legacy inventory/bay/owner tables, and the sales log (catalog, orders, labor, extras, payments, changes, GCash, and receipts), plus the role helpers and the auth-user trigger.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

`supabase login` opens a browser. `supabase link` may ask for the database password you saved.

If you change the schema later, always create a migration. Never edit the database from the dashboard.

---

## 5. Create the two staff accounts

Do this **after** the migration is applied, so the trigger creates a profile.

Staff log in with an **employee ID**, not an email. Supabase Auth still needs a login handle, so each account uses a hidden internal email that is never shown or used for mail:

| Staff | Employee ID | Hidden auth email |
|---|---|---|
| Dad | `JJA-001` | `jja-001@staff.jja.internal` |
| Uncle | `JJA-002` | `jja-002@staff.jja.internal` |

1. **Authentication → Users → Add user**.
2. Dad: email `jja-001@staff.jja.internal`, a strong password, **Auto Confirm User** on.
3. Uncle: email `jja-002@staff.jja.internal`, a different password, **Auto Confirm User** on.
4. Set the display names and, for legacy compatibility, a role:

```sql
update public.profiles
set display_name = 'Dad'
where employee_id = 'JJA-001';

update public.profiles
set display_name = 'Uncle', role = 'owner'
where employee_id = 'JJA-002';
```

The sales log does not use the role. Both accounts can do everything.

The trigger sets `employee_id` from the part before `@` in the auth email. The prefix must match the login ID in lowercase. If you add more staff later, use the same pattern: `jja-003@staff.jja.internal` and log in with `JJA-003`.

The internal address never receives mail. Password resets are done by the owner from the Supabase dashboard.

If the users already existed before the migration, backfill their profiles first:

```sql
insert into public.profiles (id, employee_id, display_name)
select
  id,
  upper(split_part(email, '@', 1)),
  coalesce(upper(split_part(email, '@', 1)), 'Staff')
from auth.users
on conflict (id) do nothing;
```

Then set the display names and role with the update statements above.

---

## 6. Database test keys

Create `.env.test.local` (gitignored) with the staging project's keys:

```dotenv
TEST_SUPABASE_URL=https://<project-ref>.supabase.co
TEST_SUPABASE_ANON_KEY=<publishable-or-anon-key>
TEST_SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>
```

The service-role key is secret. It stays on your machine and in CI secrets, never in the app or chat.

Run the database tests:

```bash
npm run test:db
```

Never point these variables at production.

---

## 7. First sign-in test

1. Start the app: `npm run dev`.
2. Open `/login`.
3. Sign in with **JJA-001** and Dad's password. The app should open **Orders** and show **Dad**, `JJA-001`, and the main navigation (Orders, Items, Reports, Settings).
4. Refresh. The session should survive.
5. Sign out, then sign in with **JJA-002** and Uncle's password. The app should show **Uncle**, `JJA-002`, and the same navigation and access.
6. Try a wrong password. The message should be clear and must not reveal whether the employee ID exists.

---

## 8. Common problems

| Symptom | Likely cause |
|---|---|
| “Almost ready” setup screen | `.env.local` is missing a variable; restart Vite after editing |
| “No staff profile” | The user was created before the migration, or the profile row is missing |
| Login says invalid credentials | Wrong employee ID or password, unconfirmed user, or the account does not exist |
| `db:push` asks for a password | Use the database password saved at project creation |
| Database tests fail immediately | `.env.test.local` is missing or the migration was not pushed |
