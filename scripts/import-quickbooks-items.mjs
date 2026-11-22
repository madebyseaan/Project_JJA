#!/usr/bin/env node
/**
 * One-time QuickBooks Item List import.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   STAFF_EMPLOYEE_ID=JJA-001 STAFF_PASSWORD=... \
 *   node scripts/import-quickbooks-items.mjs --file draft.CSV
 *
 * The CSV is a QuickBooks Item List export. Only active Inventory Part rows
 * are imported. Stock quantities are ignored. The private CSV must never be
 * committed.
 */
import { readFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const BATCH_SIZE = 200;

function parsePesoToCentavos(input) {
  const compact = String(input ?? '')
    .trim()
    .replace(/[₱\s]/g, '');

  if (compact === '') return null;

  const negative = compact.startsWith('-');
  const unsigned = negative ? compact.slice(1) : compact;

  if (unsigned.includes(',')) {
    if (!/^\d{1,3}(,\d{3})*(\.\d{0,2})?$/.test(unsigned)) return null;
  } else if (!/^\d+(\.\d{0,2})?$/.test(unsigned)) {
    return null;
  }

  const cleaned = unsigned.replace(/,/g, '');
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const centavos = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));

  if (!Number.isSafeInteger(centavos)) return null;

  return negative ? -centavos : centavos;
}

function parseArgs(argv) {
  const index = argv.indexOf('--file');
  const file = index >= 0 ? argv[index + 1] : null;

  if (!file) {
    throw new Error('Pass the QuickBooks CSV path with --file <path>.');
  }

  return { file, fullSync: !argv.includes('--no-full-sync') };
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function toItems(csvText) {
  const parsed = Papa.parse(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  });

  const headers = parsed.meta.fields ?? [];
  const required = ['Item', 'Type', 'Price'];

  for (const header of required) {
    if (!headers.includes(header)) {
      throw new Error(`The CSV is missing the ${header} column.`);
    }
  }

  const items = [];
  const errors = [];
  let skipped = 0;

  for (const [index, row] of parsed.data.entries()) {
    const type = String(row.Type ?? '').trim();
    const active = String(row['Active Status'] ?? '').trim();

    if (type !== 'Inventory Part' || active !== 'Active') {
      skipped += 1;
      continue;
    }

    const name = String(row.Item ?? '').trim();

    if (!name) {
      errors.push(`Row ${index + 2}: missing item name`);
      continue;
    }

    const price = parsePesoToCentavos(row.Price);

    if (price === null || price < 0) {
      errors.push(`Row ${index + 2}: invalid price for ${name}`);
      continue;
    }

    items.push({
      name,
      description: String(row.Description ?? '').trim(),
      sku: String(row.MPN ?? '').trim() || null,
      base_price_centavos: price,
      item_type: type,
      income_account: String(row.Account ?? '').trim(),
      cogs_account: String(row['COGS Account'] ?? '').trim(),
      asset_account: String(row['Asset Account'] ?? '').trim(),
      preferred_vendor: String(row['Preferred Vendor'] ?? '').trim(),
      is_active: true,
    });
  }

  return { items, errors, skipped };
}

async function main() {
  const { file, fullSync } = parseArgs(process.argv.slice(2));
  const url = requiredEnv('SUPABASE_URL');
  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const employeeId = requiredEnv('STAFF_EMPLOYEE_ID').trim().toUpperCase();
  const password = requiredEnv('STAFF_PASSWORD');
  const idMatch = employeeId.match(/^([A-Z]+)-?(\d{1,3})$/);
  const normalizedId = idMatch
    ? `${idMatch[1]}-${(idMatch[2] ?? '').padStart(3, '0')}`
    : employeeId;

  const csv = await readFile(file, 'utf8');
  const { items, errors, skipped } = toItems(csv);

  if (errors.length > 0) {
    console.error(`${errors.length} row(s) have errors:`);
    for (const error of errors.slice(0, 20)) console.error(`- ${error}`);
    if (errors.length > 20) console.error(`...and ${errors.length - 20} more.`);
  }

  if (items.length === 0) {
    throw new Error('No active inventory parts to import.');
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `${normalizedId.toLowerCase()}@staff.jja.internal`;
  const { error: authError } = await client.auth.signInWithPassword({ email, password });

  if (authError) {
    throw new Error(`Sign-in failed: ${authError.message}`);
  }

  const totals = { inserted: 0, updated: 0, skipped: 0 };

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    const { data, error } = await client.rpc('import_catalog_items', { p_items: batch });

    if (error) {
      throw new Error(`Import failed at row ${index + 1}: ${error.message}`);
    }

    totals.inserted += data.inserted;
    totals.updated += data.updated;
    totals.skipped += data.skipped;

    console.log(
      `Batch ${Math.floor(index / BATCH_SIZE) + 1}: ${data.inserted} new, ${data.updated} updated.`,
    );
  }

  console.log(
    `Done. ${totals.inserted} new, ${totals.updated} updated, ${skipped + totals.skipped} skipped.`,
  );

  if (fullSync && errors.length === 0) {
    const { data, error } = await client.rpc('deactivate_missing_catalog_items', {
      p_names: items.map((item) => item.name),
    });

    if (error) {
      throw new Error(`Could not deactivate missing items: ${error.message}`);
    }

    console.log(`Deactivated ${data.deactivated} item(s) no longer in the list.`);
  } else if (fullSync) {
    console.warn('Skipped deactivation because some CSV rows had errors.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
