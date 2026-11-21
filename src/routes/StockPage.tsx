import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export function StockPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stock" description="Parts, prices, and available stock." />
      <EmptyState title="No parts yet" description="The parts catalog will appear here." />
    </div>
  );
}
