import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getGcashBalances,
  getOrder,
  getPublicReceipt,
  getShopSettingsSummary,
  importCatalogItems,
  listCatalog,
  listDailyReport,
  listGcashTransfers,
  listLaborReport,
  listOpenOrders,
  listPaidOrders,
  listPaymentsReport,
  listStaff,
  recordGcashTransfer,
  saveOrder,
} from '../api';
import type { OrderInput } from '../types';
import type { CatalogImportItem } from '../catalog-csv';

export const catalogQueryKey = ['sales', 'catalog'] as const;
export const staffQueryKey = ['sales', 'staff'] as const;

export function useCatalog() {
  return useQuery({ queryKey: catalogQueryKey, queryFn: listCatalog });
}

export function useStaff() {
  return useQuery({ queryKey: staffQueryKey, queryFn: listStaff });
}

export function useOpenOrders() {
  return useQuery({
    queryKey: ['sales', 'orders', 'open'],
    queryFn: listOpenOrders,
  });
}

export function usePaidOrders(paidOn: string) {
  return useQuery({
    queryKey: ['sales', 'orders', 'paid', paidOn],
    queryFn: () => listPaidOrders(paidOn),
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['sales', 'order', orderId],
    queryFn: () => getOrder(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useDailyReport(from: string, to: string) {
  return useQuery({
    queryKey: ['sales', 'daily', from, to],
    queryFn: () => listDailyReport(from, to),
  });
}

export function useLaborReport(from: string, to: string) {
  return useQuery({
    queryKey: ['sales', 'labor', from, to],
    queryFn: () => listLaborReport(from, to),
  });
}

export function usePaymentsReport(from: string, to: string) {
  return useQuery({
    queryKey: ['sales', 'payments', from, to],
    queryFn: () => listPaymentsReport(from, to),
  });
}

export function useGcashBalances() {
  return useQuery({
    queryKey: ['sales', 'gcash'],
    queryFn: getGcashBalances,
  });
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['sales', 'shop-settings'],
    queryFn: getShopSettingsSummary,
  });
}

export function useGcashTransfers() {
  return useQuery({
    queryKey: ['sales', 'gcash', 'transfers'],
    queryFn: listGcashTransfers,
  });
}

function useInvalidateSales() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['sales'] });
  };
}

export function useSaveOrder() {
  const invalidate = useInvalidateSales();

  return useMutation({
    mutationFn: (input: OrderInput) => saveOrder(input),
    onSuccess: invalidate,
  });
}

export function useRecordGcashTransfer() {
  const invalidate = useInvalidateSales();

  return useMutation({
    mutationFn: recordGcashTransfer,
    onSuccess: invalidate,
  });
}

export function useImportCatalog() {
  const invalidate = useInvalidateSales();

  return useMutation({
    mutationFn: async (items: CatalogImportItem[]) => {
      const total = { inserted: 0, updated: 0, skipped: 0 };

      for (let index = 0; index < items.length; index += 200) {
        const batch = items.slice(index, index + 200);
        const result = await importCatalogItems(batch);
        total.inserted += result.inserted;
        total.updated += result.updated;
        total.skipped += result.skipped;
      }

      return total;
    },
    onSuccess: invalidate,
  });
}

export function usePublicReceipt(token: string | undefined) {
  return useQuery({
    queryKey: ['sales', 'receipt', token],
    queryFn: () => getPublicReceipt(token as string),
    enabled: Boolean(token),
    retry: 0,
  });
}
