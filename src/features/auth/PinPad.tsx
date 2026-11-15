import { Delete } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'back'] as const;

type PinPadProps = {
  onComplete: (pin: string) => void;
  onInput?: () => void;
  disabled?: boolean;
  error?: string | null;
};

export function PinPad({ onComplete, onInput, disabled = false, error }: PinPadProps) {
  const [digits, setDigits] = useState('');

  const handleDigit = (digit: string) => {
    if (disabled) return;

    onInput?.();

    const next = `${digits}${digit}`.slice(0, 4);
    setDigits(next);

    if (next.length === 4) {
      onComplete(next);
      setDigits('');
    }
  };

  const handleBackspace = () => {
    if (disabled) return;
    onInput?.();
    setDigits((value) => value.slice(0, -1));
  };

  return (
    <div>
      <div
        className="mb-6 flex justify-center gap-3"
        aria-label={`${digits.length} of 4 digits entered`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'size-3 rounded-full border',
              index < digits.length ? 'border-ink bg-ink' : 'border-line bg-surface',
            )}
          />
        ))}
      </div>

      <fieldset className="grid grid-cols-3 gap-3 border-0 p-0">
        <legend className="sr-only">PIN keypad</legend>
        {KEYS.map((key, index) => {
          if (key === null) {
            return <div key={`blank-${index}`} />;
          }

          if (key === 'back') {
            return (
              <Button
                key="back"
                type="button"
                variant="ghost"
                className="h-16"
                onClick={handleBackspace}
                disabled={disabled}
                aria-label="Delete last digit"
              >
                <Delete className="size-5" aria-hidden="true" />
              </Button>
            );
          }

          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="font-display h-16 text-2xl"
              onClick={() => handleDigit(key)}
              disabled={disabled}
            >
              {key}
            </Button>
          );
        })}
      </fieldset>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-center text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
