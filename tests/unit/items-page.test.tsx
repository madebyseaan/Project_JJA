import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ItemsPage } from '@/features/sales/ItemsPage';
import type { CatalogItem } from '@/features/sales/types';

let catalogState: {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: CatalogItem[] | undefined;
};

vi.mock('@/features/sales/hooks/use-sales', () => ({
  useCatalog: () => catalogState,
  useImportCatalog: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const brake: CatalogItem = {
  id: 'item-1',
  name: 'Brake pad',
  description: 'Front brake pad',
  sku: 'BP-01',
  basePriceCentavos: 15000,
  itemType: 'Inventory Part',
  incomeAccount: 'Merchandise Sales',
  cogsAccount: 'Cost of Goods Sold',
  assetAccount: 'Inventory Asset',
  preferredVendor: 'Supplier A',
  isActive: true,
};

const spark: CatalogItem = {
  ...brake,
  id: 'item-2',
  name: 'Spark plug',
  description: '',
  sku: 'SP-01',
  basePriceCentavos: 8550,
  preferredVendor: '',
};

beforeEach(() => {
  catalogState = {
    isPending: false,
    isError: false,
    error: null,
    data: [brake, spark],
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ItemsPage />
    </MemoryRouter>,
  );
}

describe('ItemsPage', () => {
  test('lists item names, prices, and vendors', () => {
    renderPage();

    expect(screen.getByText('Brake pad')).toBeInTheDocument();
    expect(screen.getByText('₱150.00')).toBeInTheDocument();
    expect(screen.getByText('BP-01 · Supplier A')).toBeInTheDocument();
    expect(screen.getByText('Spark plug')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 items')).toBeInTheDocument();
  });

  test('filters by name or SKU', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Search items'), 'sp-01');

    expect(screen.getByText('Spark plug')).toBeInTheDocument();
    expect(screen.queryByText('Brake pad')).not.toBeInTheDocument();
  });

  test('shows a no-match state that points to custom lines', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Search items'), 'clutch');

    expect(screen.getByText(/No item matches/)).toBeInTheDocument();
    expect(screen.getByText(/custom line/)).toBeInTheDocument();
  });

  test('shows the empty state with an import action', () => {
    catalogState.data = [];
    renderPage();

    expect(screen.getByText('No items yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /import item list/i }).length).toBeGreaterThan(0);
  });

  test('caps the rendered list and asks for a narrower search', () => {
    catalogState.data = Array.from({ length: 205 }, (_, index) => ({
      ...brake,
      id: `item-${index}`,
      name: `Item ${index}`,
    }));

    renderPage();

    expect(screen.getByText(/Showing the first 200 of 205 matches/)).toBeInTheDocument();
  });

  test('shows a retry state when the catalog fails', () => {
    catalogState.isError = true;
    catalogState.error = new Error('No connection.');
    catalogState.data = undefined;

    renderPage();

    expect(screen.getByText('Could not load the item list.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
