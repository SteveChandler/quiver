/**
 * ERDDAP tabledap CSV: line 1 = column names, line 2 = units, then rows.
 * An empty result is HTTP 404 with "Your query produced no matching results".
 */

import { splitCsvLine } from "./values";

interface ErddapTable {
  columns: string[];
  units: Record<string, string>;
  rows: Array<Record<string, string>>;
}

export function parseErddapCsv(text: string): ErddapTable {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("ERDDAP CSV: missing header or units line");
  const columns = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const unitCells = splitCsvLine(lines[1]);
  const units: Record<string, string> = {};
  columns.forEach((column, index) => {
    units[column] = (unitCells[index] ?? "").trim();
  });
  const rows = lines.slice(2).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { columns, units, rows };
}

export function isErddapNoRows(status: number, body: string): boolean {
  return status === 404 && /no matching results|nRows = 0/i.test(body);
}

/**
 * A changed unit would silently corrupt every stored value, so the run fails
 * instead of guessing a conversion.
 */
export function assertErddapUnits(table: ErddapTable, expected: Record<string, string>, label: string): void {
  for (const [column, unit] of Object.entries(expected)) {
    if (!table.columns.includes(column)) throw new Error(`${label}: column ${column} missing`);
    if (table.units[column] !== unit) {
      throw new Error(`${label}: column ${column} unit is "${table.units[column]}", expected "${unit}"`);
    }
  }
}
