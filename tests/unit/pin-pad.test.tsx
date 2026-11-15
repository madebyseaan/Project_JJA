import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { PinPad } from '@/features/auth/PinPad';

test('completes after four digits and clears the dots', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();

  render(<PinPad onComplete={onComplete} />);

  for (const digit of ['1', '2', '3', '4']) {
    await user.click(screen.getByRole('button', { name: digit }));
  }

  expect(onComplete).toHaveBeenCalledWith('1234');
});

test('backspace removes the last digit', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();

  render(<PinPad onComplete={onComplete} />);

  await user.click(screen.getByRole('button', { name: '1' }));
  await user.click(screen.getByRole('button', { name: '2' }));
  await user.click(screen.getByRole('button', { name: '3' }));
  await user.click(screen.getByRole('button', { name: 'Delete last digit' }));
  await user.click(screen.getByRole('button', { name: '4' }));
  await user.click(screen.getByRole('button', { name: '5' }));

  expect(onComplete).toHaveBeenCalledWith('1245');
});

test('does not accept input while disabled', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();

  render(<PinPad onComplete={onComplete} disabled />);

  await user.click(screen.getByRole('button', { name: '1' }));

  expect(onComplete).not.toHaveBeenCalled();
});

test('shows an error message', () => {
  render(<PinPad onComplete={() => {}} error="Incorrect PIN." />);

  expect(screen.getByRole('alert')).toHaveTextContent('Incorrect PIN.');
});
