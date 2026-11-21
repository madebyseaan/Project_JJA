// Captures the Step 03 review screenshots without real staff credentials.
// It seeds a syntactically valid Supabase session and stubs the profiles read,
// so the real UI renders. This is evidence for layout only, never a test of auth.
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import { mkdir } from 'node:fs/promises';

config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required to derive the session storage key.');
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173';
const outDir = 'docs/screenshots';

const users = {
  owner: {
    id: '00000000-0000-4000-8000-000000000001',
    employeeId: 'JJA-001',
    displayName: 'Dad',
    role: 'owner',
  },
  mechanic: {
    id: '00000000-0000-4000-8000-000000000002',
    employeeId: 'JJA-002',
    displayName: 'Uncle',
    role: 'mechanic',
  },
};

const pin = '1234';
const pinSalt = '00112233445566778899aabbccddeeff';

async function pinHash() {
  const data = new TextEncoder().encode(`${pinSalt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const email = `${user.employeeId.toLowerCase()}@staff.jja.internal`;

  return {
    access_token: 'header.payload.signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'screenshot-refresh-token',
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

async function openAs(browser, user, viewport) {
  const context = await browser.newContext({ viewport });
  const hash = await pinHash();

  await context.route('**/rest/v1/profiles*', (route) =>
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

  const page = await context.newPage();

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

  await page.goto(`${baseUrl}/bay`, { waitUntil: 'networkidle' });

  if (await page.getByRole('heading', { name: 'Welcome back' }).isVisible()) {
    for (const digit of pin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
  }

  await page.getByRole('heading', { name: 'Bay', exact: true }).waitFor();
  return { context, page };
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();

  try {
    const desktop = { width: 1440, height: 900 };
    const phone = { width: 360, height: 800 };

    {
      const { context, page } = await openAs(browser, users.owner, desktop);
      await page.screenshot({ path: `${outDir}/step-03-shell-bay-desktop.png` });
      await page.getByRole('link', { name: 'Owner' }).click();
      await page.getByRole('heading', { name: 'Owner', exact: true }).waitFor();
      await page.screenshot({ path: `${outDir}/step-03-shell-owner-desktop.png` });
      await context.close();
    }

    {
      const { context, page } = await openAs(browser, users.owner, phone);
      await page.screenshot({ path: `${outDir}/step-03-shell-bay-mobile.png` });
      await context.close();
    }

    {
      const { context, page } = await openAs(browser, users.mechanic, desktop);
      await page.screenshot({ path: `${outDir}/step-03-shell-mechanic-desktop.png` });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log('Saved Step 03 screenshots to', outDir);
}

await main();
