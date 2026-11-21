import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, test, vi } from 'vitest';

import { OwnerDashboardPage } from '@/features/owner/OwnerDashboardPage';
import type { DailySummary } from '@/features/owner/types';

const summary: DailySummary = {
  businessDate: '2026-11-21',
  sales: {
    receiptCount: 2,
    partsCentavos: 30000,
    laborCentavos: 20000,
    totalCentavos: 50000,
  },
  payments: {
    cashCentavos: 40000,
    gcashCentavos: 10000,
    mayaCentavos: 0,
    otherCentavos: 0,
    totalCentavos: 50000,
  },
  expectedCashCentavos: 40000,
  voids: [
    {
      receiptNo: '20261121-0002',
      totalCentavos: 12000,
      voidedAt: '2026-11-21T09:00:00Z',
      voidReason: 'Wrong part',
    },
  ],
  lowStock: [
    {
      id: 'part-1',
      name: 'Brake pad',
      sku: 'BP-01',
      availableQty: 1,
      lowStockThreshold: 3,
    },
  ],
  dayClose: null,
};

let summaryState: {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: DailySummary | undefined;
  refetch: () => void;
};

vi.mock('@/features/owner/hooks/use-owner', () => ({
  useDailySummary: () => summaryState,
  useCloseDay: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <OwnerDashboardPage />
    </MemoryRouter>,
  );
}

describe('OwnerDashboardPage', () => {
  test('shows sales, payments, low stock, and voids', () => {
    summaryState = {
      isPending: false,
      isError: false,
      error: null,
      data: summary,
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.getByRole('heading', { name: 'Owner' })).toBeInTheDocument();
    expect(screen.getAllByText('₱500.00').length).toBeGreaterThan(0);
    expect(screen.getByText('₱400.00')).toBeInTheDocument();
    expect(screen.getByText('Brake pad')).toBeInTheDocument();
    expect(screen.getByText('20261121-0002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close the day/i })).toBeInTheDocument();
  });

  test('shows the variance for a closed day', () => {
    summaryState = {
      isPending: false,
      isError: false,
      error: null,
      data: {
        ...summary,
        dayClose: {
          id: 'close-1',
          businessDate: '2026-11-21',
          expectedCashCentavos: 40000,
          countedCashCentavos: 39000,
          varianceCentavos: -1000,
          expectedGcashCentavos: 10000,
          expectedMayaCentavos: 0,
          expectedOtherCentavos: 0,
          notes: 'Short by one hundred',
          closedBy: 'owner-1',
          closedAt: '2026-11-21T10:00:00Z',
        },
      },
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.getByText('-₱10.00')).toBeInTheDocument();
    expect(screen.getByText('Short by one hundred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /correct day close/i })).toBeInTheDocument();
  });

  test('shows an error with a retry action', () => {
    summaryState = {
      isPending: false,
      isError: true,
      error: new Error('Only the owner can do this.'),
      data: undefined,
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.getByText('Could not load the owner summary.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
