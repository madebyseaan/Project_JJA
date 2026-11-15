import { useEffect } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'scroll'] as const;

export function useIdleLock(timeoutMs: number, onLock: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const reset = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(onLock, timeoutMs);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    reset();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [timeoutMs, onLock, enabled]);
}
