import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title }: BrandMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 48 48"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn('text-ink size-10', className)}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z"
        fill="var(--color-safety)"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="miter"
      />
      <path
        d="M14 31V17l10 8 10-8v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
