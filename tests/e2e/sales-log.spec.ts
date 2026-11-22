import { expect, test, type Page, type Route } from '@playwright/test';

import { mechanic, navLink, owner, signInAs } from './fixtures';

const catalog = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Brake pad',
    description: 'Front brake pad',
    sku: 'BP-01',
    base_price_centavos: 15000,
    item_type: 'Inventory Part',
    income_account: 'Merchandise Sales',
    cogs_account: 'Cost of Goods Sold',
    asset_account: 'Inventory Asset',
    preferred_vendor: 'Supplier A',
    is_active: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Spark plug',
    description: '',
    sku: 'SP-01',
    base_price_centavos: 8550,
    item_type: 'Inventory Part',
    income_account: 'Merchandise Sales',
    cogs_account: 'Cost of Goods Sold',
    asset_account: 'Inventory Asset',
    preferred_vendor: '',
    is_active: true,
  },
];

const token = '0123456789abcdef0123456789abcdef';

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function fulfill(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

type SavedOrder = {
  id: string;
  order_no: string;
  business_date: string;
  customer_name: string | null;
  bike_model: string | null;
  main_user_id: string;
  helper_user_id: string | null;
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  status: 'OPEN';
  created_at: string;
  public_token: string;
  main: { display_name: string };
  helper: { display_name: string } | null;
};

async function mockSalesLog(page: Page) {
  let order: SavedOrder | null = null;
  let itemRows: unknown[] = [];
  let dailyRows: unknown[] = [];
  let laborRows: unknown[] = [];
  let paymentRows: unknown[] = [];

  await page.route('**/rest/v1/catalog_items*', (route) => fulfill(route, catalog));

  await page.route('**/rest/v1/sales_orders*', (route) => {
    const url = new URL(route.request().url());

    if (url.searchParams.get('id')?.startsWith('eq.')) {
      return fulfill(route, order);
    }

    return fulfill(route, order ? [order] : []);
  });

  await page.route('**/rest/v1/sales_order_items*', (route) => fulfill(route, itemRows));
  await page.route('**/rest/v1/sales_labor*', (route) => fulfill(route, laborRows.slice(0, 2)));
  await page.route('**/rest/v1/sales_extras*', (route) =>
    fulfill(
      route,
      itemRows.length > 0
        ? [
            {
              id: 'extra-1',
              user_id: owner.id,
              amount_centavos: 1000,
              note: null,
              profile: { display_name: 'Dad' },
            },
          ]
        : [],
    ),
  );
  await page.route('**/rest/v1/sales_payments*', (route) =>
    fulfill(route, [
      {
        id: 'pay-1',
        method: 'CASH',
        amount_centavos: 21000,
        gcash_recipient_id: null,
        received_at: new Date().toISOString(),
        recipient: null,
      },
      {
        id: 'pay-2',
        method: 'GCASH',
        amount_centavos: 10000,
        gcash_recipient_id: owner.id,
        received_at: new Date().toISOString(),
        recipient: { display_name: 'Dad' },
      },
    ]),
  );
  await page.route('**/rest/v1/sales_changes*', (route) =>
    fulfill(route, [
      {
        id: 'change-1',
        method: 'CASH',
        amount_centavos: 5000,
        gcash_recipient_id: null,
        recipient: null,
      },
    ]),
  );
  await page.route('**/rest/v1/v_sales_daily*', (route) => fulfill(route, dailyRows));
  await page.route('**/rest/v1/v_sales_labor_daily*', (route) => fulfill(route, laborRows));
  await page.route('**/rest/v1/v_sales_payments_daily*', (route) => fulfill(route, paymentRows));
  await page.route('**/rest/v1/gcash_transfers*', (route) => fulfill(route, []));

  await page.route('**/rest/v1/rpc/get_gcash_balances', (route) =>
    fulfill(route, [
      {
        user_id: owner.id,
        display_name: 'Dad',
        shop_share_centavos: 6000,
        shop_transfers_centavos: 0,
        shop_held_centavos: 6000,
        labor_share_centavos: 4000,
        labor_transfers_centavos: 0,
        labor_held_centavos: 4000,
        labor_earned_centavos: 9000,
      },
      {
        user_id: mechanic.id,
        display_name: 'Uncle',
        shop_share_centavos: 0,
        shop_transfers_centavos: 0,
        shop_held_centavos: 0,
        labor_share_centavos: 0,
        labor_transfers_centavos: 0,
        labor_held_centavos: 0,
        labor_earned_centavos: 2000,
      },
    ]),
  );

  await page.route('**/rest/v1/rpc/save_sales_order', (route) => {
    const payload = route.request().postDataJSON() as {
      p_order_id: string | null;
      p_business_date: string;
      p_customer_name: string | null;
      p_bike_model: string | null;
      p_main_user_id: string;
      p_helper_user_id: string | null;
      p_items: { qty: number; unit_price_centavos: number }[];
      p_labor_total_centavos: number;
      p_helper_labor_centavos: number;
      p_extras: { amount_centavos: number }[];
      p_payments: { method: string; amount_centavos: number }[];
      p_changes: { amount_centavos: number }[];
    };

    const parts = payload.p_items.reduce(
      (total, item) => total + item.qty * item.unit_price_centavos,
      0,
    );
    const extras = payload.p_extras.reduce((total, extra) => total + extra.amount_centavos, 0);
    const cashPaid = payload.p_payments
      .filter((payment) => payment.method === 'CASH')
      .reduce((total, payment) => total + payment.amount_centavos, 0);
    const gcashPaid = payload.p_payments
      .filter((payment) => payment.method === 'GCASH')
      .reduce((total, payment) => total + payment.amount_centavos, 0);
    const cashChange = payload.p_changes.reduce(
      (total, change) => total + change.amount_centavos,
      0,
    );

    order = {
      id: 'order-1',
      order_no:
        payload.p_order_id && order
          ? order.order_no
          : `SL-${payload.p_business_date.replaceAll('-', '')}-0001`,
      business_date: payload.p_business_date,
      customer_name: payload.p_customer_name,
      bike_model: payload.p_bike_model,
      main_user_id: payload.p_main_user_id,
      helper_user_id: payload.p_helper_user_id,
      parts_total_centavos: parts,
      labor_total_centavos: payload.p_labor_total_centavos,
      total_centavos: parts + payload.p_labor_total_centavos,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      public_token: token,
      main: { display_name: 'Dad' },
      helper: payload.p_helper_user_id ? { display_name: 'Uncle' } : null,
    };

    itemRows = [
      {
        id: 'line-1',
        catalog_item_id: catalog[0]?.id,
        item_name_at_time: 'Brake pad',
        qty: payload.p_items[0]?.qty ?? 1,
        unit_price_at_time_centavos: payload.p_items[0]?.unit_price_centavos ?? 15000,
        line_total_centavos:
          (payload.p_items[0]?.qty ?? 1) * (payload.p_items[0]?.unit_price_centavos ?? 15000),
        is_custom: false,
      },
    ];

    dailyRows = [
      {
        business_date: payload.p_business_date,
        order_count: 1,
        parts_total_centavos: parts,
        labor_total_centavos: payload.p_labor_total_centavos,
        total_centavos: parts + payload.p_labor_total_centavos,
        extras_total_centavos: extras,
      },
    ];

    laborRows = [
      {
        business_date: payload.p_business_date,
        user_id: owner.id,
        display_name: 'Dad',
        base_labor_centavos: payload.p_labor_total_centavos - payload.p_helper_labor_centavos,
        extras_centavos: extras,
        labor_payout_centavos:
          payload.p_labor_total_centavos - payload.p_helper_labor_centavos + extras,
      },
      {
        business_date: payload.p_business_date,
        user_id: mechanic.id,
        display_name: 'Uncle',
        base_labor_centavos: payload.p_helper_labor_centavos,
        extras_centavos: 0,
        labor_payout_centavos: payload.p_helper_labor_centavos,
      },
    ];

    paymentRows = [
      {
        business_date: payload.p_business_date,
        method: 'CASH',
        received_centavos: cashPaid,
        change_centavos: cashChange,
        net_centavos: cashPaid - cashChange,
      },
      {
        business_date: payload.p_business_date,
        method: 'GCASH',
        received_centavos: gcashPaid,
        change_centavos: 0,
        net_centavos: gcashPaid,
      },
    ];

    return fulfill(route, order);
  });

  await page.route('**/rest/v1/rpc/get_sales_receipt', (route) =>
    fulfill(route, {
      shop: {
        name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
        address: 'Manila',
        contact: '0917 000 0000',
        footer: 'Thank you',
      },
      order_no: order?.order_no ?? `SL-${manilaToday().replaceAll('-', '')}-0001`,
      business_date: order?.business_date ?? manilaToday(),
      customer_name: 'Jose',
      bike_model: 'Honda Click',
      items: [
        {
          name: 'Brake pad',
          qty: 1,
          unit_price_centavos: 15000,
          line_total_centavos: 15000,
        },
      ],
      labor_total_centavos: 10000,
      total_centavos: 25000,
      extras_total_centavos: 1000,
      payments: [
        { method: 'CASH', amount_centavos: 21000 },
        { method: 'GCASH', amount_centavos: 10000 },
      ],
      changes: [{ method: 'CASH', amount_centavos: 5000 }],
    }),
  );
}

test('creates a mixed-payment order and shows it in reports, GCash, and the receipt', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await mockSalesLog(page);
  await signInAs(page, owner);

  const today = manilaToday();
  const orderNo = `SL-${today.replaceAll('-', '')}-0001`;

  await page.getByRole('button', { name: 'New order' }).first().click();
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();

  await page.getByLabel('Search the catalog').fill('brake');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const labor = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Labor', exact: true }),
  });
  await labor.getByLabel('Total labor (₱)').fill('100');
  await labor
    .getByText('Helper', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Uncle', exact: true })
    .click();
  await labor.getByLabel('Helper’s share (₱)').fill('20');

  const extras = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Extras', exact: true }),
  });
  await extras.getByRole('button', { name: 'Add extra' }).click();
  await extras.getByLabel('Amount (₱)').fill('10');

  const payment = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Payment', exact: true }),
  });
  await payment.getByRole('button', { name: 'Add payment' }).click();
  await payment.getByLabel('Amount (₱)').fill('210');
  await payment.getByRole('button', { name: 'GCash', exact: true }).click();
  await payment.getByRole('button', { name: 'Dad', exact: true }).click();

  await payment.getByRole('button', { name: 'Add payment' }).click();
  await payment.getByLabel('Amount (₱)').nth(1).fill('100');

  await payment.getByRole('button', { name: 'Add change' }).click();
  await payment.getByLabel('Amount (₱)').last().fill('50');

  await page.getByRole('button', { name: 'Review order' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Customer total')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save order' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText(orderNo)).toBeVisible();
  await expect(page.getByText('₱250.00').first()).toBeVisible();

  await page.getByRole('link', { name: new RegExp(orderNo) }).click();
  await expect(page.getByRole('heading', { name: 'Edit order' })).toBeVisible();
  await expect(page.getByLabel('Total labor (₱)')).toHaveValue('100.00');
  await navLink(page, 'Orders').click();

  await navLink(page, 'Reports').click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByText('Daily sales')).toBeVisible();
  await expect(page.getByRole('link', { name: displayDate(today) })).toBeVisible();
  await expect(page.getByText('₱250.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'GCash', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'GCash', exact: true })).toBeVisible();
  await expect(page.getByText('₱60.00').first()).toBeVisible();
  await expect(page.getByText('Recent transfers')).toBeVisible();

  await page.goto(`/s/${token}`);
  await expect(page.getByText(orderNo)).toBeVisible();
  await expect(page.getByText('Brake pad')).toBeVisible();
  await expect(page.getByText('₱260.00').first()).toBeVisible();
  await expect(page.getByText('Jose')).toBeVisible();
});
