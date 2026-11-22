import { BarChart3, Package, ReceiptText, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/utils';

type AppNavProps = {
  variant: 'rail' | 'tabs';
  className?: string;
};

type NavItem = {
  label: string;
  to: string;
  Icon: LucideIcon;
};

const ITEMS: NavItem[] = [
  { label: 'Orders', to: '/orders', Icon: ReceiptText },
  { label: 'Items', to: '/items', Icon: Package },
  { label: 'Reports', to: '/reports', Icon: BarChart3 },
  { label: 'Settings', to: '/settings', Icon: Settings },
];

export function AppNav({ variant, className }: AppNavProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        variant === 'tabs' &&
          'border-line bg-surface shrink-0 border-t pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ul className={cn(variant === 'rail' ? 'flex flex-col gap-2' : 'flex')}>
        {ITEMS.map(({ label, to, Icon }) => (
          <li key={to} className={variant === 'tabs' ? 'flex-1' : undefined}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors',
                  variant === 'rail' && 'min-h-12 border-l-4 px-3',
                  variant === 'rail' &&
                    (isActive
                      ? 'bg-soft text-ink border-safety'
                      : 'text-ink-soft hover:bg-soft border-transparent'),
                  variant === 'tabs' && 'min-h-16 flex-1 flex-col justify-center gap-1 border-t-2',
                  variant === 'tabs' &&
                    (isActive ? 'border-safety text-safety-dark' : 'text-steel border-transparent'),
                )
              }
            >
              <Icon className="size-6" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
