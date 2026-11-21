import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { TicketStatus } from '@/components/StatusBadge';

import { useUpdateTicketStatus } from '../hooks/use-tickets';
import { statusActions } from '../schemas';

type TicketStatusActionsProps = {
  ticketId: string;
  status: TicketStatus;
  isOnline: boolean;
};

export function TicketStatusActions({ ticketId, status, isOnline }: TicketStatusActionsProps) {
  const updateStatus = useUpdateTicketStatus(ticketId);
  const actions = statusActions(status);

  if (actions.length === 0) {
    return null;
  }

  const handleClick = async (next: TicketStatus) => {
    try {
      await updateStatus.mutateAsync(next);
      toast.success('Ticket status updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the status.');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <Button
          key={action.status}
          size="touch"
          variant={index === 0 ? 'default' : 'outline'}
          disabled={!isOnline || updateStatus.isPending}
          onClick={() => void handleClick(action.status)}
        >
          {updateStatus.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
