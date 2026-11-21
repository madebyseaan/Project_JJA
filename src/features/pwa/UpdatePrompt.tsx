import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <output
      aria-live="polite"
      className="border-line bg-surface fixed inset-x-3 bottom-20 z-50 block rounded-lg border p-3 shadow-lg md:right-6 md:bottom-6 md:left-auto md:max-w-sm"
    >
      <div className="flex items-start gap-3">
        {offlineReady ? (
          <WifiOff className="text-steel mt-0.5 size-5 shrink-0" aria-hidden="true" />
        ) : (
          <RefreshCw className="text-safety mt-0.5 size-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {needRefresh ? 'A new version is ready' : 'Ready to work offline'}
          </p>
          <p className="text-ink-soft mt-1 text-sm">
            {needRefresh
              ? 'Update when the current form is finished. The app does not reload on its own.'
              : 'The app shell is stored on this device. Sales still need a connection.'}
          </p>
          <div className="mt-3 flex gap-2">
            {needRefresh ? (
              <Button size="touch" onClick={() => void updateServiceWorker(true)}>
                Update now
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="touch"
              onClick={() => {
                setNeedRefresh(false);
                setOfflineReady(false);
              }}
            >
              <X aria-hidden="true" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </output>
  );
}
