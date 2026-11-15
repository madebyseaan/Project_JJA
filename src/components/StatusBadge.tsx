import { cn } from '@/lib/utils';

export type TicketStatus =
  'PENDING' | 'VERIFYING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'VOIDED';

type StatusConfig = {
  label: string;
  className: string;
  dotClassName: string;
};

const STATUS_CONFIG: Record<TicketStatus, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    className: 'border-line-strong bg-soft text-ink-soft',
    dotClassName: 'bg-steel',
  },
  VERIFYING: {
    label: 'Verifying',
    className: 'border-warn/30 bg-warn/10 text-warn',
    dotClassName: 'bg-warn',
  },
  IN_PROGRESS: {
    label: 'In progress',
    className: 'border-blueprint/30 bg-blueprint/10 text-blueprint',
    dotClassName: 'bg-blueprint',
  },
  READY: {
    label: 'Ready',
    className: 'border-ok/30 bg-ok/10 text-ok',
    dotClassName: 'bg-ok',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'border-ink/20 bg-ink/5 text-ink',
    dotClassName: 'bg-ink',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'border-danger/30 bg-danger/10 text-danger',
    dotClassName: 'bg-danger',
  },
  VOIDED: {
    label: 'Voided',
    className: 'border-danger bg-transparent text-danger',
    dotClassName: 'bg-danger',
  },
};

type StatusBadgeProps = {
  status: TicketStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-xs font-semibold',
        config.className,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dotClassName)} aria-hidden="true" />
      {config.label}
    </span>
  );
}
