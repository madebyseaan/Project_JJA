import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adjustStock, createPart, listParts, listStockMovements, updatePart } from '../api';
import type { PartCreateInput, PartUpdateInput, StockAdjustmentInput } from '../types';

export const partsQueryKey = ['parts'] as const;

export function useParts() {
  return useQuery({
    queryKey: partsQueryKey,
    queryFn: listParts,
  });
}

export function useStockMovements(partId: string | null) {
  return useQuery({
    queryKey: ['parts', partId, 'movements'],
    queryFn: () => listStockMovements(partId as string),
    enabled: Boolean(partId),
  });
}

export function useCreatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PartCreateInput) => createPart(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: partsQueryKey });
    },
  });
}

export function useUpdatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ partId, input }: { partId: string; input: PartUpdateInput }) =>
      updatePart(partId, input),
    onSuccess: (_part, variables) => {
      void queryClient.invalidateQueries({ queryKey: partsQueryKey });
      void queryClient.invalidateQueries({
        queryKey: ['parts', variables.partId, 'movements'],
      });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ partId, input }: { partId: string; input: StockAdjustmentInput }) =>
      adjustStock(partId, input),
    onSuccess: (_part, variables) => {
      void queryClient.invalidateQueries({ queryKey: partsQueryKey });
      void queryClient.invalidateQueries({
        queryKey: ['parts', variables.partId, 'movements'],
      });
    },
  });
}
