import { chromium } from '@playwright/test';

const employeeId = process.env.STAFF_EMPLOYEE_ID;
const password = process.env.STAFF_PASSWORD;
if (!employeeId || !password) throw new Error('Missing production credentials.');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto('https://jja-pos.seanromaa.workers.dev/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Employee ID').fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const setup = page.getByRole('heading', { name: 'Set your PIN' });
  const orders = page.getByRole('heading', { name: 'Orders', exact: true });
  await Promise.race([
    setup.waitFor({ timeout: 20_000 }),
    orders.waitFor({ timeout: 20_000 }),
  ]).catch(() => undefined);

  if (await setup.isVisible().catch(() => false)) {
    for (const digit of ['1', '2', '3', '4', '1', '2', '3', '4']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
  }

  await orders.waitFor({ timeout: 20_000 });
  await page.getByRole('heading', { name: 'Open jobs', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Paid sales', exact: true }).waitFor();
  const openBefore = await page.getByRole('button', { name: 'Take payment' }).count();

  await page.getByRole('button', { name: 'New order' }).first().click();
  await page.getByLabel('Search the catalog').fill('brake');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();

  const quickSale = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Payment now', exact: true }),
  });
  await quickSale.waitFor();
  await quickSale.getByRole('button', { name: 'Cash', exact: true }).waitFor();
  const amount = await quickSale.getByLabel('Amount received (₱)').inputValue();
  if (!amount || Number(amount.replace(/[^\d.]/g, '')) <= 0) {
    throw new Error('Quick sale amount is not prefilled.');
  }
  await page.getByText('Payment total', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Save & record payment' }).first().waitFor();
  console.log('quick-sale-ui ok');

  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await page.waitForURL(/\/orders$/);
  await page.getByRole('heading', { name: 'Open jobs', exact: true }).waitFor();
  const openAfter = await page.getByRole('button', { name: 'Take payment' }).count();
  if (openAfter !== openBefore) {
    throw new Error(`Open jobs changed after cancel: ${openBefore} -> ${openAfter}`);
  }
  console.log('open-jobs unchanged', openBefore);

  const paidSection = page.locator('section[aria-labelledby="paid-sales"]');
  const paidLink = paidSection.locator('ul a[href^="/orders/"]').first();
  if ((await paidLink.count()) > 0) {
    await paidLink.click();
    await page.getByText('Receipt ready', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Share receipt' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Share receipt' }).waitFor();
    const receiptUrl = dialog.getByText(/\/s\//);
    const fits = await receiptUrl.evaluate((element) => element.scrollWidth <= element.clientWidth);
    if (!fits) throw new Error('Receipt link is clipped.');

    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    if (!box || box.x < 0 || box.x + box.width > (viewport?.width ?? 0) + 1) {
      throw new Error('Receipt dialog overflows the viewport.');
    }
    console.log('receipt-dialog ok');

    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Orders', exact: true }).first().click();
    await page.waitForURL(/\/orders$/);
  }

  console.log('done');
} finally {
  await browser.close();
}
