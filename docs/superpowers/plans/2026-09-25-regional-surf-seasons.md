# Regional Surf Seasons from Buoy Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written seasonal numbers on `/best-time-to-surf/newport-beach`, `/cocoa-beach` and `/honolulu` with statistics computed from NOAA buoy archives, add evidence sections, licensed photos and data-driven copy to Newport and Cocoa, and fix the zero-score gauge and the contradictory tide sentence on every city page.

**Architecture:** An offline `tsx` script downloads NDBC and Iowa Environmental Mesonet archives, computes monthly statistics with pure functions in `lib/climatology/`, and commits one JSON dataset and one CSV per city. The best-time page switches into a data-backed mode when a dataset exists for the city, rendering server-side SVG charts and a month table from that dataset. Every user-facing "which months are best" field (score, Peak badges, peak month, hero sentence, FAQ) derives from the same dataset.

**Tech Stack:** Next.js App Router (server components), TypeScript strict, Tailwind 3, Jest 29 + Testing Library, Playwright, `tsx`, Node `zlib`, `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/specs/2026-09-25-regional-surf-seasons-design.md`

### Where this plan departs from the spec, and why

| Spec said | Plan does | Reason |
|---|---|---|
| Shore normals Cocoa 75°, Newport 210°, "check against coastline" | Cocoa 87°, Newport 217°, computed in code from two shoreline points | The check the spec asked for. Cocoa Beach Pier → Satellite Beach bearing is 177.1°; Huntington Beach Pier → Newport Pier is 127.3° |
| Oceanside Offshore 2004–2025 | 2015–2025 | Matches San Pedro South's period so the direction comparison uses the same years |
| Ledger at `scripts/data/season-approved-photos.json` | `lib/data/surf-climatology/season-photos.json` | The page and the download script read one file, so credits can't drift |
| Separate `ClimatologyCoverage` object; gates only on some sources | Coverage fields on each station; the 90% gate applies to every source | Simpler shape; a primary buoy that fails the gate stops the build instead of publishing thin data |
| Gauge arc animates after hydration | Arc animates with a CSS keyframe; no JS animation state | Real number and final arc are in the HTML with no client state; `motion-safe:` honours reduced motion |
| (silent) | Hide each beach's "Peak: …" list in data-backed mode | It comes from `best_months` and would contradict the buoy peak band on the same page |
| Window sentence uses window conditions | Also: top-level `conditions` come from the forecast row nearest to now | They came from the first row of the UTC day, which is neither "now" nor the window |
| Credit line for the Huntington photo unresolved | "Don Ramey Logan (WPPilot)" | Commons `User:WPPilot` soft-redirects to *Category:Photographs by Don Ramey Logan* |

## Global Constraints

- Node 22, Yarn 1, TypeScript strict, 2-space indentation, early returns, comments explain why. No `!` non-null assertions in new code.
- The climatology script never writes to a database and needs no credentials. Downloads cache under `.cache/climatology/` (gitignored).
- Buoy score v1, exactly: `score = round(100 × (0.45 × surfDays + 0.25 × groundswell + 0.20 × cleanMornings + 0.10 × waterComfort))`. Without a wind source that passed its gate, drop `cleanMornings` and divide the other three by 0.80.
- Thresholds: station-month coverage ≥ 0.70; ≥ 5 qualifying station-months per statistic; source gate ≥ 0.90 overall coverage; wind sea-breeze lift ≥ 0.20; small day = daytime (06:00–18:59 local) median Hs < 2 ft; big day = ≥ 3 hours with Hs ≥ 6 ft; observed day needs ≥ 10 of 13 daytime hours; light wind < 6 kt; onshore within ±67.5° of the shore normal; peak band = within 10 points of the top month.
- Wording: "Analysis by Quiver of …", never "Quiver measured". A buoy number is always called a buoy reading; never "waves" or "surf" on its own.
- Banned in page copy, captions and new component text: "not just/merely/only … , it's/but" reversals, "it's not X, it's Y", "whether you're", "stunning", "nestled", "hidden gem", "breathtaking", "in this guide", "comprehensive", "unlock", "elevate", "dive into", "magic", and bolded whole sentences.
- Photos: Public domain, CC0, CC BY or CC BY-SA only. Credit visible under every photo. Creative Commons photos say ", cropped" because the download script crops to 4:3.
- No URL, title, meta description or canonical changes. No other SEO change rides along.
- Every task ends with a local commit on `feat/regional-surf-seasons` using a Conventional Commit subject and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, open a PR, deploy or touch production without Steven's explicit go-ahead.
- Unit tests are mocked and make no network calls. The only networked step is running the build script in Task 5 and the photo download in Task 11.

## Review Focus

1. **A month the buoy mostly missed.** If fewer than 5 years qualify, that month's stats and score are `null`. The table shows "—", the charts show "n/a", and when it is the current month the hero shows "Not enough buoy data" instead of a 0 gauge. Pinned in Task 8 (view) and Task 9/10 (render) tests.
2. **Local-time edges.** 03:00 UTC on 1 January is 19:00 on 31 December in Los Angeles; the DST jump on 9 March 2025 skips local 02:00. Month, day and hour must come from the city's zone. Pinned in Task 2.
3. **Wind direction wrap-around.** With Newport's normal of 217°, wind from 350° (133° away) and from 10° (153° away, across north) are both offshore; wind from 300° is cross-shore. Pinned in Task 3.
4. **A source that fails its gate.** A failed wind gate removes the wind section and rescales the score; a failed comparison gate replaces the comparison with a plain note; a failed primary gate stops the build for that city. Pinned in Task 5 (build) and Task 13 (sections).
5. **No Mapbox token.** The station map hides the image but still lists every place and station with distances. Pinned in Task 10.

---

### Task 1: Climatology types and observation parsers

**Files:**
- Create: `lib/climatology/types.ts`
- Create: `lib/climatology/parse-ndbc.ts`
- Create: `lib/climatology/parse-iem-asos.ts`
- Test: `__tests__/lib/climatology/parse-ndbc.test.ts`
- Test: `__tests__/lib/climatology/parse-iem-asos.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `SECTORS`, `Sector`, `ClimatologyRole`, `SourceKind`, `GateResult`, `WindClass`, `HourlyObservation`, `LocalHourObservation`, `WaveMonthStats`, `WaterMonthStats`, `WindBlockStats`, `WindMonthStats`, `ClimatologyStation`, `ClimatologyPlace`, `ClimatologyMonth`, `SurfClimatologyDataset` (shapes below).
  - `parseNdbcStdmet(text: string): NdbcRecord[]` and `interface NdbcRecord { timeUtcMs: number; waveHeightM: number | null; dominantPeriodS: number | null; meanWaveDirDeg: number | null; waterTempC: number | null; windDirDeg: number | null; windSpeedMs: number | null }`.
  - `parseIemAsosCsv(text: string): AsosRecord[]` and `interface AsosRecord { timeUtcMs: number; windDirDeg: number | null; windSpeedKt: number | null }`.

- [ ] **Step 1: Write the types file**

```ts
// lib/climatology/types.ts
export const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Sector = (typeof SECTORS)[number];

export type ClimatologyRole = "waves" | "comparison-waves" | "wind";
export type SourceKind = "ndbc" | "iem-asos";
export type GateResult = "passed" | "failed";
export type WindClass = "offshore" | "cross" | "onshore" | "light";

/** One UTC hour at one station. Null means missing or flagged by the source. */
export interface HourlyObservation {
  hourUtcMs: number;
  waveHeightM: number | null;
  dominantPeriodS: number | null;
  meanWaveDirDeg: number | null;
  waterTempC: number | null;
  windDirDeg: number | null;
  windSpeedKt: number | null;
}

export interface LocalHourObservation extends HourlyObservation {
  year: number;
  /** 1-12 in the city's time zone */
  month: number;
  day: number;
  /** 0-23 in the city's time zone */
  hour: number;
}

export interface WaveMonthStats {
  hsFt: { median: number; p25: number; p75: number; p90: number };
  smallDayShare: number;
  bigDayShare: number;
  periodMix: { under8: number; from8to10: number; atLeast10: number };
  directionMix: Record<Sector, number>;
  yearlyMedianFt: Array<{ year: number; medianFt: number }>;
  observedDays: number;
  validHours: number;
  stationMonths: number;
}

export interface WaterMonthStats {
  medianF: number;
  p10F: number;
  p90F: number;
  validHours: number;
}

export interface WindBlockStats {
  offshore: number;
  cross: number;
  onshore: number;
  light: number;
  medianKt: number;
  hours: number;
}

export interface WindMonthStats {
  dawn: WindBlockStats;
  midday: WindBlockStats;
  afternoon: WindBlockStats;
  cleanMorningShare: number;
  observedMornings: number;
}

export interface ClimatologyPlace {
  label: string;
  lat: number;
  lon: number;
}

export interface ClimatologyStation {
  id: string;
  alias: string | null;
  name: string;
  role: ClimatologyRole;
  kind: SourceKind;
  lat: number;
  lon: number;
  distanceKm: number;
  referenceLabel: string;
  yearsUsed: [number, number];
  pageUrl: string;
  gate: GateResult;
  gateCoverage: number;
  validHours: number;
  excludedStationMonths: string[];
}

export interface ClimatologyMonth {
  month: number;
  waves: WaveMonthStats | null;
  comparisonWaves: WaveMonthStats | null;
  water: WaterMonthStats | null;
  wind: WindMonthStats | null;
  score: number | null;
}

export interface SurfClimatologyDataset {
  schemaVersion: 1;
  scoreVersion: "buoy-v1";
  citySlug: string;
  cityName: string;
  generatedAt: string;
  timezone: string;
  shoreNormalDeg: number | null;
  reference: ClimatologyPlace;
  places: ClimatologyPlace[];
  stations: ClimatologyStation[];
  months: ClimatologyMonth[];
}
```

- [ ] **Step 2: Write the failing NDBC parser test**

```ts
// __tests__/lib/climatology/parse-ndbc.test.ts
import { parseNdbcStdmet } from "@/lib/climatology/parse-ndbc";

const MODERN = [
  "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS  TIDE",
  "#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC   mi    ft",
  "2024 01 01 00 26 999 99.0 99.0  0.22 99.00  5.14 999 9999.0 999.0  19.5 999.0 99.0 99.00",
  "2024 01 01 00 56 352  0.2  0.6  0.23 11.00  5.22 087 9999.0 999.0  19.4 999.0 99.0 99.00",
].join("\n");

const LEGACY = [
  "YYYY MM DD hh mm  WD  WSPD GST  WVHT  DPD   APD  MWD  BAR    ATMP  WTMP  DEWP  VIS  TIDE",
  "2006 01 01 00 00 999 99.0 99.0  1.90 14.00 99.00 999 9999.0 999.0  15.1 999.0 99.0 99.00",
].join("\n");

