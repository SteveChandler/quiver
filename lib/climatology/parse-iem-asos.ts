export interface AsosRecord {
  timeUtcMs: number;
  windDirDeg: number | null;
  windSpeedKt: number | null;
}

const VALID_UTC = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

function readCell(cell: string | undefined): number | null {
  if (cell === undefined || cell.trim() === "" || cell === "M") return null;
  const value = Number(cell);
  return Number.isFinite(value) ? value : null;
}

/** Parses an IEM asos.py response requested with tz=Etc/UTC and format=onlycomma. */
export function parseIemAsosCsv(text: string): AsosRecord[] {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  const header = (lines.shift() ?? "").split(",");
  const validIndex = header.indexOf("valid");
  const dirIndex = header.indexOf("drct");
  const speedIndex = header.indexOf("sknt");
  if (validIndex === -1 || dirIndex === -1 || speedIndex === -1) {
    throw new Error(`Unexpected IEM ASOS header: ${header.join(",")}`);
  }

  const records: AsosRecord[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    const match = VALID_UTC.exec(cells[validIndex] ?? "");
    if (!match) continue;
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    records.push({
      timeUtcMs: Date.UTC(year, month - 1, day, hour, minute),
      windDirDeg: readCell(cells[dirIndex]),
      windSpeedKt: readCell(cells[speedIndex]),
    });
  }
  return records;
}
