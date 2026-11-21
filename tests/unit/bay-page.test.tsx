import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { BayPage } from '@/features/bay/BayPage';
import type { Ticket } from '@/features/bay/types';

let ticketsState: {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: Ticket[] | undefined;
  refetch: () => void;
};

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    ticketNo: 'TK-20261121-0001',
    type: 'REPAIR',
    status: 'PENDING',
    customerName: 'Jose',
    bikeModel: 'Honda Click',
    notes: null,
    partsTotalCentavos: 30000,
    laborTotalCentavos: 20000,
    totalCentavos: 50000,
    createdBy: 'user-1',
    createdByName: 'Uncle',
    createdAt: '2026-11-21T01:00:00Z',
    updatedAt: '2026-11-21T01:00:00Z',
    ...overrides,
  };
}

vi.mock('@/hooks/use-online-status', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/features/bay/hooks/use-tickets', () => ({
  useTickets: () => ticketsState,
  useTicketRealtime: () => undefined,
  useCreateTicket: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

vi.mock('@/features/inventory/hooks/use-parts', () => ({
  useParts: () => ({ isPending: false, isError: false, error: null, data: [] }),
}));

beforeEach(() => {
  ticketsState = {
    isPending: false,
    isError: false,
    error: null,
    data: [
      makeTicket(),
      makeTicket({
        id: 'ticket-2',
        ticketNo: 'TK-20261121-0002',
        status: 'IN_PROGRESS',
        customerName: null,
        bikeModel: 'Yamaha Mio',
        totalCentavos: 125000,
      }),
    ],
    refetch: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <BayPage />
    </MemoryRouter>,
  );
}

describe('BayPage', () => {
  test('lists open tickets with status, customer, and total', () => {
    renderPage();

    expect(screen.getByText('TK-20261121-0001')).toBeInTheDocument();
    expect(screen.getByText('Jose · Honda Click')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('₱500.00')).toBeInTheDocument();
    expect(screen.getByText('Walk-in · Yamaha Mio')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  test('links each ticket to its detail route', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /TK-20261121-0001/ })).toHaveAttribute(
      'href',
      '/bay/ticket/ticket-1',
    );
  });

  test('searches by ticket number and customer', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Search tickets'), 'yamaha');

    expect(screen.getByText('TK-20261121-0002')).toBeInTheDocument();
    expect(screen.queryByText('TK-20261121-0001')).not.toBeInTheDocument();
  });

  test('shows the empty state with a new-ticket action', () => {
    ticketsState.data = [];

    renderPage();

    expect(screen.getByText('No tickets in the bay')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new ticket/i }).length).toBeGreaterThan(0);
  });

  test('shows a retry state when the queue fails', () => {
    ticketsState.isError = true;
    ticketsState.error = new Error('No connection. Nothing was saved.');
    ticketsState.data = undefined;

    renderPage();

    expect(screen.getByText('Could not load the bay queue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
