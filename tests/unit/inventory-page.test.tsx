import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { InventoryPage } from '@/features/inventory/InventoryPage';
import type { Part } from '@/features/inventory/types';
import type { Profile } from '@/types/domain';

const ownerProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  employeeId: 'JJA-001',
  displayName: 'Dad',
  role: 'owner' as const,
};

const mechanicProfile = {
  ...ownerProfile,
  id: '2',
  employeeId: 'JJA-002',
  role: 'mechanic' as const,
};

let authValue: { status: 'signed-in'; profile: Profile } = {
  status: 'signed-in',
  profile: ownerProfile,
};

let partsState: {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: Part[] | undefined;
  refetch: () => void;
};

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part-1',
    name: 'Brake pad',
    sku: 'BP-01',
    category: 'Brakes',
    compatibleModels: ['Honda Click 125'],
    unitPriceCentavos: 15000,
    costPriceCentavos: 9000,
    stockOnHand: 5,
    reservedQty: 0,
    availableQty: 5,
    lowStockThreshold: 2,
    isActive: true,
    createdAt: '2026-11-15T08:00:00Z',
    updatedAt: '2026-11-15T08:00:00Z',
    ...overrides,
  };
}

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/hooks/use-online-status', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/features/inventory/hooks/use-parts', () => ({
  useParts: () => partsState,
  useCreatePart: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useUpdatePart: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useAdjustStock: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useStockMovements: () => ({ isPending: false, isError: false, data: [] }),
}));

beforeEach(() => {
  authValue = { status: 'signed-in', profile: ownerProfile };
  partsState = {
    isPending: false,
    isError: false,
    error: null,
    data: [
      makePart(),
      makePart({
        id: 'part-2',
        name: 'Spark plug',
        sku: 'SP-02',
        category: 'Electrical',
        stockOnHand: 1,
        availableQty: 1,
        lowStockThreshold: 3,
      }),
    ],
    refetch: vi.fn(),
  };
});

describe('InventoryPage', () => {
  test('shows the owner controls and the parts ledger', () => {
    render(<InventoryPage />);

    expect(screen.getByRole('heading', { name: 'Stock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add part/i })).toBeInTheDocument();
    expect(screen.getAllByText('Brake pad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spark plug').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low stock').length).toBeGreaterThan(0);
  });

  test('keeps the mechanic read-only', () => {
    authValue = { status: 'signed-in', profile: mechanicProfile };

    render(<InventoryPage />);

    expect(screen.queryByRole('button', { name: /add part/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit part/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/actions for/i)).not.toBeInTheDocument();
  });

  test('filters by search text', async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);

    await user.type(screen.getByLabelText('Search parts'), 'spark');

    expect(screen.getAllByText('Spark plug').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Brake pad')).toHaveLength(0);
  });

  test('filters to low stock only', async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);

    await user.click(screen.getByRole('button', { name: /low stock/i }));

    expect(screen.getAllByText('Spark plug').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Brake pad')).toHaveLength(0);
  });

  test('shows the empty catalog state', () => {
    partsState.data = [];

    render(<InventoryPage />);

    expect(screen.getByText('No parts yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add part/i }).length).toBeGreaterThan(0);
  });

  test('shows a retry state when the catalog fails', () => {
    partsState.isError = true;
    partsState.error = new Error('No connection. Nothing was saved.');
    partsState.data = undefined;

    render(<InventoryPage />);

    expect(screen.getByText('Could not load the parts catalog.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
