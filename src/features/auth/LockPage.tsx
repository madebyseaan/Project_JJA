import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import { useManilaClock } from '@/hooks/use-manila-clock';

import { BrandPanel } from './BrandPanel';
import { MobileBrandHeader } from './MobileBrandHeader';
import { PinPad } from './PinPad';
import { useAuth } from './use-auth';
import { usePinLock } from './use-pin-lock';

type Stage = 'setup' | 'confirm' | 'unlock';

export function LockPage() {
  const { status, profile } = useAuth();
  const { unlocked, hasPin, setPin, unlock, clearPinAndSignOut } = usePinLock();
  const navigate = useNavigate();
  const manilaTime = useManilaClock();
  const [setupStage, setSetupStage] = useState<'setup' | 'confirm'>('setup');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stage: Stage = hasPin ? 'unlock' : setupStage;

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'signed-out' || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (unlocked) {
    return <Navigate to="/" replace />;
  }

  const handleSetup = (pin: string) => {
    setError(null);
    setFirstPin(pin);
    setSetupStage('confirm');
  };

  const handleConfirm = async (pin: string) => {
    if (!firstPin || pin !== firstPin) {
      setError('PINs do not match. Start again.');
      setFirstPin(null);
      setSetupStage('setup');
      return;
    }

    setBusy(true);

    try {
      await setPin(pin);
      navigate('/', { replace: true });
    } catch {
      setError('Could not save the PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (pin: string) => {
    setBusy(true);
    setError(null);

    const result = await unlock(pin);
    setBusy(false);

    if (result.ok) {
      navigate('/', { replace: true });
      return;
    }

    if (!result.lockedOut) {
      const label = result.attemptsLeft === 1 ? 'attempt' : 'attempts';
      setError(`Incorrect PIN. ${result.attemptsLeft} ${label} left.`);
    }
  };

  const handleComplete =
    stage === 'setup' ? handleSetup : stage === 'confirm' ? handleConfirm : handleUnlock;
  const title =
    stage === 'unlock' ? 'Welcome back' : stage === 'confirm' ? 'Confirm your PIN' : 'Set your PIN';
  const subtitle =
    stage === 'unlock'
      ? 'Enter your 4-digit PIN to continue.'
      : stage === 'confirm'
        ? 'Enter the same 4 digits again.'
        : 'Choose a 4-digit PIN for the start of your shift.';

  return (
    <main className="bg-paper min-h-screen md:grid md:grid-cols-[1.05fr_0.95fr]">
      <BrandPanel
        manilaTime={manilaTime}
        eyebrow="Shift lock"
        title={
          <>
            <span className="bg-safety text-ink inline-block px-2 py-0.5">Step away,</span>
            <br />
            the bay stays put.
          </>
        }
        description={
          <>
            Five minutes idle and the screen locks itself.{' '}
            <span className="xl:block">Your PIN brings it straight back.</span>
          </>
        }
      />

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:min-h-0 md:px-6 xl:px-12">
        <div className="w-full max-w-md xl:max-w-lg">
          <MobileBrandHeader manilaTime={manilaTime} />

          <div className="border-line bg-paper border p-5 md:p-6 xl:p-8">
            <div className="border-line flex items-center gap-3 border-b pb-5">
              <span className="border-line bg-soft text-safety flex size-10 items-center justify-center border">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{profile.displayName}</p>
                <p className="text-steel font-mono text-xs">{profile.employeeId}</p>
              </div>
            </div>

            <h1 className="font-display mt-6 text-4xl font-bold tracking-tight xl:text-5xl">
              {title}
            </h1>
            <p className="text-ink-soft mt-1 text-base">{subtitle}</p>

            <div className="mt-6">
              <PinPad
                onComplete={handleComplete}
                onInput={() => setError(null)}
                disabled={busy}
                error={error}
              />
            </div>

            {stage === 'confirm' ? (
              <div className="mt-4 text-center">
                <Button
                  type="button"
                  variant="link"
                  className="min-h-12 px-3 text-xs"
                  onClick={() => {
                    setSetupStage('setup');
                    setFirstPin(null);
                    setError(null);
                  }}
                >
                  Start over
                </Button>
              </div>
            ) : null}

            <div className="border-line mt-6 border-t pt-4 text-center">
              <Button
                type="button"
                variant="link"
                className="text-steel min-h-12 w-full px-3 text-xs"
                onClick={() => void clearPinAndSignOut()}
              >
                {stage === 'unlock'
                  ? 'Forgot PIN? Sign in with password.'
                  : 'Sign in as someone else'}
              </Button>
            </div>
          </div>

          <p className="text-steel mt-4 flex items-center justify-center gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>Locks after 5 minutes idle. The PIN stays on this device.</span>
          </p>
        </div>
      </section>
    </main>
  );
}
