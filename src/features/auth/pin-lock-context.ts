import { createContext } from 'react';

export type UnlockResult = { ok: true } | { ok: false; attemptsLeft: number; lockedOut: boolean };

export type PinLockContextValue = {
  unlocked: boolean;
  hasPin: boolean;
  lock: () => void;
  setPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<UnlockResult>;
  clearPinAndSignOut: () => Promise<void>;
};

export const PinLockContext = createContext<PinLockContextValue | null>(null);
