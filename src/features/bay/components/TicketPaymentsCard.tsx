import { Ban, CheckCircle2, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos, sumCentavos } from '@/lib/money';

import type { Receipt, Ticket, TicketPayment } from '../types';
import { CancelTicketDialog } from './CancelTicketDialog';
import { CompleteTicketDialog } from './CompleteTicketDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';

type TicketPaymentsCardProps = {
  ticket: Ticket;
  payments: TicketPayment[];
  receipt: Receipt | null;
  editable: boolean;
  isOnline: boolean;
  isOwner: boolean;
  unverifiedCount: number;
};

const METHOD_LABELS: Record<TicketPayment['method'], string> = {
  CASH: 'Cash',
  GCASH: 'GCash',
  MAYA: 'Maya',
  OTHER: 'Other',
};

export function TicketPaymentsCard({
  ticket,
  payments,
  receipt,
  editable,
  isOnline,
  isOwner,
  unverifiedCount,
}: TicketPaymentsCardProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const paid = sumCentavos(payments.map((payment) => payment.amountCentavos));
  const balance = ticket.totalCentavos - paid;

  return (
    <section className="border-line bg-surface rounded-lg border">
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Payments</h2>
          <p className="text-steel text-xs">
            Paid {formatCentavos(paid)} · Balance {formatCentavos(balance)}
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="touch"
              disabled={!isOnline || balance <= 0}
              onClick={() => setPaymentOpen(true)}
            >
              Record payment
            </Button>
            <Button
              size="touch"
              disabled={!isOnline || unverifiedCount > 0}
              onClick={() => setCompleteOpen(true)}
            >
              Complete ticket
            </Button>
          </div>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <p className="text-steel p-4 text-sm">No payments recorded yet.</p>
      ) : (
        <ul className="divide-line divide-y">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {METHOD_LABELS[payment.method]}
                  {payment.referenceNo ? ` · ${payment.referenceNo}` : ''}
                </p>
                <p className="text-steel text-xs">
                  {formatManilaDateTime(payment.receivedAt)}
                  {payment.receivedByName ? ` · ${payment.receivedByName}` : ''}
                </p>
                {payment.note ? <p className="text-ink-soft mt-1 text-sm">{payment.note}</p> : null}
              </div>
              <p
                className={
                  payment.amountCentavos < 0
                    ? 'text-danger font-mono font-semibold tabular-nums'
                    : 'font-mono font-semibold tabular-nums'
                }
              >
                {formatCentavos(payment.amountCentavos)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {editable && unverifiedCount > 0 ? (
        <p className="border-warn/30 bg-warn/10 text-warn m-4 mt-0 rounded-md border p-3 text-sm">
          Verify all {unverifiedCount} remaining part{unverifiedCount === 1 ? '' : 's'} before
          completing the ticket.
        </p>
      ) : null}

      {editable ? (
        <div className="border-line flex flex-wrap gap-2 border-t p-4">
          <Button
            variant="ghost"
            size="touch"
            className="text-danger"
            disabled={!isOnline || (paid > 0 && !isOwner)}
            onClick={() => setCancelOpen(true)}
          >
            <Ban aria-hidden="true" />
            Cancel ticket
          </Button>
        </div>
      ) : null}

      {receipt ? (
        <div className="border-line border-t p-4">
          {receipt.status === 'ISSUED' ? (
            <div className="text-ok flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Receipt {receipt.receiptNo} issued
            </div>
          ) : (
            <div className="text-danger flex items-center gap-2 text-sm font-medium">
              <Ban className="size-4" aria-hidden="true" />
              Receipt {receipt.receiptNo} is void
            </div>
          )}
          <p className="text-steel mt-1 font-mono text-xs">{receipt.verificationCode}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            nativeButton={false}
            render={<Link to={`/r/${receipt.publicToken}`} />}
          >
            <ReceiptText aria-hidden="true" />
            View e-receipt
          </Button>
        </div>
      ) : null}

      {paymentOpen ? (
        <RecordPaymentDialog
          ticketId={ticket.id}
          totalCentavos={ticket.totalCentavos}
          paidCentavos={paid}
          open={paymentOpen}
          isOnline={isOnline}
          onOpenChange={setPaymentOpen}
        />
      ) : null}

      {completeOpen ? (
        <CompleteTicketDialog
          ticketId={ticket.id}
          totalCentavos={ticket.totalCentavos}
          paidCentavos={paid}
          open={completeOpen}
          isOnline={isOnline}
          onOpenChange={setCompleteOpen}
        />
      ) : null}

      {cancelOpen ? (
        <CancelTicketDialog
          ticketId={ticket.id}
          hasPayments={paid !== 0}
          isOwner={isOwner}
          open={cancelOpen}
          isOnline={isOnline}
          onOpenChange={setCancelOpen}
        />
      ) : null}
    </section>
  );
}
