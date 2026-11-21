import { History, MoreHorizontal, Pencil, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCentavos } from '@/lib/money';

import type { Part } from '../types';

type PartsTableProps = {
  parts: Part[];
  isOwner: boolean;
  isOnline: boolean;
  onEdit: (part: Part) => void;
  onAdjust: (part: Part) => void;
  onLedger: (part: Part) => void;
};

function isLowStock(part: Part): boolean {
  return part.isActive && part.availableQty <= part.lowStockThreshold;
}

function PartStatus({ part }: { part: Part }) {
  if (!part.isActive) {
    return (
      <span className="border-line text-steel inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium">
        Inactive
      </span>
    );
  }

  if (isLowStock(part)) {
    return (
      <span className="border-warn/40 bg-warn/10 text-warn inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium">
        Low stock
      </span>
    );
  }

  return (
    <span className="border-ok/40 bg-ok/10 text-ok inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium">
      In stock
    </span>
  );
}

function RowActions({
  part,
  isOwner,
  isOnline,
  onEdit,
  onAdjust,
  onLedger,
}: PartsTableProps & { part: Part }) {
  if (!isOwner) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Actions for ${part.name}`} />}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(part)}>
          <Pencil aria-hidden="true" />
          Edit part
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!isOnline} onClick={() => onAdjust(part)}>
          <SlidersHorizontal aria-hidden="true" />
          Adjust stock
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onLedger(part)}>
          <History aria-hidden="true" />
          Stock ledger
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PartsTable(props: PartsTableProps) {
  const { parts, isOwner, isOnline, onEdit, onAdjust, onLedger } = props;

  return (
    <>
      <div className="border-line bg-surface hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {isOwner ? (
                <TableHead className="hidden text-right lg:table-cell">Cost</TableHead>
              ) : null}
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Status</TableHead>
              {isOwner ? <TableHead className="w-12" aria-label="Actions" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((part) => (
              <TableRow key={part.id} className={isLowStock(part) ? 'bg-warn/5' : undefined}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium">{part.name}</p>
                    <p className="text-steel truncate text-xs">
                      {part.sku ? `${part.sku} · ` : ''}
                      {part.compatibleModels.length > 0
                        ? part.compatibleModels.join(', ')
                        : 'No model list'}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-ink-soft hidden lg:table-cell">
                  {part.category}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCentavos(part.unitPriceCentavos)}
                </TableCell>
                {isOwner ? (
                  <TableCell className="text-steel hidden text-right font-mono tabular-nums lg:table-cell">
                    {formatCentavos(part.costPriceCentavos)}
                  </TableCell>
                ) : null}
                <TableCell className="text-right font-mono tabular-nums">
                  {part.stockOnHand}
                </TableCell>
                <TableCell className="text-steel hidden text-right font-mono tabular-nums sm:table-cell">
                  {part.reservedQty}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {part.availableQty}
                </TableCell>
                <TableCell>
                  <PartStatus part={part} />
                </TableCell>
                {isOwner ? (
                  <TableCell>
                    <RowActions
                      {...props}
                      part={part}
                      isOwner={isOwner}
                      isOnline={isOnline}
                      onEdit={onEdit}
                      onAdjust={onAdjust}
                      onLedger={onLedger}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {parts.map((part) => (
          <li
            key={part.id}
            className={
              isLowStock(part)
                ? 'border-warn/50 bg-surface rounded-lg border border-l-4 p-3'
                : 'border-line bg-surface rounded-lg border border-l-4 border-l-transparent p-3'
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{part.name}</p>
                <p className="text-steel truncate text-xs">{part.category}</p>
              </div>
              <PartStatus part={part} />
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-steel text-xs">Price</dt>
                <dd className="font-mono tabular-nums">{formatCentavos(part.unitPriceCentavos)}</dd>
              </div>
              <div>
                <dt className="text-steel text-xs">On hand</dt>
                <dd className="font-mono tabular-nums">{part.stockOnHand}</dd>
              </div>
              <div>
                <dt className="text-steel text-xs">Available</dt>
                <dd className="font-mono font-semibold tabular-nums">{part.availableQty}</dd>
              </div>
            </dl>

            {isOwner ? (
              <div className="border-line mt-3 flex gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="touch"
                  className="flex-1"
                  onClick={() => onEdit(part)}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="touch"
                  className="flex-1"
                  disabled={!isOnline}
                  onClick={() => onAdjust(part)}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  Adjust
                </Button>
                <Button variant="outline" size="touch" onClick={() => onLedger(part)}>
                  <History aria-hidden="true" />
                  <span className="sr-only">Stock ledger for {part.name}</span>
                  Ledger
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
