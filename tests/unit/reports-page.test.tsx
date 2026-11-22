import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ReportsPage } from '@/features/sales/ReportsPage';
import type { DailyReport, LaborReport, PaymentsReport } from '@/features/sales/types';

type QueryState<T> = {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: T[] | undefined;
  refetch: () => void;
};

let dailyState: QueryState<DailyReport>;
let laborState: QueryState<LaborReport>;
let paymentsState: QueryState<PaymentsReport>;

vi.mock('@/features/sales/hooks/use-sales', () => ({
  useDailyReport: () => dailyState,
  useLaborReport: () => laborState,
  usePaymentsReport: () => paymentsState,
}));

beforeEach(() => {
  dailyState = {
    isPending: false,
    isError: false,
    error: null,
    data: [
      {
        businessDate: '2026-11-02',
        orderCount: 2,
        partsTotalCentavos: 30000,
        laborTotalCentavos: 10000,
        totalCentavos: 40000,
        extrasTotalCentavos: 2000,
      },
      {
        businessDate: '2026-11-01',
        orderCount: 1,
        partsTotalCentavos: 5000,
        laborTotalCentavos: 0,
        totalCentavos: 5000,
        extrasTotalCentavos: 0,
      },
    ],
    refetch: vi.fn(),
  };
  laborState = {
    isPending: false,
    isError: false,
    error: null,
    data: [
      {
        businessDate: '2026-11-02',
        userId: 'dad',
        displayName: 'Dad',
        baseLaborCentavos: 8000,
        extrasCentavos: 2000,
        laborPayoutCentavos: 10000,
      },
      {
        businessDate: '2026-11-02',
        userId: 'uncle',
        displayName: 'Uncle',
        baseLaborCentavos: 2000,
        extrasCentavos: 0,
        laborPayoutCentavos: 2000,
      },
    ],
    refetch: vi.fn(),
  };
  paymentsState = {
    isPending: false,
    isError: false,
    error: null,
    data: [
      {
        businessDate: '2026-11-02',
        method: 'CASH',
        receivedCentavos: 45000,
        changeCentavos: 5000,
        netCentavos: 40000,
      },
      {
        businessDate: '2026-11-02',
        method: 'GCASH',
        receivedCentavos: 5000,
        changeCentavos: 0,
        netCentavos: 5000,
      },
      {
        businessDate: '2026-11-01',
        method: 'CASH',
        receivedCentavos: 5000,
        changeCentavos: 0,
        netCentavos: 5000,
      },
    ],
    refetch: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}

describe('ReportsPage', () => {
  test('shows monthly totals and a daily table', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText('2 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('1 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('₱450.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '2 Nov 2026' })).toHaveAttribute(
      'href',
      '/orders?date=2026-11-02',
    );
  });

  test('reveals labor per person in the full breakdown', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText('Labor by person')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Full breakdown' }));

    expect(screen.getByText('Labor by person')).toBeInTheDocument();
    expect(screen.getByText('Dad')).toBeInTheDocument();
    expect(screen.getByText('Uncle')).toBeInTheDocument();
    expect(screen.getAllByText('₱100.00').length).toBeGreaterThan(0);
  });

  test('shows the empty state for a month without sales', () => {
    dailyState.data = [];
    laborState.data = [];
    paymentsState.data = [];

    renderPage();

    expect(screen.getByText(/No sales in/)).toBeInTheDocument();
  });

  test('shows a retry state when a report fails', () => {
    dailyState.isError = true;
    dailyState.error = new Error('No connection.');
    dailyState.data = undefined;

    renderPage();

    expect(screen.getByText('Could not load the report.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
