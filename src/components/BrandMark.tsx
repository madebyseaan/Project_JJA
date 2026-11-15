import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <img
      src="/brand/jja-logo.jpg"
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={cn('bg-paper size-10 shrink-0 rounded-full object-cover', className)}
    />
  );
}
