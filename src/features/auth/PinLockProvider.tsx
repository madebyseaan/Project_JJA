import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useIdleLock } from '@/hooks/use-idle-lock';

import {
  clearPin,
  getPinRecord,
  PinExistsError,
  pinStorageKey,
  recordFailedAttempt,
  resetAttempts,
  savePin,
  verifyPin,
} from './pin';
import { PinLockContext, type PinLockContextValue, type UnlockResult } from './pin-lock-context';
import { useAuth } from './use-auth';

const IDLE_TIMEOUT_MS = 5 * 60_000;

export function PinLockProvider() {
  const { status, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  // Read the PIN record from localStorage, and keep the state in sync with
  // other tabs. This is an external-store read, not derived render state.
  useEffect(() => {
    if (!profile) {
      setHasPin(false);
      setUnlocked(false);
      return;
    }

    const pinKey = pinStorageKey(profile.id);

    const apply = (resetUnlocked: boolean) => {
      const exists = getPinRecord(profile.id) !== null;
      setHasPin(exists);

      if (!exists || resetUnlocked) {
        setUnlocked(false);
      }
    };

    const sync = () => apply(false);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === pinKey) {
        sync();
      }
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    apply(true);

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleVisible);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleVisible);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [profile?.id]);

  const lock = useCallback(() => {
    setUnlocked(false);
    navigate('/lock', { replace: true });
  }, [navigate]);

  useIdleLock(IDLE_TIMEOUT_MS, lock, status === 'signed-in' && unlocked);

  const setPin = useCallback(
    async (pin: string) => {
      if (!profile) {
        throw new Error('No staff profile');
      }

      // Another tab may have saved a PIN while this setup flow was open.
      if (getPinRecord(profile.id)) {
        setHasPin(true);
        setUnlocked(false);
        throw new PinExistsError();
      }

      await savePin(profile.id, pin);
      setHasPin(true);
      setUnlocked(true);
    },
    [profile],
  );

  const unlock = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      if (!profile) {
        return { ok: false, attemptsLeft: 0, lockedOut: true };
      }

      const record = getPinRecord(profile.id);

      if (!record) {
        setHasPin(false);
        setUnlocked(false);
        await signOut();
        toast.error('Your PIN is missing from this device. Sign in with your password.');
        return { ok: false, attemptsLeft: 0, lockedOut: true };
      }

      if (await verifyPin(pin, record)) {
        resetAttempts(profile.id);
        setUnlocked(true);
        return { ok: true };
      }

      const attempts = recordFailedAttempt(profile.id);

      if (attempts >= 5) {
        clearPin(profile.id);
        setHasPin(false);
        setUnlocked(false);
        await signOut();
        toast.error('Too many attempts. Sign in with your password.');
        return { ok: false, attemptsLeft: 0, lockedOut: true };
      }

      return { ok: false, attemptsLeft: 5 - attempts, lockedOut: false };
    },
    [profile, signOut],
  );

  const clearPinAndSignOut = useCallback(async () => {
    if (profile) {
      clearPin(profile.id);
    }

    setHasPin(false);
    setUnlocked(false);
    await signOut();
    navigate('/login', { replace: true });
  }, [navigate, profile, signOut]);

  const value = useMemo<PinLockContextValue>(
    () => ({
      unlocked,
      hasPin,
      lock,
      setPin,
      unlock,
      clearPinAndSignOut,
    }),
    [clearPinAndSignOut, hasPin, lock, setPin, unlock, unlocked],
  );

  return (
    <PinLockContext.Provider value={value}>
      <Outlet />
    </PinLockContext.Provider>
  );
}
