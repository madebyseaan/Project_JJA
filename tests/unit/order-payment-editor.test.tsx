import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { OrderPaymentEditor } from '@/features/sales/components/OrderPaymentEditor';
import type { StaffProfile } from '@/features/sales/types';

const staff: StaffProfile[] = [
  { id: 'aldwin', displayName: 'Aldwin', employeeId: 'JJA-001' },
  { id: 'magma', displayName: 'Magma', employeeId: 'JJA-002' },
];

function renderEditor() {
  const onPaymentsChange = vi.fn();
  const onChangesChange = vi.fn();

  render(
    <OrderPaymentEditor
      payments={[]}
      changes={[]}
      staff={staff}
      defaultRecipientId="aldwin"
      currentUserId="aldwin"
      onPaymentsChange={onPaymentsChange}
      onChangesChange={onChangesChange}
    />,
  );

  return { onPaymentsChange, onChangesChange };
}

describe('OrderPaymentEditor', () => {
  test('adds a cash payment without a hidden GCash recipient', async () => {
    const user = userEvent.setup();
    const { onPaymentsChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add payment' }));

    expect(onPaymentsChange).toHaveBeenCalledWith([
      expect.objectContaining({ method: 'CASH', gcashRecipientId: '' }),
    ]);
  });

  test('adds a cash change without a hidden GCash recipient', async () => {
    const user = userEvent.setup();
    const { onChangesChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add change' }));

    expect(onChangesChange).toHaveBeenCalledWith([
      expect.objectContaining({ method: 'CASH', gcashRecipientId: '' }),
    ]);
  });
});
