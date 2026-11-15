import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { useOnlineStatus } from '@/hooks/use-online-status';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

afterEach(() => setOnline(true));

test('tracks the browser online state', () => {
  setOnline(true);

  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(true);

  setOnline(false);
  act(() => window.dispatchEvent(new Event('offline')));
  expect(result.current).toBe(false);

  setOnline(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(result.current).toBe(true);
});

test('starts offline when the browser is offline', () => {
  setOnline(false);

  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(false);
});
