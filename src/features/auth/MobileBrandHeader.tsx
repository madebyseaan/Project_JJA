import { BrandMark } from '@/components/BrandMark';

type MobileBrandHeaderProps = {
  manilaTime: string;
};

export function MobileBrandHeader({ manilaTime }: MobileBrandHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark className="size-12" title="J.J.A Motor Accessories and Motorcycle Repair" />
        <div className="min-w-0">
          <p className="font-display truncate text-xl leading-tight font-bold tracking-tight">
            J.J.A
          </p>
          <p className="text-steel truncate text-xs">Motor Accessories &amp; Repair</p>
        </div>
      </div>
      <span className="text-steel shrink-0 font-mono text-[11px] whitespace-nowrap">
        Manila · {manilaTime}
      </span>
    </div>
  );
}
