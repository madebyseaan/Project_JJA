import { ArrowLeft, CheckCircle2, Loader2, Plus, Share2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/use-auth';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatManilaDate, manilaDateKey } from '@/lib/dates';
import { formatCentavos, formatPesoInput, parsePesoToCentavos } from '@/lib/money';
import { cn } from '@/lib/utils';

import { OrderItemEditor } from './components/OrderItemEditor';
import { OrderPaymentEditor } from './components/OrderPaymentEditor';
import { ShareReceiptDialog } from './components/ShareReceiptDialog';
import { useCatalog, useOrder, useSaveOrder, useStaff } from './hooks/use-sales';
import { calculateOrderMoney, mainLaborCentavos } from './order-math';
import type {
  DraftOrderChange,
  DraftOrderExtra,
  DraftOrderItem,
  DraftOrderPayment,
  OrderInput,
} from './types';

function newKey() {
  return crypto.randomUUID();
}

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

export function OrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const auth = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const staff = useStaff();
  const existing = useOrder(id ?? null);
  const save = useSaveOrder();

  const [date, setDate] = useState(manilaDateKey());
  const [customer, setCustomer] = useState('');
  const [bike, setBike] = useState('');
  const [mainUserId, setMainUserId] = useState(() =>
    auth.status === 'signed-in' ? auth.profile.id : '',
  );
  const [helperUserId, setHelperUserId] = useState('');
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [labor, setLabor] = useState('');
  const [helperLabor, setHelperLabor] = useState('');
  const [extras, setExtras] = useState<DraftOrderExtra[]>([]);
  const [payments, setPayments] = useState<DraftOrderPayment[]>([]);
  const [changes, setChanges] = useState<DraftOrderChange[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!existing.data || loadedRef.current) return;
    loadedRef.current = true;
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
  const helperOptions = staffOptions.filter((person) => person.id !== mainUserId);

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

  const validate = (): string | null => {
    if (!date) return 'Choose a date.';
    if (date > manilaDateKey()) return 'The date cannot be in the future.';
    if (!mainUserId) return 'The main user is missing.';
    if (helperUserId && helperUserId === mainUserId) return 'The helper must be the other user.';

    if (items.length === 0 && laborCentavos <= 0 && parsedExtras.length === 0) {
      return 'Add at least one item, labor, or extra.';
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
    if (helperLaborCentavos > laborCentavos)
      return 'The helper share cannot exceed the total labor.';

    for (const extra of parsedExtras) {
      if (!extra.userId) return 'Choose who receives each extra.';
      if (extra.amount <= 0) return 'Every extra needs an amount greater than zero.';
    }

    for (const payment of parsedPayments) {
      if (payment.amount <= 0) return 'Every payment needs an amount greater than zero.';
      if (payment.method === 'GCASH' && !payment.gcashRecipientId) {
        return 'Choose who received each GCash payment.';
      }
    }

    for (const change of parsedChanges) {
      if (change.amount <= 0) return 'Every change line needs an amount greater than zero.';
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

  const openReview = () => {
    const error = validate();
    setFormError(error);
    if (error) return;
    setReviewOpen(true);
  };

  const confirmSave = async () => {
    const error = validate();
    if (error) {
      setFormError(error);
      setReviewOpen(false);
      return;
    }

    try {
      await save.mutateAsync(buildInput());
      toast.success(isEdit ? 'Order updated.' : 'Order saved.');
      setReviewOpen(false);
      navigate('/orders');
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Could not save the order.');
      setReviewOpen(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="touch" nativeButton={false} render={<Link to="/orders" />}>
          <ArrowLeft aria-hidden="true" />
          Orders
        </Button>
        <div className="flex gap-2">
          {isEdit && existing.data ? (
            <Button variant="outline" size="touch" onClick={() => setShareOpen(true)}>
              <Share2 aria-hidden="true" />
              Share receipt
            </Button>
          ) : null}
          <Button size="touch" disabled={!online || save.isPending} onClick={openReview}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Review order
          </Button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isEdit ? 'Edit order' : 'New order'}
        </h1>
        <p className="text-ink-soft mt-1 text-sm">
          {isEdit && existing.data ? (
            <>
              <span className="font-mono font-semibold">{existing.data.order.orderNo}</span>
              {' · '}
            </>
          ) : null}
          {formatManilaDate(`${date}T12:00:00+08:00`)}
        </p>
      </div>

      <section className="border-line bg-surface rounded-lg border p-4">
        <h2 className="font-display text-xl font-semibold">Customer</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="order-date">Date</Label>
            <Input
              id="order-date"
              type="date"
              value={date}
              max={manilaDateKey()}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="order-customer">Customer name</Label>
            <Input
              id="order-customer"
              placeholder="Optional"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="order-bike">Motorcycle</Label>
            <Input
              id="order-bike"
              placeholder="Optional"
              value={bike}
              onChange={(event) => setBike(event.target.value)}
            />
          </div>
        </div>
        {isEdit ? (
          <p className="text-steel mt-3 text-xs">
            Changing the date assigns a new order number for that business date.
          </p>
        ) : null}
      </section>

      <OrderItemEditor
        items={items}
        catalog={catalog.data ?? []}
        onChange={(next) => setItems(next)}
      />

      <section className="border-line bg-surface rounded-lg border p-4">
        <h2 className="font-display text-xl font-semibold">Labor</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Main worker</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {staffOptions.map((person) => (
                <Button
                  key={person.id}
                  type="button"
                  variant={mainUserId === person.id ? 'default' : 'outline'}
                  size="touch"
                  aria-pressed={mainUserId === person.id}
                  onClick={() => chooseMain(person.id)}
                >
                  {person.displayName}
                </Button>
              ))}
            </div>
            <p className="text-steel mt-1 text-xs">
              Gets the rest of the labor after the helper’s share.
            </p>
          </div>
          <div>
            <Label htmlFor="labor-total">Total labor (₱)</Label>
            <Input
              id="labor-total"
              inputMode="decimal"
              value={labor}
              onChange={(event) => setLabor(event.target.value)}
            />
          </div>
          <div>
            <Label>Helper</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!helperUserId ? 'default' : 'outline'}
                size="touch"
                aria-pressed={!helperUserId}
                onClick={() => chooseHelper(null)}
              >
                No helper
              </Button>
              {helperOptions.map((person) => (
                <Button
                  key={person.id}
                  type="button"
                  variant={helperUserId === person.id ? 'default' : 'outline'}
                  size="touch"
                  aria-pressed={helperUserId === person.id}
                  onClick={() => chooseHelper(person.id)}
                >
                  {person.displayName}
                </Button>
              ))}
            </div>
          </div>
          {helperUserId ? (
            <div>
              <Label htmlFor="helper-labor">Helper’s share (₱)</Label>
              <Input
                id="helper-labor"
                inputMode="decimal"
                value={helperLabor}
                onChange={(event) => setHelperLabor(event.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label>{mainUser?.displayName ?? 'Main user’s'} share</Label>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatCentavos(mainLabor)}
            </p>
          </div>
        </div>
      </section>

      <section className="border-line bg-surface rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">Extras</h2>
            <p className="text-steel text-xs">Keep-the-change tips. Defaults to the main user.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() =>
              setExtras([...extras, { key: newKey(), userId: mainUserId, amount: '', note: '' }])
            }
          >
            <Plus aria-hidden="true" />
            Add extra
          </Button>
        </div>

        {extras.length === 0 ? (
          <p className="text-steel mt-2 text-sm">No extra.</p>
        ) : (
          <ul className="divide-line mt-2 divide-y">
            {extras.map((extra) => (
              <li
                key={extra.key}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end"
              >
                <div>
                  <Label>Recipient</Label>
                  <div className="mt-1 flex gap-2">
                    {[mainUserId, helperUserId].filter(Boolean).map((userId) => {
                      const person = staffOptions.find((row) => row.id === userId);
                      return (
                        <Button
                          key={userId}
                          type="button"
                          variant={extra.userId === userId ? 'default' : 'outline'}
                          size="touch"
                          aria-pressed={extra.userId === userId}
                          onClick={() =>
                            setExtras(
                              extras.map((row) =>
                                row.key === extra.key ? { ...row, userId } : row,
                              ),
                            )
                          }
                        >
                          {person?.displayName ?? 'User'}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label htmlFor={`extra-${extra.key}`}>Amount (₱)</Label>
                  <Input
                    id={`extra-${extra.key}`}
                    inputMode="decimal"
                    value={extra.amount}
                    onChange={(event) =>
                      setExtras(
                        extras.map((row) =>
                          row.key === extra.key ? { ...row, amount: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`extra-note-${extra.key}`}>Note</Label>
                  <Input
                    id={`extra-note-${extra.key}`}
                    placeholder="Optional"
                    value={extra.note}
                    onChange={(event) =>
                      setExtras(
                        extras.map((row) =>
                          row.key === extra.key ? { ...row, note: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  aria-label="Remove extra"
                  onClick={() => setExtras(extras.filter((row) => row.key !== extra.key))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OrderPaymentEditor
        payments={payments}
        changes={changes}
        staff={staffOptions}
        defaultRecipientId={mainUserId}
        onPaymentsChange={setPayments}
        onChangesChange={setChanges}
      />

      <section className="border-line bg-surface rounded-lg border p-4">
        <h2 className="font-display text-xl font-semibold">Totals</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-steel">Parts</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(money.partsCentavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-steel">Labor</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(laborCentavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-steel">Extras</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(money.extrasCentavos)}</dd>
          </div>
          <div className="border-line flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Customer total</dt>
            <dd className="font-mono tabular-nums">
              {formatCentavos(money.customerTotalCentavos)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-steel">Payments</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(money.paidCentavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-steel">Change</dt>
            <dd className="font-mono tabular-nums">{formatCentavos(money.changeCentavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className={money.balanceCentavos === 0 ? 'text-ok' : 'text-danger'}>Balance</dt>
            <dd
              className={cn(
                'font-mono font-semibold tabular-nums',
                money.balanceCentavos === 0 ? 'text-ok' : 'text-danger',
              )}
            >
              {formatCentavos(money.balanceCentavos)}
            </dd>
          </div>
        </dl>
      </section>

      {formError ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm"
        >
          {formError}
        </p>
      ) : null}

      {!online ? (
        <output className="text-warn block text-sm">
          You are offline. Saving is disabled until the connection returns.
        </output>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="touch"
          className="flex-1"
          disabled={!online || save.isPending}
          onClick={openReview}
        >
          Review order
        </Button>
        <Button variant="outline" size="touch" nativeButton={false} render={<Link to="/orders" />}>
          Cancel
        </Button>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Review order</DialogTitle>
            <DialogDescription>
              Check the items, labor split, payment, change, and extra before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            <div>
              <p className="text-steel text-xs">Customer</p>
              <p>
                {customer.trim() || 'Walk-in'}
                {bike.trim() ? ` · ${bike.trim()}` : ''}
              </p>
            </div>
            <div>
              <p className="text-steel text-xs">Items</p>
              <ul className="mt-1 space-y-1">
                {items.map((item) => (
                  <li key={item.key} className="flex justify-between gap-2">
                    <span>
                      {item.qty} × {item.name}
                      {item.isCustom ? ' (custom)' : ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatCentavos(
                        (Number(item.qty) || 0) * (parsePesoToCentavos(item.price) ?? 0),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-steel text-xs">Labor</p>
              <p>
                {mainUser?.displayName ?? 'Main'}: {formatCentavos(mainLabor)}
                {helperUserId
                  ? ` · ${staffOptions.find((row) => row.id === helperUserId)?.displayName ?? 'Helper'}: ${formatCentavos(helperLaborCentavos)}`
                  : ''}
              </p>
            </div>
            <div>
              <p className="text-steel text-xs">Payment</p>
              <p>
                {payments.length} payment{payments.length === 1 ? '' : 's'} · {changes.length}{' '}
                change line{changes.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="border-line flex justify-between border-t pt-2 text-base font-semibold">
              <span>Customer total</span>
              <span className="font-mono tabular-nums">
                {formatCentavos(money.customerTotalCentavos)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-steel">Extras</span>
              <span className="font-mono tabular-nums">{formatCentavos(money.extrasCentavos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-steel">Balance</span>
              <span className="font-mono tabular-nums">
                {formatCentavos(money.balanceCentavos)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="touch"
              disabled={save.isPending || !online}
              onClick={() => void confirmSave()}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              Save order
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setReviewOpen(false)}
            >
              Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
