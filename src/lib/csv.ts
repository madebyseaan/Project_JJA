import Papa from 'papaparse';

/**
 * Spreadsheet apps treat these leading characters as formulas. Prefix a quote
 * so an exported name or note can never execute as a formula.
 */
export function escapeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export type CsvColumn<T> = {
  key: keyof T & string;
  label: string;
};

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const data = rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => {
        const value = row[column.key];
        const text = value === null || value === undefined ? '' : String(value);
        return [column.label, escapeCsvFormula(text)];
      }),
    ),
  );

  return Papa.unparse({
    fields: columns.map((column) => column.label),
    data,
  });
}
