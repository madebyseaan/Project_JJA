import { expect, type Page } from '@playwright/test';

export type TestUser = {
  id: string;
  employeeId: string;
  displayName: string;
  role: 'owner' | 'mechanic';
};

export const owner: TestUser = {
  id: '00000000-0000-4000-8000-000000000001',
  employeeId: 'JJA-001',
  displayName: 'Dad',
  role: 'owner',
};

export const mechanic: TestUser = {
  id: '00000000-0000-4000-8000-000000000002',
  employeeId: 'JJA-002',
  displayName: 'Uncle',
  role: 'mechanic',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'https://e2e.supabase.co';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const pin = '1234';
const pinSalt = '00112233445566778899aabbccddeeff';

async function pinHash(): Promise<string> {
  const data = new TextEncoder().encode(`${pinSalt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sessionFor(user: TestUser) {
  const now = Math.floor(Date.now() / 1000);
  const email = `${user.employeeId.toLowerCase()}@staff.jja.internal`;

  return {
    access_token: 'header.payload.signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { display_name: user.displayName },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };
}

export function navLink(page: Page, name: string) {
  return page.getByRole('link', { name }).filter({ visible: true });
}

/** Seed a staff session and PIN, then unlock the shell. Auth is never real in E2E. */
export async function signInAs(page: Page, user: TestUser): Promise<void> {
  const hash = await pinHash();

  await page.route('**/rest/v1/profiles*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: user.id,
          employee_id: user.employeeId,
          display_name: user.displayName,
          role: user.role,
        },
      ]),
    }),
  );

  await page.addInitScript(
    ({ sessionKey, session, pinKey, pinRecord }) => {
      localStorage.setItem(sessionKey, JSON.stringify(session));
      localStorage.setItem(pinKey, JSON.stringify(pinRecord));
    },
    {
      sessionKey: `sb-${projectRef}-auth-token`,
      session: sessionFor(user),
      pinKey: `jja.pin.${user.id}`,
      pinRecord: { salt: pinSalt, hash, attempts: 0 },
    },
  );

  await page.goto('/bay');

  const bayHeading = page.getByRole('heading', { name: 'Bay', exact: true });
  const lockHeading = page.getByRole('heading', { name: 'Welcome back' });
  await lockHeading.or(bayHeading).waitFor({ timeout: 15_000 });

  if (await lockHeading.isVisible()) {
    for (const digit of pin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
  }

  await expect(bayHeading).toBeVisible();
}
