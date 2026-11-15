import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export function BayPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Bay" description="Today's walk-in jobs and their status." />
      <EmptyState title="No tickets in the bay" description="Walk-in tickets will appear here." />
    </div>
  );
}