describe("parseNdbcStdmet", () => {
  it("reads the #YY header, skips the units row and nulls sentinel values", () => {
    const rows = parseNdbcStdmet(MODERN);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      timeUtcMs: Date.UTC(2024, 0, 1, 0, 26),
      waveHeightM: 0.22,
      dominantPeriodS: null,
      meanWaveDirDeg: null,
      waterTempC: 19.5,
      windDirDeg: null,
      windSpeedMs: null,
    });
    expect(rows[1]).toMatchObject({
      dominantPeriodS: 11,
      meanWaveDirDeg: 87,
      windDirDeg: 352,
      windSpeedMs: 0.2,
    });
  });

  it("maps the legacy YYYY/WD/BAR header", () => {
    expect(parseNdbcStdmet(LEGACY)).toEqual([
      {
        timeUtcMs: Date.UTC(2006, 0, 1, 0, 0),
        waveHeightM: 1.9,
        dominantPeriodS: 14,
        meanWaveDirDeg: null,
        waterTempC: 15.1,
        windDirDeg: null,
        windSpeedMs: null,
      },
    ]);
  });

  it("treats MM as missing and skips rows with broken time fields", () => {
    const text = [
      "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS  TIDE",
      "2024 02 01 05 00 MM   MM   MM   1.20   MM    MM  MM    MM     MM    MM    MM   MM   MM",
      "2024 xx 01 06 00 999 99.0 99.0  1.30 99.00 99.00 999 9999.0 999.0 999.0 999.0 99.0 99.00",
    ].join("\n");

    expect(parseNdbcStdmet(text)).toEqual([
      {
        timeUtcMs: Date.UTC(2024, 1, 1, 5, 0),
        waveHeightM: 1.2,
        dominantPeriodS: null,
        meanWaveDirDeg: null,
        waterTempC: null,
        windDirDeg: null,
        windSpeedMs: null,
      },
    ]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `yarn test:unit __tests__/lib/climatology/parse-ndbc.test.ts`
Expected: FAIL, "Cannot find module '@/lib/climatology/parse-ndbc'".

- [ ] **Step 4: Implement the NDBC parser**

```ts
// lib/climatology/parse-ndbc.ts
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
```

- [ ] **Step 5: Run the NDBC test to confirm it passes**

Run: `yarn test:unit __tests__/lib/climatology/parse-ndbc.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the failing ASOS parser test**

```ts
// __tests__/lib/climatology/parse-iem-asos.test.ts
import { parseIemAsosCsv } from "@/lib/climatology/parse-iem-asos";

describe("parseIemAsosCsv", () => {
  it("reads UTC rows and treats M as missing", () => {
    const csv = [
      "station,valid,drct,sknt",
      "SNA,2024-07-01 00:53,190.00,4.00",
      "SNA,2024-07-01 01:53,M,0.00",
      "SNA,2024-07-01 02:53,130.00,M",
      "SNA,not-a-time,130.00,5.00",
    ].join("\n");

    expect(parseIemAsosCsv(csv)).toEqual([
      { timeUtcMs: Date.UTC(2024, 6, 1, 0, 53), windDirDeg: 190, windSpeedKt: 4 },
      { timeUtcMs: Date.UTC(2024, 6, 1, 1, 53), windDirDeg: null, windSpeedKt: 0 },
      { timeUtcMs: Date.UTC(2024, 6, 1, 2, 53), windDirDeg: 130, windSpeedKt: null },
    ]);
  });

  it("rejects a response without the expected columns", () => {
    expect(() => parseIemAsosCsv("station,valid,tmpf\nSNA,2024-07-01 00:53,70")).toThrow(
      "Unexpected IEM ASOS header",
    );
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `yarn test:unit __tests__/lib/climatology/parse-iem-asos.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 8: Implement the ASOS parser**

```ts
// lib/climatology/parse-iem-asos.ts
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
```

- [ ] **Step 9: Run both parser tests**

Run: `yarn test:unit __tests__/lib/climatology/`
Expected: PASS, 5 tests.

- [ ] **Step 10: Commit**

```bash
git add lib/climatology/types.ts lib/climatology/parse-ndbc.ts lib/climatology/parse-iem-asos.ts __tests__/lib/climatology/parse-ndbc.test.ts __tests__/lib/climatology/parse-iem-asos.test.ts
git commit -m "feat(climatology): parse NDBC and IEM ASOS archives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Hourly series, local time and coverage rules

**Files:**
- Create: `lib/climatology/hourly.ts`
- Create: `lib/climatology/coverage.ts`
- Create: `__tests__/lib/climatology/fixtures/observations.ts` (fixture helper; `/__tests__/fixtures/` is ignored as a suite by `jest.config.js`)
- Test: `__tests__/lib/climatology/hourly-coverage.test.ts`

**Interfaces:**
- Consumes: `NdbcRecord`, `AsosRecord`, `HourlyObservation`, `LocalHourObservation` from Task 1.
- Produces:
  - `hourlyFromNdbc(records: NdbcRecord[]): HourlyObservation[]` (knots converted from m/s)
  - `hourlyFromAsos(records: AsosRecord[]): HourlyObservation[]`
  - `localize(hours: HourlyObservation[], timeZone: string): LocalHourObservation[]`
  - `STATION_MONTH_COVERAGE = 0.7`, `MIN_STATION_MONTHS = 5`, `GATE_COVERAGE = 0.9`
  - `type ValuePicker = (obs: LocalHourObservation) => number | null`
  - `daysInMonth(year: number, month: number): number`
  - `stationMonthKey(year: number, month: number): string` → `"2010-09"`
  - `groupByStationMonth(obs: LocalHourObservation[], years: readonly [number, number]): Map<string, LocalHourObservation[]>`
  - `selectStationMonths(groups: Map<string, LocalHourObservation[]>, month: number, years: readonly [number, number], pick: ValuePicker): { qualifying: LocalHourObservation[][]; excluded: string[] }`
  - `overallCoverage(obs: LocalHourObservation[], years: readonly [number, number], pick: ValuePicker): number`

- [ ] **Step 1: Write the fixture helper**

```ts
// __tests__/lib/climatology/fixtures/observations.ts
import type { HourlyObservation, LocalHourObservation } from "@/lib/climatology/types";

const EMPTY_FIELDS = {
  waveHeightM: null,
  dominantPeriodS: null,
  meanWaveDirDeg: null,
  waterTempC: null,
  windDirDeg: null,
  windSpeedKt: null,
} as const;

type Fields = Partial<Omit<HourlyObservation, "hourUtcMs">>;

/** Every local hour of one month, with fields chosen per day and hour. */
export function localMonth(
  year: number,
  month: number,
  fields: (day: number, hour: number) => Fields,
): LocalHourObservation[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const hours: LocalHourObservation[] = [];
  for (let day = 1; day <= days; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      hours.push({
        hourUtcMs: Date.UTC(year, month - 1, day, hour),
        ...EMPTY_FIELDS,
        ...fields(day, hour),
        year,
        month,
        day,
        hour,
      });
    }
  }
  return hours;
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// __tests__/lib/climatology/hourly-coverage.test.ts
import {
  daysInMonth,
  groupByStationMonth,
  overallCoverage,
  selectStationMonths,
  stationMonthKey,
} from "@/lib/climatology/coverage";
import { hourlyFromAsos, hourlyFromNdbc, localize } from "@/lib/climatology/hourly";
import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";
import { localMonth } from "./fixtures/observations";

const ndbc = (minute: number, fields: Partial<NdbcRecord>): NdbcRecord => ({
  timeUtcMs: Date.UTC(2024, 0, 1, 0, minute),
  waveHeightM: null,
  dominantPeriodS: null,
  meanWaveDirDeg: null,
  waterTempC: null,
  windDirDeg: null,
  windSpeedMs: null,
  ...fields,
});

describe("hourlyFromNdbc", () => {
  it("collapses sub-hourly rows, keeping the first valid value per field", () => {
    const hours = hourlyFromNdbc([
      ndbc(56, { waveHeightM: 0.23, dominantPeriodS: 11 }),
      ndbc(26, { waveHeightM: 0.22 }),
    ]);

    expect(hours).toHaveLength(1);
    expect(hours[0]).toMatchObject({
      hourUtcMs: Date.UTC(2024, 0, 1, 0),
      waveHeightM: 0.22,
      dominantPeriodS: 11,
    });
  });

  it("converts NDBC wind from m/s to knots", () => {
    const [hour] = hourlyFromNdbc([ndbc(0, { windSpeedMs: 10, windDirDeg: 270 })]);
    expect(hour.windSpeedKt).toBeCloseTo(19.4384, 4);
    expect(hour.windDirDeg).toBe(270);
  });
});

describe("hourlyFromAsos", () => {
  it("floors :53 observations to their hour", () => {
    const [hour] = hourlyFromAsos([
      { timeUtcMs: Date.UTC(2024, 6, 1, 0, 53), windDirDeg: 190, windSpeedKt: 4 },
    ]);
    expect(hour).toMatchObject({ hourUtcMs: Date.UTC(2024, 6, 1, 0), windDirDeg: 190, windSpeedKt: 4 });
  });
});

describe("localize", () => {
  const base = {
    waveHeightM: null,
    dominantPeriodS: null,
    meanWaveDirDeg: null,
    waterTempC: null,
    windDirDeg: null,
    windSpeedKt: null,
  };
  const at = (utcMs: number, zone: string) => localize([{ hourUtcMs: utcMs, ...base }], zone)[0];

  it("puts early-January UTC hours in the previous local year for Los Angeles", () => {
    expect(at(Date.UTC(2025, 0, 1, 3), "America/Los_Angeles")).toMatchObject({
      year: 2024,
      month: 12,
      day: 31,
      hour: 19,
    });
  });

  it("follows the March DST jump", () => {
    expect(at(Date.UTC(2025, 2, 9, 9), "America/Los_Angeles").hour).toBe(1);
    expect(at(Date.UTC(2025, 2, 9, 10), "America/Los_Angeles").hour).toBe(3);
  });

  it("reports midnight as hour 0, not 24", () => {
    expect(at(Date.UTC(2025, 0, 1, 5), "America/New_York")).toMatchObject({ day: 1, hour: 0 });
  });

  it("has no DST in Honolulu", () => {
    expect(at(Date.UTC(2025, 6, 1, 0), "Pacific/Honolulu")).toMatchObject({ month: 6, day: 30, hour: 14 });
  });
});

describe("coverage rules", () => {
  it("counts leap-year February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(stationMonthKey(2010, 9)).toBe("2010-09");
  });

  it("keeps a station-month at 70% coverage and drops it just below", () => {
    // 29 days x 24 h = 696 hours; 70% is 487.2 hours.
    const withValid = (validHours: number) =>
      localMonth(2024, 2, (day, hour) => ({
        waveHeightM: (day - 1) * 24 + hour < validHours ? 1 : null,
      }));
    const pick = (o: { waveHeightM: number | null }) => o.waveHeightM;

    const passing = selectStationMonths(groupByStationMonth(withValid(488), [2024, 2024]), 2, [2024, 2024], pick);
    expect(passing.qualifying).toHaveLength(1);
    expect(passing.excluded).toEqual([]);

    const failing = selectStationMonths(groupByStationMonth(withValid(487), [2024, 2024]), 2, [2024, 2024], pick);
    expect(failing.qualifying).toHaveLength(0);
    expect(failing.excluded).toEqual(["2024-02"]);
  });

  it("lists a missing year as an excluded station-month", () => {
    const groups = groupByStationMonth(localMonth(2023, 2, () => ({ waveHeightM: 1 })), [2023, 2024]);
    const result = selectStationMonths(groups, 2, [2023, 2024], (o) => o.waveHeightM);
    expect(result.qualifying).toHaveLength(1);
    expect(result.excluded).toEqual(["2024-02"]);
  });

  it("measures overall coverage against every hour in the year range", () => {
    const obs = localMonth(2024, 1, () => ({ waveHeightM: 1 }));
    expect(overallCoverage(obs, [2024, 2024], (o) => o.waveHeightM)).toBeCloseTo(744 / 8784, 6);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/hourly-coverage.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `hourly.ts`**

```ts
// lib/climatology/hourly.ts
import type { AsosRecord } from "./parse-iem-asos";
import type { NdbcRecord } from "./parse-ndbc";
import type { HourlyObservation, LocalHourObservation } from "./types";

const HOUR_MS = 3_600_000;
const KNOTS_PER_M_PER_S = 1.94384;

type ObservationField = Exclude<keyof HourlyObservation, "hourUtcMs">;
type FieldValues = Partial<Record<ObservationField, number | null>>;

function emptyHour(hourUtcMs: number): HourlyObservation {
  return {
    hourUtcMs,
    waveHeightM: null,
    dominantPeriodS: null,
    meanWaveDirDeg: null,
    waterTempC: null,
    windDirDeg: null,
    windSpeedKt: null,
  };
}

// Newer NDBC files report every 30 minutes and often leave one of the two
// readings empty, so each field keeps the first valid value in its hour.
function collapse(records: Array<{ timeUtcMs: number; values: FieldValues }>): HourlyObservation[] {
  const byHour = new Map<number, HourlyObservation>();
  const ordered = [...records].sort((a, b) => a.timeUtcMs - b.timeUtcMs);
  for (const record of ordered) {
    const hourUtcMs = Math.floor(record.timeUtcMs / HOUR_MS) * HOUR_MS;
    const hour = byHour.get(hourUtcMs) ?? emptyHour(hourUtcMs);
    for (const [field, value] of Object.entries(record.values) as Array<[ObservationField, number | null | undefined]>) {
      if (hour[field] === null && value !== null && value !== undefined) {
        hour[field] = value;
      }
    }
    byHour.set(hourUtcMs, hour);
  }
  return [...byHour.values()].sort((a, b) => a.hourUtcMs - b.hourUtcMs);
}

export function hourlyFromNdbc(records: NdbcRecord[]): HourlyObservation[] {
  return collapse(
    records.map((record) => ({
      timeUtcMs: record.timeUtcMs,
      values: {
        waveHeightM: record.waveHeightM,
        dominantPeriodS: record.dominantPeriodS,
        meanWaveDirDeg: record.meanWaveDirDeg,
        waterTempC: record.waterTempC,
        windDirDeg: record.windDirDeg,
        windSpeedKt: record.windSpeedMs === null ? null : record.windSpeedMs * KNOTS_PER_M_PER_S,
      },
    })),
  );
}

export function hourlyFromAsos(records: AsosRecord[]): HourlyObservation[] {
  return collapse(
    records.map((record) => ({
      timeUtcMs: record.timeUtcMs,
      values: { windDirDeg: record.windDirDeg, windSpeedKt: record.windSpeedKt },
    })),
  );
}

export function localize(hours: HourlyObservation[], timeZone: string): LocalHourObservation[] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  });
  return hours.map((obs) => {
    const parts = formatter.formatToParts(new Date(obs.hourUtcMs));
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((candidate) => candidate.type === type)?.value);
    return { ...obs, year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
  });
}
```

- [ ] **Step 5: Implement `coverage.ts`**

```ts
// lib/climatology/coverage.ts
import type { LocalHourObservation } from "./types";

export const STATION_MONTH_COVERAGE = 0.7;
export const MIN_STATION_MONTHS = 5;
export const GATE_COVERAGE = 0.9;

export type ValuePicker = (obs: LocalHourObservation) => number | null;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function stationMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function groupByStationMonth(
  obs: LocalHourObservation[],
  years: readonly [number, number],
): Map<string, LocalHourObservation[]> {
  const groups = new Map<string, LocalHourObservation[]>();
  for (const o of obs) {
    if (o.year < years[0] || o.year > years[1]) continue;
    const key = stationMonthKey(o.year, o.month);
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  return groups;
}

export function selectStationMonths(
  groups: Map<string, LocalHourObservation[]>,
  month: number,
  years: readonly [number, number],
  pick: ValuePicker,
): { qualifying: LocalHourObservation[][]; excluded: string[] } {
  const qualifying: LocalHourObservation[][] = [];
  const excluded: string[] = [];
  for (let year = years[0]; year <= years[1]; year += 1) {
    const key = stationMonthKey(year, month);
    const hours = groups.get(key) ?? [];
    const valid = hours.filter((o) => pick(o) !== null).length;
    if (valid / (daysInMonth(year, month) * 24) >= STATION_MONTH_COVERAGE) {
      qualifying.push(hours);
    } else {
      excluded.push(key);
    }
  }
  return { qualifying, excluded };
}

export function overallCoverage(
  obs: LocalHourObservation[],
  years: readonly [number, number],
  pick: ValuePicker,
): number {
  let possible = 0;
  for (let year = years[0]; year <= years[1]; year += 1) {
    for (let month = 1; month <= 12; month += 1) possible += daysInMonth(year, month) * 24;
  }
  const valid = obs.filter((o) => o.year >= years[0] && o.year <= years[1] && pick(o) !== null).length;
  return valid / possible;
}
```

- [ ] **Step 6: Run the tests**

Run: `yarn test:unit __tests__/lib/climatology/hourly-coverage.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/climatology/hourly.ts lib/climatology/coverage.ts __tests__/lib/climatology/fixtures/observations.ts __tests__/lib/climatology/hourly-coverage.test.ts
git commit -m "feat(climatology): bucket hourly observations by local month with coverage rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Monthly wave, water and wind statistics

**Files:**
- Create: `lib/climatology/stats.ts`
- Test: `__tests__/lib/climatology/stats.test.ts`

**Interfaces:**
- Consumes: `LocalHourObservation`, `WaveMonthStats`, `WaterMonthStats`, `WindMonthStats`, `WindBlockStats`, `WindClass`, `Sector`, `SECTORS` (Task 1); `MIN_STATION_MONTHS` (Task 2).
- Produces:
  - constants `M_TO_FT`, `LIGHT_WIND_KT = 6`, `ONSHORE_HALF_WIDTH_DEG = 67.5`, `WIND_BLOCKS = { dawn: [6,7,8], midday: [11,12,13], afternoon: [15,16,17] }`
  - `percentile(values: number[], p: number): number` (nearest rank)
  - `sectorOf(deg: number): Sector`
  - `angularDistance(a: number, b: number): number` (0–180)
  - `classifyWind(dirDeg: number | null, speedKt: number | null, shoreNormalDeg: number): WindClass | null`
  - `waveMonthStats(stationMonths: LocalHourObservation[][]): WaveMonthStats | null`
  - `waterMonthStats(stationMonths: LocalHourObservation[][]): WaterMonthStats | null`
  - `windMonthStats(stationMonths: LocalHourObservation[][], shoreNormalDeg: number): WindMonthStats | null`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/climatology/stats.test.ts
import {
  angularDistance,
  classifyWind,
  percentile,
  sectorOf,
  waterMonthStats,
  waveMonthStats,
  windMonthStats,
} from "@/lib/climatology/stats";
import { localMonth } from "./fixtures/observations";

const YEARS = [2020, 2021, 2022, 2023, 2024];

describe("percentile (nearest rank)", () => {
  it.each([
    [25, 1],
    [50, 2],
    [75, 3],
    [90, 4],
  ])("p%s of [4,1,3,2] is %s", (p, expected) => {
    expect(percentile([4, 1, 3, 2], p)).toBe(expected);
  });
});

describe("sectorOf", () => {
  it.each([
    [0, "N"],
    [22.4, "N"],
    [22.5, "NE"],
    [315, "NW"],
    [337.5, "N"],
    [359, "N"],
    [-45, "NW"],
  ])("%s° is %s", (deg, sector) => {
    expect(sectorOf(deg)).toBe(sector);
  });
});

describe("classifyWind", () => {
  it("classifies relative to Cocoa's 87° shore normal", () => {
    expect(classifyWind(267, 10, 87)).toBe("offshore");
    expect(classifyWind(87, 10, 87)).toBe("onshore");
    expect(classifyWind(177, 10, 87)).toBe("cross");
    expect(classifyWind(154.5, 10, 87)).toBe("onshore");
    expect(classifyWind(0, 3, 87)).toBe("light");
  });

  it("wraps around north for Newport's 217° normal", () => {
    expect(angularDistance(350, 217)).toBe(133);
    expect(angularDistance(10, 217)).toBe(153);
    expect(classifyWind(350, 12, 217)).toBe("offshore");
    expect(classifyWind(10, 12, 217)).toBe("offshore");
    expect(classifyWind(300, 12, 217)).toBe("cross");
  });

  it("returns null when a needed value is missing", () => {
    expect(classifyWind(null, 10, 87)).toBeNull();
    expect(classifyWind(100, null, 87)).toBeNull();
  });
});

describe("waveMonthStats", () => {
  // Days 1-10 are small (0.3 m), days 11-31 are 1.0 m, days 11-13 have four
  // 2.0 m hours before dawn, and days 21-31 carry 12 s swell.
  const januaries = YEARS.map((year) =>
    localMonth(year, 1, (day, hour) => ({
      waveHeightM: day <= 10 ? 0.3 : day <= 13 && hour < 4 ? 2.0 : 1.0,
      dominantPeriodS: day >= 21 ? 12 : 6,
      meanWaveDirDeg: 270,
    })),
  );

  it("summarises height, small and big days, period and direction", () => {
    const stats = waveMonthStats(januaries);

    expect(stats).toEqual({
      hsFt: { median: 3.3, p25: 1, p75: 3.3, p90: 3.3 },
      smallDayShare: 0.32,
      bigDayShare: 0.1,
      periodMix: { under8: 0.65, from8to10: 0, atLeast10: 0.35 },
      directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 1, NW: 0 },
      yearlyMedianFt: YEARS.map((year) => ({ year, medianFt: 3.3 })),
      observedDays: 155,
      validHours: 3720,
      stationMonths: 5,
    });
  });

  it("needs five qualifying station-months", () => {
    expect(waveMonthStats(januaries.slice(0, 4))).toBeNull();
  });

  it("skips a day with fewer than 10 daytime readings", () => {
    const withGap = YEARS.map((year) =>
      localMonth(year, 1, (day, hour) => ({
        waveHeightM: day === 1 && hour >= 6 && hour <= 9 ? null : 1.0,
      })),
    );
    expect(waveMonthStats(withGap)?.observedDays).toBe(150);
  });
});

describe("waterMonthStats", () => {
  it("converts to °F", () => {
    const months = YEARS.map((year) => localMonth(year, 7, () => ({ waterTempC: 20 })));
    expect(waterMonthStats(months)).toEqual({ medianF: 68, p10F: 68, p90F: 68, validHours: 3720 });
  });
});

describe("windMonthStats", () => {
  const pattern = (dawn: number, speed: number) =>
    YEARS.map((year) =>
      localMonth(year, 7, (_day, hour) => {
        if (hour >= 6 && hour <= 8) return { windDirDeg: dawn, windSpeedKt: speed };
        if (hour >= 11 && hour <= 13) return { windDirDeg: 177, windSpeedKt: 10 };
        if (hour >= 15 && hour <= 17) return { windDirDeg: 87, windSpeedKt: 12 };
        return { windDirDeg: 0, windSpeedKt: 3 };
      }),
    );

  it("splits dawn, midday and afternoon and counts clean mornings", () => {
    const stats = windMonthStats(pattern(267, 10), 87);

    expect(stats?.dawn).toEqual({ offshore: 1, cross: 0, onshore: 0, light: 0, medianKt: 10, hours: 465 });
    expect(stats?.midday.cross).toBe(1);
    expect(stats?.afternoon.onshore).toBe(1);
    expect(stats?.cleanMorningShare).toBe(1);
    expect(stats?.observedMornings).toBe(155);
  });

  it("does not count an onshore morning as clean", () => {
    expect(windMonthStats(pattern(87, 8), 87)?.cleanMorningShare).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/stats.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `stats.ts`**

```ts
// lib/climatology/stats.ts
import { MIN_STATION_MONTHS } from "./coverage";
import {
  SECTORS,
  type LocalHourObservation,
  type Sector,
  type WaterMonthStats,
  type WaveMonthStats,
  type WindBlockStats,
  type WindClass,
  type WindMonthStats,
} from "./types";

export const M_TO_FT = 3.28084;
export const LIGHT_WIND_KT = 6;
export const ONSHORE_HALF_WIDTH_DEG = 67.5;
export const WIND_BLOCKS = {
  dawn: [6, 7, 8],
  midday: [11, 12, 13],
  afternoon: [15, 16, 17],
} as const;

const SMALL_DAY_FT = 2;
const BIG_DAY_FT = 6;
const BIG_DAY_MIN_HOURS = 3;
const DAYTIME_FIRST_HOUR = 6;
const DAYTIME_LAST_HOUR = 18;
const MIN_DAYTIME_HOURS = 10; // 70% of the 13 daytime hours
const MIN_MORNING_HOURS = 2;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const share = (count: number, total: number): number => (total === 0 ? 0 : round2(count / total));

export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("percentile of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function sectorOf(deg: number): Sector {
  const normalized = ((deg % 360) + 360) % 360;
  return SECTORS[Math.round(normalized / 45) % SECTORS.length];
}

export function angularDistance(a: number, b: number): number {
  const diff = (((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Wind direction is where it blows from; the shore normal points out to sea. */
export function classifyWind(
  dirDeg: number | null,
  speedKt: number | null,
  shoreNormalDeg: number,
): WindClass | null {
  if (speedKt === null) return null;
  if (speedKt < LIGHT_WIND_KT) return "light";
  if (dirDeg === null) return null;
  const fromNormal = angularDistance(dirDeg, shoreNormalDeg);
  if (fromNormal <= ONSHORE_HALF_WIDTH_DEG) return "onshore";
  if (fromNormal >= 180 - ONSHORE_HALF_WIDTH_DEG) return "offshore";
  return "cross";
}

function values(hours: LocalHourObservation[], pick: (o: LocalHourObservation) => number | null): number[] {
  return hours.flatMap((o) => {
    const value = pick(o);
    return value === null ? [] : [value];
  });
}

function groupByDay(hours: LocalHourObservation[]): LocalHourObservation[][] {
  const days = new Map<string, LocalHourObservation[]>();
  for (const hour of hours) {
    const key = `${hour.year}-${hour.month}-${hour.day}`;
    const list = days.get(key) ?? [];
    list.push(hour);
    days.set(key, list);
  }
  return [...days.values()];
}

const heightFt = (o: LocalHourObservation): number | null =>
  o.waveHeightM === null ? null : o.waveHeightM * M_TO_FT;

export function waveMonthStats(stationMonths: LocalHourObservation[][]): WaveMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const hours = stationMonths.flat();
  const heights = values(hours, heightFt);
  if (heights.length === 0) return null;

  let observedDays = 0;
  let smallDays = 0;
  let bigDays = 0;
  for (const month of stationMonths) {
    for (const day of groupByDay(month)) {
      const daytime = values(
        day.filter((o) => o.hour >= DAYTIME_FIRST_HOUR && o.hour <= DAYTIME_LAST_HOUR),
        heightFt,
      );
      if (daytime.length < MIN_DAYTIME_HOURS) continue;
      observedDays += 1;
      if (percentile(daytime, 50) < SMALL_DAY_FT) smallDays += 1;
      if (values(day, heightFt).filter((ft) => ft >= BIG_DAY_FT).length >= BIG_DAY_MIN_HOURS) bigDays += 1;
    }
  }

  const periods = values(hours, (o) => o.dominantPeriodS);
  const directions = values(hours, (o) => o.meanWaveDirDeg);
  const directionMix = Object.fromEntries(
    SECTORS.map((sector) => [sector, share(directions.filter((d) => sectorOf(d) === sector).length, directions.length)]),
  ) as Record<Sector, number>;

  return {
    hsFt: {
      median: round1(percentile(heights, 50)),
      p25: round1(percentile(heights, 25)),
      p75: round1(percentile(heights, 75)),
      p90: round1(percentile(heights, 90)),
    },
    smallDayShare: share(smallDays, observedDays),
    bigDayShare: share(bigDays, observedDays),
    periodMix: {
      under8: share(periods.filter((p) => p < 8).length, periods.length),
      from8to10: share(periods.filter((p) => p >= 8 && p < 10).length, periods.length),
      atLeast10: share(periods.filter((p) => p >= 10).length, periods.length),
    },
    directionMix,
    yearlyMedianFt: stationMonths.map((month) => ({
      year: month[0].year,
      medianFt: round1(percentile(values(month, heightFt), 50)),
    })),
    observedDays,
    validHours: heights.length,
    stationMonths: stationMonths.length,
  };
}

export function waterMonthStats(stationMonths: LocalHourObservation[][]): WaterMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const temps = values(stationMonths.flat(), (o) => (o.waterTempC === null ? null : (o.waterTempC * 9) / 5 + 32));
  if (temps.length === 0) return null;
  return {
    medianF: Math.round(percentile(temps, 50)),
    p10F: Math.round(percentile(temps, 10)),
    p90F: Math.round(percentile(temps, 90)),
    validHours: temps.length,
  };
}

function blockStats(hours: LocalHourObservation[], blockHours: readonly number[], shoreNormalDeg: number): WindBlockStats {
  const inBlock = hours.filter((o) => blockHours.includes(o.hour));
  const classes = inBlock.flatMap((o) => {
    const windClass = classifyWind(o.windDirDeg, o.windSpeedKt, shoreNormalDeg);
    return windClass === null ? [] : [windClass];
  });
  const speeds = values(inBlock, (o) => o.windSpeedKt);
  const count = (target: WindClass) => classes.filter((c) => c === target).length;
  return {
    offshore: share(count("offshore"), classes.length),
    cross: share(count("cross"), classes.length),
    onshore: share(count("onshore"), classes.length),
    light: share(count("light"), classes.length),
    medianKt: speeds.length === 0 ? 0 : Math.round(percentile(speeds, 50)),
    hours: classes.length,
  };
}

// A morning is clean when its mean wind is light, or its speed-weighted mean
// direction is offshore.
function isCleanMorning(morning: LocalHourObservation[], shoreNormalDeg: number): boolean | null {
  const readings = morning.filter((o) => o.windSpeedKt !== null);
  if (readings.length < MIN_MORNING_HOURS) return null;
  const meanSpeed = readings.reduce((sum, o) => sum + (o.windSpeedKt ?? 0), 0) / readings.length;
  if (meanSpeed < LIGHT_WIND_KT) return true;

  const directional = readings.filter((o) => o.windDirDeg !== null);
  if (directional.length === 0) return null;
  let east = 0;
  let north = 0;
  for (const o of directional) {
    const radians = ((o.windDirDeg ?? 0) * Math.PI) / 180;
    east += (o.windSpeedKt ?? 0) * Math.sin(radians);
    north += (o.windSpeedKt ?? 0) * Math.cos(radians);
  }
  const meanDir = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return classifyWind(meanDir, meanSpeed, shoreNormalDeg) === "offshore";
}

export function windMonthStats(
  stationMonths: LocalHourObservation[][],
  shoreNormalDeg: number,
): WindMonthStats | null {
  if (stationMonths.length < MIN_STATION_MONTHS) return null;
  const hours = stationMonths.flat();

  let observedMornings = 0;
  let cleanMornings = 0;
  for (const month of stationMonths) {
    for (const day of groupByDay(month)) {
      const clean = isCleanMorning(
        day.filter((o) => (WIND_BLOCKS.dawn as readonly number[]).includes(o.hour)),
        shoreNormalDeg,
      );
      if (clean === null) continue;
      observedMornings += 1;
      if (clean) cleanMornings += 1;
    }
  }

  return {
    dawn: blockStats(hours, WIND_BLOCKS.dawn, shoreNormalDeg),
    midday: blockStats(hours, WIND_BLOCKS.midday, shoreNormalDeg),
    afternoon: blockStats(hours, WIND_BLOCKS.afternoon, shoreNormalDeg),
    cleanMorningShare: share(cleanMornings, observedMornings),
    observedMornings,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `yarn test:unit __tests__/lib/climatology/stats.test.ts`
Expected: PASS. If the `waveMonthStats` expectation differs, recompute by hand from the fixture comment before touching the implementation: 744 hours per month, 240 at 0.98 ft, 492 at 3.28 ft, 12 at 6.56 ft; median rank 372 → 3.3 ft; p25 rank 186 → 1.0 ft.

- [ ] **Step 5: Commit**

```bash
git add lib/climatology/stats.ts __tests__/lib/climatology/stats.test.ts
git commit -m "feat(climatology): compute monthly wave, water and wind statistics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Buoy score v1 and peak band

**Files:**
- Create: `lib/climatology/score.ts`
- Test: `__tests__/lib/climatology/score.test.ts`

**Interfaces:**
- Consumes: `ClimatologyMonth` (Task 1); `waterTempComfortScore(tempF: number): number` from `lib/utils/surf-score-utils.ts`.
- Produces:
  - `BUOY_SCORE_VERSION = "buoy-v1"`, `BUOY_SCORE_WEIGHTS`, `PEAK_BAND_POINTS = 10`
  - `computeBuoyScore(input: { surfDayShare: number; groundswellShare: number; cleanMorningShare: number | null; waterMedianF: number }): number`
  - `scoreMonth(month: Omit<ClimatologyMonth, "score">, cityHasWind: boolean): number | null`
  - `derivePeak(months: Array<{ month: number; score: number | null }>): { peakMonth: number | null; peakBand: number[] }`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/climatology/score.test.ts
import { computeBuoyScore, derivePeak, scoreMonth } from "@/lib/climatology/score";

describe("computeBuoyScore (buoy-v1)", () => {
  // waterTempComfortScore(70) = round(70 + 5/13 * 30) = 82
  it("weights surf days, groundswell, clean mornings and water", () => {
    // 100 x (0.45*0.8 + 0.25*0.24 + 0.20*0.5 + 0.10*0.82) = 60.2
    expect(
      computeBuoyScore({ surfDayShare: 0.8, groundswellShare: 0.24, cleanMorningShare: 0.5, waterMedianF: 70 }),
    ).toBe(60);
  });

  it("rescales the other three parts when a city has no wind record", () => {
    // 100 x (0.36 + 0.06 + 0.082) / 0.8 = 62.75
    expect(
      computeBuoyScore({ surfDayShare: 0.8, groundswellShare: 0.24, cleanMorningShare: null, waterMedianF: 70 }),
    ).toBe(63);
  });
});

describe("scoreMonth", () => {
  const waves = {
    hsFt: { median: 3, p25: 2, p75: 4, p90: 5 },
    smallDayShare: 0.2,
    bigDayShare: 0.05,
    periodMix: { under8: 0.5, from8to10: 0.26, atLeast10: 0.24 },
    directionMix: { N: 0, NE: 0, E: 1, SE: 0, S: 0, SW: 0, W: 0, NW: 0 },
    yearlyMedianFt: [],
    observedDays: 150,
    validHours: 3600,
    stationMonths: 5,
  };
  const water = { medianF: 70, p10F: 68, p90F: 72, validHours: 3600 };
  const wind = {
    dawn: { offshore: 0.5, cross: 0, onshore: 0, light: 0.5, medianKt: 5, hours: 450 },
    midday: { offshore: 0, cross: 1, onshore: 0, light: 0, medianKt: 10, hours: 450 },
    afternoon: { offshore: 0, cross: 0, onshore: 1, light: 0, medianKt: 12, hours: 450 },
    cleanMorningShare: 0.5,
    observedMornings: 150,
  };

  it("uses 1 - smallDayShare as the surf-day share", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind }, true)).toBe(60);
  });

  it("returns null when waves or water are missing", () => {
    expect(scoreMonth({ month: 1, waves: null, comparisonWaves: null, water, wind }, true)).toBeNull();
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water: null, wind }, true)).toBeNull();
  });

  it("returns null when a wind city is missing that month's wind", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind: null }, true)).toBeNull();
  });

  it("ignores wind for a city without a wind source", () => {
    expect(scoreMonth({ month: 1, waves, comparisonWaves: null, water, wind }, false)).toBe(63);
  });
});

