import Papa from 'papaparse';

import { parsePesoToCentavos } from '@/lib/money';

export type CatalogImportItem = {
  name: string;
  description: string;
  sku: string | null;
  basePriceCentavos: number;
  itemType: string;
  incomeAccount: string;
  cogsAccount: string;
  assetAccount: string;
  preferredVendor: string;
  isActive: boolean;
};

export type CatalogImportResult = {
  items: CatalogImportItem[];
  skipped: number;
  errors: string[];
};

const REQUIRED_HEADERS = ['Item', 'Type', 'Price'];

export function parseCatalogCsv(text: string): CatalogImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  });

  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    return {
      items: [],
      skipped: 0,
      errors: [`Missing columns: ${missing.join(', ')}`],
    };
  }

  const items: CatalogImportItem[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const [index, row] of parsed.data.entries()) {
    const type = (row.Type ?? '').trim();
    const active = (row['Active Status'] ?? '').trim();

    if (type !== 'Inventory Part' || active !== 'Active') {
      skipped += 1;
      continue;
    }

    const name = (row.Item ?? '').trim();

    if (!name) {
      errors.push(`Row ${index + 2}: missing item name`);
      continue;
    }

    const price = parsePesoToCentavos((row.Price ?? '').trim());

    if (price === null || price < 0) {
      errors.push(`Row ${index + 2}: invalid price for ${name}`);
      continue;
    }

    const sku = (row.MPN ?? '').trim() || null;

    items.push({
      name,
      description: (row.Description ?? '').trim(),
      sku,
      basePriceCentavos: price,
      itemType: type,
      incomeAccount: (row.Account ?? '').trim(),
      cogsAccount: (row['COGS Account'] ?? '').trim(),
      assetAccount: (row['Asset Account'] ?? '').trim(),
      preferredVendor: (row['Preferred Vendor'] ?? '').trim(),
      isActive: true,
    });
  }

  return { items, skipped, errors };
}
