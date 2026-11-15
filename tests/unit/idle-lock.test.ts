import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useIdleLock } from '@/hooks/use-idle-lock';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('locks after the timeout', () => {
  const onLock = vi.fn();

  renderHook(() => useIdleLock(5000, onLock));

  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(onLock).toHaveBeenCalledTimes(1);
});

test('resets on activity', () => {
  const onLock = vi.fn();

  renderHook(() => useIdleLock(5000, onLock));

  act(() => {
    vi.advanceTimersByTime(4000);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(4000);
  });

  expect(onLock).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(onLock).toHaveBeenCalledTimes(1);
});

test('does nothing while disabled', () => {
  const onLock = vi.fn();

  renderHook(() => useIdleLock(5000, onLock, false));

  act(() => {
    vi.advanceTimersByTime(10000);
  });

  expect(onLock).not.toHaveBeenCalled();
});
