import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { QuickSalePayment } from '@/features/sales/components/QuickSalePayment';
import type { QuickSalePaymentValue, StaffProfile } from '@/features/sales/types';

const staff: StaffProfile[] = [
  { id: 'aldwin', displayName: 'Aldwin', employeeId: 'JJA-001' },
  { id: 'magma', displayName: 'Magma', employeeId: 'JJA-002' },
];

const value: QuickSalePaymentValue = {
  payNow: true,
  method: 'CASH',
  amount: '',
  amountTouched: false,
  gcashRecipientId: '',
};

function renderQuickSale(overrides: Partial<Parameters<typeof QuickSalePayment>[0]> = {}) {
  const onChange = vi.fn();

  render(
    <QuickSalePayment
      value={value}
      totalCentavos={15000}
      changeCentavos={0}
      shortfallCentavos={0}
      staff={staff}
      currentUserId="aldwin"
      defaultRecipientId="aldwin"
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange };
}

describe('QuickSalePayment', () => {
  test('shows Cash and the exact total by default', () => {
    renderQuickSale();

    expect(screen.getByRole('heading', { name: 'Payment now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cash' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Amount received (₱)')).toHaveValue('150.00');
    expect(screen.getByText('Exact payment.')).toBeInTheDocument();
  });

  test('switches to GCash with the main worker as the recipient', async () => {
    const user = userEvent.setup();
    const { onChange } = renderQuickSale();

    await user.click(screen.getByRole('button', { name: 'GCash' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GCASH', gcashRecipientId: 'aldwin' }),
    );
  });

  test('marks a typed amount as touched', () => {
    const { onChange } = renderQuickSale();

    fireEvent.change(screen.getByLabelText('Amount received (₱)'), {
      target: { value: '200' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '200', amountTouched: true }),
    );
  });

  test('switches to pay later', async () => {
    const user = userEvent.setup();
    const { onChange } = renderQuickSale();

    await user.click(screen.getByRole('button', { name: 'Pay later' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ payNow: false }));
  });

  test('shows automatic change and shortfall', () => {
    const { rerender } = render(
      <QuickSalePayment
        value={value}
        totalCentavos={15000}
        changeCentavos={5000}
        shortfallCentavos={0}
        staff={staff}
        currentUserId="aldwin"
        defaultRecipientId="aldwin"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Change ₱50.00')).toBeInTheDocument();

    rerender(
      <QuickSalePayment
        value={value}
        totalCentavos={15000}
        changeCentavos={0}
        shortfallCentavos={5000}
        staff={staff}
        currentUserId="aldwin"
        defaultRecipientId="aldwin"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Short by ₱50.00')).toBeInTheDocument();
  });
});
