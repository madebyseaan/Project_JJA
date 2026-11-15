import { cn } from '@/lib/utils';

type ConnectionStatusProps = {
  online: boolean;
  className?: string;
};

export function ConnectionStatus({ online, className }: ConnectionStatusProps) {
  return (
    <output
      aria-live="polite"
      className={cn('text-steel inline-flex items-center gap-1.5 text-xs font-semibold', className)}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', online ? 'bg-ok' : 'bg-danger')}
      />
      {online ? 'Online' : 'Offline'}
    </output>
  );
}
