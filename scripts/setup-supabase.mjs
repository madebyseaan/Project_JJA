import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local', quiet: true });
config({ path: '.env.setup.local', override: true, quiet: true });

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`One-time Supabase setup for J.J.A POS.

Create .env.setup.local (gitignored) with:
  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
  SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>

Optional:
  JJA_001_PASSWORD=...
  JJA_002_PASSWORD=...
  If omitted, strong passwords are generated and printed once.

Run:
  npm run setup:supabase
`);
  process.exit(0);
}

const dbUrl = process.env.SUPABASE_DB_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !serviceRoleKey) {
  console.error(`Missing setup values.

Create .env.setup.local (gitignored) with:
  SUPABASE_DB_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...

See docs/setup.md.`);
  process.exit(1);
}

const STAFF_EMAIL_DOMAIN = 'staff.jja.internal';

const staff = [
  { employeeId: 'JJA-001', displayName: 'Dad', role: 'owner' },
  { employeeId: 'JJA-002', displayName: 'Uncle', role: 'mechanic' },
];

function projectUrlFromDbUrl(value) {
  const url = new URL(value);
  const host = url.hostname;
  let ref;

  if (host.startsWith('db.')) {
    ref = host.split('.')[1];
  } else if (url.username.includes('.')) {
    ref = url.username.split('.')[1];
  }

  if (!ref) {
    throw new Error('Set VITE_SUPABASE_URL in .env.local, or use the standard Supabase DB URL.');
  }

  return `https://${ref}.supabase.co`;
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? projectUrlFromDbUrl(dbUrl);

const migration = await readFile('supabase/migrations/20261115100000_profiles.sql', 'utf8');

const db = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

await db.connect();

try {
  const { rows } = await db.query("select to_regclass('public.profiles') as table_name");
  const hasProfiles = Boolean(rows[0]?.table_name);

  if (hasProfiles) {
    console.log('Migration: already applied.');
  } else {
    await db.query(migration);
    console.log('Migration: applied.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw listError;
  }

  const existingUsers = userList?.users ?? [];
  const generated = [];

  for (const person of staff) {
    const email = `${person.employeeId.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
    const existing = existingUsers.find((user) => user.email?.toLowerCase() === email);
    const passwordKey = `${person.employeeId.replaceAll('-', '_')}_PASSWORD`;
    let password = process.env[passwordKey] ?? null;
    let userId = existing?.id ?? null;

    if (!existing) {
      if (!password) {
        password = randomBytes(18).toString('base64url');
        generated.push({ employeeId: person.employeeId, password });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: person.displayName },
      });

      if (error) {
        throw error;
      }

      userId = data.user.id;
      console.log(`User: ${person.employeeId} created.`);
    } else {
      console.log(`User: ${person.employeeId} already exists; password unchanged.`);
    }

    await db.query(
      `insert into public.profiles (id, employee_id, display_name)
       values ($1, $2, $3)
       on conflict (id) do nothing`,
      [userId, person.employeeId, person.displayName],
    );

    await db.query(
      `update public.profiles
       set display_name = $1, role = $2
       where employee_id = $3`,
      [person.displayName, person.role, person.employeeId],
    );
  }

  console.log('\nProfiles ready:');
  for (const person of staff) {
    console.log(`  ${person.employeeId}  ${person.displayName}  ${person.role}`);
  }

  if (generated.length > 0) {
    const lines = [
      'J.J.A POS staff credentials',
      '',
      ...generated.map((entry) => `${entry.employeeId}: ${entry.password}`),
      '',
      'Save these to a password manager, then delete this file.',
    ];

    await writeFile('.staff-credentials.local', `${lines.join('\n')}\n`, 'utf8');
    console.log(
      '\nPasswords written to .staff-credentials.local (gitignored). Save them, then delete the file.',
    );
  }

  console.log('\nSign in at /login with the employee IDs above.');
} finally {
  await db.end();
}
