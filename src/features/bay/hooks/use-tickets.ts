import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabaseClient } from '@/lib/supabase';

import {
  addTicketItem,
  addTicketLabor,
  createTicket,
  getTicket,
  listOpenTickets,
  removeTicketItem,
  removeTicketLabor,
  setTicketItemQty,
  updateTicketStatus,
  verifyAllTicketItems,
  verifyTicketItem,
} from '../api';
import type { CreateTicketInput, TicketStatus } from '../types';

export const ticketsQueryKey = ['tickets'] as const;
export const ticketQueryKey = (ticketId: string) => ['ticket', ticketId] as const;

export function useTickets() {
  return useQuery({
    queryKey: ticketsQueryKey,
    queryFn: listOpenTickets,
    refetchInterval: 60_000,
  });
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ticketQueryKey(ticketId ?? ''),
    queryFn: () => getTicket(ticketId as string),
    enabled: Boolean(ticketId),
  });
}

function useInvalidateTickets() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    void queryClient.invalidateQueries({ queryKey: ['ticket'] });
  };
}

export function useCreateTicket() {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: invalidate,
  });
}

export function useAddTicketItem(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: ({ partId, qty }: { partId: string; qty: number }) =>
      addTicketItem(ticketId, partId, qty),
    onSuccess: invalidate,
  });
}

export function useSetTicketItemQty(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: ({ partId, qty }: { partId: string; qty: number }) =>
      setTicketItemQty(ticketId, partId, qty),
    onSuccess: invalidate,
  });
}

export function useRemoveTicketItem(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: (partId: string) => removeTicketItem(ticketId, partId),
    onSuccess: invalidate,
  });
}

export function useAddTicketLabor(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: ({
      description,
      amountCentavos,
    }: {
      description: string;
      amountCentavos: number;
    }) => addTicketLabor(ticketId, description, amountCentavos),
    onSuccess: invalidate,
  });
}

export function useRemoveTicketLabor() {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: (laborId: string) => removeTicketLabor(laborId),
    onSuccess: invalidate,
  });
}

export function useVerifyTicketItem(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: (partId: string) => verifyTicketItem(ticketId, partId),
    onSuccess: invalidate,
  });
}

export function useVerifyAllTicketItems(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: () => verifyAllTicketItems(ticketId),
    onSuccess: invalidate,
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const invalidate = useInvalidateTickets();

  return useMutation({
    mutationFn: (status: TicketStatus) => updateTicketStatus(ticketId, status),
    onSuccess: invalidate,
  });
}

/** Invalidate the bay cache whenever any ticket, item, or labor row changes. */
export function useTicketRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = (() => {
      try {
        return getSupabaseClient();
      } catch {
        return null;
      }
    })();

    if (!client) return;

    const channel = client
      .channel(`bay-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
        void queryClient.invalidateQueries({ queryKey: ['ticket'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_items' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['ticket'] });
        void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_labor' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['ticket'] });
        void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient]);
}
