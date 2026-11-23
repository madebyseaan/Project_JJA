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
  paid_on: string | null;
  customer_name: string | null;
  bike_model: string | null;
  main_user_id: string;
  helper_user_id: string | null;
  parts_total_centavos: number;
  labor_total_centavos: number;
  total_centavos: number;
  status: 'OPEN' | 'PAID';
  created_at: string;
  public_token: string;
  main: { display_name: string };
  helper: { display_name: string } | null;
};

async function mockSalesLog(page: Page) {
  let order: SavedOrder | null = null;
  let itemRows: unknown[] = [];
  let laborRows: unknown[] = [];
  let extraRows: unknown[] = [];
  let paymentRows: unknown[] = [];
  let changeRows: unknown[] = [];
  let dailyRows: unknown[] = [];
  let laborReportRows: unknown[] = [];
  let paymentReportRows: unknown[] = [];

  await page.route('**/rest/v1/catalog_items*', (route) => fulfill(route, catalog));

  await page.route('**/rest/v1/sales_orders*', (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const status = url.searchParams.get('status');
    const paidOn = url.searchParams.get('paid_on');

    if (id?.startsWith('eq.')) {
      return fulfill(route, order);
    }

    if (!order) {
      return fulfill(route, []);
    }

    if (status === 'eq.OPEN') {
      return fulfill(route, order.status === 'OPEN' ? [order] : []);
    }

    if (paidOn?.startsWith('eq.')) {
      const date = paidOn.slice(3);
      return fulfill(route, order.status === 'PAID' && order.paid_on === date ? [order] : []);
    }

    return fulfill(route, []);
  });

  await page.route('**/rest/v1/sales_order_items*', (route) => fulfill(route, itemRows));
  await page.route('**/rest/v1/sales_labor*', (route) => fulfill(route, laborRows));
  await page.route('**/rest/v1/sales_extras*', (route) => fulfill(route, extraRows));
  await page.route('**/rest/v1/sales_payments*', (route) => fulfill(route, paymentRows));
  await page.route('**/rest/v1/sales_changes*', (route) => fulfill(route, changeRows));
  await page.route('**/rest/v1/v_sales_daily*', (route) => fulfill(route, dailyRows));
  await page.route('**/rest/v1/v_sales_labor_daily*', (route) => fulfill(route, laborReportRows));
  await page.route('**/rest/v1/v_sales_payments_daily*', (route) =>
    fulfill(route, paymentReportRows),
  );
  await page.route('**/rest/v1/gcash_transfers*', (route) => fulfill(route, []));

  await page.route('**/rest/v1/rpc/get_gcash_balances', (route) =>
    fulfill(route, [
      {
        user_id: owner.id,
        display_name: 'Aldwin',
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
        display_name: 'Magma',
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
      p_paid_on: string | null;
      p_customer_name: string | null;
      p_bike_model: string | null;
      p_main_user_id: string;
      p_helper_user_id: string | null;
      p_items: { qty: number; unit_price_centavos: number }[];
      p_labor_total_centavos: number;
      p_helper_labor_centavos: number;
      p_extras: { user_id: string; amount_centavos: number; note: string | null }[];
      p_payments: { method: string; amount_centavos: number; gcash_recipient_id: string | null }[];
      p_changes: { method: string; amount_centavos: number; gcash_recipient_id: string | null }[];
    };

    const parts = payload.p_items.reduce(
      (total, item) => total + item.qty * item.unit_price_centavos,
      0,
    );
    const extras = payload.p_extras.reduce((total, extra) => total + extra.amount_centavos, 0);
    const isPaid = payload.p_payments.length > 0;

    order = {
      id: 'order-1',
      order_no:
        payload.p_order_id && order
          ? order.order_no
          : `SL-${payload.p_business_date.replaceAll('-', '')}-0001`,
      business_date: payload.p_business_date,
      paid_on: isPaid ? (payload.p_paid_on ?? manilaToday()) : null,
      customer_name: payload.p_customer_name,
      bike_model: payload.p_bike_model,
      main_user_id: payload.p_main_user_id,
      helper_user_id: payload.p_helper_user_id,
      parts_total_centavos: parts,
      labor_total_centavos: payload.p_labor_total_centavos,
      total_centavos: parts + payload.p_labor_total_centavos,
      status: isPaid ? 'PAID' : 'OPEN',
      created_at: new Date().toISOString(),
      public_token: token,
      main: { display_name: 'Aldwin' },
      helper: payload.p_helper_user_id ? { display_name: 'Magma' } : null,
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

    laborRows = [
      {
        id: 'labor-1',
        user_id: owner.id,
        amount_centavos: payload.p_labor_total_centavos - payload.p_helper_labor_centavos,
        is_main: true,
        profile: { display_name: 'Aldwin' },
      },
      ...(payload.p_helper_user_id
        ? [
            {
              id: 'labor-2',
              user_id: mechanic.id,
              amount_centavos: payload.p_helper_labor_centavos,
              is_main: false,
              profile: { display_name: 'Magma' },
            },
          ]
        : []),
    ];

    extraRows = payload.p_extras.map((extra, index) => ({
      id: `extra-${index + 1}`,
      user_id: extra.user_id,
      amount_centavos: extra.amount_centavos,
      note: extra.note,
      profile: { display_name: extra.user_id === owner.id ? 'Aldwin' : 'Magma' },
    }));

    paymentRows = payload.p_payments.map((payment, index) => ({
      id: `pay-${index + 1}`,
      method: payment.method,
      amount_centavos: payment.amount_centavos,
      gcash_recipient_id: payment.gcash_recipient_id,
      received_at: new Date().toISOString(),
      recipient: payment.gcash_recipient_id
        ? { display_name: payment.gcash_recipient_id === owner.id ? 'Aldwin' : 'Magma' }
        : null,
    }));

    changeRows = payload.p_changes.map((item, index) => ({
      id: `change-${index + 1}`,
      method: item.method,
      amount_centavos: item.amount_centavos,
      gcash_recipient_id: item.gcash_recipient_id,
      recipient: item.gcash_recipient_id
        ? { display_name: item.gcash_recipient_id === owner.id ? 'Aldwin' : 'Magma' }
        : null,
    }));

    if (isPaid) {
      const paidOn = order.paid_on as string;

      dailyRows = [
        {
          paid_on: paidOn,
          order_count: 1,
          parts_total_centavos: parts,
          labor_total_centavos: payload.p_labor_total_centavos,
          total_centavos: parts + payload.p_labor_total_centavos,
          extras_total_centavos: extras,
        },
      ];

      laborReportRows = [
        {
          paid_on: paidOn,
          user_id: owner.id,
          display_name: 'Aldwin',
          base_labor_centavos: payload.p_labor_total_centavos - payload.p_helper_labor_centavos,
          extras_centavos: extras,
          labor_payout_centavos:
            payload.p_labor_total_centavos - payload.p_helper_labor_centavos + extras,
        },
        ...(payload.p_helper_user_id
          ? [
              {
                paid_on: paidOn,
                user_id: mechanic.id,
                display_name: 'Magma',
                base_labor_centavos: payload.p_helper_labor_centavos,
                extras_centavos: 0,
                labor_payout_centavos: payload.p_helper_labor_centavos,
              },
            ]
          : []),
      ];

      const cashPaid = payload.p_payments
        .filter((payment) => payment.method === 'CASH')
        .reduce((total, payment) => total + payment.amount_centavos, 0);
      const gcashPaid = payload.p_payments
        .filter((payment) => payment.method === 'GCASH')
        .reduce((total, payment) => total + payment.amount_centavos, 0);
      const cashChange = payload.p_changes.reduce((total, item) => total + item.amount_centavos, 0);

      paymentReportRows = [
        {
          paid_on: paidOn,
          method: 'CASH',
          received_centavos: cashPaid,
          change_centavos: cashChange,
          net_centavos: cashPaid - cashChange,
        },
        {
          paid_on: paidOn,
          method: 'GCASH',
          received_centavos: gcashPaid,
          change_centavos: 0,
          net_centavos: gcashPaid,
        },
      ];
    } else {
      dailyRows = [];
      laborReportRows = [];
      paymentReportRows = [];
    }

    return fulfill(route, order);
  });

  await page.route('**/rest/v1/rpc/get_sales_receipt', (route) => {
    if (!order || order.status !== 'PAID') {
      return fulfill(route, null);
    }

    return fulfill(route, {
      shop: {
        name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
        address: 'Manila',
        contact: '0917 000 0000',
        footer: 'Thank you',
      },
      order_no: order.order_no,
      business_date: order.business_date,
      paid_on: order.paid_on,
      status: order.status,
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
    });
  });
}

test('saves an unpaid job, takes payment later, and shows both lists', async ({ page }) => {
  test.setTimeout(60_000);
  await mockSalesLog(page);
  await signInAs(page, owner);

  const today = manilaToday();
  const orderNo = `SL-${today.replaceAll('-', '')}-0001`;

  await page.getByRole('button', { name: 'New order' }).first().click();
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();
  await expect(page.getByText('Job total').first()).toBeVisible();

  await page.getByLabel('Search the catalog').fill('brake');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const labor = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Labor', exact: true }),
  });
  await labor.getByLabel('Total labor (₱)').fill('100');
  await labor
    .getByText('Helper', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Magma', exact: true })
    .click();
  await labor.getByLabel('Helper’s share (₱)').fill('20');

  await expect(page.getByText('₱250.00').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save order' }).first().click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText('Open jobs')).toBeVisible();
  await expect(page.getByText(orderNo)).toBeVisible();
  await expect(page.getByText('Unpaid', { exact: true })).toBeVisible();
  await expect(page.getByText('No paid sales on this date')).toBeVisible();

  await page.getByRole('button', { name: 'Take payment' }).click();
  await expect(page.getByRole('tab', { name: /Payment/ })).toHaveAttribute('aria-selected', 'true');

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
  await payment.getByRole('button', { name: 'You', exact: true }).click();

  await payment.getByRole('button', { name: 'Add payment' }).click();
  await payment.getByLabel('Amount (₱)').nth(1).fill('100');

  await payment.getByRole('button', { name: 'Add change' }).click();
  await payment.getByLabel('Amount (₱)').last().fill('50');

  await expect(page.getByText('₱260.00').first()).toBeVisible();
  await page.getByRole('button', { name: 'Record payment' }).first().click();

  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share receipt' })).toBeVisible();

  await navLink(page, 'Orders').click();
  await expect(page.getByText('No jobs waiting for payment.')).toBeVisible();
  await expect(page.getByText(orderNo)).toBeVisible();
  await expect(page.getByText('₱250.00').first()).toBeVisible();

  await navLink(page, 'Reports').click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByText('Paid sales by day')).toBeVisible();
  await expect(page.getByRole('link', { name: displayDate(today) })).toBeVisible();

  await page.locator('a[href="/reports/gcash"]').click();
  await expect(page.getByRole('heading', { name: 'GCash', exact: true })).toBeVisible();
  await expect(page.getByText('₱60.00').first()).toBeVisible();

  await page.goto(`/s/${token}`);
  await expect(page.getByText(orderNo)).toBeVisible();
  await expect(page.getByText('Brake pad')).toBeVisible();
  await expect(page.getByText('Paid on', { exact: false })).toBeVisible();
  await expect(page.getByText('₱260.00').first()).toBeVisible();
});
