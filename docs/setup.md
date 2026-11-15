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

---

## 3. Supabase project settings

In the dashboard:

1. **Authentication → Settings**: disable **Allow new users to sign up**. Only the two staff accounts should exist.
2. **Project Settings → General**: confirm the region is **Southeast Asia (Singapore)**. The region cannot be changed later.
3. **Project Settings → API**: copy the project URL and the publishable key into `.env.local`.

---

## 4. Apply the database migrations

The migration creates `profiles`, the role helpers, and the auth-user trigger.

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

1. **Authentication → Users → Add user**.
2. Dad: a real email and a strong password. Enable **Auto Confirm User**.
3. Uncle: a different email and password. Enable **Auto Confirm User**.
4. Dad's profile is created as `mechanic`; promote it to `owner` in the SQL editor:

```sql
update public.profiles
set role = 'owner'
where id = (
  select id
  from auth.users
  where email = 'dad@example.com'
);
```

Replace the email with Dad's real address.

If the users already existed before the migration, backfill their profiles first:

```sql
insert into public.profiles (id, display_name)
select
  id,
  coalesce(split_part(email, '@', 1), 'Staff')
from auth.users
on conflict (id) do nothing;
```

Then promote Dad.

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
3. Sign in as Dad. The temporary staff home should show **Dad** and **Owner**.
4. Refresh. The session should survive.
5. Sign out, then sign in as Uncle. The staff home should show **Uncle** and **Mechanic**.
6. Try a wrong password. The message should be clear and must not reveal whether the email exists.

---

## 8. Common problems

| Symptom | Likely cause |
|---|---|
| “Almost ready” setup screen | `.env.local` is missing a variable; restart Vite after editing |
| “No staff profile” | The user was created before the migration, or the profile row is missing |
| Login says invalid credentials | Wrong password, unconfirmed email, or the user does not exist |
| `db:push` asks for a password | Use the database password saved at project creation |
| Database tests fail immediately | `.env.test.local` is missing or the migration was not pushed |
