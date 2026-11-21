import { ChevronRight, Clock, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatManilaDateTime, isOlderThan } from '@/lib/dates';
import { formatCentavos } from '@/lib/money';

import { NewTicketSheet } from './components/NewTicketSheet';
import { useTicketRealtime, useTickets } from './hooks/use-tickets';
import { ticketTypeLabel } from './schemas';

function QueueSkeleton() {
  return (
    <output className="block space-y-2" aria-label="Loading bay queue">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="block h-24 w-full" />
      ))}
    </output>
  );
}

export function BayPage() {
  const online = useOnlineStatus();
  const tickets = useTickets();
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  useTicketRealtime();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (tickets.data ?? []).filter((ticket) => {
      if (!term) return true;
      return [ticket.ticketNo, ticket.customerName ?? '', ticket.bikeModel ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [search, tickets.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bay"
        description="Today's walk-in jobs and their status."
        actions={
          <Button size="touch" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden="true" />
            New ticket
          </Button>
        }
      />

      <div className="relative">
        <Search
          className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search ticket number, customer, or bike…"
          aria-label="Search tickets"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {!online ? (
        <output className="border-warn/30 bg-warn/10 text-warn block rounded-md border p-3 text-sm">
          You are offline. The queue is read-only until the connection returns.
        </output>
      ) : null}

      {tickets.isPending ? (
        <QueueSkeleton />
      ) : tickets.isError ? (
        <div role="alert" className="border-danger/30 bg-danger/10 rounded-lg border p-4">
          <p className="text-danger font-medium">Could not load the bay queue.</p>
          <p className="text-ink-soft mt-1 text-sm">{tickets.error.message}</p>
          <Button
            variant="outline"
            size="touch"
            className="mt-3"
            onClick={() => void tickets.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (tickets.data ?? []).length === 0 ? (
        <EmptyState
          title="No tickets in the bay"
          description="Start a new ticket for the next walk-in."
          action={
            <Button size="touch" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden="true" />
              New ticket
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No tickets match that search"
          description="Try a ticket number, customer, or bike model."
          action={
            <Button variant="outline" size="touch" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((ticket) => {
            const old = isOlderThan(ticket.createdAt, 48);

            return (
              <li key={ticket.id}>
                <Link
                  to={`/bay/ticket/${ticket.id}`}
                  className="border-line bg-surface hover:bg-soft focus-visible:ring-safety block rounded-lg border border-l-4 p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  style={{ borderLeftColor: 'var(--color-safety)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold">{ticket.ticketNo}</p>
                        <StatusBadge status={ticket.status} />
                        {old ? (
                          <span className="border-warn/40 bg-warn/10 text-warn inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium">
                            <Clock className="size-3" aria-hidden="true" />
                            Over 48h
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-medium">
                        {ticket.customerName || 'Walk-in'}
                        {ticket.bikeModel ? ` · ${ticket.bikeModel}` : ''}
                      </p>
                      <p className="text-steel mt-0.5 text-xs">
                        {ticketTypeLabel(ticket.type)} · {formatManilaDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-display text-xl font-bold tabular-nums">
                        {formatCentavos(ticket.totalCentavos)}
                      </span>
                      <ChevronRight className="text-steel size-5" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {newOpen ? (
        <NewTicketSheet open={newOpen} isOnline={online} onOpenChange={setNewOpen} />
      ) : null}
    </div>
  );
}
