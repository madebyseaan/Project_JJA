import { toAppError } from '@/lib/errors';
import { getSupabaseClient } from '@/lib/supabase';

import type { PublicReceipt, ReceiptSnapshot, VerificationResult } from './types';

type ReceiptPayload = {
  receipt_no: string;
  status: PublicReceipt['status'];
  issued_at: string;
  total_centavos: number;
  verification_code: string;
  void_reason: string | null;
  snapshot: ReceiptSnapshot;
};

type VerifyPayload = {
  valid: boolean;
  status: 'ISSUED' | 'VOID' | 'NO_MATCH';
  receipt_no?: string;
  issued_at?: string;
  total_centavos?: number;
  payment_method?: string | null;
  void_reason?: string | null;
};

export async function getPublicReceipt(token: string): Promise<PublicReceipt | null> {
  const { data, error } = await getSupabaseClient().rpc('get_receipt', { p_token: token });

  if (error) {
    throw toAppError(error);
  }

  if (!data) {
    return null;
  }

  const payload = data as ReceiptPayload;

  return {
    receiptNo: payload.receipt_no,
    status: payload.status,
    issuedAt: payload.issued_at,
    totalCentavos: payload.total_centavos,
    verificationCode: payload.verification_code,
    voidReason: payload.void_reason,
    snapshot: payload.snapshot,
  };
}

export async function verifyReceipt(receiptNo: string, code: string): Promise<VerificationResult> {
  const { data, error } = await getSupabaseClient().rpc('verify_receipt', {
    p_receipt_no: receiptNo,
    p_code: code,
  });

  if (error) {
    throw toAppError(error);
  }

  const payload = data as VerifyPayload;

  if (!payload.valid || payload.status === 'NO_MATCH') {
    return { valid: false, status: 'NO_MATCH' };
  }

  return {
    valid: true,
    status: payload.status,
    receiptNo: payload.receipt_no ?? receiptNo,
    issuedAt: payload.issued_at ?? '',
    totalCentavos: payload.total_centavos ?? 0,
    paymentMethod: payload.payment_method ?? null,
    voidReason: payload.void_reason ?? null,
  };
}
