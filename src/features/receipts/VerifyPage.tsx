import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { verifyReceipt } from './api';

export function VerifyPage() {
  const [receiptNo, setReceiptNo] = useState('');
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => verifyReceipt(receiptNo.trim(), code.trim()),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    verify.mutate();
  };

  const result = verify.data;

  return (
    <main className="bg-paper flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <p className="font-display text-3xl font-bold">Verify a receipt</p>
          <p className="text-ink-soft mt-2 text-sm">
            Enter the receipt number and the verification code printed on the receipt.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-line bg-surface mt-6 space-y-4 rounded-lg border p-5 sm:p-6"
        >
          <div>
            <Label htmlFor="verify-receipt-no">Receipt number</Label>
            <Input
              id="verify-receipt-no"
              placeholder="20261121-0001"
              value={receiptNo}
              onChange={(event) => setReceiptNo(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="verify-code">Verification code</Label>
            <Input
              id="verify-code"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              className="font-mono"
            />
          </div>

          <Button
            type="submit"
            size="touch"
            className="w-full"
            disabled={verify.isPending || receiptNo.trim() === '' || code.trim() === ''}
          >
            {verify.isPending ? 'Checking…' : 'Verify receipt'}
          </Button>

          {verify.isError ? (
            <p role="alert" className="text-danger text-sm">
              {verify.error.message}
            </p>
          ) : null}
        </form>

        {result ? (
          <output
            aria-live="polite"
            className={
              !result.valid
                ? 'border-line bg-surface mt-4 block rounded-lg border p-5'
                : result.status === 'VOID'
                  ? 'border-danger/40 bg-danger/10 mt-4 block rounded-lg border p-5'
                  : 'border-ok/40 bg-ok/10 mt-4 block rounded-lg border p-5'
            }
          >
            {!result.valid ? (
              <div className="flex items-start gap-3">
                <ShieldQuestion className="text-steel size-6 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">No match</p>
                  <p className="text-ink-soft mt-1 text-sm">
                    The receipt number and code do not match a live record. Check both values, or
                    ask the shop.
                  </p>
                </div>
              </div>
            ) : result.status === 'VOID' ? (
              <div className="flex items-start gap-3">
                <CircleAlert className="text-danger size-6 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-danger font-semibold">Void receipt</p>
                  <p className="text-ink-soft mt-1 text-sm">
                    This sale was voided. {result.voidReason ?? ''}
                  </p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Receipt</dt>
                      <dd className="font-mono">{result.receiptNo}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Original total</dt>
                      <dd className="font-mono tabular-nums">
                        {formatCentavos(result.totalCentavos)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Date</dt>
                      <dd>{formatManilaDateTime(result.issuedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <BadgeCheck className="text-ok size-6 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-ok font-semibold">Valid receipt</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Receipt</dt>
                      <dd className="font-mono">{result.receiptNo}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Date</dt>
                      <dd>{formatManilaDateTime(result.issuedAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Total</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatCentavos(result.totalCentavos)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-steel">Payment</dt>
                      <dd>{result.paymentMethod ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </output>
        ) : null}

        <p className="text-steel mt-6 text-center text-xs">
          This page only checks the shop&apos;s live record. It never shows customer details or the
          item list. A look-alike site is not the shop&apos;s system.
        </p>
        <p className="mt-3 text-center text-xs">
          <Link to="/login" className="text-blueprint underline underline-offset-4">
            Staff sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