describe("derivePeak", () => {
  const scores = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];
  const months = scores.map((score, index) => ({ month: index + 1, score }));

  it("picks the top month and every month within 10 points", () => {
    expect(derivePeak(months)).toEqual({ peakMonth: 10, peakBand: [9, 10, 11] });
  });

  it("breaks ties toward the earlier month and skips nulls", () => {
    expect(
      derivePeak([
        { month: 1, score: null },
        { month: 2, score: 70 },
        { month: 3, score: 70 },
      ]),
    ).toEqual({ peakMonth: 2, peakBand: [2, 3] });
  });

  it("returns no peak when nothing scored", () => {
    expect(derivePeak([{ month: 1, score: null }])).toEqual({ peakMonth: null, peakBand: [] });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/score.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `score.ts`**

```ts
// lib/climatology/score.ts
import { waterTempComfortScore } from "@/lib/utils/surf-score-utils";
import type { ClimatologyMonth } from "./types";

export const BUOY_SCORE_VERSION = "buoy-v1" as const;
export const BUOY_SCORE_WEIGHTS = {
  surfDays: 0.45,
  groundswell: 0.25,
  cleanMornings: 0.2,
  waterComfort: 0.1,
} as const;
export const PEAK_BAND_POINTS = 10;

export interface BuoyScoreInput {
  surfDayShare: number;
  groundswellShare: number;
  cleanMorningShare: number | null;
  waterMedianF: number;
}

export function computeBuoyScore(input: BuoyScoreInput): number {
  const weights = BUOY_SCORE_WEIGHTS;
  const water = waterTempComfortScore(input.waterMedianF) / 100;
  const base =
    weights.surfDays * input.surfDayShare +
    weights.groundswell * input.groundswellShare +
    weights.waterComfort * water;

  if (input.cleanMorningShare === null) {
    return Math.round((100 * base) / (1 - weights.cleanMornings));
  }
  return Math.round(100 * (base + weights.cleanMornings * input.cleanMorningShare));
}

export function scoreMonth(month: Omit<ClimatologyMonth, "score">, cityHasWind: boolean): number | null {
  if (!month.waves || !month.water) return null;
  if (cityHasWind && !month.wind) return null;
  return computeBuoyScore({
    surfDayShare: 1 - month.waves.smallDayShare,
    groundswellShare: month.waves.periodMix.atLeast10,
    cleanMorningShare: cityHasWind && month.wind ? month.wind.cleanMorningShare : null,
    waterMedianF: month.water.medianF,
  });
}

export function derivePeak(
  months: Array<{ month: number; score: number | null }>,
): { peakMonth: number | null; peakBand: number[] } {
  let peak: { month: number; score: number } | null = null;
  for (const entry of months) {
    if (entry.score === null) continue;
    if (peak === null || entry.score > peak.score) peak = { month: entry.month, score: entry.score };
  }
  if (peak === null) return { peakMonth: null, peakBand: [] };

  const floor = peak.score - PEAK_BAND_POINTS;
  return {
    peakMonth: peak.month,
    peakBand: months.filter((entry) => entry.score !== null && entry.score >= floor).map((entry) => entry.month),
  };
}
```

- [ ] **Step 4: Run the test**

Run: `yarn test:unit __tests__/lib/climatology/score.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/climatology/score.ts __tests__/lib/climatology/score.test.ts
git commit -m "feat(climatology): add buoy score v1 and peak band

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sources, dataset assembly, CSV, and the build run

**Files:**
- Create: `lib/climatology/geo.ts`
- Create: `lib/climatology/sources.ts`
- Create: `lib/climatology/build-dataset.ts`
- Create: `lib/climatology/csv.ts`
- Create: `scripts/climatology/build-surf-climatology.ts`
- Modify: `.gitignore` (add `/.cache/`)
- Modify: `__tests__/lib/climatology/fixtures/observations.ts` (add `utcHours`)
- Test: `__tests__/lib/climatology/geo-sources.test.ts`
- Test: `__tests__/lib/climatology/build-dataset.test.ts`
- Generated and committed: `lib/data/surf-climatology/{cocoa-beach,newport-beach,honolulu}.json`, `public/data/surf-climatology/{cocoa-beach,newport-beach,honolulu}.csv`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `haversineKm(a: {lat:number; lon:number}, b: {lat:number; lon:number}): number`, `bearingDeg(from, to): number`, `seawardNormalDeg(from, to, seaSide: "left" | "right"): number`
  - `interface ClimatologySourceConfig { id: string; alias: string | null; name: string; role: ClimatologyRole; kind: SourceKind; lat: number; lon: number; years: readonly [number, number]; pageUrl: string }`
  - `interface CityClimatologyConfig { citySlug: string; cityName: string; timezone: string; reference: ClimatologyPlace; places: ClimatologyPlace[]; shoreNormalDeg: number | null; sources: ClimatologySourceConfig[] }`
  - `CITY_CLIMATOLOGY_CONFIGS: readonly CityClimatologyConfig[]`
  - `SEA_BREEZE_MIN_LIFT = 0.2`, `seaBreezeLift(obs: LocalHourObservation[], shoreNormalDeg: number): number`
  - `buildSurfClimatologyDataset(input: { city: CityClimatologyConfig; series: Array<{ source: ClimatologySourceConfig; hourly: HourlyObservation[] }>; generatedAt: string }): SurfClimatologyDataset`
  - `datasetToCsv(dataset: SurfClimatologyDataset): string`

- [ ] **Step 1: Write the failing geo and sources test**

```ts
// __tests__/lib/climatology/geo-sources.test.ts
import { haversineKm, seawardNormalDeg } from "@/lib/climatology/geo";
import { CITY_CLIMATOLOGY_CONFIGS } from "@/lib/climatology/sources";

const config = (slug: string) => {
  const found = CITY_CLIMATOLOGY_CONFIGS.find((city) => city.citySlug === slug);
  if (!found) throw new Error(`missing ${slug}`);
  return found;
};

describe("geo helpers", () => {
  it("measures the Cape Canaveral buoy's distance to Cocoa Beach Pier", () => {
    expect(haversineKm({ lat: 28.4, lon: -80.533 }, { lat: 28.367648, lon: -80.602777 })).toBeCloseTo(7.72, 1);
  });

  it("derives shore normals from the coastline", () => {
    expect(
      seawardNormalDeg({ lat: 28.367648, lon: -80.602777 }, { lat: 28.1707, lon: -80.5913 }, "left"),
    ).toBeCloseTo(87.1, 0);
    expect(
      seawardNormalDeg({ lat: 33.655093, lon: -118.004193 }, { lat: 33.607328, lon: -117.928942 }, "right"),
    ).toBeCloseTo(217.3, 0);
  });
});

describe("CITY_CLIMATOLOGY_CONFIGS", () => {
  it("configures the three data-backed cities", () => {
    expect(CITY_CLIMATOLOGY_CONFIGS.map((city) => city.citySlug)).toEqual([
      "cocoa-beach",
      "newport-beach",
      "honolulu",
    ]);
    expect(config("cocoa-beach").shoreNormalDeg).toBe(87);
    expect(config("newport-beach").shoreNormalDeg).toBe(217);
    expect(config("honolulu").shoreNormalDeg).toBeNull();
  });

  it("gives Newport's comparison buoy the same years as its primary buoy", () => {
    const sources = config("newport-beach").sources;
    const primary = sources.find((source) => source.role === "waves");
    const comparison = sources.find((source) => source.role === "comparison-waves");
    expect(comparison?.years).toEqual(primary?.years);
  });

  it("requires a shore normal wherever a wind source is configured", () => {
    for (const city of CITY_CLIMATOLOGY_CONFIGS) {
      if (city.sources.some((source) => source.role === "wind")) {
        expect(city.shoreNormalDeg).not.toBeNull();
      }
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/geo-sources.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `geo.ts`**

```ts
// lib/climatology/geo.ts
interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

export function haversineKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function bearingDeg(from: Point, to: Point): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Direction the beach faces, from two points along the shoreline and which side the sea is on. */
export function seawardNormalDeg(from: Point, to: Point, seaSide: "left" | "right"): number {
  const turn = seaSide === "right" ? 90 : -90;
  return (bearingDeg(from, to) + turn + 360) % 360;
}
```

- [ ] **Step 4: Implement `sources.ts`**

```ts
// lib/climatology/sources.ts
import { seawardNormalDeg } from "./geo";
import type { ClimatologyPlace, ClimatologyRole, SourceKind } from "./types";

export interface ClimatologySourceConfig {
  id: string;
  alias: string | null;
  name: string;
  role: ClimatologyRole;
  kind: SourceKind;
  lat: number;
  lon: number;
  years: readonly [number, number];
  pageUrl: string;
}

export interface CityClimatologyConfig {
  citySlug: string;
  cityName: string;
  timezone: string;
  reference: ClimatologyPlace;
  places: ClimatologyPlace[];
  shoreNormalDeg: number | null;
  sources: ClimatologySourceConfig[];
}

// Pier and Doheny coordinates are from Wikipedia. Cocoa Beach Pier and
// Satellite Beach are from the beaches seed in
// supabase/migrations/20251207000001_add_southeast_gulf_beaches.sql.
const COCOA_BEACH_PIER: ClimatologyPlace = { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 };
const SATELLITE_BEACH: ClimatologyPlace = { label: "Satellite Beach", lat: 28.1707, lon: -80.5913 };
const NEWPORT_PIER: ClimatologyPlace = { label: "Newport Pier", lat: 33.607328, lon: -117.928942 };
const HUNTINGTON_BEACH_PIER: ClimatologyPlace = { label: "Huntington Beach Pier", lat: 33.655093, lon: -118.004193 };
const DOHENY_STATE_BEACH: ClimatologyPlace = { label: "Doheny State Beach", lat: 33.460833, lon: -117.678056 };
const WAIKIKI: ClimatologyPlace = { label: "Waikīkī", lat: 21.2766, lon: -157.8269 };

// Station positions are the current NDBC deployment coordinates.
const ndbcPage = (id: string): string =>
  `https://www.ndbc.noaa.gov/station_page.php?station=${id.toLowerCase()}`;

export const CITY_CLIMATOLOGY_CONFIGS: readonly CityClimatologyConfig[] = [
  {
    citySlug: "cocoa-beach",
    cityName: "Cocoa Beach",
    timezone: "America/New_York",
    reference: COCOA_BEACH_PIER,
    places: [COCOA_BEACH_PIER, SATELLITE_BEACH],
    // Walking south from the pier to Satellite Beach, the sea is on the left.
    shoreNormalDeg: Math.round(seawardNormalDeg(COCOA_BEACH_PIER, SATELLITE_BEACH, "left")),
    sources: [
      {
        id: "41113",
        alias: "CDIP 143",
        name: "Cape Canaveral Nearshore",
        role: "waves",
        kind: "ndbc",
        lat: 28.4,
        lon: -80.533,
        years: [2007, 2025],
        pageUrl: ndbcPage("41113"),
      },
      {
        id: "TRDF1",
        alias: "CO-OPS 8721604",
        name: "Trident Pier",
        role: "wind",
        kind: "ndbc",
        lat: 28.416,
        lon: -80.593,
        years: [2007, 2025],
        pageUrl: ndbcPage("trdf1"),
      },
    ],
  },
  {
    citySlug: "newport-beach",
    cityName: "Newport Beach",
    timezone: "America/Los_Angeles",
    reference: NEWPORT_PIER,
    places: [NEWPORT_PIER, HUNTINGTON_BEACH_PIER, DOHENY_STATE_BEACH],
    // Walking southeast from Huntington to Newport, the sea is on the right.
    shoreNormalDeg: Math.round(seawardNormalDeg(HUNTINGTON_BEACH_PIER, NEWPORT_PIER, "right")),
    sources: [
      {
        id: "46253",
        alias: "CDIP 213",
        name: "San Pedro South",
        role: "waves",
        kind: "ndbc",
        lat: 33.576,
        lon: -118.182,
        years: [2015, 2025],
        pageUrl: ndbcPage("46253"),
      },
      {
        // Same years as San Pedro South so the comparison covers one period.
        id: "46224",
        alias: "CDIP 045",
        name: "Oceanside Offshore",
        role: "comparison-waves",
        kind: "ndbc",
        lat: 33.178,
        lon: -117.472,
        years: [2015, 2025],
        pageUrl: ndbcPage("46224"),
      },
      {
        id: "SNA",
        alias: null,
        name: "John Wayne Airport",
        role: "wind",
        kind: "iem-asos",
        lat: 33.6757,
        lon: -117.8682,
        years: [2015, 2025],
        pageUrl: "https://mesonet.agron.iastate.edu/sites/site.php?station=SNA&network=CA_ASOS",
      },
    ],
  },
  {
    citySlug: "honolulu",
    cityName: "Honolulu",
    timezone: "Pacific/Honolulu",
    reference: WAIKIKI,
    places: [WAIKIKI],
    shoreNormalDeg: null,
    sources: [
      {
        id: "51211",
        alias: "CDIP 233",
        name: "Pearl Harbor Entrance",
        role: "waves",
        kind: "ndbc",
        lat: 21.297,
        lon: -157.959,
        years: [2017, 2025],
        pageUrl: ndbcPage("51211"),
      },
    ],
  },
];
```

- [ ] **Step 5: Run the geo and sources test**

Run: `yarn test:unit __tests__/lib/climatology/geo-sources.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Add `utcHours` to the fixture helper**

Append to `__tests__/lib/climatology/fixtures/observations.ts`:

```ts
/** Every UTC hour from 1 January of the first year to 31 December of the last. */
export function utcHours(
  years: readonly [number, number],
  fields: (date: Date) => Fields,
): HourlyObservation[] {
  const hours: HourlyObservation[] = [];
  const end = Date.UTC(years[1] + 1, 0, 1);
  for (let t = Date.UTC(years[0], 0, 1); t < end; t += 3_600_000) {
    hours.push({ hourUtcMs: t, ...EMPTY_FIELDS, ...fields(new Date(t)) });
  }
  return hours;
}
```

- [ ] **Step 7: Write the failing dataset and CSV test**

```ts
// __tests__/lib/climatology/build-dataset.test.ts
import { buildSurfClimatologyDataset } from "@/lib/climatology/build-dataset";
import { datasetToCsv } from "@/lib/climatology/csv";
import type { CityClimatologyConfig, ClimatologySourceConfig } from "@/lib/climatology/sources";
import { utcHours } from "./fixtures/observations";

const YEARS = [2020, 2024] as const;
const source = (id: string, role: ClimatologySourceConfig["role"]): ClimatologySourceConfig => ({
  id,
  alias: null,
  name: `Station ${id}`,
  role,
  kind: "ndbc",
  lat: 28.4,
  lon: -80.533,
  years: YEARS,
  pageUrl: `https://example.test/${id}`,
});

const CITY: CityClimatologyConfig = {
  citySlug: "test-beach",
  cityName: "Test Beach",
  timezone: "Etc/UTC",
  reference: { label: "Test Pier", lat: 28.367648, lon: -80.602777 },
  places: [{ label: "Test Pier", lat: 28.367648, lon: -80.602777 }],
  shoreNormalDeg: 90,
  sources: [source("W1", "waves"), source("C1", "comparison-waves"), source("WIND1", "wind")],
};

// 1.0 m all the time, 12 s swell on days divisible by 3, 24 °C water.
const waves = utcHours(YEARS, (date) => ({
  waveHeightM: 1,
  dominantPeriodS: date.getUTCDate() % 3 === 0 ? 12 : 6,
  meanWaveDirDeg: 90,
  waterTempC: 24,
}));
// Only the first two weeks of each month: fails the 90% gate.
const patchyComparison = utcHours(YEARS, (date) => ({
  waveHeightM: date.getUTCDate() <= 14 ? 1 : null,
}));
// Offshore dawn, onshore afternoon: a clear sea breeze.
const seaBreezeWind = utcHours(YEARS, (date) => {
  const hour = date.getUTCHours();
  if (hour >= 6 && hour <= 8) return { windDirDeg: 270, windSpeedKt: 10 };
  if (hour >= 15 && hour <= 17) return { windDirDeg: 90, windSpeedKt: 12 };
  return { windDirDeg: 0, windSpeedKt: 3 };
});
const flatWind = utcHours(YEARS, () => ({ windDirDeg: 270, windSpeedKt: 10 }));

const build = (wind = seaBreezeWind) =>
  buildSurfClimatologyDataset({
    city: CITY,
    generatedAt: "2026-09-26",
    series: [
      { source: CITY.sources[0], hourly: waves },
      { source: CITY.sources[1], hourly: patchyComparison },
      { source: CITY.sources[2], hourly: wind },
    ],
  });

// Five years of hourly data per source; build each variant once.
const SEA_BREEZE_DATASET = build();
const FLAT_WIND_DATASET = build(flatWind);

describe("buildSurfClimatologyDataset", () => {
  it("gates each station and scores every month", () => {
    const dataset = SEA_BREEZE_DATASET;

    expect(dataset.stations.map((s) => [s.id, s.gate])).toEqual([
      ["W1", "passed"],
      ["C1", "failed"],
      ["WIND1", "passed"],
    ]);
    expect(dataset.stations[0]).toMatchObject({ distanceKm: 7.7, referenceLabel: "Test Pier", yearsUsed: [2020, 2024] });
    expect(dataset.months).toHaveLength(12);
    expect(dataset.months.every((m) => m.comparisonWaves === null)).toBe(true);
    expect(dataset.months[0].water?.medianF).toBe(75);
    expect(dataset.months[0].wind?.cleanMorningShare).toBe(1);
    // 100 x (0.45 x 1 + 0.25 x 0.32 + 0.20 x 1 + 0.10 x 0.93) = 82.3
    expect(dataset.months[0].score).toBe(82);
  });

  it("drops wind and rescales the score when the wind shows no sea breeze", () => {
    const dataset = FLAT_WIND_DATASET;

    expect(dataset.stations[2].gate).toBe("failed");
    expect(dataset.months[0].wind).toBeNull();
    // 100 x (0.45 + 0.08 + 0.093) / 0.8 = 77.9
    expect(dataset.months[0].score).toBe(78);
  });

  it("stops when the primary buoy fails its gate", () => {
    const patchyWaves = utcHours(YEARS, (date) => ({ waveHeightM: date.getUTCDate() <= 10 ? 1 : null }));
    expect(() =>
      buildSurfClimatologyDataset({
        city: { ...CITY, sources: [CITY.sources[0]] },
        generatedAt: "2026-09-26",
        series: [{ source: CITY.sources[0], hourly: patchyWaves }],
      }),
    ).toThrow("W1 failed its coverage gate");
  });
});

describe("datasetToCsv", () => {
  it("writes a commented header and one row per month for passing wave stations", () => {
    const lines = datasetToCsv(SEA_BREEZE_DATASET).trimEnd().split("\n");
    const comments = lines.filter((line) => line.startsWith("#"));
    const rows = lines.filter((line) => !line.startsWith("#"));

    expect(comments.join("\n")).toContain("not surf height at the beach");
    expect(comments.join("\n")).toContain("gate failed");
    expect(rows[0].split(",")[0]).toBe("month");
    expect(rows).toHaveLength(13);
    expect(rows[1].startsWith("1,W1,waves,3.3,")).toBe(true);
    expect(rows[1].endsWith(",75,75,75,1,82")).toBe(true);
  });
});
```

- [ ] **Step 8: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/build-dataset.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 9: Implement `build-dataset.ts`**

```ts
// lib/climatology/build-dataset.ts
import {
  GATE_COVERAGE,
  groupByStationMonth,
  overallCoverage,
  selectStationMonths,
  type ValuePicker,
} from "./coverage";
import { haversineKm } from "./geo";
import { localize } from "./hourly";
import { BUOY_SCORE_VERSION, scoreMonth } from "./score";
import type { CityClimatologyConfig, ClimatologySourceConfig } from "./sources";
import { classifyWind, waterMonthStats, waveMonthStats, WIND_BLOCKS, windMonthStats } from "./stats";
import type {
  ClimatologyMonth,
  ClimatologyRole,
  ClimatologyStation,
  HourlyObservation,
  LocalHourObservation,
  SurfClimatologyDataset,
} from "./types";

export const SEA_BREEZE_MIN_LIFT = 0.2;

export interface SourceSeries {
  source: ClimatologySourceConfig;
  hourly: HourlyObservation[];
}

interface PreparedSource {
  source: ClimatologySourceConfig;
  groups: Map<string, LocalHourObservation[]>;
  station: ClimatologyStation;
}

const pickWave: ValuePicker = (o) => o.waveHeightM;
const pickWater: ValuePicker = (o) => o.waterTempC;
const pickWind: ValuePicker = (o) => o.windSpeedKt;

function onshoreShare(obs: LocalHourObservation[], hours: readonly number[], shoreNormalDeg: number): number {
  const classes = obs
    .filter((o) => hours.includes(o.hour))
    .flatMap((o) => {
      const windClass = classifyWind(o.windDirDeg, o.windSpeedKt, shoreNormalDeg);
      return windClass === null ? [] : [windClass];
    });
  if (classes.length === 0) return 0;
  return classes.filter((windClass) => windClass === "onshore").length / classes.length;
}

/** Summer afternoon onshore share minus summer dawn onshore share. */
export function seaBreezeLift(obs: LocalHourObservation[], shoreNormalDeg: number): number {
  const summer = obs.filter((o) => o.month >= 6 && o.month <= 8);
  return (
    onshoreShare(summer, WIND_BLOCKS.afternoon, shoreNormalDeg) -
    onshoreShare(summer, WIND_BLOCKS.dawn, shoreNormalDeg)
  );
}

function prepare(series: SourceSeries, city: CityClimatologyConfig): PreparedSource {
  const { source } = series;
  const local = localize(series.hourly, city.timezone).filter(
    (o) => o.year >= source.years[0] && o.year <= source.years[1],
  );
  const pick = source.role === "wind" ? pickWind : pickWave;
  const gateCoverage = overallCoverage(local, source.years, pick);

  let passed = gateCoverage >= GATE_COVERAGE;
  if (source.role === "wind") {
    if (city.shoreNormalDeg === null) {
      throw new Error(`${city.citySlug} has a wind source but no shore normal`);
    }
    passed = passed && seaBreezeLift(local, city.shoreNormalDeg) >= SEA_BREEZE_MIN_LIFT;
  }

  const groups = groupByStationMonth(local, source.years);
  const excluded: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    excluded.push(...selectStationMonths(groups, month, source.years, pick).excluded);
  }

  return {
    source,
    groups,
    station: {
      id: source.id,
      alias: source.alias,
      name: source.name,
      role: source.role,
      kind: source.kind,
      lat: source.lat,
      lon: source.lon,
      distanceKm: Math.round(haversineKm(source, city.reference) * 10) / 10,
      referenceLabel: city.reference.label,
      yearsUsed: [source.years[0], source.years[1]],
      pageUrl: source.pageUrl,
      gate: passed ? "passed" : "failed",
      gateCoverage: Math.round(gateCoverage * 1000) / 1000,
      validHours: local.filter((o) => pick(o) !== null).length,
      excludedStationMonths: excluded.sort(),
    },
  };
}

export function buildSurfClimatologyDataset({
  city,
  series,
  generatedAt,
}: {
  city: CityClimatologyConfig;
  series: SourceSeries[];
  generatedAt: string;
}): SurfClimatologyDataset {
  const prepared = series.map((entry) => prepare(entry, city));
  const byRole = (role: ClimatologyRole): PreparedSource | null =>
    prepared.find((entry) => entry.source.role === role) ?? null;
  const passing = (entry: PreparedSource | null): PreparedSource | null =>
    entry && entry.station.gate === "passed" ? entry : null;

  const primary = byRole("waves");
  if (!primary) throw new Error(`${city.citySlug} has no wave source`);
  if (primary.station.gate === "failed") {
    throw new Error(
      `${city.citySlug}: ${primary.source.id} failed its coverage gate (${primary.station.gateCoverage})`,
    );
  }
  const comparison = passing(byRole("comparison-waves"));
  const wind = passing(byRole("wind"));

  const months: ClimatologyMonth[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const qualifying = (entry: PreparedSource, pick: ValuePicker) =>
      selectStationMonths(entry.groups, month, entry.source.years, pick).qualifying;
    const entry: Omit<ClimatologyMonth, "score"> = {
      month,
      waves: waveMonthStats(qualifying(primary, pickWave)),
      comparisonWaves: comparison ? waveMonthStats(qualifying(comparison, pickWave)) : null,
      water: waterMonthStats(qualifying(primary, pickWater)),
      wind:
        wind && city.shoreNormalDeg !== null
          ? windMonthStats(qualifying(wind, pickWind), city.shoreNormalDeg)
          : null,
    };
    months.push({ ...entry, score: scoreMonth(entry, wind !== null) });
  }

  return {
    schemaVersion: 1,
    scoreVersion: BUOY_SCORE_VERSION,
    citySlug: city.citySlug,
    cityName: city.cityName,
    generatedAt,
    timezone: city.timezone,
    shoreNormalDeg: city.shoreNormalDeg,
    reference: city.reference,
    places: city.places,
    stations: prepared.map((entry) => entry.station),
    months,
  };
}
```

- [ ] **Step 10: Implement `csv.ts`**

```ts
// lib/climatology/csv.ts
import { SECTORS, type ClimatologyMonth, type SurfClimatologyDataset, type WaveMonthStats } from "./types";

const COLUMNS = [
  "month",
  "station_id",
  "role",
  "hs_median_ft",
  "hs_p25_ft",
  "hs_p75_ft",
  "hs_p90_ft",
  "small_day_share",
  "big_day_share",
  "period_under8_share",
  "period_8to10_share",
  "period_10plus_share",
  ...SECTORS.map((sector) => `dir_${sector.toLowerCase()}_share`),
  "water_median_f",
  "water_p10_f",
  "water_p90_f",
  "clean_morning_share",
  "buoy_score_v1",
];

type Cell = string | number | null | undefined;

function row(
  month: ClimatologyMonth,
  stationId: string,
  role: "waves" | "comparison-waves",
  waves: WaveMonthStats | null,
): string {
  // Water, wind and the score belong to the city's primary buoy row only.
  const primary = role === "waves";
  const cells: Cell[] = [
    month.month,
    stationId,
    role,
    waves?.hsFt.median,
    waves?.hsFt.p25,
    waves?.hsFt.p75,
    waves?.hsFt.p90,
    waves?.smallDayShare,
    waves?.bigDayShare,
    waves?.periodMix.under8,
    waves?.periodMix.from8to10,
    waves?.periodMix.atLeast10,
    ...SECTORS.map((sector) => waves?.directionMix[sector]),
    primary ? month.water?.medianF : null,
    primary ? month.water?.p10F : null,
    primary ? month.water?.p90F : null,
    primary ? month.wind?.cleanMorningShare : null,
    primary ? month.score : null,
  ];
  return cells.map((cell) => (cell === null || cell === undefined ? "" : String(cell))).join(",");
}

export function datasetToCsv(dataset: SurfClimatologyDataset): string {
  const lines = [
    `# Quiver monthly buoy statistics for ${dataset.cityName}. Method ${dataset.scoreVersion}, generated ${dataset.generatedAt}.`,
    "# Heights are buoy significant wave height in feet, not surf height at the beach.",
    ...dataset.stations.map(
      (station) =>
        `# ${station.role}: ${station.name} (${station.kind === "ndbc" ? "NDBC" : "ASOS"} ${station.id}${
          station.alias ? `, ${station.alias}` : ""
        }), ${station.yearsUsed[0]}-${station.yearsUsed[1]}, gate ${station.gate}. ${station.pageUrl}`,
    ),
    COLUMNS.join(","),
  ];

  const primary = dataset.stations.find((station) => station.role === "waves");
  const comparison = dataset.stations.find(
    (station) => station.role === "comparison-waves" && station.gate === "passed",
  );
  for (const month of dataset.months) {
    if (primary) lines.push(row(month, primary.id, "waves", month.waves));
    if (comparison) lines.push(row(month, comparison.id, "comparison-waves", month.comparisonWaves));
  }
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 11: Run the dataset and CSV tests**

Run: `yarn test:unit __tests__/lib/climatology/build-dataset.test.ts`
Expected: PASS, 4 tests. The fixture builds three five-year hourly series; a runtime of a few seconds is normal.

- [ ] **Step 12: Write the build script**

```ts
// scripts/climatology/build-surf-climatology.ts
/**
 * Builds lib/data/surf-climatology/<city>.json and public/data/surf-climatology/<city>.csv
 * from NOAA NDBC historical archives and the Iowa Environmental Mesonet ASOS archive.
 *
 *   yarn tsx scripts/climatology/build-surf-climatology.ts [--city=cocoa-beach]
 *
 * Downloads are cached in .cache/climatology/. No database access, no credentials.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { buildSurfClimatologyDataset, type SourceSeries } from "@/lib/climatology/build-dataset";
import { datasetToCsv } from "@/lib/climatology/csv";
import { hourlyFromAsos, hourlyFromNdbc } from "@/lib/climatology/hourly";
import { parseIemAsosCsv, type AsosRecord } from "@/lib/climatology/parse-iem-asos";
import { parseNdbcStdmet, type NdbcRecord } from "@/lib/climatology/parse-ndbc";
import { CITY_CLIMATOLOGY_CONFIGS, type ClimatologySourceConfig } from "@/lib/climatology/sources";
import type { HourlyObservation } from "@/lib/climatology/types";

const CACHE_DIR = ".cache/climatology";
const DATASET_DIR = "lib/data/surf-climatology";
const CSV_DIR = "public/data/surf-climatology";
const USER_AGENT = "QuiverSurf/1.0 (https://www.quiversurf.app; surf-climatology)";

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCached(url: string, cacheName: string): Promise<Buffer | null> {
  const path = join(CACHE_DIR, cacheName);
  if (existsSync(path)) return readFile(path);

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, body);
  await delay(500);
  return body;
}

async function loadNdbc(source: ClimatologySourceConfig): Promise<HourlyObservation[]> {
  const records: NdbcRecord[] = [];
  for (let year = source.years[0]; year <= source.years[1]; year += 1) {
    const file = `${source.id.toLowerCase()}h${year}.txt.gz`;
    const body = await fetchCached(`https://www.ndbc.noaa.gov/data/historical/stdmet/${file}`, file);
    if (!body) {
      console.warn(`  no NDBC archive ${file}`);
      continue;
    }
    records.push(...parseNdbcStdmet(gunzipSync(body).toString("utf8")));
  }
  return hourlyFromNdbc(records);
}

async function loadAsos(source: ClimatologySourceConfig): Promise<HourlyObservation[]> {
  const records: AsosRecord[] = [];
  for (let year = source.years[0]; year <= source.years[1]; year += 1) {
    const url =
      `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${source.id}` +
      `&data=drct&data=sknt&year1=${year}&month1=1&day1=1&year2=${year + 1}&month2=1&day2=1` +
      "&tz=Etc%2FUTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3";
    const body = await fetchCached(url, `${source.id.toLowerCase()}-asos-${year}.csv`);
    if (!body) {
      console.warn(`  no ASOS data for ${source.id} ${year}`);
      continue;
    }
    records.push(...parseIemAsosCsv(body.toString("utf8")));
  }
  return hourlyFromAsos(records);
}

async function main(): Promise<void> {
  const only = process.argv.find((arg) => arg.startsWith("--city="))?.slice("--city=".length);
  const cities = CITY_CLIMATOLOGY_CONFIGS.filter((city) => !only || city.citySlug === only);
  if (cities.length === 0) throw new Error(`No climatology config for ${only}`);

  const generatedAt = new Date().toISOString().slice(0, 10);
  await mkdir(DATASET_DIR, { recursive: true });
  await mkdir(CSV_DIR, { recursive: true });

  let failures = 0;
  for (const city of cities) {
    console.log(`${city.citySlug}`);
    const series: SourceSeries[] = [];
    for (const source of city.sources) {
      console.log(`  loading ${source.kind} ${source.id} ${source.years[0]}-${source.years[1]}`);
      const hourly = source.kind === "ndbc" ? await loadNdbc(source) : await loadAsos(source);
      series.push({ source, hourly });
    }

    try {
      const dataset = buildSurfClimatologyDataset({ city, series, generatedAt });
      await writeFile(join(DATASET_DIR, `${city.citySlug}.json`), `${JSON.stringify(dataset, null, 2)}\n`);
      await writeFile(join(CSV_DIR, `${city.citySlug}.csv`), datasetToCsv(dataset));
      for (const station of dataset.stations) {
        console.log(
          `  ${station.id} ${station.role}: gate ${station.gate} ` +
            `(${(station.gateCoverage * 100).toFixed(1)}% coverage), ` +
            `${station.excludedStationMonths.length} station-months excluded`,
        );
      }
      console.log(`  scores: ${dataset.months.map((month) => month.score ?? "n/a").join(" ")}`);
    } catch (error) {
      failures += 1;
      console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 13: Ignore the download cache**

Append one line to `.gitignore`:

```
/.cache/
```

- [ ] **Step 14: Run the build for all three cities**

Run: `yarn tsx scripts/climatology/build-surf-climatology.ts`
Expected: one block per city listing each station's gate and 12 scores. The first run downloads roughly 60 archive files and takes a few minutes; reruns read the cache.

Record the printed gate lines; they go in the commit message. Then apply these rules:

- `41113` or `46253` failed, or the script exited non-zero for `cocoa-beach` or `newport-beach`: **stop and report to Steven.** That city cannot ship with this design.
- `51211` failed (no `honolulu.json` written): **stop and report to Steven.** Honolulu's fix needs a different decision. Do not hand-write a replacement.
- `TRDF1`, `SNA` or `46224` failed: continue. The pages handle a missing wind or comparison source, and Task 12's copy covers it.
- Read the 12 scores for each city. If any city has more than three `n/a` months, stop and report; that means coverage is thinner than the archive survey showed on 2026-09-25.

- [ ] **Step 15: Spot-check one number by hand**

Run:

```bash
node -e "const d=require('./lib/data/surf-climatology/cocoa-beach.json');const m=d.months[8];console.log(JSON.stringify({sep:m.waves&&m.waves.hsFt,small:m.waves&&m.waves.smallDayShare,water:m.water,score:m.score},null,1))"
```

Expected: a September median buoy height between 1 and 5 ft and median water between 78 and 86 °F. A value outside those ranges means a unit or time-zone bug; debug before committing.

- [ ] **Step 16: Commit**

```bash
git add .gitignore lib/climatology/geo.ts lib/climatology/sources.ts lib/climatology/build-dataset.ts lib/climatology/csv.ts scripts/climatology/build-surf-climatology.ts __tests__/lib/climatology/fixtures/observations.ts __tests__/lib/climatology/geo-sources.test.ts __tests__/lib/climatology/build-dataset.test.ts lib/data/surf-climatology public/data/surf-climatology
git commit -m "feat(climatology): build Newport, Cocoa and Honolulu buoy datasets

<paste the gate lines printed in Step 14 here>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Server-render the real score in the gauge

**Files:**
- Modify: `components/forecast/animated-score-gauge.tsx`
- Modify: `tailwind.config.ts` (keyframes and animation)
- Test: `__tests__/components/forecast/animated-score-gauge-ssr.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AnimatedScoreGauge` keeps its props (`score`, `size`, `showLabel`, `showAction`, `character`, `duration`, `enableGlow`, `variant`, `className`). The number and the finished arc are in the server HTML. Tailwind class `animate-gauge-fill`.

- [ ] **Step 1: Write the failing SSR test**

```tsx
// __tests__/components/forecast/animated-score-gauge-ssr.test.tsx
/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from "react-dom/server";

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";

describe("AnimatedScoreGauge server render", () => {
  it("renders the real score, a visible label and the finished arc", () => {
    const html = renderToStaticMarkup(
      <AnimatedScoreGauge score={86} size="xl" showLabel showAction={false} />,
    );

    expect(html).toMatch(/>86<\/span>/);
    expect(html).not.toMatch(/>0<\/span>/);
    expect(html).not.toContain("opacity-0");
    expect(html).toContain("motion-safe:animate-gauge-fill");
    // xl: size 128, stroke 8 -> radius 60; 86% filled leaves 14% of the circumference.
    const circumference = 2 * Math.PI * 60;
    expect(html).toContain(`stroke-dashoffset="${circumference * (1 - 86 / 100)}"`);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/components/forecast/animated-score-gauge-ssr.test.tsx`
Expected: FAIL. The HTML contains `>0</span>` and `opacity-0`.

- [ ] **Step 3: Add the keyframe to `tailwind.config.ts`**

In `theme.extend.keyframes`, next to `pulseGlow`, add:

```ts
        gaugeFill: {
          from: { strokeDashoffset: "var(--gauge-empty)" },
        },
```

In `theme.extend.animation`, next to `"pulse-glow"`, add:

```ts
        "gauge-fill": "gaugeFill 1.2s cubic-bezier(0.33, 1, 0.68, 1)",
```

- [ ] **Step 4: Remove the JS animation from the gauge**

In `components/forecast/animated-score-gauge.tsx`:

1. Replace the two hook imports

```tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
```

with

```tsx
import type { CSSProperties } from "react";
```

2. Delete the `easeOutCubic` function and its doc comment.

3. Delete everything from `const [displayScore, setDisplayScore] = useState(0);` through the end of the IntersectionObserver `useEffect` (the state, `elementRef`, `animationRef`, `reducedMotion`, `animate`, and the effect). Keep `isHero`, `config`, `radius`, `circumference`, `scoreCall`, `scoreColors`, `labelTextClass` and `targetOffset`.

4. Replace

```tsx
  const showGlow = enableGlow && scoreCall.label === "EPIC" && hasAnimated;
```

with

```tsx
  const showGlow = enableGlow && scoreCall.label === "EPIC";
```

5. On the outer `<div ref={elementRef} …>`, remove `ref={elementRef}`.

6. In the gauge wrapper's `cn(...)`, replace `showGlow && !reducedMotion && "animate-pulse-glow"` with `showGlow && "motion-safe:animate-pulse-glow"`.

7. Replace the progress arc's `strokeDashoffset` and `className` so the final arc is in the markup and CSS draws it in:

```tsx
            strokeDashoffset={targetOffset}
            // The arc renders finished on the server; the keyframe only
            // animates it in from empty when motion is allowed.
            style={{ "--gauge-empty": circumference, animationDuration: `${duration}ms` } as CSSProperties}
            className={cn(
              "transition-colors duration-300 motion-safe:animate-gauge-fill",
              isHero ? "text-white" : scoreColors.text
            )}
```

8. Replace `{displayScore}` with `{score}`.

9. In the quality label, the action phrase and the character label, delete both lines

```tsx
              !hasAnimated && !reducedMotion && "opacity-0",
              hasAnimated && "motion-safe:animate-fade-in"
```

(the character label keeps `"opacity-80"`).

- [ ] **Step 5: Run the gauge tests and every suite that renders it**

Run: `yarn test:unit __tests__/components/forecast/animated-score-gauge-ssr.test.tsx __tests__/components/forecast/animated-score-gauge.test.tsx __tests__/components/forecast/best-days-section.test.tsx __tests__/components/forecast/conditions-overview/best-day-hero.test.tsx __tests__/app/best-time-city-page.test.ts`
Expected: PASS. If a suite relied on the count-up (fake timers advancing to reach the score), update it to assert the score immediately; that is the new contract.

- [ ] **Step 6: Lint the changed files**

Run: `npx eslint --max-warnings=0 components/forecast/animated-score-gauge.tsx tailwind.config.ts`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/forecast/animated-score-gauge.tsx tailwind.config.ts __tests__/components/forecast/animated-score-gauge-ssr.test.tsx
git commit -m "fix(gauge): server-render the real score instead of counting up from 0

Crawlers and no-JS readers saw 0 on every best-time month card. The arc
now animates with a CSS keyframe from the finished server markup.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Describe the best window with the window's own conditions

**Files:**
- Modify: `actions/forecast/intent-forecast-actions.ts` (`IntentForecastSummary`, `buildWindowReason`, the `bestWindow` and `conditions` assembly in `getIntentForecastSummary`)
- Modify: `lib/recommendations/major-event-hold/adapters/intent.ts` (`IntentForecastBestWindow`)
- Modify: `app/best-time-to-surf/[city]/page.tsx` (`buildBestTimeTodayAnswerCopy`)
- Modify: `__tests__/app/best-time-la-jolla-live-answer.test.ts`
- Test: `__tests__/actions/forecast/intent-forecast-actions.test.ts` (new case)

**Interfaces:**
- Consumes: nothing new.
- Produces (additive): `IntentForecastSummary["bestWindow"]` gains `conditions?: { tide: string; wind: string; swell: string }`. `IntentForecastBestWindow` gains the same optional field. `buildBestTimeTodayAnswerCopy` gains `weekAnswerOverride?: string` (used in Task 13).

- [ ] **Step 1: Write the failing action test**

Add inside the `describe("getIntentForecastSummary major-event hold boundary", …)` block in `__tests__/actions/forecast/intent-forecast-actions.test.ts`:

```ts
    it("describes the window with the forecast hour nearest its peak, and now with the hour nearest now", async () => {
      const beachId = beachIds[0];
      const row = (forecastAt: string, tide: string, wind: string, swell: string) => ({
        id: `forecast-${forecastAt}`,
        beach_id: beachId,
        forecast_at: forecastAt,
        forecast_date: forecastAt.slice(0, 10),
        forecast_time: forecastAt.slice(11, 19),
        wave_height: swell,
        wave_period: "12",
        wave_direction: "W",
        wind_direction_deg: 90,
        wind_speed: wind,
        tide_height: "2.5",
        tide_status: tide,
        created_at: "2026-07-19T00:00:00.000Z",
        updated_at: "2026-07-19T00:00:00.000Z",
      });
      const forecasts = [
        row("2026-07-19T00:00:00.000Z", "Falling", "3 mph", "1-2 ft"),
        row("2026-07-19T12:00:00.000Z", "Rising", "8 mph", "2-3 ft"),
        row("2026-07-19T20:00:00.000Z", "Falling", "12 mph", "3-4 ft"),
      ];
      const query: any = {
        select: jest.fn(() => query),
        in: jest.fn(() => query),
        gte: jest.fn(() => query),
        lt: jest.fn(() => query),
        order: jest.fn(async () => ({ data: forecasts, error: null })),
      };
      (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({ from: jest.fn(() => query) });
      (findMagicHour as jest.Mock).mockReturnValue({
        found: true,
        peakTime: new Date("2026-07-19T20:00:00.000Z"),
        windowStart: "1:00 PM",
        windowEnd: "2:00 PM",
        confidence: 0.9,
        swellMatch: true,
        windQuality: "perfect",
        tideInRange: true,
      });
      mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
        ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
          Promise.resolve(
            candidates.map(({ candidateId }) => ({
              candidateId,
              evaluation: { outcome: "allow", holdIds: [], holdEpoch: "intent-epoch" },
              recommendationAvailability: { state: "available", holdEpoch: "intent-epoch" },
            })),
          ),
      );

      const result = await getIntentForecastSummary(
        [{ id: beachId, name: "Beach 1", slug: "beach-1", city: "San Diego", state: "CA" }],
        "best-time",
      );

      expect(result?.bestWindow).toEqual({
        start: "1:00 PM",
        end: "2:00 PM",
        reason: "tide in range, offshore winds, good swell angle",
        conditions: { tide: "Falling", wind: "12 mph", swell: "3-4 ft" },
      });
      expect(result?.conditions).toEqual({ tide: "Rising", wind: "8 mph", swell: "2-3 ft" });
    });
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/actions/forecast/intent-forecast-actions.test.ts -t "nearest its peak"`
Expected: FAIL. `reason` says "incoming tide", `bestWindow` has no `conditions`, and `conditions` holds the 00:00 row.

- [ ] **Step 3: Implement in `intent-forecast-actions.ts`**

1. Change the type:

```ts
export interface IntentForecastSummary {
  bestWindow: {
    start: string;
    end: string;
    reason: string;
    /** Conditions at the forecast hour nearest the window's peak. */
    conditions?: { tide: string; wind: string; swell: string };
  } | null;
```

2. In `buildWindowReason`, `tideInRange` means the tide sits in the beach's preferred band, not that it is rising:

```ts
  if (result.tideInRange) parts.push("tide in range");
```

3. Above `buildWindowReason`, add:

```ts
function nearestForecast(
  forecasts: EnhancedForecastEntity[],
  targetMs: number,
): EnhancedForecastEntity | undefined {
  let nearest: EnhancedForecastEntity | undefined;
  let nearestDelta = Number.POSITIVE_INFINITY;
  for (const forecast of forecasts) {
    const at = Date.parse(forecast.forecast_at);
    if (!Number.isFinite(at)) continue;
    const delta = Math.abs(at - targetMs);
    if (delta < nearestDelta) {
      nearest = forecast;
      nearestDelta = delta;
    }
  }
  return nearest;
}

function toConditions(forecast: EnhancedForecastEntity | undefined): IntentForecastSummary["conditions"] {
  return {
    tide: forecast?.tide_status ?? "Unknown",
    wind: forecast?.wind_speed ?? "Unknown",
    swell: forecast?.wave_height ?? "Unknown",
  };
}
```

4. Where `bestWindow` is assigned, attach the peak-hour conditions:

```ts
      const peakMs = best.result.peakTime?.getTime() ?? Number.NaN;
      bestWindow = {
        start: best.result.windowStart ?? "",
        end: best.result.windowEnd ?? "",
        reason: buildWindowReason(best.result),
        ...(Number.isFinite(peakMs)
          ? { conditions: toConditions(nearestForecast(best.forecasts, peakMs)) }
          : {}),
      };
```

5. Replace the `conditionForecast` / `conditions` block with the hour nearest now:

```ts
    const conditions = toConditions(nearestForecast(bestForecasts, now.getTime()));
```

If TypeScript reports that `forecast_at` or `wind_speed` has a different type on `EnhancedForecastEntity`, check `types/` for the entity and adapt `toConditions` to the real field types; do not cast.

- [ ] **Step 4: Widen the hold adapter's window type**

In `lib/recommendations/major-event-hold/adapters/intent.ts`:

```ts
export interface IntentForecastBestWindow {
  start: string;
  end: string;
  reason: string;
  conditions?: IntentForecastConditions;
}
```

`IntentForecastConditions` is declared just below it; move the `IntentForecastConditions` interface above `IntentForecastBestWindow`.

- [ ] **Step 5: Run the action test**

Run: `yarn test:unit __tests__/actions/forecast/intent-forecast-actions.test.ts`
Expected: PASS, including the existing hold-boundary case.

- [ ] **Step 6: Update the copy test for the new sentence**

In `__tests__/app/best-time-la-jolla-live-answer.test.ts`, the second case's fixture has no window conditions, so the sentence must not borrow the current tide. Replace its first `todayAnswer` expectation with:

```ts
    expect(copy.todayAnswer).toMatch(
      /^La Jolla's best surf window today is 6:00 AM-9:00 AM; incoming tide, light winds\./,
    );
    expect(copy.todayAnswer).not.toContain("rising tide");
```

and add a third case:

```ts
  it("describes the window with the window's conditions and labels current conditions as now", () => {
    const copy = buildBestTimeTodayAnswerCopy({
      citySlug: "cocoa-beach",
      cityName: "Cocoa Beach",
      currentMonthName: "September",
      currentMonthScore: 55,
      currentBestMonthCount: 1,
      totalBeaches: 1,
      peakMonthName: "October",
      weekAnswerOverride: "September scores 55/100 on the Cape Canaveral Nearshore buoy record.",
      forecastSummary: {
        bestWindow: {
          start: "2:30 PM",
          end: "3:30 PM",
          reason: "tide in range, good swell angle",
          conditions: { tide: "Rising", wind: "12 mph", swell: "1.4 ft" },
        },
        topPicks: [],
        conditions: { tide: "Falling", wind: "20 mph", swell: "1.2 ft" },
        isTomorrow: false,
        recommendationAvailability: { state: "available", holdEpoch: "test-epoch" },
      },
    });

    expect(copy.todayAnswer).toBe(
      "Cocoa Beach's best surf window today is 2:30 PM-3:30 PM, with rising tide, 12 mph wind, and 1.4 ft swell; tide in range, good swell angle. Check the live report before you drive.",
    );
    expect(copy.surfReportCue).toBe(
      "Now: falling tide, 20 mph wind, and 1.2 ft swell. Confirm them in the live surf report first.",
    );
    expect(copy.thisWeekAnswer).toBe(
      "September scores 55/100 on the Cape Canaveral Nearshore buoy record.",
    );
  });
```

- [ ] **Step 7: Run to confirm the copy test fails**

Run: `yarn test:unit __tests__/app/best-time-la-jolla-live-answer.test.ts`
Expected: FAIL on the new expectations.

- [ ] **Step 8: Update `buildBestTimeTodayAnswerCopy`**

In `app/best-time-to-surf/[city]/page.tsx`:

1. Add to `BestTimeTodayAnswerCopyArgs`:

```ts
  /** Replaces the state-profile "this week" sentence for buoy-backed cities. */
  weekAnswerOverride?: string;
```

and destructure `weekAnswerOverride` in the function signature.

2. Replace the `liveTodayAnswer` and `liveSurfReportCue` expressions:

```ts
  const windowConditions = forecastSummary?.bestWindow?.conditions;
  const windowConditionText = windowConditions
    ? `, with ${windowConditions.tide.toLowerCase()} tide, ${windowConditions.wind} wind, and ${windowConditions.swell} swell`
    : "";
  const liveTodayAnswer =
    forecastSummary?.bestWindow
      ? `${cityName}'s best surf window ${forecastDay} is ${forecastSummary.bestWindow.start}-${forecastSummary.bestWindow.end}${windowConditionText}; ${forecastSummary.bestWindow.reason}. ${
          topPick
            ? `${topPick.name} is the top pick at ${topPick.waveHeight}.`
            : "Check the live report before you drive."
        }`
      : null;
  const liveSurfReportCue = forecastSummary
    ? `Now: ${forecastSummary.conditions.tide.toLowerCase()} tide, ${forecastSummary.conditions.wind} wind, and ${forecastSummary.conditions.swell} swell. Confirm them in the live surf report first.`
    : null;
```

3. Replace the `baseThisWeekAnswer` line with:

```ts
  const baseThisWeekAnswer =
    weekAnswerOverride ??
    `${currentMonthName} rates ${currentMonthScore}/100 for ${cityName}. ${seasonStrength}; ${peakMonthName} is the historical peak if this week's surf report looks marginal.`;
```

- [ ] **Step 9: Run the copy, page and intent-plan tests**

Run: `yarn test:unit __tests__/app/best-time-la-jolla-live-answer.test.ts __tests__/app/best-time-city-page.test.ts __tests__/components/intent/todays-intent-plan.test.tsx __tests__/actions/forecast/intent-forecast-actions.test.ts`
Expected: PASS.

- [ ] **Step 10: Typecheck**

Run: `yarn typecheck`
Expected: exit 0. The `[intent]/[city]` page reads `forecastSummary?.conditions.wind`; it now gets the hour nearest now, which is what it labels.

- [ ] **Step 11: Commit**

```bash
git add actions/forecast/intent-forecast-actions.ts lib/recommendations/major-event-hold/adapters/intent.ts "app/best-time-to-surf/[city]/page.tsx" __tests__/actions/forecast/intent-forecast-actions.test.ts __tests__/app/best-time-la-jolla-live-answer.test.ts
git commit -m "fix(best-time): describe the best window with its own tide, wind and swell

The window sentence mixed the first forecast row of the UTC day with the
window reason, and the reason said \"incoming tide\" whenever the tide was
merely inside the preferred band. Cocoa Beach showed \"falling tide ...
incoming tide\" in one sentence.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dataset loader and the data-backed season view

**Files:**
- Create: `lib/climatology/get-surf-climatology.ts`
- Create: `lib/climatology/season-view.ts`
- Create: `__tests__/lib/climatology/fixtures/dataset.ts`
- Test: `__tests__/lib/climatology/season-view.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `derivePeak` and `PEAK_BAND_POINTS` (Task 4), `haversineKm` (Task 5), the committed JSON (Task 5), `getWetsuitRecommendation(tempF).thickness` from `lib/utils/wetsuit-utils.ts`.
- Produces:
  - `getSurfClimatology(citySlug: string): SurfClimatologyDataset | null`
  - `MONTH_NAMES`, `MONTH_ABBREVS`, `SEASONS` (`Array<{ label: string; months: readonly number[] }>`)
  - `interface SeasonMonthView { month: number; name: string; abbrev: string; score: number | null; isPeak: boolean; waves: WaveMonthStats | null; waterMedianF: number | null; wetsuit: string | null }`
  - `interface DataBackedSeasonView { primary: ClimatologyStation; comparison: ClimatologyStation | null; wind: ClimatologyStation | null; failedStations: ClimatologyStation[]; months: SeasonMonthView[]; current: SeasonMonthView; peakMonth: SeasonMonthView | null; peakBand: SeasonMonthView[]; quietMonth: SeasonMonthView | null; weekAnswer: string; heroDetail: string; bestMonthFaq: string; waterFaq: string; yearRoundFaq: string }`
  - `buildDataBackedSeasonView(dataset: SurfClimatologyDataset, currentMonth: number): DataBackedSeasonView`
  - `seasonalDirectionMix(dataset: SurfClimatologyDataset, role: "waves" | "comparison-waves", months: readonly number[]): Record<Sector, number> | null`
  - `stationDistanceKm(station: ClimatologyStation, place: ClimatologyPlace): number`
  - `joinNames(names: string[]): string`, `formatShare(share: number): string`

- [ ] **Step 1: Write the dataset fixture**

```ts
// __tests__/lib/climatology/fixtures/dataset.ts
import type {
  ClimatologyStation,
  SurfClimatologyDataset,
  WaveMonthStats,
} from "@/lib/climatology/types";

export function waveStats(overrides: Partial<WaveMonthStats> = {}): WaveMonthStats {
  return {
    hsFt: { median: 2.4, p25: 1.8, p75: 3.3, p90: 4.6 },
    smallDayShare: 0.3,
    bigDayShare: 0.05,
    periodMix: { under8: 0.6, from8to10: 0.25, atLeast10: 0.15 },
    directionMix: { N: 0.1, NE: 0.3, E: 0.3, SE: 0.2, S: 0.05, SW: 0, W: 0, NW: 0.05 },
    yearlyMedianFt: [],
    observedDays: 150,
    validHours: 3600,
    stationMonths: 5,
    ...overrides,
  };
}

export function station(overrides: Partial<ClimatologyStation> = {}): ClimatologyStation {
  return {
    id: "41113",
    alias: "CDIP 143",
    name: "Cape Canaveral Nearshore",
    role: "waves",
    kind: "ndbc",
    lat: 28.4,
    lon: -80.533,
    distanceKm: 7.7,
    referenceLabel: "Cocoa Beach Pier",
    yearsUsed: [2007, 2025],
    pageUrl: "https://www.ndbc.noaa.gov/station_page.php?station=41113",
    gate: "passed",
    gateCoverage: 0.93,
    validHours: 150000,
    excludedStationMonths: [],
    ...overrides,
  };
}

/** A Cocoa-like dataset with the given monthly scores (null = not enough data). */
export function makeDataset(
  scores: Array<number | null>,
  overrides: Partial<SurfClimatologyDataset> = {},
): SurfClimatologyDataset {
  return {
    schemaVersion: 1,
    scoreVersion: "buoy-v1",
    citySlug: "cocoa-beach",
    cityName: "Cocoa Beach",
    generatedAt: "2026-09-26",
    timezone: "America/New_York",
    shoreNormalDeg: 87,
    reference: { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 },
    places: [
      { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 },
      { label: "Satellite Beach", lat: 28.1707, lon: -80.5913 },
    ],
    stations: [station()],
    months: scores.map((score, index) => ({
      month: index + 1,
      waves: score === null ? null : waveStats(index === 5 ? { smallDayShare: 0.6 } : {}),
      comparisonWaves: null,
      water: score === null ? null : { medianF: 70 + index, p10F: 66 + index, p90F: 74 + index, validHours: 700 },
      wind: null,
      score,
    })),
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing view test**

```ts
// __tests__/lib/climatology/season-view.test.ts
import { getSurfClimatology } from "@/lib/climatology/get-surf-climatology";
import {
  buildDataBackedSeasonView,
  joinNames,
  seasonalDirectionMix,
} from "@/lib/climatology/season-view";
import { makeDataset, station, waveStats } from "./fixtures/dataset";

const SCORES = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];

describe("buildDataBackedSeasonView", () => {
  it("marks the peak band from the same scores it prints", () => {
    const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

    expect(view.peakMonth?.name).toBe("October");
    expect(view.peakBand.map((m) => m.name)).toEqual(["September", "October", "November"]);
    expect(view.months.filter((m) => m.isPeak).map((m) => m.month)).toEqual([9, 10, 11]);
    expect(view.weekAnswer).toBe(
      "September scores 70/100 on the Cape Canaveral Nearshore buoy record. It's in the peak band, within 10 points of October.",
    );
  });

  it("says when the current month is the top month", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 10).weekAnswer).toBe(
      "October scores 74/100 on the Cape Canaveral Nearshore buoy record. It's the highest-scoring month.",
    );
  });

  it("names the peak band when the current month is outside it", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 1).weekAnswer).toBe(
      "January scores 40/100 on the Cape Canaveral Nearshore buoy record. The peak band runs September, October and November.",
    );
  });

  it("does not invent a score for a month without enough data", () => {
    const scores = [...SCORES];
    scores[2] = null;
    const view = buildDataBackedSeasonView(makeDataset(scores), 3);

    expect(view.current.score).toBeNull();
    expect(view.weekAnswer).toBe("There isn't enough Cape Canaveral Nearshore buoy data to score March.");
    expect(view.heroDetail).toBe("Not enough buoy data for March. Peak month: October.");
  });

  it("builds the hero detail from buoy readings with the station and distance", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 9).heroDetail).toBe(
      "Buoy median 2.4 ft, typically 1.8–3.3 ft, at Cape Canaveral Nearshore, 7.7 km from Cocoa Beach Pier. Water 78°F. Peak month: October.",
    );
  });

  it("answers the FAQs from the dataset", () => {
    const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

    expect(view.bestMonthFaq).toBe(
      "October scores highest for Cocoa Beach on Quiver's buoy score (74/100), based on Cape Canaveral Nearshore readings from 2007 to 2025.",
    );
    expect(view.waterFaq).toBe(
      "At the Cape Canaveral Nearshore buoy, the median water temperature runs from 70°F in January to 81°F in December (2007–2025). Wetsuit: Spring suit (2mm) in January, Boardshorts in December.",
    );
    expect(view.yearRoundFaq).toBe(
      "7 of 12 months score 50 or more on Quiver's buoy score for Cocoa Beach. October scores highest.",
    );
  });

  it("finds the quietest month by small-day share", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 9).quietMonth?.name).toBe("June");
  });

  it("keeps failed stations out of the comparison and wind slots", () => {
    const dataset = makeDataset(SCORES, {
      stations: [
        station(),
        station({ id: "46224", role: "comparison-waves", gate: "failed" }),
        station({ id: "TRDF1", role: "wind", gate: "passed" }),
      ],
    });
    const view = buildDataBackedSeasonView(dataset, 9);

    expect(view.comparison).toBeNull();
    expect(view.wind?.id).toBe("TRDF1");
    expect(view.failedStations.map((s) => s.id)).toEqual(["46224"]);
  });
});

describe("seasonalDirectionMix", () => {
  it("weights each month by its valid hours", () => {
    const dataset = makeDataset(SCORES);
    dataset.months[5].waves = waveStats({ validHours: 1000, directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 1, SW: 0, W: 0, NW: 0 } });
    dataset.months[6].waves = waveStats({ validHours: 3000, directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 1, W: 0, NW: 0 } });
    dataset.months[7].waves = null;

    expect(seasonalDirectionMix(dataset, "waves", [6, 7, 8])).toEqual({
      N: 0, NE: 0, E: 0, SE: 0, S: 0.25, SW: 0.75, W: 0, NW: 0,
    });
    expect(seasonalDirectionMix(dataset, "comparison-waves", [6, 7, 8])).toBeNull();
  });
});

describe("joinNames", () => {
  it("joins with commas and a final and", () => {
    expect(joinNames(["May"])).toBe("May");
    expect(joinNames(["May", "June"])).toBe("May and June");
    expect(joinNames(["May", "June", "July"])).toBe("May, June and July");
  });
});

describe("getSurfClimatology", () => {
  it("loads the committed datasets and nothing else", () => {
    for (const slug of ["cocoa-beach", "newport-beach", "honolulu"]) {
      const dataset = getSurfClimatology(slug);
      expect(dataset?.citySlug).toBe(slug);
      expect(dataset?.months).toHaveLength(12);
    }
    expect(getSurfClimatology("san-diego")).toBeNull();
  });

  it("keeps every committed dataset's Peak badges consistent with its scores", () => {
    for (const slug of ["cocoa-beach", "newport-beach", "honolulu"]) {
      const dataset = getSurfClimatology(slug);
      if (!dataset) throw new Error(`missing ${slug}`);
      const view = buildDataBackedSeasonView(dataset, 1);
      const top = Math.max(...view.months.flatMap((m) => (m.score === null ? [] : [m.score])));
      for (const month of view.months) {
        expect(month.isPeak).toBe(month.score !== null && month.score >= top - 10);
      }
    }
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/season-view.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `get-surf-climatology.ts`**

```ts
// lib/climatology/get-surf-climatology.ts
import cocoaBeach from "@/lib/data/surf-climatology/cocoa-beach.json";
import honolulu from "@/lib/data/surf-climatology/honolulu.json";
import newportBeach from "@/lib/data/surf-climatology/newport-beach.json";
import type { SurfClimatologyDataset } from "./types";

// JSON imports widen tuples and literals, so check the parts the page relies on.
function asDataset(input: unknown, citySlug: string): SurfClimatologyDataset {
  const value = input as Partial<SurfClimatologyDataset>;
  if (
    value.schemaVersion !== 1 ||
    value.citySlug !== citySlug ||
    !Array.isArray(value.months) ||
    value.months.length !== 12 ||
    !Array.isArray(value.stations)
  ) {
    throw new Error(`Invalid surf climatology dataset for ${citySlug}`);
  }
  return value as SurfClimatologyDataset;
}

const DATASETS: Readonly<Record<string, SurfClimatologyDataset>> = {
  "cocoa-beach": asDataset(cocoaBeach, "cocoa-beach"),
  "newport-beach": asDataset(newportBeach, "newport-beach"),
  honolulu: asDataset(honolulu, "honolulu"),
};

export function getSurfClimatology(citySlug: string): SurfClimatologyDataset | null {
  return DATASETS[citySlug] ?? null;
}
```

- [ ] **Step 5: Implement `season-view.ts`**

```ts
// lib/climatology/season-view.ts
import { getWetsuitRecommendation } from "@/lib/utils/wetsuit-utils";
import { haversineKm } from "./geo";
import { derivePeak, PEAK_BAND_POINTS } from "./score";
import {
  SECTORS,
  type ClimatologyPlace,
  type ClimatologyRole,
  type ClimatologyStation,
  type Sector,
  type SurfClimatologyDataset,
  type WaveMonthStats,
} from "./types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
export const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
export const SEASONS: ReadonlyArray<{ label: string; months: readonly number[] }> = [
  { label: "Dec–Feb", months: [12, 1, 2] },
  { label: "Mar–May", months: [3, 4, 5] },
  { label: "Jun–Aug", months: [6, 7, 8] },
  { label: "Sep–Nov", months: [9, 10, 11] },
];

export interface SeasonMonthView {
  month: number;
  name: string;
  abbrev: string;
  score: number | null;
  isPeak: boolean;
  waves: WaveMonthStats | null;
  waterMedianF: number | null;
  wetsuit: string | null;
}

export interface DataBackedSeasonView {
  primary: ClimatologyStation;
  comparison: ClimatologyStation | null;
  wind: ClimatologyStation | null;
  failedStations: ClimatologyStation[];
  months: SeasonMonthView[];
  current: SeasonMonthView;
  peakMonth: SeasonMonthView | null;
  peakBand: SeasonMonthView[];
  quietMonth: SeasonMonthView | null;
  weekAnswer: string;
  heroDetail: string;
  bestMonthFaq: string;
  waterFaq: string;
  yearRoundFaq: string;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function stationDistanceKm(station: ClimatologyStation, place: ClimatologyPlace): number {
  return Math.round(haversineKm(station, place) * 10) / 10;
}

export function seasonalDirectionMix(
  dataset: SurfClimatologyDataset,
  role: "waves" | "comparison-waves",
  months: readonly number[],
): Record<Sector, number> | null {
  const stats = dataset.months
    .filter((month) => months.includes(month.month))
    .map((month) => (role === "waves" ? month.waves : month.comparisonWaves))
    .filter((entry): entry is WaveMonthStats => entry !== null);
  const totalHours = stats.reduce((sum, entry) => sum + entry.validHours, 0);
  if (totalHours === 0) return null;
  return Object.fromEntries(
    SECTORS.map((sector) => [
      sector,
      Math.round((stats.reduce((sum, entry) => sum + entry.directionMix[sector] * entry.validHours, 0) / totalHours) * 100) / 100,
    ]),
  ) as Record<Sector, number>;
}

function findStation(dataset: SurfClimatologyDataset, role: ClimatologyRole): ClimatologyStation | null {
  return dataset.stations.find((station) => station.role === role) ?? null;
}

function buildWeekAnswer(
  current: SeasonMonthView,
  peak: SeasonMonthView | null,
  band: SeasonMonthView[],
  primary: ClimatologyStation,
): string {
  if (current.score === null) {
    return `There isn't enough ${primary.name} buoy data to score ${current.name}.`;
  }
  const lead = `${current.name} scores ${current.score}/100 on the ${primary.name} buoy record.`;
  if (!peak) return lead;
  if (peak.month === current.month) return `${lead} It's the highest-scoring month.`;
  if (current.isPeak) return `${lead} It's in the peak band, within ${PEAK_BAND_POINTS} points of ${peak.name}.`;
  return `${lead} The peak band runs ${joinNames(band.map((month) => month.name))}.`;
}

function buildHeroDetail(current: SeasonMonthView, peak: SeasonMonthView | null, primary: ClimatologyStation): string {
  const parts: string[] = [];
  if (current.waves) {
    const { median, p25, p75 } = current.waves.hsFt;
    parts.push(
      `Buoy median ${median} ft, typically ${p25}–${p75} ft, at ${primary.name}, ${primary.distanceKm} km from ${primary.referenceLabel}.`,
    );
  } else {
    parts.push(`Not enough buoy data for ${current.name}.`);
  }
  if (current.waterMedianF !== null) parts.push(`Water ${current.waterMedianF}°F.`);
  if (peak && peak.month !== current.month) parts.push(`Peak month: ${peak.name}.`);
  return parts.join(" ");
}

function buildWaterFaq(months: SeasonMonthView[], primary: ClimatologyStation): string {
  const withWater = months.filter((month) => month.waterMedianF !== null);
  if (withWater.length === 0) {
    return `The ${primary.name} buoy doesn't have enough water temperature readings to summarise.`;
  }
  const coldest = withWater.reduce((a, b) => ((b.waterMedianF ?? 0) < (a.waterMedianF ?? 0) ? b : a));
  const warmest = withWater.reduce((a, b) => ((b.waterMedianF ?? 0) > (a.waterMedianF ?? 0) ? b : a));
  const [firstYear, lastYear] = primary.yearsUsed;
  return (
    `At the ${primary.name} buoy, the median water temperature runs from ${coldest.waterMedianF}°F in ${coldest.name} ` +
    `to ${warmest.waterMedianF}°F in ${warmest.name} (${firstYear}–${lastYear}). ` +
    `Wetsuit: ${coldest.wetsuit} in ${coldest.name}, ${warmest.wetsuit} in ${warmest.name}.`
  );
}

export function buildDataBackedSeasonView(
  dataset: SurfClimatologyDataset,
  currentMonth: number,
): DataBackedSeasonView {
  const primary = findStation(dataset, "waves");
  if (!primary) throw new Error(`${dataset.citySlug} dataset has no wave station`);
  const passed = (role: ClimatologyRole): ClimatologyStation | null => {
    const station = findStation(dataset, role);
    return station && station.gate === "passed" ? station : null;
  };

  const { peakMonth, peakBand } = derivePeak(dataset.months);
  const band = new Set(peakBand);
  const months: SeasonMonthView[] = dataset.months.map((month) => ({
    month: month.month,
    name: MONTH_NAMES[month.month - 1],
    abbrev: MONTH_ABBREVS[month.month - 1],
    score: month.score,
    isPeak: band.has(month.month),
    waves: month.waves,
    waterMedianF: month.water?.medianF ?? null,
    wetsuit: month.water ? getWetsuitRecommendation(month.water.medianF).thickness : null,
  }));
  const byMonth = (monthNumber: number): SeasonMonthView => {
    const found = months.find((month) => month.month === monthNumber);
    if (!found) throw new Error(`${dataset.citySlug} dataset has no month ${monthNumber}`);
    return found;
  };

  const current = byMonth(currentMonth);
  const peak = peakMonth === null ? null : byMonth(peakMonth);
  const bandMonths = peakBand.map(byMonth);
  const quietMonth = months.reduce<SeasonMonthView | null>(
    (quietest, month) =>
      month.waves && (!quietest?.waves || month.waves.smallDayShare > quietest.waves.smallDayShare)
        ? month
        : quietest,
    null,
  );
  const [firstYear, lastYear] = primary.yearsUsed;
  const strongMonths = months.filter((month) => month.score !== null && month.score >= 50).length;

  return {
    primary,
    comparison: passed("comparison-waves"),
    wind: passed("wind"),
    failedStations: dataset.stations.filter((station) => station.gate === "failed"),
    months,
    current,
    peakMonth: peak,
    peakBand: bandMonths,
    quietMonth,
    weekAnswer: buildWeekAnswer(current, peak, bandMonths, primary),
    heroDetail: buildHeroDetail(current, peak, primary),
    bestMonthFaq: peak
      ? `${peak.name} scores highest for ${dataset.cityName} on Quiver's buoy score (${peak.score}/100), based on ${primary.name} readings from ${firstYear} to ${lastYear}.`
      : `There isn't enough ${primary.name} buoy data to name a best month for ${dataset.cityName}.`,
    waterFaq: buildWaterFaq(months, primary),
    yearRoundFaq:
      `${strongMonths} of 12 months score 50 or more on Quiver's buoy score for ${dataset.cityName}.` +
      (peak ? ` ${peak.name} scores highest.` : ""),
  };
}
```

- [ ] **Step 6: Run the view test**

Run: `yarn test:unit __tests__/lib/climatology/season-view.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/climatology/get-surf-climatology.ts lib/climatology/season-view.ts __tests__/lib/climatology/fixtures/dataset.ts __tests__/lib/climatology/season-view.test.ts
git commit -m "feat(climatology): derive the season view from one dataset

Score, Peak badges, peak month, hero sentence and FAQ answers all come
from the same buoy scores, so they cannot disagree.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Server-rendered buoy charts

**Files:**
- Create: `components/best-time-to-surf/buoy-record/chart-theme.ts`
- Create: `components/best-time-to-surf/buoy-record/score-by-month-chart.tsx`
- Create: `components/best-time-to-surf/buoy-record/wave-range-chart.tsx`
- Create: `components/best-time-to-surf/buoy-record/direction-mix-chart.tsx`
- Create: `components/best-time-to-surf/buoy-record/wind-by-time-chart.tsx`
- Modify: `__tests__/lib/climatology/fixtures/dataset.ts` (add `windStats`)
- Test: `__tests__/components/best-time-to-surf/buoy-record-charts.test.tsx`

**Interfaces:**
- Consumes: `SeasonMonthView`, `formatShare` (Task 8); `SECTORS`, `Sector`, `WindMonthStats` (Task 1).
- Produces:
  - `ScoreByMonthChart({ months: SeasonMonthView[]; stationName: string; chartId: string })`
  - `WaveRangeChart({ months: SeasonMonthView[]; stationName: string; chartId: string })`
  - `DirectionMixChart({ rows: Array<{ stationName: string; seasons: Array<{ label: string; mix: Record<Sector, number> | null }> }>; chartId: string })`
  - `WindByTimeChart({ months: Array<{ month: number; abbrev: string; wind: WindMonthStats | null }>; stationName: string; chartId: string })`
  - `CHART_*` colours and `WIND_CLASS_COLORS`, `WIND_CLASS_LABELS`

All four are server components (no hooks, no `"use client"`), draw plain SVG, and carry a `<title>` that states the numbers so screen readers and crawlers get the data.

- [ ] **Step 1: Check the palette**

Load the `dataviz` skill. Run its palette validator on the colours below against the page surface `#FFFFFF` and the paper surface `#FBF6E8`. If it flags a pair, adjust the hex value in `chart-theme.ts` and note the change in the commit message.

```ts
// components/best-time-to-surf/buoy-record/chart-theme.ts
// Buoy-record chart colours, drawn on white cards over the cream paper page.
export const CHART_INK = "#11100D";
export const CHART_MUTED = "#655C4C";
export const CHART_GRID = "rgba(17, 16, 13, 0.12)";
export const CHART_SERIES = "#1F5F7A";
export const CHART_PEAK = "#B04E1B";

export const WIND_CLASS_COLORS = {
  offshore: "#1F5F7A",
  light: "#8DB3BF",
  cross: "#D9C08A",
  onshore: "#B04E1B",
} as const;

export const WIND_CLASS_LABELS = {
  offshore: "Offshore",
  light: "Light (under 6 kt)",
  cross: "Cross-shore",
  onshore: "Onshore",
} as const;
```

- [ ] **Step 2: Add `windStats` to the dataset fixture**

Append to `__tests__/lib/climatology/fixtures/dataset.ts`:

```ts
import type { WindMonthStats } from "@/lib/climatology/types";

export function windStats(overrides: Partial<WindMonthStats> = {}): WindMonthStats {
  return {
    dawn: { offshore: 0.5, cross: 0.1, onshore: 0.1, light: 0.3, medianKt: 7, hours: 465 },
    midday: { offshore: 0.1, cross: 0.3, onshore: 0.5, light: 0.1, medianKt: 10, hours: 465 },
    afternoon: { offshore: 0, cross: 0.2, onshore: 0.8, light: 0, medianKt: 13, hours: 465 },
    cleanMorningShare: 0.6,
    observedMornings: 150,
    ...overrides,
  };
}
```

(Move the new `import type` line up to join the existing type import at the top of the file.)

- [ ] **Step 3: Write the failing chart tests**

```tsx
// __tests__/components/best-time-to-surf/buoy-record-charts.test.tsx
import { render, screen } from "@testing-library/react";

import { DirectionMixChart } from "@/components/best-time-to-surf/buoy-record/direction-mix-chart";
import { ScoreByMonthChart } from "@/components/best-time-to-surf/buoy-record/score-by-month-chart";
import { WaveRangeChart } from "@/components/best-time-to-surf/buoy-record/wave-range-chart";
import { WindByTimeChart } from "@/components/best-time-to-surf/buoy-record/wind-by-time-chart";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { makeDataset, windStats } from "../../lib/climatology/fixtures/dataset";

const SCORES = [40, 42, null, 50, 48, 44, 52, 60, 70, 74, 66, 50];
const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

describe("ScoreByMonthChart", () => {
  it("draws peak bars, marks missing months and states the numbers in its title", () => {
    const { container } = render(
      <ScoreByMonthChart months={view.months} stationName="Cape Canaveral Nearshore" chartId="score" />,
    );

    expect(container.querySelectorAll('[data-testid="score-bar-peak"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="score-bar-missing"]')).toHaveLength(1);
    expect(container.querySelector("title")?.textContent).toBe(
      "Buoy score by month, Cape Canaveral Nearshore: Jan 40, Feb 42, Mar n/a, Apr 50, May 48, Jun 44, Jul 52, Aug 60, Sep 70, Oct 74, Nov 66, Dec 50",
    );
    expect(screen.getByText("Peak band: within 10 points of the top month")).toBeInTheDocument();
  });
});

describe("WaveRangeChart", () => {
  it("draws a median dot for each month with data", () => {
    const { container } = render(
      <WaveRangeChart months={view.months} stationName="Cape Canaveral Nearshore" chartId="waves" />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(11);
    expect(screen.getAllByText("n/a")).toHaveLength(1);
    expect(container.querySelector("title")?.textContent).toContain("Sep median 2.4 ft");
    expect(screen.getByText(/not surf height at the beach/)).toBeInTheDocument();
  });
});

describe("DirectionMixChart", () => {
  it("draws one panel per station and labels shares of 5% or more", () => {
    const mix = { N: 0.1, NE: 0.3, E: 0.3, SE: 0.2, S: 0.05, SW: 0, W: 0, NW: 0.05 };
    render(
      <DirectionMixChart
        chartId="dir"
        rows={[
          { stationName: "San Pedro South", seasons: [{ label: "Jun–Aug", mix }] },
          { stationName: "Oceanside Offshore", seasons: [{ label: "Jun–Aug", mix: null }] },
        ]}
      />,
    );

    expect(screen.getByText("San Pedro South")).toBeInTheDocument();
    expect(screen.getByText("Oceanside Offshore")).toBeInTheDocument();
    expect(screen.getAllByText("30%")).toHaveLength(2);
    expect(screen.getByText("n/a")).toBeInTheDocument();
  });
});

describe("WindByTimeChart", () => {
  it("draws three stacked bars per month and a legend", () => {
    const months = view.months.map((m) => ({ month: m.month, abbrev: m.abbrev, wind: m.month === 3 ? null : windStats() }));
    const { container } = render(<WindByTimeChart months={months} stationName="Trident Pier" chartId="wind" />);

    expect(container.querySelectorAll('[data-testid="wind-bar"]')).toHaveLength(33);
    expect(screen.getByText("Offshore")).toBeInTheDocument();
    expect(screen.getByText("Light (under 6 kt)")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toContain("Jan 50%");
  });
});
```

- [ ] **Step 4: Run to confirm failure**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-charts.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 5: Implement `ScoreByMonthChart`**

```tsx
// components/best-time-to-surf/buoy-record/score-by-month-chart.tsx
import type { SeasonMonthView } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_PEAK, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 32;
const TOP = 20;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = STEP * 0.62;
const BASELINE = TOP + PLOT_HEIGHT;

interface ScoreByMonthChartProps {
  months: SeasonMonthView[];
  stationName: string;
  chartId: string;
}

export function ScoreByMonthChart({ months, stationName, chartId }: ScoreByMonthChartProps) {
  const titleId = `${chartId}-title`;
  const summary = months.map((month) => `${month.abbrev} ${month.score ?? "n/a"}`).join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Buoy score by month, ${stationName}: ${summary}`}</title>
        {[25, 50, 75, 100].map((tick) => {
          const y = TOP + PLOT_HEIGHT * (1 - tick / 100);
          return (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH} y1={y} y2={y} stroke={CHART_GRID} />
              <text x={LEFT - 6} y={y + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
                {tick}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const x = LEFT + index * STEP + (STEP - BAR_WIDTH) / 2;
          const center = x + BAR_WIDTH / 2;
          const monthLabel = (
            <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
              {month.abbrev}
            </text>
          );
          if (month.score === null) {
            return (
              <g key={month.month} data-testid="score-bar-missing">
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={10} fill={CHART_MUTED}>
                  n/a
                </text>
                {monthLabel}
              </g>
            );
          }
          const height = PLOT_HEIGHT * (month.score / 100);
          return (
            <g key={month.month} data-testid={month.isPeak ? "score-bar-peak" : "score-bar"}>
              <rect
                x={x}
                y={BASELINE - height}
                width={BAR_WIDTH}
                height={height}
                rx={3}
                fill={month.isPeak ? CHART_PEAK : CHART_SERIES}
              />
              <text
                x={center}
                y={BASELINE - height - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={CHART_INK}
              >
                {month.score}
              </text>
              {monthLabel}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center gap-2 text-xs text-[#655C4C]">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_PEAK }} aria-hidden="true" />
        Peak band: within 10 points of the top month
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 6: Implement `WaveRangeChart`**

```tsx
// components/best-time-to-surf/buoy-record/wave-range-chart.tsx
import type { SeasonMonthView } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 16;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 14;

interface WaveRangeChartProps {
  months: SeasonMonthView[];
  stationName: string;
  chartId: string;
}

export function WaveRangeChart({ months, stationName, chartId }: WaveRangeChartProps) {
  const titleId = `${chartId}-title`;
  const p90s = months.flatMap((month) => (month.waves ? [month.waves.hsFt.p90] : []));
  // Round the axis up to an even number of feet, never below 4 ft.
  const maxFt = Math.max(4, Math.ceil(Math.max(0, ...p90s) / 2) * 2);
  const y = (ft: number): number => TOP + PLOT_HEIGHT * (1 - ft / maxFt);
  const ticks = Array.from({ length: maxFt / 2 }, (_, index) => (index + 1) * 2);
  const summary = months
    .map((month) => (month.waves ? `${month.abbrev} median ${month.waves.hsFt.median} ft` : `${month.abbrev} n/a`))
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Buoy wave height by month at ${stationName}: ${summary}`}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
            <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
              {`${tick} ft`}
            </text>
          </g>
        ))}
        {months.map((month, index) => {
          const center = LEFT + index * STEP + STEP / 2;
          const monthLabel = (
            <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
              {month.abbrev}
            </text>
          );
          if (!month.waves) {
            return (
              <g key={month.month}>
                <text x={center} y={y(0) - 6} textAnchor="middle" fontSize={10} fill={CHART_MUTED}>
                  n/a
                </text>
                {monthLabel}
              </g>
            );
          }
          const { median, p25, p75, p90 } = month.waves.hsFt;
          return (
            <g key={month.month}>
              <rect
                x={center - BAR_WIDTH / 2}
                y={y(p75)}
                width={BAR_WIDTH}
                height={Math.max(1, y(p25) - y(p75))}
                rx={3}
                fill={CHART_SERIES}
                fillOpacity={0.3}
              />
              <line
                x1={center - BAR_WIDTH / 2}
                x2={center + BAR_WIDTH / 2}
                y1={y(p90)}
                y2={y(p90)}
                stroke={CHART_INK}
                strokeWidth={2}
              />
              <circle cx={center} cy={y(median)} r={4} fill={CHART_SERIES} />
              {monthLabel}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs leading-5 text-[#655C4C]">
        Dot: median buoy reading. Bar: the middle half of readings. Line: the 90th percentile. These are buoy
        readings, not surf height at the beach.
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 7: Implement `DirectionMixChart`**

```tsx
// components/best-time-to-surf/buoy-record/direction-mix-chart.tsx
import { formatShare } from "@/lib/climatology/season-view";
import { SECTORS, type Sector } from "@/lib/climatology/types";
import { CHART_MUTED, CHART_SERIES } from "./chart-theme";

const LABEL_WIDTH = 72;
const COLUMN_WIDTH = 40;
const ROW_HEIGHT = 58;
const BAR_MAX = 36;
const TOP = 12;
const WIDTH = LABEL_WIDTH + SECTORS.length * COLUMN_WIDTH;

interface DirectionMixRow {
  stationName: string;
  seasons: Array<{ label: string; mix: Record<Sector, number> | null }>;
}

interface DirectionMixChartProps {
  rows: DirectionMixRow[];
  chartId: string;
}

function topSectors(mix: Record<Sector, number> | null): string {
  if (!mix) return "no data";
  return [...SECTORS]
    .sort((a, b) => mix[b] - mix[a])
    .slice(0, 2)
    .map((sector) => `${sector} ${formatShare(mix[sector])}`)
    .join(", ");
}

export function DirectionMixChart({ rows, chartId }: DirectionMixChartProps) {
  // One scale for every panel so stations can be compared by eye.
  const maxShare = Math.max(
    0.05,
    ...rows.flatMap((row) =>
      row.seasons.flatMap((season) => {
        const mix = season.mix;
        return mix ? SECTORS.map((sector) => mix[sector]) : [];
      }),
    ),
  );

  return (
    <div>
      <div className={rows.length > 1 ? "grid gap-6 md:grid-cols-2" : undefined}>
        {rows.map((row, rowIndex) => {
          const titleId = `${chartId}-${rowIndex}-title`;
          const height = TOP + row.seasons.length * ROW_HEIGHT + 16;
          return (
            <figure key={row.stationName}>
              <figcaption className="mb-2 text-sm font-semibold text-[#11100D]">{row.stationName}</figcaption>
              <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
                <title id={titleId}>
                  {`Swell direction at ${row.stationName}, share of hours: ${row.seasons
                    .map((season) => `${season.label} ${topSectors(season.mix)}`)
                    .join("; ")}`}
                </title>
                {row.seasons.map((season, seasonIndex) => {
                  const rowTop = TOP + seasonIndex * ROW_HEIGHT;
                  const mix = season.mix;
                  return (
                    <g key={season.label}>
                      <text x={0} y={rowTop + BAR_MAX} fontSize={11} fill={CHART_MUTED}>
                        {season.label}
                      </text>
                      {mix ? (
                        SECTORS.map((sector, sectorIndex) => {
                          const share = mix[sector];
                          const barHeight = (share / maxShare) * BAR_MAX;
                          const x = LABEL_WIDTH + sectorIndex * COLUMN_WIDTH;
                          return (
                            <g key={sector}>
                              <rect
                                x={x}
                                y={rowTop + BAR_MAX - barHeight}
                                width={COLUMN_WIDTH - 8}
                                height={barHeight}
                                rx={2}
                                fill={CHART_SERIES}
                              />
                              {share >= 0.05 && (
                                <text
                                  x={x + (COLUMN_WIDTH - 8) / 2}
                                  y={rowTop + BAR_MAX - barHeight - 3}
                                  textAnchor="middle"
                                  fontSize={9}
                                  fill={CHART_MUTED}
                                >
                                  {formatShare(share)}
                                </text>
                              )}
                            </g>
                          );
                        })
                      ) : (
                        <text x={LABEL_WIDTH} y={rowTop + BAR_MAX} fontSize={11} fill={CHART_MUTED}>
                          n/a
                        </text>
                      )}
                    </g>
                  );
                })}
                {SECTORS.map((sector, sectorIndex) => (
                  <text
                    key={sector}
                    x={LABEL_WIDTH + sectorIndex * COLUMN_WIDTH + (COLUMN_WIDTH - 8) / 2}
                    y={height - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill={CHART_MUTED}
                  >
                    {sector}
                  </text>
                ))}
              </svg>
            </figure>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[#655C4C]">
        Direction the swell comes from at the buoy, as a share of hours in each season.
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Implement `WindByTimeChart`**

```tsx
// components/best-time-to-surf/buoy-record/wind-by-time-chart.tsx
import { formatShare } from "@/lib/climatology/season-view";
import type { WindMonthStats } from "@/lib/climatology/types";
import { CHART_GRID, CHART_MUTED, WIND_CLASS_COLORS, WIND_CLASS_LABELS } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 12;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const BASELINE = TOP + PLOT_HEIGHT;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 12;
const BAR_GAP = 3;
const BLOCKS = ["dawn", "midday", "afternoon"] as const;
const CLASS_ORDER = ["offshore", "light", "cross", "onshore"] as const;

interface WindByTimeChartProps {
  months: Array<{ month: number; abbrev: string; wind: WindMonthStats | null }>;
  stationName: string;
  chartId: string;
}

export function WindByTimeChart({ months, stationName, chartId }: WindByTimeChartProps) {
  const titleId = `${chartId}-title`;
  const groupWidth = BLOCKS.length * BAR_WIDTH + (BLOCKS.length - 1) * BAR_GAP;
  const summary = months
    .map((month) => (month.wind ? `${month.abbrev} ${formatShare(month.wind.dawn.offshore)}` : `${month.abbrev} n/a`))
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Wind at ${stationName}, share of dawn hours with offshore wind: ${summary}`}</title>
        {[0.5, 1].map((tick) => {
          const y = BASELINE - PLOT_HEIGHT * tick;
          return (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH} y1={y} y2={y} stroke={CHART_GRID} />
              <text x={LEFT - 6} y={y + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
                {formatShare(tick)}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const groupLeft = LEFT + index * STEP + (STEP - groupWidth) / 2;
          const center = LEFT + index * STEP + STEP / 2;
          const wind = month.wind;
          return (
            <g key={month.month}>
              {wind ? (
                BLOCKS.map((block, blockIndex) => {
                  const x = groupLeft + blockIndex * (BAR_WIDTH + BAR_GAP);
                  let cursor = BASELINE;
                  return (
                    <g key={block} data-testid="wind-bar">
                      {CLASS_ORDER.map((windClass) => {
                        const height = PLOT_HEIGHT * wind[block][windClass];
                        cursor -= height;
                        return (
                          <rect
                            key={windClass}
                            x={x}
                            y={cursor}
                            width={BAR_WIDTH}
                            height={height}
                            fill={WIND_CLASS_COLORS[windClass]}
                          />
                        );
                      })}
                    </g>
                  );
                })
              ) : (
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={10} fill={CHART_MUTED}>
                  n/a
                </text>
              )}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                {month.abbrev}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 space-y-2 text-xs text-[#655C4C]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {CLASS_ORDER.map((windClass) => (
            <li key={windClass} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: WIND_CLASS_COLORS[windClass] }}
                aria-hidden="true"
              />
              {WIND_CLASS_LABELS[windClass]}
            </li>
          ))}
        </ul>
        <p>Each month shows dawn (6–9 am), midday (11 am–2 pm) and afternoon (3–6 pm), left to right.</p>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 9: Run the chart tests**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-charts.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 10: Lint**

Run: `npx eslint --max-warnings=0 components/best-time-to-surf/buoy-record/`
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add components/best-time-to-surf/buoy-record/chart-theme.ts components/best-time-to-surf/buoy-record/score-by-month-chart.tsx components/best-time-to-surf/buoy-record/wave-range-chart.tsx components/best-time-to-surf/buoy-record/direction-mix-chart.tsx components/best-time-to-surf/buoy-record/wind-by-time-chart.tsx __tests__/lib/climatology/fixtures/dataset.ts __tests__/components/best-time-to-surf/buoy-record-charts.test.tsx
git commit -m "feat(best-time): add server-rendered buoy charts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Month table, source line, score explainer and station map

**Files:**
- Create: `components/best-time-to-surf/buoy-record/buoy-month-table.tsx`
- Create: `components/best-time-to-surf/buoy-record/source-line.tsx`
- Create: `components/best-time-to-surf/buoy-record/score-explainer.tsx`
- Create: `components/best-time-to-surf/buoy-record/station-map.tsx`
- Test: `__tests__/components/best-time-to-surf/buoy-record-panels.test.tsx`

**Interfaces:**
- Consumes: `SeasonMonthView`, `formatShare`, `stationDistanceKm` (Task 8); `BUOY_SCORE_WEIGHTS` (Task 4); `getStaticMapImageUrlWithPins(pins, { width, height, padding })` from `lib/map-utils.ts` (returns `null` without a Mapbox token).
- Produces:
  - `BuoyMonthTable({ months: SeasonMonthView[]; station: ClimatologyStation })`
  - `describeStationSource(station: ClimatologyStation, scoreVersion: string): string` and `SourceLine({ station, scoreVersion })`
  - `ScoreExplainer({ hasWind: boolean; csvHref: string | null; scoreVersion: string })`
  - `StationMap({ places: ClimatologyPlace[]; stations: ClimatologyStation[] })`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/components/best-time-to-surf/buoy-record-panels.test.tsx
import { render, screen, within } from "@testing-library/react";

import { BuoyMonthTable } from "@/components/best-time-to-surf/buoy-record/buoy-month-table";
import { ScoreExplainer } from "@/components/best-time-to-surf/buoy-record/score-explainer";
import { describeStationSource } from "@/components/best-time-to-surf/buoy-record/source-line";
import { StationMap } from "@/components/best-time-to-surf/buoy-record/station-map";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { makeDataset, station } from "../../lib/climatology/fixtures/dataset";

const SCORES = [40, 42, null, 50, 48, 44, 52, 60, 70, 74, 66, 50];
const dataset = makeDataset(SCORES);
const view = buildDataBackedSeasonView(dataset, 9);

describe("BuoyMonthTable", () => {
  it("renders twelve months, a dash for missing data and Peak markers", () => {
    render(<BuoyMonthTable months={view.months} station={view.primary} />);
    const rows = screen.getAllByRole("row").slice(1);

    expect(rows).toHaveLength(12);
    expect(within(rows[2]).getAllByText("—").length).toBeGreaterThanOrEqual(6);
    expect(within(rows[8]).getByText("Peak")).toBeInTheDocument();
    expect(within(rows[8]).getByText("2.4 ft (1.8–3.3)")).toBeInTheDocument();
    expect(within(rows[8]).getByText("78°F")).toBeInTheDocument();
    expect(screen.getByText(/Heights are buoy readings, not surf at the beach/)).toBeInTheDocument();
  });
});

describe("describeStationSource", () => {
  it("credits NDBC buoys as analysis by Quiver", () => {
    expect(describeStationSource(view.primary, "buoy-v1")).toBe(
      "Analysis by Quiver of NOAA NDBC station 41113 (CDIP 143) hourly observations, 2007–2025, 150,000 hours. Method buoy-v1.",
    );
  });

  it("credits the airport archive for ASOS wind", () => {
    const airport = station({ id: "SNA", alias: null, name: "John Wayne Airport", kind: "iem-asos", role: "wind", yearsUsed: [2015, 2025], validHours: 90000 });
    expect(describeStationSource(airport, "buoy-v1")).toBe(
      "Analysis by Quiver of John Wayne Airport (SNA) hourly weather observations from the Iowa Environmental Mesonet ASOS archive, 2015–2025, 90,000 hours. Method buoy-v1.",
    );
  });
});

describe("ScoreExplainer", () => {
  it("lists all four parts and the CSV link when wind is available", () => {
    render(<ScoreExplainer hasWind csvHref="/data/surf-climatology/cocoa-beach.csv" scoreVersion="buoy-v1" />);

    expect(screen.getByText(/45%/)).toBeInTheDocument();
    expect(screen.getByText(/20%: share of mornings/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the monthly numbers (CSV)" })).toHaveAttribute(
      "href",
      "/data/surf-climatology/cocoa-beach.csv",
    );
  });

  it("explains the rescale and hides the link when there is no wind or CSV", () => {
    render(<ScoreExplainer hasWind={false} csvHref={null} scoreVersion="buoy-v1" />);

    expect(screen.queryByText(/share of mornings/)).not.toBeInTheDocument();
    expect(screen.getByText(/scaled up to fill the score/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("StationMap", () => {
  // next/jest loads .env files, and map-utils falls back to NEXT_PUBLIC_MAPBOX_TOKEN.
  const original = {
    access: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    legacy: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  };
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });
  // Assigning undefined to process.env stores the string "undefined", so restore by deleting.
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  afterEach(() => {
    restore("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", original.access);
    restore("NEXT_PUBLIC_MAPBOX_TOKEN", original.legacy);
  });

  it("lists places and station distances even without a Mapbox token", () => {
    render(<StationMap places={dataset.places} stations={[view.primary]} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("Cape Canaveral Nearshore (NDBC 41113): 7.7 km from Cocoa Beach Pier, 26.1 km from Satellite Beach"),
    ).toBeInTheDocument();
  });

  it("draws the static map with lettered places and numbered stations when a token exists", () => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test";
    render(<StationMap places={dataset.places} stations={[view.primary]} />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toContain("api.mapbox.com");
    expect(image.getAttribute("src")).toContain("pin-s-a+B04E1B");
    expect(image.getAttribute("src")).toContain("pin-s-1+1F5F7A");
    expect(screen.getByText("Map © Mapbox © OpenStreetMap")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-panels.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `BuoyMonthTable`**

```tsx
// components/best-time-to-surf/buoy-record/buoy-month-table.tsx
import { formatShare, type SeasonMonthView } from "@/lib/climatology/season-view";
import type { ClimatologyStation } from "@/lib/climatology/types";

const DASH = "—";
const HEADERS = [
  "Month",
  "Buoy score",
  "Buoy median (typical)",
  "Days 6 ft+",
  "Days under 2 ft",
  "Swell 10 s+",
  "Water",
  "Wetsuit",
] as const;

interface BuoyMonthTableProps {
  months: SeasonMonthView[];
  station: ClimatologyStation;
}

export function BuoyMonthTable({ months, station }: BuoyMonthTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#11100D]/15 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm text-[#11100D]">
        <caption className="px-4 py-3 text-left text-xs text-[#655C4C]">
          {`Monthly record at ${station.name}, ${station.yearsUsed[0]}–${station.yearsUsed[1]}. Heights are buoy readings, not surf at the beach.`}
        </caption>
        <thead className="bg-[#FBF6E8] text-xs uppercase tracking-wide text-[#655C4C]">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month} className="border-t border-[#11100D]/10">
              <th scope="row" className="px-4 py-2 font-semibold">
                {month.name}
                {month.isPeak && (
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-[#B04E1B]">Peak</span>
                )}
              </th>
              <td className="px-4 py-2 tabular-nums">{month.score ?? DASH}</td>
              <td className="px-4 py-2 tabular-nums">
                {month.waves
                  ? `${month.waves.hsFt.median} ft (${month.waves.hsFt.p25}–${month.waves.hsFt.p75})`
                  : DASH}
              </td>
              <td className="px-4 py-2 tabular-nums">{month.waves ? formatShare(month.waves.bigDayShare) : DASH}</td>
              <td className="px-4 py-2 tabular-nums">{month.waves ? formatShare(month.waves.smallDayShare) : DASH}</td>
              <td className="px-4 py-2 tabular-nums">
                {month.waves ? formatShare(month.waves.periodMix.atLeast10) : DASH}
              </td>
              <td className="px-4 py-2 tabular-nums">{month.waterMedianF !== null ? `${month.waterMedianF}°F` : DASH}</td>
              <td className="px-4 py-2">{month.wetsuit ?? DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement `SourceLine`**

```tsx
// components/best-time-to-surf/buoy-record/source-line.tsx
import type { ClimatologyStation } from "@/lib/climatology/types";

export function describeStationSource(station: ClimatologyStation, scoreVersion: string): string {
  const years = `${station.yearsUsed[0]}–${station.yearsUsed[1]}`;
  const hours = station.validHours.toLocaleString("en-US");
  if (station.kind === "iem-asos") {
    return `Analysis by Quiver of ${station.name} (${station.id}) hourly weather observations from the Iowa Environmental Mesonet ASOS archive, ${years}, ${hours} hours. Method ${scoreVersion}.`;
  }
  const alias = station.alias ? ` (${station.alias})` : "";
  return `Analysis by Quiver of NOAA NDBC station ${station.id}${alias} hourly observations, ${years}, ${hours} hours. Method ${scoreVersion}.`;
}

interface SourceLineProps {
  station: ClimatologyStation;
  scoreVersion: string;
}

export function SourceLine({ station, scoreVersion }: SourceLineProps) {
  return (
    <p className="mt-2 text-xs leading-5 text-[#655C4C]">
      {describeStationSource(station, scoreVersion)}{" "}
      <a href={station.pageUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        Station page
      </a>
    </p>
  );
}
```

- [ ] **Step 5: Implement `ScoreExplainer`**

```tsx
// components/best-time-to-surf/buoy-record/score-explainer.tsx
import { BUOY_SCORE_WEIGHTS } from "@/lib/climatology/score";

interface ScoreExplainerProps {
  hasWind: boolean;
  csvHref: string | null;
  scoreVersion: string;
}

const percent = (weight: number): string => `${Math.round(weight * 100)}%`;

export function ScoreExplainer({ hasWind, csvHref, scoreVersion }: ScoreExplainerProps) {
  return (
    <div className="mt-4 rounded-lg border border-[#11100D]/15 bg-[#FBF6E8] p-4 text-sm leading-6 text-[#11100D]">
      <h3 className="text-base font-semibold">How the buoy score works</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{`${percent(BUOY_SCORE_WEIGHTS.surfDays)}: share of days when the buoy's daytime median reached 2 ft`}</li>
        <li>{`${percent(BUOY_SCORE_WEIGHTS.groundswell)}: share of hours with swell of 10 seconds or longer`}</li>
        {hasWind && (
          <li>{`${percent(BUOY_SCORE_WEIGHTS.cleanMornings)}: share of mornings (6–9 am) with offshore wind or wind under 6 knots`}</li>
        )}
        <li>{`${percent(BUOY_SCORE_WEIGHTS.waterComfort)}: how comfortable the median water temperature is`}</li>
      </ul>
      {!hasWind && (
        <p className="mt-2">This page has no wind record we trust, so the other three parts are scaled up to fill the score.</p>
      )}
      <p className="mt-2 text-[#655C4C]">
        {`Method ${scoreVersion}. Buoy scores can be compared with each other. The monthly scores on city pages without buoy data use an older method.`}
      </p>
      {csvHref && (
        <a
          href={csvHref}
          download
          className="mt-3 inline-flex font-semibold text-ocean-blue underline-offset-2 hover:underline"
        >
          Download the monthly numbers (CSV)
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement `StationMap`**

```tsx
// components/best-time-to-surf/buoy-record/station-map.tsx
import Image from "next/image";

import { stationDistanceKm } from "@/lib/climatology/season-view";
import type { ClimatologyPlace, ClimatologyStation } from "@/lib/climatology/types";
import { getStaticMapImageUrlWithPins } from "@/lib/map-utils";

const PLACE_COLOR = "B04E1B";
const STATION_COLOR = "1F5F7A";

const placeLetter = (index: number): string => String.fromCharCode(97 + index);
const stationCode = (station: ClimatologyStation): string =>
  station.kind === "ndbc" ? `NDBC ${station.id}` : station.id;

interface StationMapProps {
  places: ClimatologyPlace[];
  stations: ClimatologyStation[];
}

export function StationMap({ places, stations }: StationMapProps) {
  const src = getStaticMapImageUrlWithPins(
    [
      ...places.map((place, index) => ({
        latitude: place.lat,
        longitude: place.lon,
        label: placeLetter(index),
        color: PLACE_COLOR,
      })),
      ...stations.map((station, index) => ({
        latitude: station.lat,
        longitude: station.lon,
        label: String(index + 1),
        color: STATION_COLOR,
      })),
    ],
    { width: 720, height: 360, padding: 48 },
  );

  return (
    <figure>
      {src && (
        <Image
          src={src}
          alt={`Map of ${places.map((place) => place.label).join(", ")} and the ${
            stations.length === 1 ? "station" : "stations"
          } used on this page`}
          width={720}
          height={360}
          unoptimized
          className="h-auto w-full rounded-lg border border-[#11100D]/15"
        />
      )}
      <figcaption className="mt-3 space-y-2 text-sm text-[#11100D]">
        <ul className="space-y-1">
          {places.map((place, index) => (
            <li key={place.label}>
              <span className="font-mono text-[#B04E1B]">{placeLetter(index)}</span>
              {` · ${place.label}`}
            </li>
          ))}
          {stations.map((station, index) => (
            <li key={station.id}>
              <span className="font-mono text-[#1F5F7A]">{index + 1}</span>
              {" · "}
              <span>
                {`${station.name} (${stationCode(station)}): ${places
                  .map((place) => `${stationDistanceKm(station, place)} km from ${place.label}`)
                  .join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
        {src && <p className="text-xs text-[#655C4C]">Map © Mapbox © OpenStreetMap</p>}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 7: Run the panel tests**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-panels.test.tsx`
Expected: PASS, 7 tests. If `getByText` for the station line fails because the text is split across elements, keep the component as written (the distance line is one text node inside the inner `<span>`) and check for stray whitespace in the template string.

- [ ] **Step 8: Lint and commit**

Run: `npx eslint --max-warnings=0 components/best-time-to-surf/buoy-record/`
Expected: no output.

```bash
git add components/best-time-to-surf/buoy-record/buoy-month-table.tsx components/best-time-to-surf/buoy-record/source-line.tsx components/best-time-to-surf/buoy-record/score-explainer.tsx components/best-time-to-surf/buoy-record/station-map.tsx __tests__/components/best-time-to-surf/buoy-record-panels.test.tsx
git commit -m "feat(best-time): add the buoy month table, source lines, score explainer and station map

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Licensed season photos

**Files:**
- Create: `lib/data/surf-climatology/season-photos.json`
- Create: `lib/climatology/season-photos.ts`
- Create: `components/best-time-to-surf/buoy-record/season-photo.tsx`
- Generated and committed: `public/images/seasons/cocoa-beach/*.webp`, `public/images/seasons/newport-beach/*.webp`
- Test: `__tests__/lib/climatology/season-photos.test.tsx`

**Interfaces:**
- Consumes: `parseApprovedRuntimePhotos` from `scripts/lib/beach-photo-candidates.ts` (test only); `requiresLicenseNotice` from `lib/photos/license-notice.ts`; the existing downloader `scripts/download-approved-seo-photos.ts` (center-crops to 1600×1200 WebP with ImageMagick and `cwebp`, both installed at `/opt/homebrew/bin`).
- Produces:
  - `type SeasonPhotoSlot = "hero" | "big-swell" | "typical-day" | "south-swell" | "comparison-north" | "comparison-south" | "buoy-limits"`
  - `interface SeasonPhoto { citySlug: string; slot: SeasonPhotoSlot; src: string; alt: string; caption: string; creator: string; licenseCode: string; licenseUrl: string; sourceUrl: string }`
  - `getSeasonPhotos(citySlug: string): SeasonPhoto[]`
  - `SeasonPhotoFigure({ photo: SeasonPhoto; priority?: boolean; className?: string })`

- [ ] **Step 1: Write the manifest**

`creator` is the Commons Artist field exactly (the Huntington file's Artist is "WPPilot"; Commons `User:WPPilot` redirects to *Category:Photographs by Don Ramey Logan*, so the credit names both). Public-domain entries use the Public Domain Mark URL because the downloader requires a `licenseUrl`.

```json
[
  {
    "citySlug": "cocoa-beach",
    "slot": "hero",
    "slug": "season-cocoa-beach-launch",
    "name": "launch-over-pier",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/e/ed/190221-F-DJ189-1003.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:190221-F-DJ189-1003.jpg",
    "title": "Falcon 9 night launch over the Cocoa Beach Pier",
    "creator": "U.S. Air Force photo by Airman 1st Class Dalton Williams",
    "licenseCode": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Cocoa Beach season hero. US federal work; verified on Commons 2026-09-25. Center-cropped to 4:3.",
    "runtimeAssetPath": "public/images/seasons/cocoa-beach/launch-over-pier.webp",
    "alt": "Long-exposure arc of a rocket launch rising behind the lit Cocoa Beach Pier at night",
    "caption": "A Falcon 9 launch from Cape Canaveral arcs over the Cocoa Beach Pier, February 21, 2019."
  },
  {
    "citySlug": "cocoa-beach",
    "slot": "big-swell",
    "slug": "season-cocoa-beach-bill",
    "name": "pier-hurricane-bill",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Pier_at_Cocoa_Beach_%283879447583%29.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Pier_at_Cocoa_Beach_(3879447583).jpg",
    "title": "Pier at Cocoa Beach",
    "creator": "Mangrove Mike from North Carolina, USA",
    "licenseCode": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Cocoa Beach big-swell photo. Licence verified on Commons 2026-09-25. Center-cropped to 4:3.",
    "runtimeAssetPath": "public/images/seasons/cocoa-beach/pier-hurricane-bill.webp",
    "alt": "Whitewater from a large swell running out to the end of the Cocoa Beach Pier on an overcast day",
    "caption": "Surf from Hurricane Bill at the Cocoa Beach Pier, August 21, 2009."
  },
  {
    "citySlug": "cocoa-beach",
    "slot": "typical-day",
    "slug": "season-cocoa-beach-south",
    "name": "pier-looking-south",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/4/41/Surfing_at_the_Cocoa_Beach_Pier_%28Cocoa_Beach%2C_Florida%29_005.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Surfing_at_the_Cocoa_Beach_Pier_(Cocoa_Beach,_Florida)_005.jpg",
    "title": "Surfing at the Cocoa Beach Pier",
    "creator": "Leonard J. DeFrancisci",
    "licenseCode": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Cocoa Beach typical-day photo. Licence verified on Commons 2026-09-25. Center-cropped to 4:3; the crop stays CC BY-SA 3.0.",
    "runtimeAssetPath": "public/images/seasons/cocoa-beach/pier-looking-south.webp",
    "alt": "Surfers on small lined-up waves south of the Cocoa Beach Pier, seen from the pier deck",
    "caption": "Looking south from the pier deck, January 18, 2014."
  },
  {
    "citySlug": "cocoa-beach",
    "slot": "buoy-limits",
    "slug": "season-cocoa-beach-satellite",
    "name": "satellite-beach-from-above",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/7/70/Satellite_Beach_from_the_air_%2835539816191%29.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Satellite_Beach_from_the_air_(35539816191).jpg",
    "title": "Satellite Beach from the air",
    "creator": "Michael Seeley from Melbourne, FL, United States",
    "licenseCode": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Cocoa Beach buoy-limits photo. Licence verified on Commons 2026-09-25. The 4:3 center crop removes the corner signature.",
    "runtimeAssetPath": "public/images/seasons/cocoa-beach/satellite-beach-from-above.webp",
    "alt": "Satellite Beach seen from directly above: dunes, sand and small waves breaking unevenly close to shore",
    "caption": "Satellite Beach from directly above, July 2, 2017. Small waves break unevenly along the inside sandbar."
  },
  {
    "citySlug": "newport-beach",
    "slot": "hero",
    "slug": "season-newport-pier",
    "name": "newport-pier-aerial",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Newport_Pier_2_copy_by_Don_Ramey_Logan.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Newport_Pier_2_copy_by_Don_Ramey_Logan.jpg",
    "title": "Newport Pier",
    "creator": "Don Ramey Logan",
    "licenseCode": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Newport Beach season hero. Licence verified on Commons 2026-09-25. Do not caption as Blackies: the metadata does not say which side that is. Center-cropped to 4:3.",
    "runtimeAssetPath": "public/images/seasons/newport-beach/newport-pier-aerial.webp",
    "alt": "Aerial view of Newport Pier with whitewater on the sandbars on both sides of the pier",
    "caption": "Newport Pier from the air, October 20, 2018."
  },
  {
    "citySlug": "newport-beach",
    "slot": "south-swell",
    "slug": "season-newport-wedge",
    "name": "the-wedge",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/4/4c/The_Wedge.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:The_Wedge.jpg",
    "title": "The Wedge",
    "creator": "SkiEngineer",
    "licenseCode": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Newport Beach south-swell photo. Licence verified on Commons 2026-09-25. Center-cropped to 4:3; the crop stays CC BY-SA 4.0.",
    "runtimeAssetPath": "public/images/seasons/newport-beach/the-wedge.webp",
    "alt": "A thick green wave pitching at the Wedge with a rider in the lip",
    "caption": "The Wedge on August 4, 2016."
  },
  {
    "citySlug": "newport-beach",
    "slot": "comparison-north",
    "slug": "season-huntington-pier",
    "name": "huntington-pier-aerial",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/7/7c/HB_Pier_by_Don_Ramey_Logan.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:HB_Pier_by_Don_Ramey_Logan.jpg",
    "title": "HB Pier",
    "creator": "Don Ramey Logan (WPPilot)",
    "licenseCode": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Newport Beach page, Huntington comparison. Commons Artist is WPPilot; User:WPPilot redirects to Category:Photographs by Don Ramey Logan. Licence verified 2026-09-25. Center-cropped to 4:3; the crop stays CC BY-SA 4.0.",
    "runtimeAssetPath": "public/images/seasons/newport-beach/huntington-pier-aerial.webp",
    "alt": "Aerial view of Huntington Beach Pier and the long straight beach with small lines of surf",
    "caption": "Huntington Beach Pier from the air, April 15, 2026."
  },
  {
    "citySlug": "newport-beach",
    "slot": "comparison-south",
    "slug": "season-strands",
    "name": "strands-from-headlands",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Orange_County_%2826007449440%29.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Orange_County_(26007449440).jpg",
    "title": "Orange County",
    "creator": "Sergei Gussev",
    "licenseCode": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "licenseStatus": "defensible",
    "usageNotes": "Newport Beach page, Dana Point comparison. Licence verified on Commons 2026-09-25. Center-cropped to 4:3.",
    "runtimeAssetPath": "public/images/seasons/newport-beach/strands-from-headlands.webp",
    "alt": "Strands Beach and the coast beyond, seen from the Dana Point Headlands, with white lines of surf",
    "caption": "Strands Beach from the Dana Point Headlands, April 2, 2016."
  }
]
```

- [ ] **Step 2: Download and crop the photos**

Run: `yarn tsx scripts/download-approved-seo-photos.ts --manifest lib/data/surf-climatology/season-photos.json`
Expected: eight "Wrote public/images/seasons/…webp" lines.

- [ ] **Step 3: Look at every crop**

Open each of the eight WebP files with the Read tool. Check that the crop keeps the subject: the launch arc and the pier in the hero, the rider at the Wedge, the pier in both aerials, the sandbar in the Satellite Beach frame, and that no watermark or signature remains. If a center crop cuts the subject, stop and report which file; do not hand-edit images in this task.

- [ ] **Step 4: Write the failing photo test**

```tsx
// __tests__/lib/climatology/season-photos.test.tsx
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import { SeasonPhotoFigure } from "@/components/best-time-to-surf/buoy-record/season-photo";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { parseApprovedRuntimePhotos } from "@/scripts/lib/beach-photo-candidates";

const ALLOWED_LICENSES = /^(Public domain|CC0 1\.0|CC BY \d\.\d|CC BY-SA \d\.\d)$/;
const MANIFEST_PATH = join(process.cwd(), "lib/data/surf-climatology/season-photos.json");

describe("season photo manifest", () => {
  it("is a valid approved-photo manifest for the downloader", () => {
    expect(() => parseApprovedRuntimePhotos(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")))).not.toThrow();
  });

  it.each(["cocoa-beach", "newport-beach"])("gives %s four photos in distinct slots with files on disk", (slug) => {
    const photos = getSeasonPhotos(slug);

    expect(photos).toHaveLength(4);
    expect(new Set(photos.map((photo) => photo.slot)).size).toBe(4);
    expect(photos.some((photo) => photo.slot === "hero")).toBe(true);
    for (const photo of photos) {
      expect(photo.licenseCode).toMatch(ALLOWED_LICENSES);
      expect(photo.src.startsWith(`/images/seasons/${slug}/`)).toBe(true);
      expect(existsSync(join(process.cwd(), "public", photo.src))).toBe(true);
    }
  });

  it("never captions a Newport photo as Blackies", () => {
    for (const photo of getSeasonPhotos("newport-beach")) {
      expect(`${photo.alt} ${photo.caption}`).not.toMatch(/blackies/i);
    }
  });

  it("has no photos for cities without season copy", () => {
    expect(getSeasonPhotos("honolulu")).toEqual([]);
  });
});

describe("SeasonPhotoFigure", () => {
  const [cocoaHero, , cocoaTypical] = getSeasonPhotos("cocoa-beach");

  it("credits a public-domain photo without a licence label", () => {
    render(<SeasonPhotoFigure photo={cocoaHero} />);

    expect(screen.getByRole("link", { name: "Photo: U.S. Air Force photo by Airman 1st Class Dalton Williams" })).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:190221-F-DJ189-1003.jpg",
    );
    expect(screen.queryByText(/cropped/)).not.toBeInTheDocument();
  });

  it("names and links the licence of a Creative Commons photo and says it was cropped", () => {
    render(<SeasonPhotoFigure photo={cocoaTypical} />);

    expect(screen.getByRole("link", { name: "CC BY-SA 3.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/3.0/",
    );
    expect(screen.getByText(/cropped/)).toBeInTheDocument();
    expect(screen.getByAltText(cocoaTypical.alt)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to confirm failure**

Run: `yarn test:unit __tests__/lib/climatology/season-photos.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 6: Implement `season-photos.ts`**

```ts
// lib/climatology/season-photos.ts
import manifest from "@/lib/data/surf-climatology/season-photos.json";

export type SeasonPhotoSlot =
  | "hero"
  | "big-swell"
  | "typical-day"
  | "south-swell"
  | "comparison-north"
  | "comparison-south"
  | "buoy-limits";

const SLOTS: readonly SeasonPhotoSlot[] = [
  "hero",
  "big-swell",
  "typical-day",
  "south-swell",
  "comparison-north",
  "comparison-south",
  "buoy-limits",
];

export interface SeasonPhoto {
  citySlug: string;
  slot: SeasonPhotoSlot;
  src: string;
  alt: string;
  caption: string;
  creator: string;
  licenseCode: string;
  licenseUrl: string;
  sourceUrl: string;
}

function toSeasonPhoto(entry: (typeof manifest)[number]): SeasonPhoto {
  const slot = SLOTS.find((candidate) => candidate === entry.slot);
  if (!slot) throw new Error(`Unknown season photo slot ${entry.slot}`);
  return {
    citySlug: entry.citySlug,
    slot,
    // The manifest stores the repo path the downloader writes to.
    src: entry.runtimeAssetPath.replace(/^public/, ""),
    alt: entry.alt,
    caption: entry.caption,
    creator: entry.creator,
    licenseCode: entry.licenseCode,
    licenseUrl: entry.licenseUrl,
    sourceUrl: entry.sourceUrl,
  };
}

const PHOTOS: readonly SeasonPhoto[] = manifest.map(toSeasonPhoto);

export function getSeasonPhotos(citySlug: string): SeasonPhoto[] {
  return PHOTOS.filter((photo) => photo.citySlug === citySlug);
}
```

- [ ] **Step 7: Implement `SeasonPhotoFigure`**

```tsx
// components/best-time-to-surf/buoy-record/season-photo.tsx
import Image from "next/image";

import type { SeasonPhoto } from "@/lib/climatology/season-photos";
import { requiresLicenseNotice } from "@/lib/photos/license-notice";

interface SeasonPhotoFigureProps {
  photo: SeasonPhoto;
  priority?: boolean;
  className?: string;
}

export function SeasonPhotoFigure({ photo, priority = false, className }: SeasonPhotoFigureProps) {
  return (
    <figure className={className}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#11100D]/15 bg-[#EEE3C9]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 460px, 100vw"
          className="object-cover"
        />
      </div>
      <figcaption className="mt-2 text-xs leading-5 text-[#655C4C]">
        {photo.caption}{" "}
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {`Photo: ${photo.creator}`}
        </a>
        {/* Public-domain photos need no licence label; CC photos were cropped by the downloader. */}
        {requiresLicenseNotice(photo.licenseCode) && (
          <>
            {", "}
            <a
              href={photo.licenseUrl}
              target="_blank"
              rel="license noopener noreferrer"
              className="underline underline-offset-2"
            >
              {photo.licenseCode}
            </a>
            {", cropped"}
          </>
        )}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 8: Run the photo test**

Run: `yarn test:unit __tests__/lib/climatology/season-photos.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 9: Commit**

```bash
git add lib/data/surf-climatology/season-photos.json lib/climatology/season-photos.ts components/best-time-to-surf/buoy-record/season-photo.tsx public/images/seasons __tests__/lib/climatology/season-photos.test.tsx
git commit -m "feat(best-time): add licensed, credited season photos for Newport and Cocoa

Eight Wikimedia Commons photos (one US Air Force public-domain, seven CC BY
or CC BY-SA), none reused on their Wikipedia articles, cropped to 4:3 and
credited under each image.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Data-driven page copy and the voice test

**Files:**
- Create: `lib/climatology/season-copy.ts`
- Create: `lib/data/surf-climatology/copy/cocoa-beach.ts`
- Create: `lib/data/surf-climatology/copy/newport-beach.ts`
- Create: `lib/data/surf-climatology/copy/index.ts`
- Test: `__tests__/data/surf-climatology-copy-voice.test.ts`

**Interfaces:**
- Consumes: `DataBackedSeasonView`, `joinNames`, `formatShare`, `seasonalDirectionMix`, `buildDataBackedSeasonView` (Task 8); `haversineKm` (Task 5); `PEAK_BAND_POINTS` (Task 4); `getSeasonPhotos` (Task 11).
- Produces:
  - `interface SeasonCopyContext { dataset: SurfClimatologyDataset; view: DataBackedSeasonView }`
  - `interface SeasonCopySource { label: string; url: string }`
  - `interface SeasonCopy { answerHeading(c): string; answer(c): string[]; comparisonHeading: string; comparison(c): string[]; limitsHeading: string; limits(c): string[]; sources: SeasonCopySource[] }`
  - `describePeakAndQuiet(view: DataBackedSeasonView): string[]`
  - `getSeasonCopy(citySlug: string): SeasonCopy | null`

Every number in the copy is read from the dataset at render time. The copy states figures, cites a named source, or says what a figure cannot show. Nothing else.

- [ ] **Step 1: Write the failing voice test**

```ts
// __tests__/data/surf-climatology-copy-voice.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getSurfClimatology } from "@/lib/climatology/get-surf-climatology";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { getSeasonCopy } from "@/lib/data/surf-climatology/copy";

const BANNED: Array<[string, RegExp]> = [
  ["a not-just reversal", /\bnot (just|merely|only)\b[^.]*[,;—]\s*(it'?s|but)\b/i],
  ["an it's-not-X-it's-Y line", /\bit'?s not\b[^.]*,\s*it'?s\b/i],
  ["whether you're", /\bwhether you'?re\b/i],
  ["stunning", /\bstunning\b/i],
  ["nestled", /\bnestled\b/i],
  ["hidden gem", /\bhidden gem\b/i],
  ["breathtaking", /\bbreathtaking\b/i],
  ["in this guide", /\bin this guide\b/i],
  ["comprehensive", /\bcomprehensive\b/i],
  ["unlock", /\bunlock/i],
  ["elevate", /\belevate/i],
  ["dive into", /\bdive into\b/i],
  ["magic", /\bmagic/i],
  ["bold emphasis", /\*\*|<strong|<b>/i],
];

const COMPONENT_FILES = [
  "buoy-month-table.tsx",
  "direction-mix-chart.tsx",
  "score-by-month-chart.tsx",
  "score-explainer.tsx",
  "season-photo.tsx",
  "source-line.tsx",
  "station-map.tsx",
  "wave-range-chart.tsx",
  "wind-by-time-chart.tsx",
].map((file) => join(process.cwd(), "components/best-time-to-surf/buoy-record", file));

function renderedText(slug: string): string[] {
  const dataset = getSurfClimatology(slug);
  if (!dataset) throw new Error(`no dataset for ${slug}`);
  const copy = getSeasonCopy(slug);
  const texts: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const view = buildDataBackedSeasonView(dataset, month);
    texts.push(view.weekAnswer, view.heroDetail, view.bestMonthFaq, view.waterFaq, view.yearRoundFaq);
    if (!copy) continue;
    const context = { dataset, view };
    texts.push(
      copy.answerHeading(context),
      ...copy.answer(context),
      copy.comparisonHeading,
      ...copy.comparison(context),
      copy.limitsHeading,
      ...copy.limits(context),
    );
  }
  for (const photo of getSeasonPhotos(slug)) texts.push(photo.alt, photo.caption);
  return texts;
}

describe.each(["cocoa-beach", "newport-beach", "honolulu"])("%s page text", (slug) => {
  it.each(BANNED)("contains no %s", (_label, pattern) => {
    for (const text of renderedText(slug)) expect(text).not.toMatch(pattern);
  });

  it("never calls a buoy number waves or surf", () => {
    for (const text of renderedText(slug)) {
      expect(text).not.toMatch(/\d(\.\d)?\s*ft (waves|surf)\b/i);
    }
  });

  it("prints no undefined, NaN or null", () => {
    for (const text of renderedText(slug)) expect(text).not.toMatch(/undefined|NaN|\bnull\b/);
  });
});

describe("season copy", () => {
  it("exists for Newport and Cocoa only", () => {
    expect(getSeasonCopy("cocoa-beach")).not.toBeNull();
    expect(getSeasonCopy("newport-beach")).not.toBeNull();
    expect(getSeasonCopy("honolulu")).toBeNull();
  });

  it("gives each city its own headings", () => {
    const headings = (slug: string): string[] => {
      const dataset = getSurfClimatology(slug);
      const copy = getSeasonCopy(slug);
      if (!dataset || !copy) throw new Error(`missing ${slug}`);
      const context = { dataset, view: buildDataBackedSeasonView(dataset, 1) };
      return [copy.answerHeading(context), copy.comparisonHeading, copy.limitsHeading];
    };
    const cocoa = headings("cocoa-beach");
    for (const heading of headings("newport-beach")) expect(cocoa).not.toContain(heading);
  });

  it.each(COMPONENT_FILES)("%s contains no banned phrase", (file) => {
    const source = readFileSync(file, "utf8");
    for (const [, pattern] of BANNED) expect(source).not.toMatch(pattern);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/data/surf-climatology-copy-voice.test.ts`
Expected: FAIL, `@/lib/data/surf-climatology/copy` not found.

- [ ] **Step 3: Implement `season-copy.ts`**

```ts
// lib/climatology/season-copy.ts
import { PEAK_BAND_POINTS } from "./score";
import { formatShare, joinNames, type DataBackedSeasonView } from "./season-view";
import type { SurfClimatologyDataset } from "./types";

export interface SeasonCopyContext {
  dataset: SurfClimatologyDataset;
  view: DataBackedSeasonView;
}

export interface SeasonCopySource {
  label: string;
  url: string;
}

export interface SeasonCopy {
  answerHeading: (context: SeasonCopyContext) => string;
  answer: (context: SeasonCopyContext) => string[];
  comparisonHeading: string;
  comparison: (context: SeasonCopyContext) => string[];
  limitsHeading: string;
  limits: (context: SeasonCopyContext) => string[];
  sources: SeasonCopySource[];
}

export const NOAA_WAVE_HEIGHT_SOURCE: SeasonCopySource = {
  label: "NOAA NDBC: how wave height is measured",
  url: "https://www.ndbc.noaa.gov/faq/measdes.shtml",
};

export const SIGNIFICANT_HEIGHT_SENTENCE =
  "The buoy reports significant wave height, which NOAA defines as the average height of the highest third of the waves it measures.";

export const formatKm = (km: number): string => `${Math.round(km * 10) / 10} km`;

/** The opening paragraphs for a buoy-backed city. Every number comes from the view. */
export function describePeakAndQuiet(view: DataBackedSeasonView): string[] {
  const { peakMonth, peakBand, quietMonth, primary } = view;
  if (!peakMonth?.waves || peakMonth.score === null) {
    return [`There isn't enough ${primary.name} buoy data to name a best month.`];
  }

  const others = peakBand.filter((month) => month.month !== peakMonth.month).map((month) => month.name);
  const paragraphs = [
    `${peakMonth.name} scores highest on the ${primary.name} buoy record, ${peakMonth.score}/100.` +
      (others.length > 0
        ? ` ${joinNames(others)} ${others.length === 1 ? "is" : "are"} within ${PEAK_BAND_POINTS} points of it.`
        : ""),
    `In ${peakMonth.name} the buoy's median reading is ${peakMonth.waves.hsFt.median} ft. ` +
      `${formatShare(peakMonth.waves.bigDayShare)} of its days held 6 ft or more for at least three hours, ` +
      `and ${formatShare(peakMonth.waves.periodMix.atLeast10)} of its hours had swell of 10 seconds or longer.`,
  ];
  if (quietMonth?.waves && quietMonth.month !== peakMonth.month) {
    paragraphs.push(
      `${quietMonth.name} is the quietest month: on ${formatShare(quietMonth.waves.smallDayShare)} of its days the daytime median stayed under 2 ft.`,
    );
  }
  return paragraphs;
}
```

- [ ] **Step 4: Implement the Cocoa copy**

```ts
// lib/data/surf-climatology/copy/cocoa-beach.ts
import { haversineKm } from "@/lib/climatology/geo";
import {
  describePeakAndQuiet,
  formatKm,
  NOAA_WAVE_HEIGHT_SOURCE,
  SIGNIFICANT_HEIGHT_SENTENCE,
  type SeasonCopy,
} from "@/lib/climatology/season-copy";

export const COCOA_BEACH_SEASON_COPY: SeasonCopy = {
  answerHeading: ({ view }) =>
    `What ${view.primary.yearsUsed[1] - view.primary.yearsUsed[0] + 1} years of the Cape Canaveral buoy show`,
  answer: ({ view }) => describePeakAndQuiet(view),
  comparisonHeading: "Satellite Beach on the same buoy",
  comparison: ({ dataset, view }) => {
    const satellite = dataset.places.find((place) => place.label === "Satellite Beach");
    if (!satellite) return [];
    return [
      `Satellite Beach is ${formatKm(haversineKm(view.primary, satellite))} from the ${view.primary.name} buoy; the Cocoa Beach Pier is ${formatKm(view.primary.distanceKm)} from it. The monthly numbers on this page stand for both beaches.`,
      "They can't tell you which beach is bigger on a given morning. That comes down to the sandbars in front of each one.",
    ];
  },
  limitsHeading: "What the buoy can't tell you about the pier",
  limits: ({ view }) => [
    `${SIGNIFICANT_HEIGHT_SENTENCE} It measures the swell ${formatKm(view.primary.distanceKm)} from the pier, before that swell reaches the sandbars.`,
    "Surf at the pier depends on those bars, and they move after big swells, so the same swell on the buoy can break differently from one month to the next.",
    view.wind
      ? `Wind comes from ${view.wind.name} at Port Canaveral, ${formatKm(view.wind.distanceKm)} from the Cocoa Beach Pier.`
      : "We don't have a wind record we trust near the pier, so wind isn't part of this page's score.",
  ],
  sources: [NOAA_WAVE_HEIGHT_SOURCE],
};
```

- [ ] **Step 5: Implement the Newport copy**

```ts
// lib/data/surf-climatology/copy/newport-beach.ts
import { haversineKm } from "@/lib/climatology/geo";
import {
  describePeakAndQuiet,
  formatKm,
  NOAA_WAVE_HEIGHT_SOURCE,
  SIGNIFICANT_HEIGHT_SENTENCE,
  type SeasonCopy,
} from "@/lib/climatology/season-copy";
import { formatShare, seasonalDirectionMix } from "@/lib/climatology/season-view";
import type { Sector } from "@/lib/climatology/types";

const southShare = (mix: Record<Sector, number>): string => formatShare(mix.S + mix.SW);
const westShare = (mix: Record<Sector, number>): string => formatShare(mix.W + mix.NW);

const SHARED_BUOY_NOTE =
  "Huntington Beach and Newport share one buoy here, so these numbers can't say which of the two is bigger on a given day.";

export const NEWPORT_BEACH_SEASON_COPY: SeasonCopy = {
  answerHeading: () => "Newport's months, read from the San Pedro South buoy",
  answer: ({ view }) => describePeakAndQuiet(view),
  comparisonHeading: "Huntington and Newport against Dana Point",
  comparison: ({ dataset, view }) => {
    const huntington = dataset.places.find((place) => place.label === "Huntington Beach Pier");
    const doheny = dataset.places.find((place) => place.label === "Doheny State Beach");
    if (!view.comparison || !huntington || !doheny) {
      return [
        "Oceanside Offshore's record didn't pass our coverage check, so this page doesn't compare Dana Point and San Clemente.",
        SHARED_BUOY_NOTE,
      ];
    }

    const [firstYear, lastYear] = view.primary.yearsUsed;
    const intro =
      `San Pedro South is ${formatKm(haversineKm(view.primary, huntington))} from the Huntington Beach Pier and ` +
      `${formatKm(view.primary.distanceKm)} from Newport Pier, so it stands in for both. Oceanside Offshore, ` +
      `${formatKm(haversineKm(view.comparison, doheny))} from Doheny State Beach, stands in for Dana Point and ` +
      `San Clemente. Both records cover ${firstYear}–${lastYear}.`;

    const summerHome = seasonalDirectionMix(dataset, "waves", [6, 7, 8]);
    const summerAway = seasonalDirectionMix(dataset, "comparison-waves", [6, 7, 8]);
    const winterHome = seasonalDirectionMix(dataset, "waves", [12, 1, 2]);
    const winterAway = seasonalDirectionMix(dataset, "comparison-waves", [12, 1, 2]);
    if (!summerHome || !summerAway || !winterHome || !winterAway) return [intro, SHARED_BUOY_NOTE];

    return [
      intro,
      `From June to August, ${southShare(summerHome)} of hours at San Pedro South had swell from the south or southwest, ` +
        `against ${southShare(summerAway)} at Oceanside Offshore. From December to February, swell from the west or ` +
        `northwest made up ${westShare(winterHome)} of hours at San Pedro South and ${westShare(winterAway)} at Oceanside Offshore.`,
      SHARED_BUOY_NOTE,
    ];
  },
  limitsHeading: "Where the buoy and the beach part ways",
  limits: ({ view }) => [
    `${SIGNIFICANT_HEIGHT_SENTENCE} San Pedro South sits ${formatKm(view.primary.distanceKm)} from Newport Pier, and swell changes as it crosses shallower water and bends around headlands on the way in.`,
    "The Wedge, beside the Newport Harbor jetty, gets its shape from swell reflecting off the jetty. No buoy measures that.",
    view.wind
      ? `Wind comes from ${view.wind.name}, ${formatKm(view.wind.distanceKm)} inland from Newport Pier. Wind at the beach can differ from the airport; the useful part is the timing of the afternoon onshore breeze.`
      : "We don't have a wind record we trust near Newport, so wind isn't part of this page's score.",
  ],
  sources: [
    NOAA_WAVE_HEIGHT_SOURCE,
    { label: "Wikipedia: The Wedge", url: "https://en.wikipedia.org/wiki/The_Wedge_(surfing)" },
  ],
};
```

- [ ] **Step 6: Implement the registry**

```ts
// lib/data/surf-climatology/copy/index.ts
import type { SeasonCopy } from "@/lib/climatology/season-copy";
import { COCOA_BEACH_SEASON_COPY } from "./cocoa-beach";
import { NEWPORT_BEACH_SEASON_COPY } from "./newport-beach";

const SEASON_COPY: Readonly<Record<string, SeasonCopy>> = {
  "cocoa-beach": COCOA_BEACH_SEASON_COPY,
  "newport-beach": NEWPORT_BEACH_SEASON_COPY,
};

export function getSeasonCopy(citySlug: string): SeasonCopy | null {
  return SEASON_COPY[citySlug] ?? null;
}
```

- [ ] **Step 7: Run the voice test**

Run: `yarn test:unit __tests__/data/surf-climatology-copy-voice.test.ts`
Expected: PASS. A failure here is a copy problem: fix the sentence, never loosen the pattern.

- [ ] **Step 8: Print the rendered copy for review**

Run:

```bash
yarn tsx -e 'import { getSurfClimatology } from "./lib/climatology/get-surf-climatology"; import { buildDataBackedSeasonView } from "./lib/climatology/season-view"; import { getSeasonCopy } from "./lib/data/surf-climatology/copy"; for (const slug of ["cocoa-beach", "newport-beach"]) { const dataset = getSurfClimatology(slug)!; const copy = getSeasonCopy(slug)!; const context = { dataset, view: buildDataBackedSeasonView(dataset, 9) }; console.log(`\n## ${slug}\n`); console.log([copy.answerHeading(context), ...copy.answer(context), "", copy.comparisonHeading, ...copy.comparison(context), "", copy.limitsHeading, ...copy.limits(context)].join("\n")); }'
```

Read the output as a surfer would. Check that each percentage reads sensibly (no "0% of its days" in a month called the best), that the peak band names months in calendar order, and that nothing claims more than the numbers show. Save the output to the scratchpad for Steven's review in Task 14.

- [ ] **Step 9: Commit**

```bash
git add lib/climatology/season-copy.ts lib/data/surf-climatology/copy __tests__/data/surf-climatology-copy-voice.test.ts
git commit -m "feat(best-time): write data-driven season copy for Newport and Cocoa

Every number in the copy is read from the buoy dataset at render time. A
voice test blocks stock phrases and calling a buoy number surf.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Wire the buoy record into the page, the Dataset schema and the sitemap

**Files:**
- Create: `components/best-time-to-surf/buoy-record/buoy-record-sections.tsx`
- Create: `components/seo/dataset-schema.tsx`
- Modify: `app/best-time-to-surf/[city]/page.tsx`
- Modify: `app/sitemap.ts` (`getBestTimeToSurfRoutes`)
- Test: `__tests__/components/best-time-to-surf/buoy-record-sections.test.tsx`
- Test: `__tests__/components/seo/dataset-schema.test.tsx`
- Modify: `__tests__/app/best-time-city-page.test.ts` (new source-level case)

**Interfaces:**
- Consumes: everything from Tasks 8–12; `SITE_URL` from `lib/constants/seo`; `latestSitemapDate(fallback, ...values)` in `app/sitemap.ts`.
- Produces:
  - `BuoyRecordSections({ dataset: SurfClimatologyDataset; view: DataBackedSeasonView; copy: SeasonCopy | null; photos: SeasonPhoto[]; csvHref: string | null })`
  - `DatasetSchema({ dataset: SurfClimatologyDataset; csvPath: string })`

- [ ] **Step 1: Write the failing section and schema tests**

```tsx
// __tests__/components/best-time-to-surf/buoy-record-sections.test.tsx
import { render, screen } from "@testing-library/react";

import { BuoyRecordSections } from "@/components/best-time-to-surf/buoy-record/buoy-record-sections";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { getSeasonCopy } from "@/lib/data/surf-climatology/copy";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { makeDataset, station, windStats } from "../../lib/climatology/fixtures/dataset";

const SCORES = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];

describe("BuoyRecordSections", () => {
  it("renders only the data sections for a city without copy", () => {
    const dataset = makeDataset(SCORES);
    render(
      <BuoyRecordSections
        dataset={dataset}
        view={buildDataBackedSeasonView(dataset, 9)}
        copy={null}
        photos={[]}
        csvHref={null}
      />,
    );

    for (const heading of [
      "Buoy score by month",
      "Month by month at the buoy",
      "How big the buoy reads each month",
      "Where the swell comes from",
      "Where these numbers come from",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "Wind by time of day" })).not.toBeInTheDocument();
    expect(screen.queryByText("Download the monthly numbers (CSV)")).not.toBeInTheDocument();
  });

  it("adds copy, wind, photos and the CSV link for Cocoa", () => {
    const dataset = makeDataset(SCORES, {
      stations: [station(), station({ id: "TRDF1", alias: "CO-OPS 8721604", name: "Trident Pier", role: "wind", lat: 28.416, lon: -80.593, distanceKm: 5.5 })],
    });
    dataset.months = dataset.months.map((month) => ({ ...month, wind: windStats() }));
    const copy = getSeasonCopy("cocoa-beach");

    render(
      <BuoyRecordSections
        dataset={dataset}
        view={buildDataBackedSeasonView(dataset, 9)}
        copy={copy}
        photos={getSeasonPhotos("cocoa-beach")}
        csvHref="/data/surf-climatology/cocoa-beach.csv"
      />,
    );

    expect(screen.getByRole("heading", { name: "What 19 years of the Cape Canaveral buoy show" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Satellite Beach on the same buoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the buoy can't tell you about the pier" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wind by time of day" })).toBeInTheDocument();
    expect(screen.getByText("Download the monthly numbers (CSV)")).toBeInTheDocument();
    expect(screen.getByAltText(/Satellite Beach seen from directly above/)).toBeInTheDocument();
    expect(screen.queryByAltText(/rocket launch/)).not.toBeInTheDocument(); // hero renders in the page header
    expect(screen.getByRole("link", { name: "NOAA NDBC: how wave height is measured" })).toBeInTheDocument();
  });

  it("says when a station failed its coverage check", () => {
    const dataset = makeDataset(SCORES, {
      stations: [station(), station({ id: "46224", name: "Oceanside Offshore", role: "comparison-waves", gate: "failed", gateCoverage: 0.81 })],
    });
    render(
      <BuoyRecordSections dataset={dataset} view={buildDataBackedSeasonView(dataset, 9)} copy={null} photos={[]} csvHref={null} />,
    );

    expect(
      screen.getByText("Oceanside Offshore (NDBC 46224) had 81% of hours recorded, below our 90% bar, so this page doesn't use it."),
    ).toBeInTheDocument();
  });

  it("names the sea-breeze check when a well-covered wind record fails", () => {
    const dataset = makeDataset(SCORES, {
      stations: [
        station(),
        station({ id: "SNA", alias: null, name: "John Wayne Airport", kind: "iem-asos", role: "wind", gate: "failed", gateCoverage: 0.97 }),
      ],
    });
    render(
      <BuoyRecordSections dataset={dataset} view={buildDataBackedSeasonView(dataset, 9)} copy={null} photos={[]} csvHref={null} />,
    );

    expect(
      screen.getByText("John Wayne Airport (SNA) didn't show the summer afternoon sea breeze we check wind records for, so this page doesn't use it."),
    ).toBeInTheDocument();
  });
});
```

```tsx
// __tests__/components/seo/dataset-schema.test.tsx
import { render } from "@testing-library/react";

import { DatasetSchema } from "@/components/seo/dataset-schema";
import { makeDataset, station } from "../../lib/climatology/fixtures/dataset";

describe("DatasetSchema", () => {
  it("describes the downloadable CSV and only the stations actually used", () => {
    const dataset = makeDataset([40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50], {
      stations: [station(), station({ id: "TRDF1", role: "wind", gate: "failed", pageUrl: "https://example.test/trdf1" })],
    });
    const { container } = render(<DatasetSchema dataset={dataset} csvPath="/data/surf-climatology/cocoa-beach.csv" />);
    const json = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");

    expect(json["@type"]).toBe("Dataset");
    expect(json.name).toBe("Cocoa Beach monthly buoy statistics");
    expect(json.isBasedOn).toEqual(["https://www.ndbc.noaa.gov/station_page.php?station=41113"]);
    expect(json.temporalCoverage).toBe("2007-01-01/2025-12-31");
    expect(json.variableMeasured).not.toContain("Wind speed");
    expect(json.distribution).toEqual([
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: expect.stringMatching(/\/data\/surf-climatology\/cocoa-beach\.csv$/),
      },
    ]);
    expect(json.description.length).toBeGreaterThanOrEqual(50);
  });
});
```

Add to `__tests__/app/best-time-city-page.test.ts`, next to the existing source-level cases:

```ts
  it("switches buoy-backed cities to the dataset for every seasonal field", () => {
    const source = readFileSync(join(process.cwd(), "app/best-time-to-surf/[city]/page.tsx"), "utf8");

    expect(source).toContain("getSurfClimatology(citySlug)");
    expect(source).toContain("<BuoyRecordSections");
    expect(source).toContain("weekAnswerOverride: seasonView?.weekAnswer");
    expect(source).toContain("seasonView ? seasonView.heroDetail");
    expect(source).toContain("seasonView ? seasonView.waterFaq");
    expect(source).toMatch(/!seasonView && beach\.bestMonths\.length > 0/);
    // The legacy sections stay for every other city.
    expect(source).toContain("Surf Score by Month");
    expect(source).toContain("Dawn Patrol vs Afternoon Sessions");
  });
```

- [ ] **Step 2: Run to confirm failure**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-sections.test.tsx __tests__/components/seo/dataset-schema.test.tsx __tests__/app/best-time-city-page.test.ts`
Expected: FAIL (modules missing; source assertions fail).

- [ ] **Step 3: Implement `BuoyRecordSections`**

```tsx
// components/best-time-to-surf/buoy-record/buoy-record-sections.tsx
import { GATE_COVERAGE } from "@/lib/climatology/coverage";
import type { SeasonCopy } from "@/lib/climatology/season-copy";
import type { SeasonPhoto, SeasonPhotoSlot } from "@/lib/climatology/season-photos";
import { SEASONS, seasonalDirectionMix, type DataBackedSeasonView } from "@/lib/climatology/season-view";
import type { ClimatologyStation, SurfClimatologyDataset } from "@/lib/climatology/types";
import { BuoyMonthTable } from "./buoy-month-table";
import { DirectionMixChart } from "./direction-mix-chart";
import { ScoreByMonthChart } from "./score-by-month-chart";
import { ScoreExplainer } from "./score-explainer";
import { SeasonPhotoFigure } from "./season-photo";
import { SourceLine } from "./source-line";
import { StationMap } from "./station-map";
import { WaveRangeChart } from "./wave-range-chart";
import { WindByTimeChart } from "./wind-by-time-chart";

interface BuoyRecordSectionsProps {
  dataset: SurfClimatologyDataset;
  view: DataBackedSeasonView;
  copy: SeasonCopy | null;
  photos: SeasonPhoto[];
  csvHref: string | null;
}

// A wind source can fail on coverage or on the sea-breeze check; say which.
function describeFailedStation(station: ClimatologyStation): string {
  const code = station.kind === "ndbc" ? `NDBC ${station.id}` : station.id;
  if (station.gateCoverage < GATE_COVERAGE) {
    return `${station.name} (${code}) had ${Math.round(station.gateCoverage * 100)}% of hours recorded, below our ${Math.round(
      GATE_COVERAGE * 100,
    )}% bar, so this page doesn't use it.`;
  }
  return `${station.name} (${code}) didn't show the summer afternoon sea breeze we check wind records for, so this page doesn't use it.`;
}

const SECTION = "mb-12";
const HEADING = "mb-4 text-2xl font-semibold text-gray-900";
const CARD = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";
const PROSE = "max-w-3xl space-y-3 text-[15px] leading-7 text-[#11100D]";

export function BuoyRecordSections({ dataset, view, copy, photos, csvHref }: BuoyRecordSectionsProps) {
  const context = { dataset, view };
  const photosFor = (slots: SeasonPhotoSlot[]) => photos.filter((photo) => slots.includes(photo.slot));
  const midPhotos = photosFor(["big-swell", "typical-day", "south-swell"]);
  const comparisonPhotos = photosFor(["comparison-north", "comparison-south"]);
  const limitsPhotos = photosFor(["buoy-limits"]);
  const mapStations = [view.primary, view.comparison, view.wind].filter(
    (station): station is NonNullable<typeof station> => station !== null,
  );
  const directionRows = [
    {
      stationName: view.primary.name,
      seasons: SEASONS.map((season) => ({ label: season.label, mix: seasonalDirectionMix(dataset, "waves", season.months) })),
    },
    ...(view.comparison
      ? [
          {
            stationName: view.comparison.name,
            seasons: SEASONS.map((season) => ({
              label: season.label,
              mix: seasonalDirectionMix(dataset, "comparison-waves", season.months),
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.answerHeading(context)}</h2>
          <div className={PROSE}>
            {copy.answer(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>Buoy score by month</h2>
        <div className={CARD}>
          <ScoreByMonthChart months={view.months} stationName={view.primary.name} chartId="buoy-score" />
        </div>
        <SourceLine station={view.primary} scoreVersion={dataset.scoreVersion} />
        <ScoreExplainer hasWind={view.wind !== null} csvHref={csvHref} scoreVersion={dataset.scoreVersion} />
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Month by month at the buoy</h2>
        <BuoyMonthTable months={view.months} station={view.primary} />
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>How big the buoy reads each month</h2>
        <div className={CARD}>
          <WaveRangeChart months={view.months} stationName={view.primary.name} chartId="buoy-waves" />
        </div>
        {midPhotos.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {midPhotos.map((photo) => (
              <SeasonPhotoFigure key={photo.slot} photo={photo} />
            ))}
          </div>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Where the swell comes from</h2>
        <div className={CARD}>
          <DirectionMixChart rows={directionRows} chartId="buoy-direction" />
        </div>
      </section>

      {view.wind && (
        <section className={SECTION}>
          <h2 className={HEADING}>Wind by time of day</h2>
          <div className={CARD}>
            <WindByTimeChart
              months={dataset.months.map((month, index) => ({
                month: month.month,
                abbrev: view.months[index].abbrev,
                wind: month.wind,
              }))}
              stationName={view.wind.name}
              chartId="buoy-wind"
            />
          </div>
          <SourceLine station={view.wind} scoreVersion={dataset.scoreVersion} />
        </section>
      )}

      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.comparisonHeading}</h2>
          <div className={PROSE}>
            {copy.comparison(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {comparisonPhotos.length > 0 && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {comparisonPhotos.map((photo) => (
                <SeasonPhotoFigure key={photo.slot} photo={photo} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>Where these numbers come from</h2>
        <StationMap places={dataset.places} stations={mapStations} />
        {view.comparison && <SourceLine station={view.comparison} scoreVersion={dataset.scoreVersion} />}
        {view.failedStations.map((station) => (
          <p key={station.id} className="mt-2 text-xs leading-5 text-[#655C4C]">
            {describeFailedStation(station)}
          </p>
        ))}
        {view.primary.excludedStationMonths.length > 0 && (
          <p className="mt-2 text-xs leading-5 text-[#655C4C]">
            {`Months left out because the buoy recorded less than 70% of their hours: ${view.primary.excludedStationMonths.join(", ")}.`}
          </p>
        )}
      </section>

      {copy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.limitsHeading}</h2>
          <div className={PROSE}>
            {copy.limits(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {limitsPhotos.map((photo) => (
            <SeasonPhotoFigure key={photo.slot} photo={photo} className="mt-6 max-w-xl" />
          ))}
          <ul className="mt-4 space-y-1 text-xs text-[#655C4C]">
            {copy.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 4: Implement `DatasetSchema`**

```tsx
// components/seo/dataset-schema.tsx
/**
 * Dataset structured data for a buoy-record CSV. Describes only the stations
 * the page actually uses and the file readers can download.
 */
import type { SurfClimatologyDataset } from "@/lib/climatology/types";
import { SITE_URL } from "@/lib/constants/seo";

interface DatasetSchemaProps {
  dataset: SurfClimatologyDataset;
  csvPath: string;
}

export function DatasetSchema({ dataset, csvPath }: DatasetSchemaProps) {
  const used = dataset.stations.filter((station) => station.gate === "passed");
  const hasWind = used.some((station) => station.role === "wind");
  const years = used.flatMap((station) => station.yearsUsed);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${dataset.cityName} monthly buoy statistics`,
    description:
      `Monthly buoy wave height, swell period and direction, water temperature${hasWind ? " and wind" : ""} for ` +
      `${dataset.cityName}, computed by Quiver from hourly NOAA${used.some((s) => s.kind === "iem-asos") ? " and ASOS" : ""} ` +
      "observations. Heights are buoy readings, not surf height at the beach.",
    creator: { "@type": "Organization", name: "Quiver", url: SITE_URL },
    isBasedOn: used.map((station) => station.pageUrl),
    temporalCoverage: `${Math.min(...years)}-01-01/${Math.max(...years)}-12-31`,
    spatialCoverage: {
      "@type": "Place",
      name: dataset.reference.label,
      geo: { "@type": "GeoCoordinates", latitude: dataset.reference.lat, longitude: dataset.reference.lon },
    },
    variableMeasured: [
      "Significant wave height",
      "Dominant wave period",
      "Mean wave direction",
      "Water temperature",
      ...(hasWind ? ["Wind speed", "Wind direction"] : []),
    ],
    dateModified: dataset.generatedAt,
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE_URL}${csvPath}` }],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

- [ ] **Step 5: Run the section and schema tests**

Run: `yarn test:unit __tests__/components/best-time-to-surf/buoy-record-sections.test.tsx __tests__/components/seo/dataset-schema.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the page**

In `app/best-time-to-surf/[city]/page.tsx`:

1. Imports, after the existing component imports:

```tsx
import { BuoyRecordSections } from "@/components/best-time-to-surf/buoy-record/buoy-record-sections";
import { SeasonPhotoFigure } from "@/components/best-time-to-surf/buoy-record/season-photo";
import { DatasetSchema } from "@/components/seo/dataset-schema";
import { getSurfClimatology } from "@/lib/climatology/get-surf-climatology";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { getSeasonCopy } from "@/lib/data/surf-climatology/copy";
```

2. Directly after `const currentStateMonth = stateProfile?.monthly[currentMonthIndex];`:

```tsx
  // Buoy-backed cities take every seasonal field from one dataset.
  const climatology = getSurfClimatology(citySlug);
  const seasonView = climatology ? buildDataBackedSeasonView(climatology, currentMonthIndex + 1) : null;
  const seasonCopy = climatology ? getSeasonCopy(citySlug) : null;
  const seasonPhotos = climatology ? getSeasonPhotos(citySlug) : [];
  const heroPhoto = seasonPhotos.find((photo) => photo.slot === "hero") ?? null;
  const seasonCsvPath = seasonCopy ? `/data/surf-climatology/${citySlug}.csv` : null;
```

3. In the `buildBestTimeTodayAnswerCopy({...})` call, replace the two state-profile arguments and add the override:

```tsx
    waveHeightRange: seasonView ? null : currentStateMonth?.waveHeightRange,
    waterTempF: seasonView ? seasonView.current.waterMedianF : currentStateMonth?.waterTemp,
    weekAnswerOverride: seasonView?.weekAnswer,
```

4. In `faqItems`, change the three answers:

```tsx
      answer: seasonView ? seasonView.bestMonthFaq : `${data.peakMonthName} is the peak surf month ...`, // keep the existing template string as the else branch
```

```tsx
      answer: seasonView ? seasonView.waterFaq : stateProfile ? /* existing */ : /* existing */,
```

```tsx
      answer: seasonView
        ? seasonView.yearRoundFaq
        : generateYearRoundAnswer(cityName, data.monthly.filter((m) => m.score >= 50).length, data.peakMonthName),
```

Keep each existing expression verbatim as the non-buoy branch.

5. After `<FAQSchema items={faqItems} />`:

```tsx
      {climatology && seasonCsvPath && <DatasetSchema dataset={climatology} csvPath={seasonCsvPath} />}
```

6. In the current-month hero card, replace the single `<AnimatedScoreGauge score={currentMonthData.score} … />` with:

```tsx
                  {/* Seasonal average, not a live call — no "Go now!" (#569) */}
                  {seasonView ? (
                    seasonView.current.score !== null ? (
                      <AnimatedScoreGauge score={seasonView.current.score} size="xl" showLabel showAction={false} />
                    ) : (
                      <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-8 border-gray-200 text-center text-sm font-semibold text-[#655C4C]">
                        No buoy data
                      </div>
                    )
                  ) : (
                    <AnimatedScoreGauge score={currentMonthData.score} size="xl" showLabel showAction={false} />
                  )}
```

Replace the eyebrow `Seasonal pattern in {currentMonthData.monthName}` with:

```tsx
                      {seasonView ? `Buoy record for ${currentMonthData.monthName}` : `Seasonal pattern in ${currentMonthData.monthName}`}
```

and replace the contents of the `<p className="max-w-md text-[#655C4C]">` with:

```tsx
                      {seasonView ? seasonView.heroDetail : (
                        <>
                          {/* existing three expressions, unchanged */}
                        </>
                      )}
```

7. Replace the hero scene panel:

```tsx
              {heroPhoto ? (
                <SeasonPhotoFigure photo={heroPhoto} priority className="lg:self-start" />
              ) : (
                heroScene && (
                  /* 4:3 rather than stretched to the column height: a 16:9 photo
                     forced that tall only shows ~37% of its width. */
                  <SeoScenePanel
                    scene={heroScene}
                    priority
                    className="lg:self-start"
                    mediaClassName="aspect-[4/3] min-h-[240px]"
                  />
                )
              )}
```

8. Wrap the three legacy sections (`{/* Month-by-Month Chart */}`, `{/* Monthly Breakdown Grid / Heatmap */}`, `{/* Dawn Patrol vs Afternoon */}`) so buoy-backed cities get the buoy record instead:

```tsx
        {seasonView && climatology ? (
          <BuoyRecordSections
            dataset={climatology}
            view={seasonView}
            copy={seasonCopy}
            photos={seasonPhotos}
            csvHref={seasonCsvPath}
          />
        ) : (
          <>
            {/* the three existing sections, unchanged */}
          </>
        )}
```

9. In the Top Surf Spots list, hide the per-beach `best_months` list where the buoy peak band is shown:

```tsx
                            {!seasonView && beach.bestMonths.length > 0 && (
```

- [ ] **Step 7: Use the dataset date in the sitemap**

In `app/sitemap.ts`, import `getSurfClimatology` from `@/lib/climatology/get-surf-climatology` and change the city route's `lastModified` in `getBestTimeToSurfRoutes`:

```ts
          lastModified: latestSitemapDate(
            SITEMAP_CONTENT_VERSIONS.bestTimeTemplate,
            editorial?.lastModified,
            getSurfClimatology(citySlug)?.generatedAt,
          ),
```

- [ ] **Step 8: Run the page, sitemap and section tests**

Run: `yarn test:unit __tests__/app/best-time-city-page.test.ts __tests__/app/best-time-la-jolla-live-answer.test.ts __tests__/app/sitemap.test.ts __tests__/app/sitemap-city-resolution.test.ts __tests__/components/best-time-to-surf __tests__/components/seo/dataset-schema.test.tsx`
Expected: PASS.

- [ ] **Step 9: Typecheck and lint**

Run: `yarn typecheck`
Expected: exit 0.

Run: `npx eslint --max-warnings=0 "app/best-time-to-surf/[city]/page.tsx" app/sitemap.ts components/best-time-to-surf/buoy-record components/seo/dataset-schema.tsx lib/climatology lib/data/surf-climatology`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add components/best-time-to-surf/buoy-record/buoy-record-sections.tsx components/seo/dataset-schema.tsx "app/best-time-to-surf/[city]/page.tsx" app/sitemap.ts __tests__/components/best-time-to-surf/buoy-record-sections.test.tsx __tests__/components/seo/dataset-schema.test.tsx __tests__/app/best-time-city-page.test.ts
git commit -m "feat(best-time): show the buoy record on Newport, Cocoa and Honolulu

Buoy-backed cities take score, Peak badges, peak month, hero text and FAQ
answers from their dataset, replace the state-profile grid and the generic
dawn/afternoon block with the buoy record, and publish the CSV as a
Dataset. Honolulu gets the data swap only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end check, full verification, review gates and baseline

**Files:**
- Create: `e2e/guest-best-time-buoy-record.spec.ts`
- Create: `docs/growth/regional-surf-seasons-measurement.md`

**Interfaces:**
- Consumes: the finished pages.
- Produces: a guest Playwright spec, a verified branch, Steven's copy and photo sign-off, and a recorded baseline.

- [ ] **Step 1: Write the E2E spec**

```ts
// e2e/guest-best-time-buoy-record.spec.ts
/**
 * Buoy-record season pages: evidence renders in server HTML, photos are credited,
 * and the legacy state-profile sections are gone for buoy-backed cities.
 *
 * @project guest
 */
import { test, expect } from "@playwright/test";

import { assertNoErrors, setupErrorDetection, type ErrorCapture } from "./utils/error-detection";

const PAGES = [
  { path: "/best-time-to-surf/cocoa-beach", station: "NOAA NDBC station 41113", credit: /U\.S\. Air Force photo/ },
  { path: "/best-time-to-surf/newport-beach", station: "NOAA NDBC station 46253", credit: /Don Ramey Logan/ },
] as const;

test.describe("best-time buoy record", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  for (const target of PAGES) {
    test(`${target.path} serves the buoy record in its HTML`, async ({ page, request }) => {
      const response = await request.get(target.path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(target.station);
      expect(html).toContain("How the buoy score works");
      expect(html).not.toContain("Dawn Patrol vs Afternoon Sessions");
      expect(html).not.toMatch(/>0<\/span>/);

      await page.goto(target.path);
      await expect(page.getByRole("heading", { name: "Month by month at the buoy" })).toBeVisible();
      await expect(page.getByText(target.credit).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Download the monthly numbers (CSV)" })).toHaveAttribute(
        "href",
        /\/data\/surf-climatology\/.+\.csv$/,
      );
    });
  }

  test("the CSV downloads with its source header", async ({ request }) => {
    const response = await request.get("/data/surf-climatology/cocoa-beach.csv");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("not surf height at the beach");
  });

  test("Honolulu no longer shows North Shore winter text", async ({ request }) => {
    const response = await request.get("/best-time-to-surf/honolulu");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("Pipe Masters");
    expect(html).toContain("NOAA NDBC station 51211");
  });
});
```

- [ ] **Step 2: Run the E2E spec**

Follow `e2e/README.md` for the local guest setup, then run:
`yarn test:e2e e2e/guest-best-time-buoy-record.spec.ts --project=guest`
Expected: 4 passed. If a city page 404s in the E2E environment because its beaches are not seeded there, report it with the output; do not skip the test.

- [ ] **Step 3: Run the full verification set**

Run each and record the result:

```bash
yarn test:unit
```

```bash
yarn typecheck
```

```bash
yarn deadcode
```

```bash
VERCEL_ENV=preview yarn build
```

Expected: all exit 0. `yarn test:unit` covers the shared gauge change across every suite. Fix any failure in the task that owns the code, then rerun.

- [ ] **Step 4: Look at the pages**

Start the dev server with `preview_start` from `.claude/launch.json` and open `/best-time-to-surf/cocoa-beach`, `/newport-beach` and `/honolulu`. For each:
- screenshot at desktop width and with `resize_window` preset `mobile`;
- confirm the month table scrolls inside its card with no page-level horizontal scroll at 375 px;
- confirm the hero gauge shows the real number before and after hydration;
- read the console for errors.

Send the six screenshots and the Task 12 copy printout to Steven with `SendUserFile`.

- [ ] **Step 5: Get Steven's copy review**

Stop and wait for Steven's answer on the copy and screenshots. Apply requested wording changes in the copy modules, rerun the voice test, and commit them as `fix(best-time): copy edits from review`.

- [ ] **Step 6: Get the duplicate-photo check**

Ask Steven to run the read-only query in spec §4 (or allow it). If any of the eight files is already on a Quiver page, swap it for the next-ranked candidate from the 2026-09-25 photo research, rerun Task 11 Steps 2–3 and 8 for that file, and commit.

- [ ] **Step 7: Write the measurement plan and record the baseline**

Create `docs/growth/regional-surf-seasons-measurement.md` with this content, then run the baseline queries through the PostHog MCP tool and paste the numbers into the Baseline table.

````markdown
# Regional surf seasons: measurement

Pages: `/best-time-to-surf/newport-beach`, `/best-time-to-surf/cocoa-beach` (Honolulu is a data repair, not measured).
Status: shipped_unvalidated until the +8 week reading.

## Funnel

page view (Google/Bing referral) → live forecast opened from the page → alert started or created → return visit within 14 days.

Quiver has no "beach saved" event in the taxonomy, so the save step is measured through alerts only.

## Bot check

Run first. If it returns 0, `bot_flagged` is not sent to PostHog and the North Charleston exclusion is the only bot filter.

```sql
SELECT count() FROM events
WHERE properties.bot_flagged = true AND timestamp > now() - INTERVAL 30 DAY
```

## Referred visitors (30 days before deploy, then +4 and +8 weeks)

```sql
SELECT properties.$pathname AS path, count(DISTINCT person_id) AS visitors
FROM events
WHERE event = '$pageview'
  AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
  AND (properties.$referring_domain ILIKE '%google.%' OR properties.$referring_domain ILIKE '%bing.com%')
  AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
  AND coalesce(properties.bot_flagged, false) = false
  AND timestamp >= {start} AND timestamp < {end}
GROUP BY path
```

## Next steps from those visitors

```sql
WITH landed AS (
  SELECT DISTINCT person_id, min(timestamp) AS landed_at
  FROM events
  WHERE event = '$pageview'
    AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
    AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
    AND timestamp >= {start} AND timestamp < {end}
  GROUP BY person_id
)
SELECT
  countIf(e.event = 'beach_view') AS forecast_opened,
  countIf(e.event IN ('save_alert_clicked', 'anon_alert_capture_submit', 'alert_rule_created')) AS alert_steps,
  count(DISTINCT if(e.event = '$pageview' AND e.timestamp > landed.landed_at + INTERVAL 1 DAY
    AND e.timestamp < landed.landed_at + INTERVAL 14 DAY, e.person_id, NULL)) AS returned_within_14d
FROM events e
JOIN landed ON e.person_id = landed.person_id
WHERE e.timestamp >= landed.landed_at AND e.timestamp < landed.landed_at + INTERVAL 14 DAY
```

## Baseline

| Window | Page | Referred visitors | Forecast opened | Alert steps | Returned ≤14 d |
|---|---|---|---|---|---|
| 30 days before deploy | newport-beach | | | | |
| 30 days before deploy | cocoa-beach | | | | |

Counts are small (the 2026-09-25 research saw 13–17 referred visitors per page per month). Report raw counts; do not claim significance.

## Readings

- +4 weeks after the production deploy: (date)
- +8 weeks: (date)
````

The `(date)` cells are filled when the deploy happens; they are the only blanks left on purpose.

- [ ] **Step 8: Commit**

```bash
git add e2e/guest-best-time-buoy-record.spec.ts docs/growth/regional-surf-seasons-measurement.md
git commit -m "test(best-time): cover the buoy record end to end and record the baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Report**

Report to Steven: the gate results from Task 5, the test and build commands with their results, the screenshots, the baseline numbers, and anything that was skipped. Do not push, open a PR or deploy; those need his go-ahead, and the deploy counts as the one SEO change for this window.
