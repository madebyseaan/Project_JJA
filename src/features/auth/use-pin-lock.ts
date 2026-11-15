import { useContext } from 'react';

import { PinLockContext, type PinLockContextValue } from './pin-lock-context';

export function usePinLock(): PinLockContextValue {
  const context = useContext(PinLockContext);

  if (!context) {
    throw new Error('usePinLock must be used within PinLockProvider');
  }

  return context;
}
