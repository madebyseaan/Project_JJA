import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, test, vi } from 'vitest';

import { ReceiptPage } from '@/features/receipts/ReceiptPage';
import type { PublicReceipt } from '@/features/receipts/types';

const receipt: PublicReceipt = {
  receiptNo: '20261121-0001',
  status: 'ISSUED',
  issuedAt: '2026-11-21T05:30:00Z',
  totalCentavos: 35000,
  verificationCode: 'ABCD-1234-EF56-7890',
  voidReason: null,
  snapshot: {
    shop: { name: 'J.J.A Motor Accessories', address: 'Manila', contact: '0917', footer: 'Thanks' },
    ticket: {
      no: 'TK-20261121-0001',
      type: 'REPAIR',
      customer_name: 'Jose',
      bike_model: 'Honda Click',
      created_at: '2026-11-21T05:00:00Z',
    },
    items: [
      {
        name: 'Brake pad',
        qty: 2,
        unit_price_centavos: 15000,
        line_total_centavos: 30000,
      },
    ],
    labor: [{ description: 'Install', amount_centavos: 5000 }],
    totals: { parts_centavos: 30000, labor_centavos: 5000, total_centavos: 35000 },
    payments: [{ method: 'CASH', amount_centavos: 35000, received_by: 'Uncle' }],
    receipt_no: '20261121-0001',
    issued_at: '2026-11-21T05:30:00Z',
  },
};

const getPublicReceipt = vi.fn(async () => receipt);

vi.mock('@/features/receipts/api', () => ({
  getPublicReceipt: () => getPublicReceipt(),
}));

function renderReceipt() {
  const router = createMemoryRouter([{ path: '/r/:token', element: <ReceiptPage /> }], {
    initialEntries: ['/r/abcdef'],
  });

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ReceiptPage', () => {
  test('renders the shop, items, totals, and verification code', async () => {
    renderReceipt();

    expect(await screen.findByText('J.J.A Motor Accessories')).toBeInTheDocument();
    expect(screen.getByText('20261121-0001')).toBeInTheDocument();
    expect(screen.getByText('Brake pad')).toBeInTheDocument();
    expect(screen.getByText('Install')).toBeInTheDocument();
    expect(screen.getAllByText('₱350.00').length).toBeGreaterThan(0);
    expect(screen.getByText('ABCD-1234-EF56-7890')).toBeInTheDocument();
    expect(screen.getByText(/not a BIR Official Receipt/i)).toBeInTheDocument();
  });

  test('renders a void banner for a voided receipt', async () => {
    getPublicReceipt.mockResolvedValueOnce({
      ...receipt,
      status: 'VOID',
      voidReason: 'Wrong part',
    });

    renderReceipt();

    expect(await screen.findByText('This receipt is void')).toBeInTheDocument();
    expect(screen.getByText('Wrong part')).toBeInTheDocument();
  });
});
