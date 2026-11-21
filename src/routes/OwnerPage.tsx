import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export function OwnerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Owner" description="Today's sales, cash, and low stock." />
      <EmptyState
        title="No sales yet"
        description="Completed sales and the day close will appear here."
      />
    </div>
  );
}
