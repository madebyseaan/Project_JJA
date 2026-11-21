import { expect, test } from '@playwright/test';

test('verifies a receipt through the public page', async ({ page }) => {
  await page.route('**/rest/v1/rpc/verify_receipt', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        status: 'ISSUED',
        receipt_no: '20261121-0001',
        issued_at: '2026-11-21T05:30:00Z',
        total_centavos: 35000,
        payment_method: 'CASH',
        void_reason: null,
      }),
    }),
  );

  await page.goto('/verify');

  await page.getByLabel('Receipt number').fill('20261121-0001');
  await page.getByLabel('Verification code').fill('ABCD-1234-EF56-7890');
  await page.getByRole('button', { name: 'Verify receipt' }).click();

  await expect(page.getByText('Valid receipt')).toBeVisible();
  await expect(page.getByText('20261121-0001')).toBeVisible();
  await expect(page.getByText('₱350.00')).toBeVisible();
});
