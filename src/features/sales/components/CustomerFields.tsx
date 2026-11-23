import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { manilaDateKey } from '@/lib/dates';

type CustomerFieldsProps = {
  date: string;
  customer: string;
  bike: string;
  isEdit: boolean;
  onDateChange: (date: string) => void;
  onCustomerChange: (customer: string) => void;
  onBikeChange: (bike: string) => void;
};

export function CustomerFields({
  date,
  customer,
  bike,
  isEdit,
  onDateChange,
  onCustomerChange,
  onBikeChange,
}: CustomerFieldsProps) {
  return (
    <section className="border-line bg-surface rounded-lg border p-4">
      <h2 className="font-display text-xl font-semibold">Customer</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="order-date">Job date</Label>
          <Input
            id="order-date"
            type="date"
            value={date}
            max={manilaDateKey()}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="order-customer">Customer name</Label>
          <Input
            id="order-customer"
            placeholder="Optional"
            value={customer}
            onChange={(event) => onCustomerChange(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="order-bike">Motorcycle</Label>
          <Input
            id="order-bike"
            placeholder="Optional"
            value={bike}
            onChange={(event) => onBikeChange(event.target.value)}
          />
        </div>
      </div>
      {isEdit ? (
        <p className="text-steel mt-3 text-xs">
          Changing the job date assigns a new order number for that date.
        </p>
      ) : null}
    </section>
  );
}
