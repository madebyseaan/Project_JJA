import { Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Receipt link copied.');
  } catch {
    toast.error('Could not copy the link. Select it and copy manually.');
  }
}

export function ShareReceiptDialog({
  open,
  onOpenChange,
  orderNo,
  token,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNo: string;
  token: string;
}) {
  const url = `${window.location.origin}/s/${token}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${orderNo}`, url });
        return;
      } catch {
        // The user cancelled the share sheet; fall back to copying.
      }
    }

    await copyText(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display pr-8 text-2xl">Share receipt</DialogTitle>
          <DialogDescription className="text-pretty break-words">
            The customer can open this link or scan the QR code. It shows the order, items, labor
            total, total, and payment methods — never the internal labor split.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col items-center gap-3">
          <div className="border-line w-full max-w-[11rem] rounded-lg border p-3">
            <QRCodeSVG
              value={url}
              size={176}
              className="h-auto w-full"
              bgColor="#ffffff"
              fgColor="#12181a"
            />
          </div>
          <p className="text-steel w-full text-center font-mono text-xs leading-relaxed break-all">
            {url}
          </p>
        </div>

        <DialogFooter>
          <Button size="touch" className="w-full sm:w-auto" onClick={() => void share()}>
            <Share2 aria-hidden="true" />
            Share link
          </Button>
          <Button
            variant="outline"
            size="touch"
            className="w-full sm:w-auto"
            onClick={() => void copyText(url)}
          >
            <Copy aria-hidden="true" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
