export interface NdbcRecord {
  timeUtcMs: number;
  waveHeightM: number | null;
  dominantPeriodS: number | null;
  meanWaveDirDeg: number | null;
  waterTempC: number | null;
  windDirDeg: number | null;
  windSpeedMs: number | null;
}

// Older archives use YYYY/WD/BAR where newer ones use #YY/WDIR/PRES.
const HEADER_ALIASES: Readonly<Record<string, string>> = {
  YYYY: "YY",
  WD: "WDIR",
  BAR: "PRES",
};

// NDBC fills missing values with 99 / 999 in historical files.
const MISSING_AT_OR_ABOVE: Readonly<Record<string, number>> = {
  WVHT: 99,
  DPD: 99,
  MWD: 999,
  WTMP: 999,
  WDIR: 999,
  WSPD: 99,
};

function readNumber(token: string | undefined, column: string): number | null {
  if (token === undefined || token === "MM") return null;
  const value = Number(token);
  if (!Number.isFinite(value)) return null;
  if (value >= MISSING_AT_OR_ABOVE[column]) return null;
  return value;
}

export function parseNdbcStdmet(text: string): NdbcRecord[] {
  const records: NdbcRecord[] = [];
  let header: string[] | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;

    if (header === null) {
      header = line
        .replace(/^#/, "")
        .split(/\s+/)
        .map((name) => HEADER_ALIASES[name] ?? name);
      continue;
    }
    // The units row ("#yr mo dy ...") follows the header in newer files.
    if (line.startsWith("#")) continue;

    const columns = header;
    const tokens = line.split(/\s+/);
    const field = (name: string): string | undefined => {
      const index = columns.indexOf(name);
      return index === -1 ? undefined : tokens[index];
    };

    let year = Number(field("YY"));
    if (year < 100) year += 1900;
    const month = Number(field("MM"));
    const day = Number(field("DD"));
    const hour = Number(field("hh"));
    const minute = columns.includes("mm") ? Number(field("mm")) : 0;
    if (![year, month, day, hour, minute].every(Number.isFinite)) continue;

    records.push({
      timeUtcMs: Date.UTC(year, month - 1, day, hour, minute),
      waveHeightM: readNumber(field("WVHT"), "WVHT"),
      dominantPeriodS: readNumber(field("DPD"), "DPD"),
      meanWaveDirDeg: readNumber(field("MWD"), "MWD"),
      waterTempC: readNumber(field("WTMP"), "WTMP"),
      windDirDeg: readNumber(field("WDIR"), "WDIR"),
      windSpeedMs: readNumber(field("WSPD"), "WSPD"),
    });
  }

  return records;
}
