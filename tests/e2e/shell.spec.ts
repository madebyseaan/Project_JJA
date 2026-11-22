import { expect, test } from '@playwright/test';

import { mechanic, navLink, owner, signInAs } from './fixtures';

const emptyDaily: unknown[] = [];
const emptyLabor: unknown[] = [];
const emptyPayments: unknown[] = [];

async function mockEmptyDay(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/sales_orders*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/rest/v1/v_sales_daily*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyDaily),
    }),
  );
  await page.route('**/rest/v1/v_sales_labor_daily*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyLabor),
    }),
  );
  await page.route('**/rest/v1/v_sales_payments_daily*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPayments),
    }),
  );
}

test('both staff see the same sales log navigation', async ({ page }) => {
  await mockEmptyDay(page);
  await signInAs(page, owner);

  for (const name of ['Orders', 'Items', 'Reports', 'Settings']) {
    await expect(navLink(page, name)).toBeVisible();
  }

  await expect(page.getByText('No orders on this date')).toBeVisible();
});

test('the mechanic gets the same access as the owner', async ({ page }) => {
  await mockEmptyDay(page);
  await signInAs(page, mechanic);

  for (const name of ['Orders', 'Items', 'Reports', 'Settings']) {
    await expect(navLink(page, name)).toBeVisible();
  }

  await navLink(page, 'Items').click();
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toBeVisible();
});

test('the sales log fits a 360px phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockEmptyDay(page);
  await signInAs(page, owner);

  await expect(navLink(page, 'Orders')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await navLink(page, 'Reports').click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();

  const reportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(reportOverflow).toBeLessThanOrEqual(1);
});
