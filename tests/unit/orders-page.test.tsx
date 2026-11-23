import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { OrdersPage } from '@/features/sales/OrdersPage';
import type { DailyReport, LaborReport, PaymentsReport, SalesOrder } from '@/features/sales/types';

type QueryState<T> = {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: T[] | undefined;
  refetch: () => void;
};

let openState: QueryState<SalesOrder>;
let paidState: QueryState<SalesOrder>;
let dailyState: QueryState<DailyReport>;
let laborState: QueryState<LaborReport>;
let paymentsState: QueryState<PaymentsReport>;

vi.mock('@/features/sales/hooks/use-sales', () => ({
  useOpenOrders: () => openState,
  usePaidOrders: () => paidState,
  useDailyReport: () => dailyState,
  useLaborReport: () => laborState,
  usePaymentsReport: () => paymentsState,
}));

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    status: 'signed-in',
    profile: { id: 'aldwin', employeeId: 'JJA-001', displayName: 'Aldwin', role: 'owner' },
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

const openOrder: SalesOrder = {
  id: 'open-1',
  orderNo: 'SL-20261123-0001',
  businessDate: '2026-11-23',
  paidOn: null,
  customerName: 'Jose',
  bikeModel: 'Honda Click',
  mainUserId: 'aldwin',
  mainUserName: 'Aldwin',
  helperUserId: null,
  helperUserName: null,
  partsTotalCentavos: 15000,
  laborTotalCentavos: 5000,
  totalCentavos: 20000,
  status: 'OPEN',
  createdAt: '2026-11-23T01:00:00Z',
  publicToken: 'a'.repeat(32),
};

const paidOrder: SalesOrder = {
  ...openOrder,
  id: 'paid-1',
  orderNo: 'SL-20261122-0001',
  businessDate: '2026-11-22',
  paidOn: '2026-11-23',
  customerName: 'Maria',
  partsTotalCentavos: 20000,
  laborTotalCentavos: 10000,
  totalCentavos: 30000,
  status: 'PAID',
  publicToken: 'b'.repeat(32),
};

function emptyState<T>(): QueryState<T> {
  return {
    isPending: false,
    isError: false,
    error: null,
    data: [],
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  openState = { ...emptyState<SalesOrder>(), data: [openOrder] };
  paidState = { ...emptyState<SalesOrder>(), data: [paidOrder] };
  dailyState = {
    ...emptyState<DailyReport>(),
    data: [
      {
        paidOn: '2026-11-23',
        orderCount: 1,
        partsTotalCentavos: 20000,
        laborTotalCentavos: 10000,
        totalCentavos: 30000,
        extrasTotalCentavos: 0,
      },
    ],
  };
  laborState = {
    ...emptyState<LaborReport>(),
    data: [
      {
        paidOn: '2026-11-23',
        userId: 'aldwin',
        displayName: 'Aldwin',
        baseLaborCentavos: 10000,
        extrasCentavos: 0,
        laborPayoutCentavos: 10000,
      },
    ],
  };
  paymentsState = {
    ...emptyState<PaymentsReport>(),
    data: [
      {
        paidOn: '2026-11-23',
        method: 'CASH',
        receivedCentavos: 30000,
        changeCentavos: 0,
        netCentavos: 30000,
      },
    ],
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  );
}

describe('OrdersPage', () => {
  test('shows open jobs and paid sales separately', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Open jobs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paid sales' })).toBeInTheDocument();
    expect(screen.getByText('SL-20261123-0001')).toBeInTheDocument();
    expect(screen.getByText('SL-20261122-0001')).toBeInTheDocument();
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Take payment').closest('a')).toHaveAttribute(
      'href',
      '/orders/open-1?tab=payment',
    );
  });

  test('shows You for the signed-in worker', () => {
    renderPage();

    expect(screen.getAllByText(/You/).length).toBeGreaterThan(0);
  });

  test('does not count open jobs in the paid sales summary', () => {
    dailyState.data = [];
    laborState.data = [];
    paymentsState.data = [];

    renderPage();

    const partsCard = screen.getByText('Parts sales').parentElement;
    expect(partsCard).not.toBeNull();
    expect(within(partsCard as HTMLElement).getByText('₱0.00')).toBeInTheDocument();
  });

  test('shows empty states for no jobs and no paid sales', () => {
    openState.data = [];
    paidState.data = [];
    dailyState.data = [];
    laborState.data = [];
    paymentsState.data = [];

    renderPage();

    expect(screen.getByText('No jobs waiting for payment.')).toBeInTheDocument();
    expect(screen.getByText('No paid sales on this date')).toBeInTheDocument();
  });
});
