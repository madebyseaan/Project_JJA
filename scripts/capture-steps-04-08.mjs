// Layout evidence for Steps 04-08. Auth and API responses are mocked; this is
// never a test of the real database.
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import { mkdir } from 'node:fs/promises';

config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'https://screenshot.supabase.co';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173';
const outDir = 'docs/screenshots';
const pin = '1234';
const pinSalt = '00112233445566778899aabbccddeeff';

const owner = {
  id: '00000000-0000-4000-8000-000000000001',
  employeeId: 'JJA-001',
  displayName: 'Dad',
  role: 'owner',
};

async function hashPin() {
  const data = new TextEncoder().encode(`${pinSalt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'header.payload.signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'screenshot-refresh',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${user.employeeId.toLowerCase()}@staff.jja.internal`,
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

const parts = [
  {
    id: 'part-1',
    name: 'Brake pad',
    sku: 'BP-01',
    category: 'Brakes',
    compatible_models: ['Honda Click 125', 'Yamaha Mio'],
    unit_price_centavos: 15000,
    cost_price_centavos: 9000,
    stock_on_hand: 12,
    reserved_qty: 2,
    available_qty: 10,
    low_stock_threshold: 3,
    is_active: true,
    created_at: '2026-11-21T01:00:00Z',
    updated_at: '2026-11-21T01:00:00Z',
  },
  {
    id: 'part-2',
    name: 'Spark plug',
    sku: 'SP-02',
    category: 'Electrical',
    compatible_models: ['Universal'],
    unit_price_centavos: 8500,
    cost_price_centavos: 4200,
    stock_on_hand: 2,
    reserved_qty: 1,
    available_qty: 1,
    low_stock_threshold: 3,
    is_active: true,
    created_at: '2026-11-21T01:00:00Z',
    updated_at: '2026-11-21T01:00:00Z',
  },
  {
    id: 'part-3',
    name: 'Engine oil 10W-40',
    sku: 'OIL-10W40',
    category: 'Oils',
    compatible_models: ['Universal'],
    unit_price_centavos: 35000,
    cost_price_centavos: 25000,
    stock_on_hand: 24,
    reserved_qty: 0,
    available_qty: 24,
    low_stock_threshold: 6,
    is_active: true,
    created_at: '2026-11-21T01:00:00Z',
    updated_at: '2026-11-21T01:00:00Z',
  },
];

const tickets = [
  {
    id: 'ticket-1',
    ticket_no: 'TK-20261121-0001',
    type: 'REPAIR',
    status: 'IN_PROGRESS',
    customer_name: 'Jose',
    bike_model: 'Honda Click 125',
    notes: null,
    parts_total_centavos: 30000,
    labor_total_centavos: 20000,
    total_centavos: 50000,
    created_by: owner.id,
    created_at: '2026-11-21T01:00:00Z',
    updated_at: '2026-11-21T01:05:00Z',
    created_by_name: 'Dad',
  },
  {
    id: 'ticket-2',
    ticket_no: 'TK-20261121-0002',
    type: 'SALE',
    status: 'PENDING',
    customer_name: null,
    bike_model: 'Yamaha Mio',
    notes: null,
    parts_total_centavos: 8500,
    labor_total_centavos: 0,
    total_centavos: 8500,
    created_by: owner.id,
    created_at: '2026-11-21T02:10:00Z',
    updated_at: '2026-11-21T02:10:00Z',
    created_by_name: 'Dad',
  },
];

const ticket = {
  id: 'ticket-1',
  ticket_no: 'TK-20261121-0001',
  type: 'REPAIR',
  status: 'IN_PROGRESS',
  customer_name: 'Jose',
  bike_model: 'Honda Click 125',
  notes: 'Front brake feels soft.',
  parts_total_centavos: 30000,
  labor_total_centavos: 20000,
  total_centavos: 50000,
  created_by: owner.id,
  created_at: '2026-11-21T01:00:00Z',
  updated_at: '2026-11-21T01:05:00Z',
};

const items = [
  {
    id: 'item-1',
    ticket_id: 'ticket-1',
    part_id: 'part-1',
    part_name_at_time: 'Brake pad',
    qty: 2,
    unit_price_at_time_centavos: 15000,
    unit_cost_at_time_centavos: 9000,
    line_total_centavos: 30000,
    verified_at: '2026-11-21T01:04:00Z',
    verified_by: owner.id,
    created_at: '2026-11-21T01:01:00Z',
  },
];

const labor = [
  {
    id: 'labor-1',
    ticket_id: 'ticket-1',
    description: 'Install brake pads and bleed the line',
    amount_centavos: 20000,
    created_by: owner.id,
    created_at: '2026-11-21T01:02:00Z',
  },
];

const summary = {
  business_date: '2026-11-21',
  sales: { receipt_count: 3, parts_centavos: 48500, labor_centavos: 30000, total_centavos: 78500 },
  payments: {
    cash_centavos: 58500,
    gcash_centavos: 20000,
    maya_centavos: 0,
    other_centavos: 0,
    total_centavos: 78500,
  },
  expected_cash_centavos: 58500,
  voids: [],
  low_stock: [
    { id: 'part-2', name: 'Spark plug', sku: 'SP-02', available_qty: 1, low_stock_threshold: 3 },
  ],
  day_close: null,
};

function receiptPayload() {
  return {
    receipt_no: '20261121-0003',
    status: 'ISSUED',
    issued_at: '2026-11-21T05:30:00Z',
    total_centavos: 50000,
    verification_code: 'A1B2-C3D4-E5F6-7890',
    void_reason: null,
    snapshot: {
      shop: {
        name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
        address: 'Manila, Philippines',
        contact: '0917 000 0000',
        footer: 'Thank you for your business.',
      },
      ticket: {
        no: 'TK-20261121-0001',
        type: 'REPAIR',
        customer_name: 'Jose',
        bike_model: 'Honda Click 125',
        created_at: '2026-11-21T01:00:00Z',
      },
      items: [
        {
          name: 'Brake pad',
          qty: 2,
          unit_price_centavos: 15000,
          line_total_centavos: 30000,
        },
      ],
      labor: [{ description: 'Install brake pads and bleed the line', amount_centavos: 20000 }],
      totals: { parts_centavos: 30000, labor_centavos: 20000, total_centavos: 50000 },
      payments: [{ method: 'CASH', amount_centavos: 50000, received_by: 'Dad' }],
      receipt_no: '20261121-0003',
      issued_at: '2026-11-21T05:30:00Z',
    },
  };
}

async function seed(page, session) {
  const hash = await hashPin();
  await page.addInitScript(
    ({ sessionKey, value, pinKey, record }) => {
      localStorage.setItem(sessionKey, JSON.stringify(value));
      localStorage.setItem(pinKey, JSON.stringify(record));
    },
    {
      sessionKey: `sb-${projectRef}-auth-token`,
      value: session,
      pinKey: `jja.pin.${session.user.id}`,
      record: { salt: pinSalt, hash, attempts: 0 },
    },
  );
}

async function unlock(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const lock = page.getByRole('heading', { name: 'Welcome back' });
  if (await lock.isVisible().catch(() => false)) {
    for (const digit of pin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.route('**/rest/v1/profiles*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: owner.id,
            employee_id: owner.employeeId,
            display_name: owner.displayName,
            role: owner.role,
          },
        ]),
      }),
    );
    await page.route('**/rest/v1/parts*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parts) }),
    );
    await page.route('**/rest/v1/v_open_tickets*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tickets),
      }),
    );
    await page.route('**/rest/v1/tickets*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ticket) }),
    );
    await page.route('**/rest/v1/ticket_items*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items) }),
    );
    await page.route('**/rest/v1/ticket_labor*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(labor) }),
    );
    await page.route('**/rest/v1/ticket_payments*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/rest/v1/receipts*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/rest/v1/rpc/get_daily_summary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summary),
      }),
    );

    await seed(page, sessionFor(owner));

    await page.goto(`${baseUrl}/inventory`);
    await unlock(page);
    await page.getByRole('link', { name: 'Stock' }).filter({ visible: true }).click();
    await page.getByRole('heading', { name: 'Stock' }).waitFor();
    await page.screenshot({ path: `${outDir}/step-04-inventory-desktop.png` });

    await page.getByRole('link', { name: 'Bay' }).filter({ visible: true }).click();
    await page.getByRole('heading', { name: 'Bay', exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/step-05-bay-queue-desktop.png` });

    await page
      .getByRole('link', { name: /TK-20261121-0001/ })
      .filter({ visible: true })
      .click();
    await page.getByText('TK-20261121-0001').first().waitFor();
    await page.screenshot({ path: `${outDir}/step-05-ticket-desktop.png` });

    await page.getByRole('link', { name: 'Owner' }).filter({ visible: true }).click();
    await page.getByRole('heading', { name: 'Owner' }).waitFor();
    await page.screenshot({ path: `${outDir}/step-08-owner-desktop.png` });

    const phone = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const phonePage = await phone.newPage();
    await phonePage.route('**/rest/v1/profiles*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: owner.id,
            employee_id: owner.employeeId,
            display_name: owner.displayName,
            role: owner.role,
          },
        ]),
      }),
    );
    await phonePage.route('**/rest/v1/parts*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parts) }),
    );
    await seed(phonePage, sessionFor(owner));
    await phonePage.goto(`${baseUrl}/inventory`);
    await unlock(phonePage);
    await phonePage.getByRole('link', { name: 'Stock' }).filter({ visible: true }).click();
    await phonePage.getByRole('heading', { name: 'Stock' }).waitFor();
    await phonePage.screenshot({ path: `${outDir}/step-04-inventory-mobile.png` });
    await phone.close();

    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const publicPage = await publicContext.newPage();
    await publicPage.route('**/rest/v1/rpc/get_receipt', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(receiptPayload()),
      }),
    );
    await publicPage.goto(`${baseUrl}/r/screenshot-token`);
    await publicPage.getByText('J.J.A Motor Accessories and Motorcycle Repair Shop').waitFor();
    await publicPage.screenshot({ path: `${outDir}/step-07-receipt-desktop.png` });
    await publicContext.close();

    await context.close();
  } finally {
    await browser.close();
  }

  console.log('Saved Steps 04, 05, 07, and 08 screenshots.');
}

await main();
