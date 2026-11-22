import { BarChart3, Package, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandMark } from '@/components/BrandMark';

type BrandPanelProps = {
  manilaTime: string;
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
};

const CAPABILITIES = [
  { label: 'Orders', Icon: ReceiptText, tone: 'text-brand-red' },
  { label: 'Items', Icon: Package, tone: 'text-brand-blue' },
  { label: 'Reports', Icon: BarChart3, tone: 'text-brand-gold' },
] as const;

export function BrandPanel({ manilaTime, eyebrow, title, description }: BrandPanelProps) {
  return (
    <section className="bg-ink text-paper relative hidden overflow-hidden p-8 md:flex xl:p-12">
      <div aria-hidden="true" className="blueprint-grid pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid h-full w-full max-w-[40rem] grid-rows-[auto_1fr_auto]">
        <BrandMark
          className="size-16 xl:size-24"
          title="J.J.A Motor Accessories and Motorcycle Repair"
        />

        <div className="flex flex-col justify-center py-10">
          <p className="border-safety text-paper/70 mb-5 border-l-4 pl-3 text-sm md:text-base">
            {eyebrow}
          </p>
          <p className="font-display text-paper text-[clamp(3.25rem,6vw,7rem)] leading-[0.9] font-bold tracking-tight">
            {title}
          </p>
          <p className="text-paper/70 mt-6 max-w-[26rem] text-base md:text-lg xl:text-xl">
            {description}
          </p>

          <div className="text-paper/60 mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm xl:text-base">
            {CAPABILITIES.map(({ label, Icon, tone }) => (
              <span key={label} className="inline-flex items-center gap-2">
                <Icon className={`${tone} size-4`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="border-paper/10 text-paper/50 flex items-center justify-between gap-4 border-t pt-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-1 w-9 overflow-hidden" aria-hidden="true">
              <span className="bg-brand-red h-full w-1/3" />
              <span className="bg-brand-blue h-full w-1/3" />
              <span className="bg-brand-gold h-full w-1/3" />
            </span>
            <span>J.J.A · Est. 2023</span>
          </div>
          <span className="font-mono text-[11px]">Manila · {manilaTime}</span>
        </div>
      </div>
    </section>
  );
}
