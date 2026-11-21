export type ReceiptStatus = 'ISSUED' | 'VOID';

export type ReceiptSnapshot = {
  shop: {
    name: string;
    address: string;
    contact: string;
    footer: string;
  };
  ticket: {
    no: string;
    type: 'REPAIR' | 'SALE';
    customer_name: string;
    bike_model: string;
    created_at: string;
  };
  items: {
    name: string;
    qty: number;
    unit_price_centavos: number;
    line_total_centavos: number;
  }[];
  labor: {
    description: string;
    amount_centavos: number;
  }[];
  totals: {
    parts_centavos: number;
    labor_centavos: number;
    total_centavos: number;
  };
  payments: {
    method: 'CASH' | 'GCASH' | 'MAYA' | 'OTHER';
    amount_centavos: number;
    received_by: string;
  }[];
  receipt_no: string;
  issued_at: string;
};

export type PublicReceipt = {
  receiptNo: string;
  status: ReceiptStatus;
  issuedAt: string;
  totalCentavos: number;
  verificationCode: string;
  voidReason: string | null;
  snapshot: ReceiptSnapshot;
};

export type VerificationResult =
  | {
      valid: true;
      status: ReceiptStatus;
      receiptNo: string;
      issuedAt: string;
      totalCentavos: number;
      paymentMethod: string | null;
      voidReason: string | null;
    }
  | {
      valid: false;
      status: 'NO_MATCH';
    };
