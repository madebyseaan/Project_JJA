import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SalesReceiptPage } from '@/features/sales/SalesReceiptPage';
import type { PublicSalesReceipt } from '@/features/sales/types';

const receipt: PublicSalesReceipt = {
  shop: {
    name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
    address: 'Manila',
    contact: '0917 000 0000',
    footer: 'Thank you',
  },
  orderNo: 'SL-20261122-0001',
  businessDate: '2026-11-22',
  customerName: 'Jose',
  bikeModel: 'Honda Click',
  items: [
    {
      name: 'Brake pad',
      qty: 2,
      unitPriceCentavos: 15000,
      lineTotalCentavos: 30000,
    },
  ],
  laborTotalCentavos: 10000,
  totalCentavos: 40000,
  extrasTotalCentavos: 0,
  payments: [
    { method: 'CASH', amountCentavos: 30000 },
    { method: 'GCASH', amountCentavos: 10000 },
  ],
  changes: [],
};

const receiptState = {
  isPending: false,
  isError: false,
  error: null as Error | null,
  data: receipt as PublicSalesReceipt | null,
  refetch: vi.fn(),
};

vi.mock('@/features/sales/hooks/use-sales', () => ({
  usePublicReceipt: () => receiptState,
}));

beforeEach(() => {
  receiptState.isError = false;
  receiptState.error = null;
  receiptState.data = receipt;
});

function renderPage(token = 'abc123') {
  const router = createMemoryRouter([{ path: '/s/:token', element: <SalesReceiptPage /> }], {
    initialEntries: [`/s/${token}`],
  });

  return render(<RouterProvider router={router} />);
}

describe('SalesReceiptPage', () => {
  test('renders the shop, order, items, totals, and payment methods', () => {
    renderPage();

    expect(
      screen.getByText('J.J.A Motor Accessories and Motorcycle Repair Shop'),
    ).toBeInTheDocument();
    expect(screen.getByText('SL-20261122-0001')).toBeInTheDocument();
    expect(screen.getByText('Brake pad')).toBeInTheDocument();
    expect(screen.getByText('Jose')).toBeInTheDocument();
    expect(screen.getByText('Honda Click')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('GCash')).toBeInTheDocument();
    expect(screen.getAllByText('₱400.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Total charged')).toBeInTheDocument();
  });

  test('never shows an internal labor split', () => {
    renderPage();

    expect(screen.queryByText('Dad')).not.toBeInTheDocument();
    expect(screen.queryByText('Uncle')).not.toBeInTheDocument();
    expect(screen.queryByText(/helper/i)).not.toBeInTheDocument();
  });

  test('shows a tip and change when the customer paid more than the sale', () => {
    receiptState.data = {
      ...receipt,
      extrasTotalCentavos: 1000,
      payments: [
        { method: 'CASH', amountCentavos: 21000 },
        { method: 'GCASH', amountCentavos: 10000 },
      ],
      changes: [{ method: 'CASH', amountCentavos: 5000 }],
    };

    renderPage();

    expect(screen.getByText('Extra / tip')).toBeInTheDocument();
    expect(screen.getByText('Change returned')).toBeInTheDocument();
    expect(screen.getByText('Total charged')).toBeInTheDocument();
    expect(screen.getAllByText('₱260.00').length).toBeGreaterThan(0);
  });

  test('shows a not-found state for a bad token', () => {
    receiptState.data = null;

    renderPage();

    expect(screen.getByText('Receipt not found')).toBeInTheDocument();
  });

  test('shows an error state with retry', () => {
    receiptState.isError = true;
    receiptState.error = new Error('No connection.');
    receiptState.data = undefined as unknown as PublicSalesReceipt | null;

    renderPage();

    expect(screen.getByText('Could not load this receipt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
