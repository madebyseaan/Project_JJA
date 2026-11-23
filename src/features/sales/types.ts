export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  basePriceCentavos: number;
  itemType: string;
  incomeAccount: string;
  cogsAccount: string;
  assetAccount: string;
  preferredVendor: string;
  isActive: boolean;
};

export type SalesOrder = {
  id: string;
  orderNo: string;
  businessDate: string;
  paidOn: string | null;
  customerName: string | null;
  bikeModel: string | null;
  mainUserId: string;
  mainUserName: string | null;
  helperUserId: string | null;
  helperUserName: string | null;
  partsTotalCentavos: number;
  laborTotalCentavos: number;
  totalCentavos: number;
  status: 'OPEN' | 'PAID' | 'EXPORTED';
  createdAt: string;
  publicToken: string;
};

export type SalesOrderItem = {
  id: string;
  catalogItemId: string | null;
  itemName: string;
  qty: number;
  unitPriceCentavos: number;
  lineTotalCentavos: number;
  isCustom: boolean;
};

export type SalesLabor = {
  id: string;
  userId: string;
  userName: string | null;
  amountCentavos: number;
  isMain: boolean;
};

export type SalesExtra = {
  id: string;
  userId: string;
  userName: string | null;
  amountCentavos: number;
  note: string | null;
};

export type SalesPayment = {
  id: string;
  method: 'CASH' | 'GCASH';
  amountCentavos: number;
  gcashRecipientId: string | null;
  gcashRecipientName: string | null;
  receivedAt: string;
};

export type SalesChange = {
  id: string;
  method: 'CASH' | 'GCASH';
  amountCentavos: number;
  gcashRecipientId: string | null;
  gcashRecipientName: string | null;
};

export type OrderDetail = {
  order: SalesOrder;
  items: SalesOrderItem[];
  labor: SalesLabor[];
  extras: SalesExtra[];
  payments: SalesPayment[];
  changes: SalesChange[];
};

export type OrderItemInput = {
  catalogItemId: string | null;
  itemName: string;
  qty: number;
  unitPriceCentavos: number;
  isCustom: boolean;
};

export type OrderExtraInput = {
  userId: string;
  amountCentavos: number;
  note: string | null;
};

export type OrderPaymentInput = {
  method: 'CASH' | 'GCASH';
  amountCentavos: number;
  gcashRecipientId: string | null;
};

export type OrderChangeInput = {
  method: 'CASH' | 'GCASH';
  amountCentavos: number;
  gcashRecipientId: string | null;
};

export type DraftOrderItem = {
  key: string;
  catalogItemId: string | null;
  name: string;
  qty: string;
  price: string;
  isCustom: boolean;
};

export type DraftOrderExtra = {
  key: string;
  userId: string;
  amount: string;
  note: string;
};

export type DraftOrderPayment = {
  key: string;
  method: 'CASH' | 'GCASH';
  amount: string;
  gcashRecipientId: string;
};

export type DraftOrderChange = {
  key: string;
  method: 'CASH' | 'GCASH';
  amount: string;
  gcashRecipientId: string;
};

export type QuickSalePaymentValue = {
  payNow: boolean;
  method: 'CASH' | 'GCASH';
  amount: string;
  amountTouched: boolean;
  gcashRecipientId: string;
};

export type PaymentRecordedState = {
  order: SalesOrder;
  paidCentavos: number;
  changeCentavos: number;
  mode: 'recorded' | 'updated';
};

export type OrderInput = {
  orderId: string | null;
  businessDate: string;
  paidOn: string | null;
  customerName: string | null;
  bikeModel: string | null;
  mainUserId: string;
  helperUserId: string | null;
  items: OrderItemInput[];
  laborTotalCentavos: number;
  helperLaborCentavos: number;
  extras: OrderExtraInput[];
  payments: OrderPaymentInput[];
  changes: OrderChangeInput[];
};

export type DailyReport = {
  paidOn: string;
  orderCount: number;
  partsTotalCentavos: number;
  laborTotalCentavos: number;
  totalCentavos: number;
  extrasTotalCentavos: number;
};

export type LaborReport = {
  paidOn: string;
  userId: string;
  displayName: string;
  baseLaborCentavos: number;
  extrasCentavos: number;
  laborPayoutCentavos: number;
};

export type PaymentsReport = {
  paidOn: string;
  method: 'CASH' | 'GCASH';
  receivedCentavos: number;
  changeCentavos: number;
  netCentavos: number;
};

export type GcashBalance = {
  userId: string;
  displayName: string;
  shopShareCentavos: number;
  shopTransfersCentavos: number;
  shopHeldCentavos: number;
  laborShareCentavos: number;
  laborTransfersCentavos: number;
  laborHeldCentavos: number;
  laborEarnedCentavos: number;
};

export type GcashTransfer = {
  id: string;
  userId: string;
  userName: string | null;
  amountCentavos: number;
  destination: 'SHOP_BANK' | 'USER';
  counterpartyUserId: string | null;
  counterpartyName: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

export type StaffProfile = {
  id: string;
  displayName: string;
  employeeId: string;
};

export type ShopSettingsSummary = {
  shopName: string;
  address: string;
  contact: string;
  receiptFooter: string;
};

export type PublicSalesReceipt = {
  shop: {
    name: string;
    address: string;
    contact: string;
    footer: string;
  };
  orderNo: string;
  businessDate: string;
  paidOn: string;
  status: 'PAID' | 'EXPORTED';
  customerName: string | null;
  bikeModel: string | null;
  items: {
    name: string;
    qty: number;
    unitPriceCentavos: number;
    lineTotalCentavos: number;
  }[];
  laborTotalCentavos: number;
  totalCentavos: number;
  extrasTotalCentavos: number;
  payments: {
    method: 'CASH' | 'GCASH';
    amountCentavos: number;
  }[];
  changes: {
    method: 'CASH' | 'GCASH';
    amountCentavos: number;
  }[];
};
