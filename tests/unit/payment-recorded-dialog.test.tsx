import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { PaymentRecordedDialog } from '@/features/sales/components/PaymentRecordedDialog';
import type { PaymentRecordedState, SalesOrder } from '@/features/sales/types';

const order: SalesOrder = {
  id: 'order-1',
  orderNo: 'SL-20261123-0004',
  businessDate: '2026-11-23',
  paidOn: '2026-11-23',
  customerName: 'Walk-in',
  bikeModel: null,
  mainUserId: 'aldwin',
  mainUserName: 'Aldwin',
  helperUserId: null,
  helperUserName: null,
  partsTotalCentavos: 20000,
  laborTotalCentavos: 5000,
  totalCentavos: 25000,
  status: 'PAID',
  createdAt: '2026-11-23T02:00:00Z',
  publicToken: '0123456789abcdef0123456789abcdef',
};

function renderDialog(
  record: PaymentRecordedState = {
    order,
    paidCentavos: 31000,
    changeCentavos: 5000,
    mode: 'recorded',
  },
) {
  const onClose = vi.fn();
  const onShare = vi.fn();

  render(<PaymentRecordedDialog record={record} onClose={onClose} onShare={onShare} />);

  return { onClose, onShare };
}

describe('PaymentRecordedDialog', () => {
  test('shows the paid amount, change, and receipt readiness', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Payment recorded' })).toBeInTheDocument();
    expect(screen.getByText('Paid', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(order.orderNo)).toBeInTheDocument();
    expect(screen.getByText('₱260.00')).toBeInTheDocument();
    expect(screen.getByText('₱310.00')).toBeInTheDocument();
    expect(screen.getByText('₱50.00')).toBeInTheDocument();
    expect(screen.getByText('Receipt ready')).toBeInTheDocument();
  });

  test('shares the receipt and closes with Done', async () => {
    const user = userEvent.setup();
    const { onClose, onShare } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Share receipt' }));
    expect(onShare).toHaveBeenCalledWith(order);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('says payment updated for an existing paid order', () => {
    renderDialog({
      order,
      paidCentavos: 31000,
      changeCentavos: 5000,
      mode: 'updated',
    });

    expect(screen.getByRole('heading', { name: 'Payment updated' })).toBeInTheDocument();
  });
});
