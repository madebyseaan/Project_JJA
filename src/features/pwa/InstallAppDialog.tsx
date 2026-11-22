import { CheckCircle2, Download, MoreVertical, Share } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type InstallAppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPrompt: boolean;
  installed: boolean;
  isIos: boolean;
  isAndroid: boolean;
  onInstall: () => Promise<boolean>;
};

export function InstallAppDialog({
  open,
  onOpenChange,
  canPrompt,
  installed,
  isIos,
  isAndroid,
  onInstall,
}: InstallAppDialogProps) {
  const handleInstall = async () => {
    const accepted = await onInstall();
    if (accepted) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Install J.J.A</DialogTitle>
          <DialogDescription>
            Install the app on this phone or computer for one-tap access and an offline app shell.
            Sales still need a connection.
          </DialogDescription>
        </DialogHeader>

        {installed ? (
          <div className="border-ok/30 bg-ok/10 rounded-md border p-4">
            <p className="text-ok flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              Already installed
            </p>
            <p className="text-ink-soft mt-1 text-sm">
              Open J.J.A from your home screen or app list.
            </p>
          </div>
        ) : canPrompt ? (
          <div className="space-y-3">
            <p className="text-ink-soft text-sm">
              Tap Install and confirm. The app will appear on your home screen or app list.
            </p>
            <Button size="touch" className="w-full" onClick={() => void handleInstall()}>
              <Download aria-hidden="true" />
              Install app
            </Button>
          </div>
        ) : isIos ? (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                1
              </span>
              <span>
                Open this page in <strong>Safari</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                2
              </span>
              <span className="flex items-center gap-1">
                Tap the <Share className="size-4" aria-hidden="true" /> <strong>Share</strong>{' '}
                button.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                3
              </span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                1
              </span>
              <span className="flex items-center gap-1">
                Open the browser menu <MoreVertical className="size-4" aria-hidden="true" />.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                2
              </span>
              <span>
                Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="border-line bg-paper flex size-8 shrink-0 items-center justify-center rounded-md border font-semibold">
                3
              </span>
              <span>Confirm the install.</span>
            </li>
          </ol>
        )}

        <p className="border-line text-steel border-t pt-3 text-xs">
          {isAndroid || isIos ? 'Each phone sets its own 4-digit PIN. ' : ''}
          The PIN is stored on the device, not in the shop database.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" size="touch" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
