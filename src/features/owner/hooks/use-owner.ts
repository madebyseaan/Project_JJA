import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  closeDay,
  getDailySummary,
  getReceiptIntegrity,
  getShopSettings,
  listAuditEvents,
  listSales,
  updateShopSettings,
} from '../api';
import type { ShopSettings } from '../types';

export function useDailySummary(businessDate: string) {
  return useQuery({
    queryKey: ['owner', 'summary', businessDate],
    queryFn: () => getDailySummary(businessDate),
  });
}

export function useSales(businessDate: string) {
  return useQuery({
    queryKey: ['owner', 'sales', businessDate],
    queryFn: () => listSales(businessDate),
  });
}

export function useAuditEvents() {
  return useQuery({
    queryKey: ['owner', 'audit'],
    queryFn: () => listAuditEvents(100),
  });
}

export function useReceiptIntegrity() {
  return useQuery({
    queryKey: ['owner', 'integrity'],
    queryFn: getReceiptIntegrity,
  });
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['owner', 'settings'],
    queryFn: getShopSettings,
  });
}

export function useCloseDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      businessDate: string;
      countedCashCentavos: number;
      notes: string | null;
    }) => closeDay(input.businessDate, input.countedCashCentavos, input.notes),
    onSuccess: (_close, input) => {
      void queryClient.invalidateQueries({ queryKey: ['owner', 'summary', input.businessDate] });
      void queryClient.invalidateQueries({ queryKey: ['owner', 'audit'] });
    },
  });
}

export function useUpdateShopSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ShopSettings) => updateShopSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['owner', 'audit'] });
    },
  });
}
