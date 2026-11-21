import { ChartNoAxesCombined, Package, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/utils';
import type { Role } from '@/types/domain';

type AppNavProps = {
  role: Role;
  variant: 'rail' | 'tabs';
  className?: string;
};

type NavItem = {
  label: string;
  to: string;
  Icon: LucideIcon;
  ownerOnly?: boolean;
};

const ITEMS: NavItem[] = [
  { label: 'Bay', to: '/bay', Icon: Wrench },
  { label: 'Stock', to: '/inventory', Icon: Package },
  { label: 'Owner', to: '/owner', Icon: ChartNoAxesCombined, ownerOnly: true },
];

export function AppNav({ role, variant, className }: AppNavProps) {
  const items = ITEMS.filter((item) => !item.ownerOnly || role === 'owner');

  return (
    <nav
      aria-label="Main"
      className={cn(
        variant === 'tabs' && 'border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t',
        className,
      )}
    >
      <ul className={cn(variant === 'rail' ? 'flex flex-col gap-2' : 'flex')}>
        {items.map(({ label, to, Icon }) => (
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
