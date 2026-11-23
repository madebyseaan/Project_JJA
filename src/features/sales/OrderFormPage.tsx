import { ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/use-auth';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatManilaDate, manilaDateKey } from '@/lib/dates';
import { formatCentavos, formatPesoInput, parsePesoToCentavos } from '@/lib/money';

import { CustomerFields } from './components/CustomerFields';
import { ExtrasFields } from './components/ExtrasFields';
import { LaborFields } from './components/LaborFields';
import { OrderItemEditor } from './components/OrderItemEditor';
import { OrderPaymentEditor } from './components/OrderPaymentEditor';
import { OrderSummaryCard } from './components/OrderSummaryCard';
import { ShareReceiptDialog } from './components/ShareReceiptDialog';
import { useCatalog, useOrder, useSaveOrder, useStaff } from './hooks/use-sales';
import { calculateOrderMoney, mainLaborCentavos } from './order-math';
import { staffLabel } from './staff-label';
import type {
  DraftOrderChange,
  DraftOrderExtra,
  DraftOrderItem,
  DraftOrderPayment,
  OrderInput,
  SalesOrder,
} from './types';

function parseDraftItems(items: DraftOrderItem[]) {
  return items.map((item) => ({
    key: item.key,
    catalogItemId: item.catalogItemId,
    name: item.name.trim(),
    qty: Number(item.qty),
    price: parsePesoToCentavos(item.price),
    isCustom: item.isCustom,
  }));
}

function statusLabel(status: SalesOrder['status']): string {
  if (status === 'PAID') return 'Paid';
  if (status === 'EXPORTED') return 'Exported';
  return 'Unpaid';
}

export function OrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = isEdit && searchParams.get('tab') === 'payment' ? 'payment' : 'order';
  const auth = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const staff = useStaff();
  const existing = useOrder(id ?? null);
  const save = useSaveOrder();

  const currentUserId = auth.status === 'signed-in' ? auth.profile.id : null;

  const [date, setDate] = useState(manilaDateKey());
  const [customer, setCustomer] = useState('');
  const [bike, setBike] = useState('');
  const [mainUserId, setMainUserId] = useState(currentUserId ?? '');
  const [helperUserId, setHelperUserId] = useState('');
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [labor, setLabor] = useState('');
  const [helperLabor, setHelperLabor] = useState('');
  const [extras, setExtras] = useState<DraftOrderExtra[]>([]);
  const [payments, setPayments] = useState<DraftOrderPayment[]>([]);
  const [changes, setChanges] = useState<DraftOrderChange[]>([]);
  const [paymentDate, setPaymentDate] = useState(manilaDateKey());
  const [formError, setFormError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!existing.data) return;
    if (loadedIdRef.current === existing.data.order.id) return;
    loadedIdRef.current = existing.data.order.id;
    const detail = existing.data;
    setDate(detail.order.businessDate);
    setCustomer(detail.order.customerName ?? '');
    setBike(detail.order.bikeModel ?? '');
    setMainUserId(detail.order.mainUserId);
    setHelperUserId(detail.order.helperUserId ?? '');
    setItems(
      detail.items.map((item) => ({
        key: item.id,
        catalogItemId: item.catalogItemId,
        name: item.itemName,
        qty: String(item.qty),
        price: formatPesoInput(item.unitPriceCentavos),
        isCustom: item.isCustom,
      })),
    );
    setLabor(formatPesoInput(detail.order.laborTotalCentavos));
    setHelperLabor(
      detail.labor.some((row) => !row.isMain)
        ? formatPesoInput(detail.labor.find((row) => !row.isMain)?.amountCentavos ?? 0)
        : '',
    );
    setExtras(
      detail.extras.map((extra) => ({
        key: extra.id,
        userId: extra.userId,
        amount: formatPesoInput(extra.amountCentavos),
        note: extra.note ?? '',
      })),
    );
    setPayments(
      detail.payments.map((payment) => ({
        key: payment.id,
        method: payment.method,
        amount: formatPesoInput(payment.amountCentavos),
        gcashRecipientId: payment.gcashRecipientId ?? '',
      })),
    );
    setChanges(
      detail.changes.map((change) => ({
        key: change.id,
        method: change.method,
        amount: formatPesoInput(change.amountCentavos),
        gcashRecipientId: change.gcashRecipientId ?? '',
      })),
    );
    setPaymentDate(detail.order.paidOn ?? manilaDateKey());
  }, [existing.data]);

  if (isEdit && existing.isPending) {
    return <FullPageLoading />;
  }

  if (isEdit && existing.isError) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="touch" nativeButton={false} render={<Link to="/orders" />}>
          <ArrowLeft aria-hidden="true" />
          Orders
        </Button>
        <p role="alert" className="text-danger">
          Could not load this order: {existing.error.message}
        </p>
      </div>
    );
  }

  const parsedItems = parseDraftItems(items);
  const laborCentavos = parsePesoToCentavos(labor) ?? 0;
  const helperLaborCentavos = parsePesoToCentavos(helperLabor) ?? 0;
  const parsedExtras = extras.map((extra) => ({
    key: extra.key,
    userId: extra.userId,
    amount: parsePesoToCentavos(extra.amount) ?? 0,
    note: extra.note,
  }));
  const parsedPayments = payments.map((payment) => ({
    key: payment.key,
    method: payment.method,
    amount: parsePesoToCentavos(payment.amount) ?? 0,
    gcashRecipientId: payment.gcashRecipientId,
  }));
  const parsedChanges = changes.map((change) => ({
    key: change.key,
    method: change.method,
    amount: parsePesoToCentavos(change.amount) ?? 0,
    gcashRecipientId: change.gcashRecipientId,
  }));

  const hasPayment =
    parsedPayments.length > 0 || parsedChanges.length > 0 || parsedExtras.length > 0;
  const orderStatus = existing.data?.order.status ?? 'OPEN';
  const orderWasPaid = orderStatus === 'PAID' || orderStatus === 'EXPORTED';
  const isLocked = orderStatus === 'EXPORTED';

  const money = calculateOrderMoney({
    items: parsedItems.map((item) => ({
      qty: Number.isFinite(item.qty) ? item.qty : 0,
      unitPriceCentavos: item.price ?? 0,
    })),
    laborTotalCentavos: laborCentavos,
    extras: parsedExtras.map((extra) => ({ amountCentavos: extra.amount })),
    payments: parsedPayments.map((payment) => ({
      method: payment.method,
      amountCentavos: payment.amount,
    })),
    changes: parsedChanges.map((change) => ({
      method: change.method,
      amountCentavos: change.amount,
    })),
  });

  const mainLabor = mainLaborCentavos(laborCentavos, helperLaborCentavos);
  const staffOptions = staff.data ?? [];
  const mainUser = staffOptions.find((person) => person.id === mainUserId);

  const chooseMain = (userId: string) => {
    if (userId === mainUserId) return;

    if (helperUserId === userId) {
      setHelperUserId('');
      setHelperLabor('');
    }

    setExtras(extras.map((row) => (row.userId === mainUserId ? { ...row, userId } : row)));
    setMainUserId(userId);
  };

  const chooseHelper = (userId: string | null) => {
    if (userId === helperUserId) return;

    if (helperUserId) {
      setExtras(
        extras.map((row) =>
          row.userId === helperUserId ? { ...row, userId: userId ?? mainUserId } : row,
        ),
      );
    }

    setHelperUserId(userId ?? '');
    setHelperLabor('');
  };

  const validateJob = (): string | null => {
    if (!date) return 'Choose a job date.';
    if (date > manilaDateKey()) return 'The job date cannot be in the future.';
    if (!mainUserId) return 'The main worker is missing.';
    if (helperUserId && helperUserId === mainUserId) return 'The helper must be the other person.';

    if (items.length === 0 && laborCentavos <= 0) {
      return 'Add at least one item or labor.';
    }

    for (const item of parsedItems) {
      if (!item.name) return 'Every item needs a name.';
      if (!Number.isInteger(item.qty) || item.qty <= 0) return 'Every item needs a whole quantity.';
      if (item.price === null || item.price < 0) return 'Every item needs a valid price.';
    }

    if (labor.trim() !== '' && parsePesoToCentavos(labor) === null) {
      return 'Enter a valid labor amount.';
    }
    if (helperUserId && helperLabor.trim() !== '' && parsePesoToCentavos(helperLabor) === null) {
      return 'Enter a valid helper labor amount.';
    }
    if (helperLaborCentavos > laborCentavos) {
      return 'The helper’s share cannot exceed the total labor.';
    }

    return null;
  };

  const validatePayment = (): string | null => {
    const jobError = validateJob();
    if (jobError) return jobError;

    if (!paymentDate) return 'Choose the payment date.';
    if (paymentDate > manilaDateKey()) return 'The payment date cannot be in the future.';
    if (paymentDate < date) return 'The payment date cannot be before the job date.';

    if (parsedPayments.length === 0) {
      return 'Add at least one payment.';
    }

    for (const extra of parsedExtras) {
      if (!extra.userId) return 'Choose who receives each extra.';
      if (extra.amount <= 0) return 'Every extra needs an amount greater than zero.';
    }

    for (const payment of parsedPayments) {
      if (payment.amount <= 0) return 'Every payment needs an amount greater than zero.';
      if (payment.method === 'CASH' && payment.gcashRecipientId) {
        return 'Cash payments cannot have a GCash recipient.';
      }
      if (payment.method === 'GCASH' && !payment.gcashRecipientId) {
        return 'Choose who received each GCash payment.';
      }
    }

    for (const change of parsedChanges) {
      if (change.amount <= 0) return 'Every change line needs an amount greater than zero.';
      if (change.method === 'CASH' && change.gcashRecipientId) {
        return 'Cash change cannot have a GCash recipient.';
      }
      if (change.method === 'GCASH' && !change.gcashRecipientId) {
        return 'Choose who returned each GCash change.';
      }
    }

    const gcashPaymentsByRecipient = new Map<string, number>();
    for (const payment of parsedPayments) {
      if (payment.method !== 'GCASH' || !payment.gcashRecipientId) continue;
      gcashPaymentsByRecipient.set(
        payment.gcashRecipientId,
        (gcashPaymentsByRecipient.get(payment.gcashRecipientId) ?? 0) + payment.amount,
      );
    }

    const gcashChangesByRecipient = new Map<string, number>();
    for (const change of parsedChanges) {
      if (change.method !== 'GCASH' || !change.gcashRecipientId) continue;
      gcashChangesByRecipient.set(
        change.gcashRecipientId,
        (gcashChangesByRecipient.get(change.gcashRecipientId) ?? 0) + change.amount,
      );
    }

    for (const [recipientId, changeAmount] of gcashChangesByRecipient) {
      const received = gcashPaymentsByRecipient.get(recipientId) ?? 0;

      if (received === 0) {
        return 'GCash change must come from someone who received a GCash payment.';
      }

      if (changeAmount > received) {
        return 'GCash change cannot be more than that person received.';
      }
    }

    if (money.netCashCentavos < 0 || money.netGcashCentavos < 0) {
      return 'Change cannot be more than the payment for that method.';
    }

    if (money.balanceCentavos !== 0) {
      return `Payment is not balanced. Difference: ${formatCentavos(money.balanceCentavos)}.`;
    }

    return null;
  };

  const buildInput = (): OrderInput => ({
    orderId: id ?? null,
    businessDate: date,
    paidOn: hasPayment ? paymentDate : null,
    customerName: customer.trim() || null,
    bikeModel: bike.trim() || null,
    mainUserId,
    helperUserId: helperUserId || null,
    items: parsedItems.map((item) => ({
      catalogItemId: item.catalogItemId,
      itemName: item.name,
      qty: item.qty,
      unitPriceCentavos: item.price ?? 0,
      isCustom: item.isCustom,
    })),
    laborTotalCentavos: laborCentavos,
    helperLaborCentavos,
    extras: parsedExtras.map((extra) => ({
      userId: extra.userId,
      amountCentavos: extra.amount,
      note: extra.note || null,
    })),
    payments: parsedPayments.map((payment) => ({
      method: payment.method,
      amountCentavos: payment.amount,
      gcashRecipientId: payment.gcashRecipientId || null,
    })),
    changes: parsedChanges.map((change) => ({
      method: change.method,
      amountCentavos: change.amount,
      gcashRecipientId: change.gcashRecipientId || null,
    })),
  });

  const needsPaymentValidation = tab === 'payment' || hasPayment || orderWasPaid;

  const submit = async () => {
    if (isLocked) {
      setFormError('This month has been exported. The order is read-only.');
      return;
    }

    const error = needsPaymentValidation ? validatePayment() : validateJob();
    setFormError(error);

    if (error) return;

    try {
      await save.mutateAsync(buildInput());

      if (!isEdit) {
        toast.success('Job saved. Take payment when the work is done.');
        navigate('/orders');
        return;
      }

      toast.success(tab === 'payment' ? 'Payment saved.' : 'Order saved.');
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Could not save the order.');
    }
  };

  const setTab = (next: 'order' | 'payment') => {
    setSearchParams(next === 'payment' ? { tab: 'payment' } : {}, { replace: true });
  };

  const summaryMode = tab === 'payment' ? 'payment' : 'job';
  const primaryLabel = isLocked
    ? 'Read-only'
    : tab === 'payment'
      ? orderWasPaid
        ? 'Update payment'
        : 'Record payment'
      : 'Save order';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Button variant="ghost" size="touch" nativeButton={false} render={<Link to="/orders" />}>
            <ArrowLeft aria-hidden="true" />
            Orders
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {isEdit ? 'Order' : 'New order'}
            </h1>
            {isEdit ? (
              <span className="border-line text-steel rounded-sm border px-2 py-1 text-xs font-semibold">
                {statusLabel(orderStatus)}
              </span>
            ) : null}
          </div>
          <p className="text-ink-soft mt-1 text-sm">
            {isEdit && existing.data ? (
              <>
                <span className="font-mono font-semibold">{existing.data.order.orderNo}</span>
                {' · '}
              </>
            ) : null}
            {formatManilaDate(`${date}T12:00:00+08:00`)}
          </p>
          {!isEdit ? (
            <p className="text-steel mt-1 text-sm">
              Record the job now. Payment is recorded after the repair.
            </p>
          ) : null}
        </div>

        {isEdit && existing.data && orderStatus !== 'OPEN' ? (
          <Button variant="outline" size="touch" onClick={() => setShareOpen(true)}>
            <Share2 aria-hidden="true" />
            Share receipt
          </Button>
        ) : null}
      </div>

      {isEdit ? (
        <div className="flex gap-2" role="tablist" aria-label="Order steps">
          <Button
            type="button"
            role="tab"
            aria-selected={tab === 'order'}
            variant={tab === 'order' ? 'default' : 'outline'}
            size="touch"
            onClick={() => setTab('order')}
          >
            Order
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={tab === 'payment'}
            variant={tab === 'payment' ? 'default' : 'outline'}
            size="touch"
            onClick={() => setTab('payment')}
          >
            Payment
            <span className="text-xs font-normal">{orderWasPaid ? 'Paid' : 'Unpaid'}</span>
          </Button>
        </div>
      ) : null}

      {isLocked ? (
        <p className="border-warn/40 bg-warn/10 text-warn rounded-md border p-3 text-sm">
          This month has been exported. The order is read-only; corrections happen in QuickBooks.
        </p>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="order-2 space-y-5 lg:order-1">
          {tab === 'order' ? (
            <>
              <CustomerFields
                date={date}
                customer={customer}
                bike={bike}
                isEdit={isEdit}
                onDateChange={setDate}
                onCustomerChange={setCustomer}
                onBikeChange={setBike}
              />

              <OrderItemEditor
                items={items}
                catalog={catalog.data ?? []}
                onChange={(next) => setItems(next)}
              />

              <LaborFields
                staff={staffOptions}
                mainUserId={mainUserId}
                helperUserId={helperUserId}
                currentUserId={currentUserId}
                labor={labor}
                helperLabor={helperLabor}
                mainLaborCentavos={mainLabor}
                onLaborChange={setLabor}
                onHelperLaborChange={setHelperLabor}
                onChooseMain={chooseMain}
                onChooseHelper={chooseHelper}
              />
            </>
          ) : (
            <>
              <section className="border-line bg-surface rounded-lg border p-4">
                <h2 className="font-display text-xl font-semibold">Payment date</h2>
                <div className="mt-3 max-w-xs">
                  <Label htmlFor="payment-date">Paid on</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    min={date}
                    max={manilaDateKey()}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </div>
                <p className="text-steel mt-2 text-xs">
                  This is the date used in sales and GCash reports.
                </p>
              </section>

              <ExtrasFields
                extras={extras}
                staff={staffOptions}
                mainUserId={mainUserId}
                helperUserId={helperUserId}
                currentUserId={currentUserId}
                onChange={setExtras}
              />

              <OrderPaymentEditor
                payments={payments}
                changes={changes}
                staff={staffOptions}
                defaultRecipientId={mainUserId}
                currentUserId={currentUserId}
                onPaymentsChange={setPayments}
                onChangesChange={setChanges}
              />
            </>
          )}

          {!online ? (
            <output className="text-warn block text-sm">
              You are offline. Saving is disabled until the connection returns.
            </output>
          ) : null}

          <div className="flex gap-2 lg:hidden">
            <Button
              size="touch"
              className="flex-1"
              disabled={!online || save.isPending || isLocked}
              onClick={() => void submit()}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {primaryLabel}
            </Button>
            <Button
              variant="outline"
              size="touch"
              nativeButton={false}
              render={<Link to="/orders" />}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div className="order-1 space-y-3 lg:sticky lg:top-6 lg:order-2">
          <OrderSummaryCard
            mode={summaryMode}
            partsCentavos={money.partsCentavos}
            laborCentavos={laborCentavos}
            extrasCentavos={money.extrasCentavos}
            paidCentavos={money.paidCentavos}
            changeCentavos={money.changeCentavos}
            balanceCentavos={money.balanceCentavos}
            note={
              tab === 'order'
                ? orderWasPaid
                  ? 'This order is paid. If you change items or labor, rebalance the payment before saving.'
                  : 'Payment is recorded after the repair.'
                : 'Payment date is the date used in reports.'
            }
            primaryAction={
              <Button
                size="touch"
                className="w-full"
                disabled={!online || save.isPending || isLocked}
                onClick={() => void submit()}
              >
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {primaryLabel}
              </Button>
            }
            secondaryAction={
              tab === 'payment' && !orderWasPaid ? (
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  className="w-full"
                  onClick={() => setTab('order')}
                >
                  Add items or labor
                </Button>
              ) : null
            }
          />
          {tab === 'order' && mainUser ? (
            <p className="text-steel text-xs">
              Main worker: <strong>{staffLabel(mainUser, currentUserId)}</strong>
            </p>
          ) : null}
        </div>
      </div>

      {isEdit && existing.data ? (
        <ShareReceiptDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          orderNo={existing.data.order.orderNo}
          token={existing.data.order.publicToken}
        />
      ) : null}
    </div>
  );
}
