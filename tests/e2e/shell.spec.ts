import { expect, test } from '@playwright/test';

import { mechanic, navLink, owner, signInAs } from './fixtures';

const parts = [
  {
    id: 'part-1',
    name: 'Brake pad',
    sku: 'BP-01',
    category: 'Brakes',
    compatible_models: ['Honda Click 125'],
    unit_price_centavos: 15000,
    cost_price_centavos: 9000,
    stock_on_hand: 5,
    reserved_qty: 0,
    available_qty: 5,
    low_stock_threshold: 2,
    is_active: true,
    created_at: '2026-11-21T01:00:00Z',
    updated_at: '2026-11-21T01:00:00Z',
  },
];

const summary = {
  business_date: '2026-11-21',
  sales: { receipt_count: 2, parts_centavos: 30000, labor_centavos: 20000, total_centavos: 50000 },
  payments: {
    cash_centavos: 40000,
    gcash_centavos: 10000,
    maya_centavos: 0,
    other_centavos: 0,
    total_centavos: 50000,
  },
  expected_cash_centavos: 40000,
  voids: [],
  low_stock: [],
  day_close: null,
};

test('owner shell reaches the inventory and owner dashboard', async ({ page }) => {
  await page.route('**/rest/v1/parts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parts) }),
  );
  await page.route('**/rest/v1/rpc/get_daily_summary', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary) }),
  );

  await signInAs(page, owner);

  await navLink(page, 'Stock').click();
  await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
  await expect(
    page.getByText('Brake pad', { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  await navLink(page, 'Owner').click();
  await expect(page.getByRole('heading', { name: 'Owner' })).toBeVisible();
  await expect(page.getByText('₱500.00').first()).toBeVisible();
});

test('mechanic does not see the owner navigation', async ({ page }) => {
  await signInAs(page, mechanic);

  await expect(navLink(page, 'Bay')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Owner' })).toHaveCount(0);
});

test('the shell fits a 360px phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signInAs(page, owner);

  await expect(navLink(page, 'Bay')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await navLink(page, 'Stock').click();
  await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
});
