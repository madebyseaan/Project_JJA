import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/use-auth';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatManilaDateTime } from '@/lib/dates';
import { formatCentavos, sumCentavos } from '@/lib/money';

import { AddLaborDialog } from './components/AddLaborDialog';
import { AddPartSheet } from './components/AddPartSheet';
import { TicketLaborCard } from './components/TicketLaborCard';
import { TicketPartsCard } from './components/TicketPartsCard';
import { TicketPaymentsCard } from './components/TicketPaymentsCard';
import { TicketStatusActions } from './components/TicketStatusActions';
import { useTicket, useTicketRealtime } from './hooks/use-tickets';
import { ticketTypeLabel } from './schemas';
import type { TicketDetail } from './types';

const OPEN_STATUSES = new Set(['PENDING', 'VERIFYING', 'IN_PROGRESS', 'READY']);

function DetailSkeleton() {
  return (
    <output className="block space-y-4" aria-label="Loading ticket">
      <Skeleton className="block h-10 w-64" />
      <Skeleton className="block h-32 w-full" />
      <Skeleton className="block h-64 w-full" />
    </output>
  );
}

function TicketWorkspace({
  ticketId,
  detail,
  isOnline,
}: {
  ticketId: string;
  detail: TicketDetail;
  isOnline: boolean;
}) {
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [addLaborOpen, setAddLaborOpen] = useState(false);
  const auth = useAuth();
  const { ticket, items, labor, payments, receipt } = detail;
  const editable = OPEN_STATUSES.has(ticket.status);
  const verifiedCount = items.filter((item) => item.verifiedAt !== null).length;
  const unverifiedCount = items.length - verifiedCount;
  const paid = sumCentavos(payments.map((payment) => payment.amountCentavos));
  const balance = ticket.totalCentavos - paid;
  const isOwner = auth.status === 'signed-in' && auth.profile.role === 'owner';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-semibold">{ticket.ticketNo}</p>
          <StatusBadge status={ticket.status} />
          <span className="text-steel text-xs">{ticketTypeLabel(ticket.type)}</span>
        </div>
        {editable ? (
          <TicketStatusActions ticketId={ticketId} status={ticket.status} isOnline={isOnline} />
        ) : null}
      </div>

      <div className="border-line bg-surface grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-steel text-xs">Customer</p>
          <p className="font-medium">{ticket.customerName || 'Walk-in'}</p>
        </div>
        <div>
          <p className="text-steel text-xs">Bike</p>
          <p className="font-medium">{ticket.bikeModel || '—'}</p>
        </div>
        <div>
          <p className="text-steel text-xs">Opened</p>
          <p className="font-medium">{formatManilaDateTime(ticket.createdAt)}</p>
        </div>
        {ticket.notes ? (
          <div className="sm:col-span-3">
            <p className="text-steel text-xs">Notes</p>
            <p className="text-ink-soft whitespace-pre-wrap">{ticket.notes}</p>
          </div>
        ) : null}
      </div>

      {!editable ? (
        <p
          className={
            ticket.status === 'COMPLETED'
              ? 'border-ink/20 bg-ink/5 rounded-md border p-3 text-sm'
              : 'border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm'
          }
        >
          {ticket.status === 'COMPLETED'
            ? 'This ticket is completed and cannot be edited.'
            : `This ticket is ${ticket.status.toLowerCase()} and read-only.`}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <TicketPartsCard
            ticketId={ticketId}
            items={items}
            editable={editable}
            isOnline={isOnline}
            onAddPart={() => setAddPartOpen(true)}
          />
          <TicketLaborCard
            labor={labor}
            editable={editable}
            isOnline={isOnline}
            onAddLabor={() => setAddLaborOpen(true)}
          />
          <TicketPaymentsCard
            ticket={ticket}
            payments={payments}
            receipt={receipt}
            editable={editable}
            isOnline={isOnline}
            isOwner={isOwner}
            unverifiedCount={unverifiedCount}
          />
        </div>

        <aside className="border-line bg-surface hidden rounded-lg border p-4 lg:block lg:self-start">
          <h2 className="font-display text-xl font-semibold">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Parts</dt>
              <dd className="font-mono tabular-nums">
                {formatCentavos(ticket.partsTotalCentavos)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Labor</dt>
              <dd className="font-mono tabular-nums">
                {formatCentavos(ticket.laborTotalCentavos)}
              </dd>
            </div>
            <div className="border-line flex justify-between gap-2 border-t pt-2">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-xl font-bold tabular-nums">
                {formatCentavos(ticket.totalCentavos)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Verified</dt>
              <dd>
                {verifiedCount} of {items.length}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Paid</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(paid)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel">Balance</dt>
              <dd className="font-mono tabular-nums">{formatCentavos(balance)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="border-line bg-surface fixed inset-x-0 bottom-16 z-20 flex items-center justify-between gap-3 border-t p-3 md:hidden">
        <div>
          <p className="text-steel text-xs">Total</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatCentavos(ticket.totalCentavos)}
          </p>
        </div>
        <p className="text-steel text-xs">
          {verifiedCount} of {items.length} verified
        </p>
      </div>

      {addPartOpen ? (
        <AddPartSheet
          ticketId={ticketId}
          open={addPartOpen}
          isOnline={isOnline}
          onOpenChange={setAddPartOpen}
        />
      ) : null}

      {addLaborOpen ? (
        <AddLaborDialog
          ticketId={ticketId}
          open={addLaborOpen}
          isOnline={isOnline}
          onOpenChange={setAddLaborOpen}
        />
      ) : null}
    </>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const online = useOnlineStatus();
  const ticket = useTicket(id);

  useTicketRealtime();

  if (!id) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-danger">
          No ticket was selected.
        </p>
        <Button variant="outline" size="touch" render={<Link to="/bay" />}>
          <ArrowLeft aria-hidden="true" />
          Back to the bay
        </Button>
      </div>
    );
  }

  if (ticket.isPending) {
    return <DetailSkeleton />;
  }

  if (ticket.isError) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="touch" render={<Link to="/bay" />}>
          <ArrowLeft aria-hidden="true" />
          Back to the bay
        </Button>
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load this ticket.</p>
          <p className="text-ink-soft mt-1 text-sm">{ticket.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void ticket.refetch()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="touch" render={<Link to="/bay" />}>
          <ArrowLeft aria-hidden="true" />
          Bay
        </Button>
        {ticket.isFetching ? (
          <Loader2 className="text-steel size-4 animate-spin" aria-label="Refreshing ticket" />
        ) : null}
      </div>

      {!online ? (
        <output className="border-warn/30 bg-warn/10 text-warn block rounded-md border p-3 text-sm">
          You are offline. This ticket is read-only until the connection returns.
        </output>
      ) : null}

      <TicketWorkspace ticketId={id} detail={ticket.data} isOnline={online} />
    </div>
  );
}
