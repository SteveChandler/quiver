# Swell Outlook Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Location note:** this plan is for the `quiver-native` repo. It is kept beside the spec in `quiver` for review; copy it to `quiver-native/docs/plans/` when execution starts. End each commit message with the attribution line your own session specifies.

**Goal:** Ship the native half of Swell Outlook Phase 1: a gated "How this week plays out" Home section, a new Swell Outlook screen, a Week Scout entry row, and a swell detail with a live-map hero, day scrubber and a "How the forecast moved" chart, all driven by `GET /api/swell/outlook`.
**Architecture:** One new feature folder `src/features/swell-outlook/` holds the contract types, a tolerant parser, a gating query hook (`null` data means "not enabled for this user"), pure formatting and chart-geometry modules (unit-tested without rendering), and thin `react-native-svg` components. Existing surfaces (`home.tsx`, `week-scout.tsx`, `swell-landing-screen.tsx`) branch on that hook so a 401/403/404 leaves today's UI untouched. The detail hero reuses `DetailMap` (the existing `/embed/map` WebView) with two small additive props.
**Tech Stack:** Expo ~55, React Native 0.83.6, TypeScript ~5.9 (strict), `react-native-svg` 15.15.3, `react-native-reanimated` 4.2.1, `@tanstack/react-query` ^5.101, `react-native-webview` 13.16, React Navigation 7 (native stack), Jest 29 + `jest-expo` + `@testing-library/react-native` ^13.3.
**Spec:** quiver: docs/superpowers/specs/2026-10-04-swell-outlook-design.md

## Global Constraints
- The API contract (`GET /api/swell/outlook`, `SwellOutlookResponse`, `OutlookSwell`) is fixed by the spec; native parses it tolerantly item by item and never renames or repurposes a field.
- Phase 1 UI has three tiers only (`locked`, `likely`, `on_the_radar`); `early_signal` is in the type, parsed, and filtered out of every list and graphic. Horizon is whatever `horizonDays` says (9 in Phase 1).
- Gating rule: Home section, entry row, Outlook screen content and the new SwellLanding sections render only when the outlook query returns a parsed body. 401/403/404, an unparseable body, or no signed-in user means `data === null`/`undefined` and every existing surface (including "HOW TODAY CHANGES" and the SwellLanding run table) renders exactly as it does today.
- Motion is slow, organic and subtle: one 1.8 s ease-out reveal on the week graphic, no loops, no pulses, `useReducedMotion` respected, map time changes use the existing `smooth` flag.
- Never use the phrase "the call" in copy; never claim AI or machine-learning forecasting in any string.
- TypeScript with explicit types on every function signature, early returns over nesting, minimal comments that explain why, no new `any`.
- Conventional commits, one logical change per commit, task-owned files only (`git add <paths>`, never `git add -A`).
- Work in a git worktree off `origin/main`, never the primary checkout (the primary `quiver-native` checkout is mid cherry-pick and 552 commits behind `origin/main`; every file reference in this plan was read from `origin/main`).
- quiver-native PRs show no CI check, so the full local suite must pass before the PR: `npm run typecheck`, `npm run lint`, `npm test` (which is `TZ=America/Los_Angeles jest`).
- Metro must be restarted with `--clear` before any simulator verdict.
- No OTA publish, store submission, Fly deploy, production write or flag change without Steven's explicit approval at the time.
- Never merge `main` into a deployed OTA maintenance branch; this plan only opens a PR against `main` and does not merge it.
- Mobile-consumed API contracts are additive and installed binaries live for months: parse defensively, ship no native module changes (this plan adds no dependency, so the Expo fingerprint is expected to be unchanged; verify before any OTA).

## Review Focus
1. **Endpoint disabled (401/403/404) or body unparseable for a non-allowlisted user:** every surface stays byte-for-byte today's UI, Home keeps "HOW TODAY CHANGES", Week Scout has no new row, SwellLanding keeps its run table. Tests: Task 2 (hook returns `null`), Task 8 (screen "not available" state), Task 9 (Home gate), Task 10 (entry row null), Task 13 (SwellLanding ungated branch).
2. **Empty `swells` list (the common case), or only `early_signal` swells:** a designed empty state on Home (flat week plus one line) and on the Outlook screen (one-line summary, last-checked time, Week Scout link), never an error. Tests: Task 6, Task 8, Task 10 (row wording).
3. **A swell with a single history run, or runs with null heights:** chart says tracking has just started, sparkline draws one dot and no line, nothing divides by zero. Tests: Task 7 (sparkline), Task 11 (chart), Task 13 (screen).
4. **`fit.status` of `unknown`/`rideable`, a user with no boards, or only some boards fitting:** no label unless the contract says so; `in_range` names the board(s) only when the user owns more board classes than fit; `below_range` is dimmed and labelled; `above_range` is labelled and never dimmed. Tests: Task 3 (treatment), Task 7 (row styles).
5. **Sparse optional fields and long text:** `stormName: null`, `sizeByOrientation` with one or both sides null, `periodS: null`, `peakWindow` set, a very long beach name or a 320 pt wide phone: copy omits what is missing and every text node clamps (`numberOfLines`) instead of overflowing. Tests: Task 3 (source/orientation lines), Task 5 (label clamp at narrow width), Task 7 (row), Task 8 (header), Task 13 (detail).

## File Structure
**Create** (all under `src/features/swell-outlook/` unless noted)
- `types.ts` — contract types (`SwellOutlookResponse`, `OutlookSwell`, tiers, fit, history).
- `parse-outlook.ts` — `parseSwellOutlook(unknown)`: tolerant, item-by-item parser; `null` when the body is not an outlook.
- `use-swell-outlook.ts` — `useSwellOutlook()` query, `fetchSwellOutlook()`, gating via `null`.
- `dev-fixture.ts` — `__DEV__`-only fixture override (`EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE`) and `rebaseOutlookToNow`.
- `outlook-format.ts` — pure copy/grouping/fit/change/label logic.
- `analytics.ts` — `trackSwellOutlook()` over the existing `forecast_interaction` event.
- `week-graphic-geometry.ts` — pure geometry for the Home/Outlook strip graphic.
- `week-graphic.tsx` — `WeekGraphic` (react-native-svg) and `WeekGraphicLegend`.
- `home-week-plays-out.tsx` — `HowThisWeekPlaysOut` Home section.
- `sparkline-geometry.ts`, `direction-glyph.tsx`, `run-sparkline.tsx`, `tier-chip.tsx`, `glyph-key.tsx` — row building blocks.
- `outlook-row.tsx` — `OutlookRow`.
- `swell-outlook-screen.tsx` — `SwellOutlookScreen` (all states).
- `outlook-entry-row.tsx` — `SwellOutlookEntryRow` (Week Scout).
- `history-chart-geometry.ts`, `forecast-moved-section.tsx` — "How the forecast moved" chart.
- `scrub-model.ts`, `swell-map-hero.tsx` — day scrubber model and map hero.
- `tier-track.tsx` — three-stop tier track for the detail screen.
- `index.ts` — public exports.
- `__fixtures__/outlook.three-overlapping.json`, `__fixtures__/outlook.empty.json`, `__fixtures__/make-swell.ts` — fixtures and test builders.
- `__tests__/*.test.ts(x)` — one test file per module above, plus `src/features/swell-landing/__tests__/swell-landing-outlook.test.tsx`.

**Modify**
- `src/features/swell-landing/types.ts` — widen `SwellLandingEntrySource` with `'outlook'`.
- `src/features/swell-landing/swell-landing-screen.tsx` — gated hero, tier track, chart; push back goes to the outlook.
- `src/features/swell-landing/__tests__/swell-landing-screen.test.tsx` — mock the new hook so existing assertions are unchanged.
- `src/features/beach-forecast/detail-map.tsx` (+ `detail-map.test.tsx`) — additive `playing` and `onForecastTimeChange` props.
- `src/navigation/types.ts`, `src/navigation/root-navigator.tsx` — register `SwellOutlook`.
- `src/screens/home.tsx` (+ `src/__tests__/home-screen.test.tsx`, `src/__tests__/home-dashboard-stitch.test.tsx`) — swap the section behind the gate.
- `src/screens/week-scout.tsx` (+ `src/__tests__/week-scout-screen.test.tsx`) — one entry row.

## Setup (before Task 1)
```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git fetch origin
git worktree add .worktrees/swell-outlook-native-20261004 -b feat/swell-outlook-native origin/main
cd .worktrees/swell-outlook-native-20261004
source ~/.nvm/nvm.sh && nvm use 22
npm ci
npm test -- src/features/swell-landing 2>&1 | tail -n 8
```
Expected: the swell-landing suites PASS on an untouched checkout (baseline).

## Fixture run (used by the simulator-verification steps)
The app reads the fixture only in `__DEV__` and only when the env var is set (Task 2). Fixture times are rebased so the first swell lands about tomorrow relative to the simulator clock.
```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/swell-outlook-native-20261004
EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE=three npx expo start --dev-client --clear      # or =empty, or =disabled
```
Before judging anything: confirm the dev client's API base reaches this Mac (check Metro's env and `ifconfig` for the current LAN IP; a stale LAN IP is the known failure), and confirm the bundle is the worktree's by grepping Metro's served bundle for `swell-outlook-screen`. The fixture bypasses only `GET /api/swell/outlook`; the swell detail's own `/api/swell/<key>` call is expected to 404 for fixture keys, which the screen already treats as non-fatal because Outlook rows pass a full set of route params.

### Task 1: Contract types, tolerant parser, fixtures
**Files:** Create `src/features/swell-outlook/types.ts`, `parse-outlook.ts`, `__fixtures__/outlook.three-overlapping.json`, `__fixtures__/outlook.empty.json`, `__fixtures__/make-swell.ts`, `index.ts`; Test `src/features/swell-outlook/__tests__/parse-outlook.test.ts`.
**Interfaces:** Consumes: `BoardClass`, `normalizeBoardClass(raw: string | null | undefined): BoardClass | null` from `@/lib/board-class` (verified at `src/lib/board-class.ts:15,89`). Produces: `OutlookTier`, `VisibleOutlookTier`, `OutlookStatus`, `OutlookChange`, `OutlookFitStatus`, `OutlookSource`, `OutlookSizeRange`, `OutlookFit`, `OutlookHistoryRun`, `OutlookSwell`, `SwellOutlookResponse`, `OUTLOOK_TIERS`, `parseSwellOutlook(value: unknown): SwellOutlookResponse | null`, test builders `makeSwell(overrides?: Partial<OutlookSwell>): OutlookSwell` and `makeOutlook(overrides?: Partial<SwellOutlookResponse>): SwellOutlookResponse`.

Spec note: `BoardClass` already exists natively (`src/lib/board-class.ts`), so `fit.boards` is normalised through `normalizeBoardClass` and unknown strings are dropped rather than trusted.

- [ ] **Step 1: Write the failing test**

Create `src/features/swell-outlook/__tests__/parse-outlook.test.ts`:
```ts
import threeOverlapping from '../__fixtures__/outlook.three-overlapping.json';
import emptyOutlook from '../__fixtures__/outlook.empty.json';
import { parseSwellOutlook } from '../parse-outlook';

describe('parseSwellOutlook', () => {
  it('parses the three-overlapping fixture in full', () => {
    const outlook = parseSwellOutlook(threeOverlapping);
    expect(outlook).not.toBeNull();
    expect(outlook?.horizonDays).toBe(9);
    expect(outlook?.homeBeach).toEqual({ id: 'beach-hb', name: 'Huntington Beach' });
    expect(outlook?.swells.map((swell) => swell.tier)).toEqual(['locked', 'likely', 'on_the_radar']);
    const [south, northwest, tropical] = outlook?.swells ?? [];
    expect(south.fit).toEqual({ status: 'in_range', boards: ['longboard'] });
    expect(northwest.fit).toEqual({ status: 'below_range', boards: [] });
    expect(tropical.fit.status).toBe('above_range');
    expect(tropical.stormName).toBe('Hurricane Rachel');
    expect(tropical.history).toHaveLength(1);
    expect(tropical.sizeByOrientation).toEqual({ southFacing: { min: 7, max: 9 }, westFacing: null });
    expect(tropical.peakWindow).toEqual({ from: '2026-10-09T04:00:00.000Z', to: '2026-10-10T16:00:00.000Z' });
  });

  it('parses the empty fixture as a valid outlook with no swells', () => {
    const outlook = parseSwellOutlook(emptyOutlook);
    expect(outlook?.swells).toEqual([]);
    expect(outlook?.horizonDays).toBe(9);
  });

  it('returns null for anything that is not an outlook body', () => {
    expect(parseSwellOutlook(null)).toBeNull();
    expect(parseSwellOutlook('nope')).toBeNull();
    expect(parseSwellOutlook([])).toBeNull();
    expect(parseSwellOutlook({ swells: 'x', generatedAt: '2026-10-04T15:20:00.000Z' })).toBeNull();
    expect(parseSwellOutlook({ swells: [] })).toBeNull();
  });

  it('drops a malformed swell on its own and keeps the rest', () => {
    const body = JSON.parse(JSON.stringify(threeOverlapping));
    body.swells[1].peakAt = 'not a date';
    body.swells[2].tier = 'mystery';
    const outlook = parseSwellOutlook(body);
    expect(outlook?.swells.map((swell) => swell.id)).toEqual(['swell-2026-10-05-ssw']);
  });

  it('falls back safely on unknown enum values and missing optional fields', () => {
    const body = JSON.parse(JSON.stringify(threeOverlapping));
    const swell = body.swells[0];
    swell.status = 'weird';
    swell.change = 'weird';
    swell.source = 'weird';
    swell.fit = { status: 'weird', boards: ['longboard'] };
    delete swell.stormName;
    delete swell.sizeByOrientation;
    delete swell.peakWindow;
    delete swell.directionLabel;
    delete swell.beachCount;
    const parsed = parseSwellOutlook(body)?.swells[0];
    expect(parsed?.status).toBe('forecast');
    expect(parsed?.change).toBe('steady');
    expect(parsed?.source).toBe('unknown');
    expect(parsed?.fit).toEqual({ status: 'unknown', boards: [] });
    expect(parsed?.stormName).toBeNull();
    expect(parsed?.sizeByOrientation).toEqual({ southFacing: null, westFacing: null });
    expect(parsed?.peakWindow).toBeNull();
    expect(parsed?.directionLabel).toBe('SSW');
    expect(parsed?.beachCount).toBe(1);
  });

  it('keeps boards only for in_range and normalises board classes', () => {
    const body = JSON.parse(JSON.stringify(threeOverlapping));
    body.swells[0].fit = { status: 'in_range', boards: ['Long Board', 'shortboard', 'shortboard', 'mystery', 7] };
    body.swells[1].fit = { status: 'rideable', boards: ['fish'] };
    const [first, second] = parseSwellOutlook(body)?.swells ?? [];
    expect(first.fit.boards).toEqual(['longboard', 'shortboard']);
    expect(second.fit).toEqual({ status: 'rideable', boards: [] });
  });

  it('sorts history by run date and drops malformed runs', () => {
    const body = JSON.parse(JSON.stringify(threeOverlapping));
    body.swells[0].history = [
      { runDate: '2026-10-03', peakAt: '2026-10-05T19:00:00.000Z', faceHeightFt: 2, periodS: 15 },
      { runDate: '2026-10-01', peakAt: '2026-10-05T19:00:00.000Z', faceHeightFt: 1.5, periodS: null },
      { runDate: '2026-10-02', peakAt: 'bad', faceHeightFt: 2, periodS: 15 },
      { runDate: '2026-10-04', peakAt: '2026-10-05T19:00:00.000Z', faceHeightFt: 'x', periodS: 15 },
    ];
    const history = parseSwellOutlook(body)?.swells[0].history ?? [];
    expect(history.map((run) => run.runDate)).toEqual(['2026-10-01', '2026-10-03']);
    expect(history[0].periodS).toBeNull();
  });

  it('ignores an inverted peak window and a zero-height swell', () => {
    const body = JSON.parse(JSON.stringify(threeOverlapping));
    body.swells[2].peakWindow = { from: '2026-10-10T16:00:00.000Z', to: '2026-10-09T04:00:00.000Z' };
    body.swells[1].faceHeightFt = { min: 0, max: 0 };
    const outlook = parseSwellOutlook(body);
    expect(outlook?.swells).toHaveLength(2);
    expect(outlook?.swells[1].peakWindow).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/parse-outlook.test.ts`
Expected: FAIL with `Cannot find module '../__fixtures__/outlook.three-overlapping.json'` (then `../parse-outlook`).

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/types.ts`:
```ts
import type { BoardClass } from '@/lib/board-class';

export const OUTLOOK_TIERS = ['locked', 'likely', 'on_the_radar', 'early_signal'] as const;
export type OutlookTier = (typeof OUTLOOK_TIERS)[number];
/** Phase 1 draws three tiers; `early_signal` is parsed and filtered out of every list. */
export type VisibleOutlookTier = Exclude<OutlookTier, 'early_signal'>;
export type OutlookStatus = 'forecast' | 'shrinking' | 'arrived' | 'faded';
export type OutlookChange = 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';
export type OutlookFitStatus = 'in_range' | 'rideable' | 'below_range' | 'above_range' | 'unknown';
export type OutlookSource = 'southern_hemisphere' | 'tropical' | 'north_pacific' | 'local' | 'unknown';

export interface OutlookSizeRange {
  min: number;
  max: number;
}

export interface OutlookFit {
  status: OutlookFitStatus;
  /** Board classes whose ideal band contains this size; empty unless `in_range`. */
  boards: BoardClass[];
}

export interface OutlookHistoryRun {
  runDate: string;
  peakAt: string;
  faceHeightFt: number;
  periodS: number | null;
}

export interface OutlookSwell {
  id: string;
  /** The representative beach event; opens the swell detail page. */
  eventKey: string;
  tier: OutlookTier;
  status: OutlookStatus;
  change: OutlookChange;
  arrivalAt: string | null;
  peakAt: string;
  peakWindow: { from: string; to: string } | null;
  faceHeightFt: OutlookSizeRange;
  periodS: number | null;
  directionDeg: number;
  directionLabel: string;
  beach: { id: string; name: string };
  beachCount: number;
  notable: boolean;
  fit: OutlookFit;
  source: OutlookSource;
  stormName: string | null;
  sizeByOrientation: {
    southFacing: OutlookSizeRange | null;
    westFacing: OutlookSizeRange | null;
  };
  history: OutlookHistoryRun[];
}

export interface SwellOutlookResponse {
  generatedAt: string;
  runDate: string;
  horizonDays: number;
  homeBeach: { id: string; name: string } | null;
  swells: OutlookSwell[];
}
```

`src/features/swell-outlook/parse-outlook.ts`:
```ts
import { normalizeBoardClass, type BoardClass } from '@/lib/board-class';
import {
  OUTLOOK_TIERS,
  type OutlookChange,
  type OutlookFit,
  type OutlookFitStatus,
  type OutlookHistoryRun,
  type OutlookSizeRange,
  type OutlookSource,
  type OutlookStatus,
  type OutlookSwell,
  type SwellOutlookResponse,
} from './types';

const STATUSES: readonly OutlookStatus[] = ['forecast', 'shrinking', 'arrived', 'faded'];
const CHANGES: readonly OutlookChange[] = ['new', 'upgraded', 'downgraded', 'earlier', 'later', 'steady'];
const FIT_STATUSES: readonly OutlookFitStatus[] = ['in_range', 'rideable', 'below_range', 'above_range', 'unknown'];
const SOURCES: readonly OutlookSource[] = ['southern_hemisphere', 'tropical', 'north_pacific', 'local', 'unknown'];
const DEFAULT_HORIZON_DAYS = 9;
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function instant(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function compassLabel(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

function parseRange(value: unknown): OutlookSizeRange | null {
  const range = record(value);
  const min = finite(range?.min);
  const max = finite(range?.max);
  if (min === null || max === null || min < 0 || max < min) return null;
  return { min, max };
}

function parseBeach(value: unknown): { id: string; name: string } | null {
  const beach = record(value);
  const id = text(beach?.id);
  const name = text(beach?.name);
  return id && name ? { id, name } : null;
}

function parsePeakWindow(value: unknown): { from: string; to: string } | null {
  const window = record(value);
  const from = instant(window?.from);
  const to = instant(window?.to);
  if (!from || !to || Date.parse(to) < Date.parse(from)) return null;
  return { from, to };
}

function parseFit(value: unknown): OutlookFit {
  const fit = record(value);
  const status = oneOf(FIT_STATUSES, fit?.status, 'unknown');
  if (status !== 'in_range' || !Array.isArray(fit?.boards)) return { status, boards: [] };
  const boards: BoardClass[] = [];
  for (const raw of fit.boards as unknown[]) {
    const board = typeof raw === 'string' ? normalizeBoardClass(raw) : null;
    if (board && !boards.includes(board)) boards.push(board);
  }
  return { status, boards };
}

function parseHistoryRun(value: unknown): OutlookHistoryRun | null {
  const run = record(value);
  const runDate = text(run?.runDate);
  const peakAt = instant(run?.peakAt);
  const faceHeightFt = finite(run?.faceHeightFt);
  if (!run || !runDate || !peakAt || faceHeightFt === null || faceHeightFt < 0) return null;
  return { runDate, peakAt, faceHeightFt, periodS: finite(run.periodS) };
}

function parseHistory(value: unknown): OutlookHistoryRun[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseHistoryRun)
    .filter((run): run is OutlookHistoryRun => run !== null)
    .sort((a, b) => a.runDate.localeCompare(b.runDate));
}

function parseSwell(value: unknown): OutlookSwell | null {
  const body = record(value);
  if (!body) return null;
  const id = text(body.id);
  const eventKey = text(body.eventKey);
  const peakAt = instant(body.peakAt);
  const faceHeightFt = parseRange(body.faceHeightFt);
  const directionDeg = finite(body.directionDeg);
  const beach = parseBeach(body.beach);
  const tier = OUTLOOK_TIERS.find((candidate) => candidate === body.tier);
  if (!id || !eventKey || !peakAt || !faceHeightFt || faceHeightFt.max <= 0) return null;
  if (directionDeg === null || !beach || !tier) return null;
  const orientation = record(body.sizeByOrientation);
  const beachCount = finite(body.beachCount);
  return {
    id,
    eventKey,
    tier,
    status: oneOf(STATUSES, body.status, 'forecast'),
    change: oneOf(CHANGES, body.change, 'steady'),
    arrivalAt: instant(body.arrivalAt),
    peakAt,
    peakWindow: parsePeakWindow(body.peakWindow),
    faceHeightFt,
    periodS: finite(body.periodS),
    directionDeg,
    directionLabel: text(body.directionLabel) ?? compassLabel(directionDeg),
    beach,
    beachCount: beachCount !== null && beachCount >= 1 ? Math.round(beachCount) : 1,
    notable: body.notable === true,
    fit: parseFit(body.fit),
    source: oneOf(SOURCES, body.source, 'unknown'),
    stormName: text(body.stormName),
    sizeByOrientation: {
      southFacing: parseRange(orientation?.southFacing),
      westFacing: parseRange(orientation?.westFacing),
    },
    history: parseHistory(body.history),
  };
}

/**
 * Installed binaries outlive server changes, so the body is read field by
 * field: one malformed swell is dropped on its own, and only a body that is
 * not an outlook at all (no `swells` array or no `generatedAt`) yields null,
 * which the app treats exactly like "not enabled for this user".
 */
export function parseSwellOutlook(value: unknown): SwellOutlookResponse | null {
  const body = record(value);
  if (!body || !Array.isArray(body.swells)) return null;
  const generatedAt = instant(body.generatedAt);
  if (!generatedAt) return null;
  const horizonDays = finite(body.horizonDays);
  return {
    generatedAt,
    runDate: text(body.runDate) ?? generatedAt.slice(0, 10),
    horizonDays: horizonDays !== null && horizonDays >= 1 ? Math.round(horizonDays) : DEFAULT_HORIZON_DAYS,
    homeBeach: parseBeach(body.homeBeach),
    swells: body.swells
      .map(parseSwell)
      .filter((swell): swell is OutlookSwell => swell !== null),
  };
}
```

`src/features/swell-outlook/__fixtures__/outlook.three-overlapping.json` (3 overlapping swells; one `in_range` longboard-only, one `below_range`, one `above_range` with a single history run, a named storm, a window and a null west side):
```json
{
  "generatedAt": "2026-10-04T15:20:00.000Z",
  "runDate": "2026-10-04",
  "horizonDays": 9,
  "homeBeach": { "id": "beach-hb", "name": "Huntington Beach" },
  "swells": [
    {
      "id": "swell-2026-10-05-ssw",
      "eventKey": "beach-hb:SSW:2026-10-05",
      "tier": "locked",
      "status": "forecast",
      "change": "upgraded",
      "arrivalAt": "2026-10-05T01:00:00.000Z",
      "peakAt": "2026-10-05T19:00:00.000Z",
      "peakWindow": null,
      "faceHeightFt": { "min": 2, "max": 3 },
      "periodS": 15,
      "directionDeg": 205,
      "directionLabel": "SSW",
      "beach": { "id": "beach-hb", "name": "Huntington Beach" },
      "beachCount": 6,
      "notable": false,
      "fit": { "status": "in_range", "boards": ["longboard"] },
      "source": "southern_hemisphere",
      "stormName": null,
      "sizeByOrientation": {
        "southFacing": { "min": 2, "max": 3 },
        "westFacing": { "min": 1, "max": 2 }
      },
      "history": [
        { "runDate": "2026-10-01", "peakAt": "2026-10-05T19:00:00.000Z", "faceHeightFt": 2, "periodS": 14 },
        { "runDate": "2026-10-02", "peakAt": "2026-10-05T19:00:00.000Z", "faceHeightFt": 2, "periodS": 15 },
        { "runDate": "2026-10-03", "peakAt": "2026-10-05T19:00:00.000Z", "faceHeightFt": 2, "periodS": 15 },
        { "runDate": "2026-10-04", "peakAt": "2026-10-05T19:00:00.000Z", "faceHeightFt": 2.5, "periodS": 15 }
      ]
    },
    {
      "id": "swell-2026-10-06-wnw",
      "eventKey": "beach-sb:WNW:2026-10-06",
      "tier": "likely",
      "status": "forecast",
      "change": "steady",
      "arrivalAt": "2026-10-06T04:00:00.000Z",
      "peakAt": "2026-10-06T22:00:00.000Z",
      "peakWindow": null,
      "faceHeightFt": { "min": 1.5, "max": 2 },
      "periodS": 13,
      "directionDeg": 295,
      "directionLabel": "WNW",
      "beach": { "id": "beach-sb", "name": "Seal Beach" },
      "beachCount": 3,
      "notable": false,
      "fit": { "status": "below_range", "boards": [] },
      "source": "north_pacific",
      "stormName": null,
      "sizeByOrientation": {
        "southFacing": null,
        "westFacing": { "min": 1.5, "max": 2 }
      },
      "history": [
        { "runDate": "2026-10-03", "peakAt": "2026-10-06T22:00:00.000Z", "faceHeightFt": 1.5, "periodS": 13 },
        { "runDate": "2026-10-04", "peakAt": "2026-10-06T22:00:00.000Z", "faceHeightFt": 1.5, "periodS": 13 }
      ]
    },
    {
      "id": "swell-2026-10-09-s",
      "eventKey": "beach-hb:S:2026-10-09",
      "tier": "on_the_radar",
      "status": "forecast",
      "change": "new",
      "arrivalAt": null,
      "peakAt": "2026-10-09T18:00:00.000Z",
      "peakWindow": { "from": "2026-10-09T04:00:00.000Z", "to": "2026-10-10T16:00:00.000Z" },
      "faceHeightFt": { "min": 7, "max": 9 },
      "periodS": 17,
      "directionDeg": 190,
      "directionLabel": "S",
      "beach": { "id": "beach-hb", "name": "Huntington Beach" },
      "beachCount": 5,
      "notable": true,
      "fit": { "status": "above_range", "boards": [] },
      "source": "tropical",
      "stormName": "Hurricane Rachel",
      "sizeByOrientation": {
        "southFacing": { "min": 7, "max": 9 },
        "westFacing": null
      },
      "history": [
        { "runDate": "2026-10-04", "peakAt": "2026-10-09T18:00:00.000Z", "faceHeightFt": 8, "periodS": 17 }
      ]
    }
  ]
}
```

`src/features/swell-outlook/__fixtures__/outlook.empty.json`:
```json
{
  "generatedAt": "2026-10-04T15:20:00.000Z",
  "runDate": "2026-10-04",
  "horizonDays": 9,
  "homeBeach": { "id": "beach-hb", "name": "Huntington Beach" },
  "swells": []
}
```

`src/features/swell-outlook/__fixtures__/make-swell.ts`:
```ts
import type { OutlookSwell, SwellOutlookResponse } from '../types';

export function makeSwell(overrides: Partial<OutlookSwell> = {}): OutlookSwell {
  return {
    id: 'swell-1',
    eventKey: 'beach-hb:SSW:2026-10-05',
    tier: 'locked',
    status: 'forecast',
    change: 'steady',
    arrivalAt: null,
    peakAt: '2026-10-05T19:00:00.000Z',
    peakWindow: null,
    faceHeightFt: { min: 2, max: 3 },
    periodS: 15,
    directionDeg: 205,
    directionLabel: 'SSW',
    beach: { id: 'beach-hb', name: 'Huntington Beach' },
    beachCount: 1,
    notable: false,
    fit: { status: 'rideable', boards: [] },
    source: 'southern_hemisphere',
    stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: null },
    history: [],
    ...overrides,
  };
}

export function makeOutlook(overrides: Partial<SwellOutlookResponse> = {}): SwellOutlookResponse {
  return {
    generatedAt: '2026-10-04T15:20:00.000Z',
    runDate: '2026-10-04',
    horizonDays: 9,
    homeBeach: { id: 'beach-hb', name: 'Huntington Beach' },
    swells: [makeSwell()],
    ...overrides,
  };
}
```

`src/features/swell-outlook/index.ts` (later tasks append exports):
```ts
export { parseSwellOutlook } from './parse-outlook';
export { OUTLOOK_TIERS } from './types';
export type {
  OutlookChange,
  OutlookFit,
  OutlookFitStatus,
  OutlookHistoryRun,
  OutlookSizeRange,
  OutlookSource,
  OutlookStatus,
  OutlookSwell,
  OutlookTier,
  SwellOutlookResponse,
  VisibleOutlookTier,
} from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/parse-outlook.test.ts && npm run typecheck`
Expected: PASS (8 tests), typecheck clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add outlook contract types, tolerant parser and fixtures"
```

### Task 2: Gating query hook and dev fixture
**Files:** Create `src/features/swell-outlook/use-swell-outlook.ts`, `dev-fixture.ts`; Modify `index.ts`; Test `src/features/swell-outlook/__tests__/use-swell-outlook.test.tsx`, `__tests__/dev-fixture.test.ts`.
**Interfaces:** Consumes: `apiGet<T>(path: string, options?: RequestOptions): Promise<T>` (`src/lib/api-client.ts:170`; options accept `signal`, default `cacheMode` is `no-store`), `shouldRetryNativeQuery(failureCount: number, error: unknown, maxRetries?: number): boolean` (`src/lib/query-error-policy.ts:3`), `useAuthStore` (`src/stores/auth-store`), `parseSwellOutlook`. Produces: `SWELL_OUTLOOK_PATH`, `SWELL_OUTLOOK_QUERY_KEY`, `fetchSwellOutlook(signal?: AbortSignal): Promise<SwellOutlookResponse | null>`, `useSwellOutlook(): UseQueryResult<SwellOutlookResponse | null, Error>`, `devOutlookFixture(now?: Date): SwellOutlookResponse | null | undefined`, `rebaseOutlookToNow(outlook: SwellOutlookResponse, now: Date): SwellOutlookResponse`.

Semantics every later task relies on: `data` is `undefined` while pending or after a first transport failure, `null` when the user is not enabled (401/403/404 or unparseable body), and a `SwellOutlookResponse` when enabled. Gate on `data != null`.

Spec note: the web `next.config.mjs` blanket-caches `/api/*` for 60 s and the native client defaults to `cacheMode: 'no-store'`; the outlook keeps that default so a 403 can never stick in NSURLCache and so allowlist changes take effect on the next fetch.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/use-swell-outlook.test.tsx`:
```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { apiGet } from '@/lib/api-client';
import threeOverlapping from '../__fixtures__/outlook.three-overlapping.json';
import { useSwellOutlook } from '../use-swell-outlook';

let mockUser: { id: string } | null = { id: 'user-1' };

jest.mock('@/lib/api-client', () => ({ apiGet: jest.fn() }));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockUser }),
}));

function statusError(status: number): Error {
  return Object.assign(new Error(`status ${status}`), { status });
}

function createWrapper(): ({ children }: { children: React.ReactNode }) => React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
  });
  return function Wrapper({ children }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSwellOutlook', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    jest.mocked(apiGet).mockReset();
    delete process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE;
  });

  it('returns the parsed outlook when the endpoint answers', async () => {
    jest.mocked(apiGet).mockResolvedValue(threeOverlapping);
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.swells).toHaveLength(3);
    expect(apiGet).toHaveBeenCalledWith('/api/swell/outlook', expect.objectContaining({ signal: expect.anything() }));
  });

  it.each([401, 403, 404])('treats a %i as "not enabled for this user" (data null, no error)', async (status) => {
    jest.mocked(apiGet).mockRejectedValue(statusError(status));
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('treats an unparseable body as not enabled', async () => {
    jest.mocked(apiGet).mockResolvedValue({ hello: 'world' });
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('surfaces a server failure as an error with no data (callers must not treat it as enabled)', async () => {
    jest.mocked(apiGet).mockRejectedValue(statusError(500));
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(result.current.data).toBeUndefined();
  });

  it('does not call the API without a signed-in user', () => {
    mockUser = null;
    renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('serves a dev fixture without touching the API when the env var is set', async () => {
    process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE = 'empty';
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.swells).toEqual([]);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('serves "disabled" from the dev fixture as null', async () => {
    process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE = 'disabled';
    const { result } = renderHook(() => useSwellOutlook(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
```

`src/features/swell-outlook/__tests__/dev-fixture.test.ts`:
```ts
import threeOverlapping from '../__fixtures__/outlook.three-overlapping.json';
import { devOutlookFixture, rebaseOutlookToNow } from '../dev-fixture';
import { parseSwellOutlook } from '../parse-outlook';

describe('rebaseOutlookToNow', () => {
  const outlook = parseSwellOutlook(threeOverlapping)!;

  it('shifts every timestamp by whole days so the first swell stays a day out', () => {
    const rebased = rebaseOutlookToNow(outlook, new Date('2026-11-12T20:00:00.000Z'));
    expect(rebased.generatedAt).toBe('2026-11-12T15:20:00.000Z');
    expect(rebased.runDate).toBe('2026-11-12');
    expect(rebased.swells[0].peakAt).toBe('2026-11-13T19:00:00.000Z');
    expect(rebased.swells[0].history[0].runDate).toBe('2026-11-09');
    expect(rebased.swells[2].peakWindow).toEqual({
      from: '2026-11-17T04:00:00.000Z',
      to: '2026-11-18T16:00:00.000Z',
    });
    expect(rebased.swells[2].arrivalAt).toBeNull();
  });

  it('is a no-op on the fixture day', () => {
    expect(rebaseOutlookToNow(outlook, new Date('2026-10-04T20:00:00.000Z'))).toEqual(outlook);
  });
});

describe('devOutlookFixture', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE;
  });

  it('returns undefined when no fixture is requested', () => {
    expect(devOutlookFixture()).toBeUndefined();
  });

  it('returns a rebased outlook, an empty one, or null', () => {
    process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE = 'three';
    expect(devOutlookFixture(new Date('2026-10-04T20:00:00.000Z'))?.swells).toHaveLength(3);
    process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE = 'empty';
    expect(devOutlookFixture()?.swells).toEqual([]);
    process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE = 'disabled';
    expect(devOutlookFixture()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/use-swell-outlook.test.tsx src/features/swell-outlook/__tests__/dev-fixture.test.ts`
Expected: FAIL with `Cannot find module '../use-swell-outlook'` / `'../dev-fixture'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/dev-fixture.ts`:
```ts
import emptyFixture from './__fixtures__/outlook.empty.json';
import threeFixture from './__fixtures__/outlook.three-overlapping.json';
import { parseSwellOutlook } from './parse-outlook';
import type { SwellOutlookResponse } from './types';

const DAY_MS = 86_400_000;

function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function shiftInstant(iso: string, deltaMs: number): string {
  return new Date(Date.parse(iso) + deltaMs).toISOString();
}

function shiftDate(date: string, deltaMs: number): string {
  return new Date(Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`) + deltaMs).toISOString().slice(0, 10);
}

/** Moves a fixture by whole days so its swells keep the same offsets from "today". */
export function rebaseOutlookToNow(outlook: SwellOutlookResponse, now: Date): SwellOutlookResponse {
  const delta = utcDayStart(now.getTime()) - utcDayStart(Date.parse(outlook.generatedAt));
  if (delta === 0) return outlook;
  return {
    ...outlook,
    generatedAt: shiftInstant(outlook.generatedAt, delta),
    runDate: shiftDate(outlook.runDate, delta),
    swells: outlook.swells.map((swell) => ({
      ...swell,
      arrivalAt: swell.arrivalAt ? shiftInstant(swell.arrivalAt, delta) : null,
      peakAt: shiftInstant(swell.peakAt, delta),
      peakWindow: swell.peakWindow
        ? { from: shiftInstant(swell.peakWindow.from, delta), to: shiftInstant(swell.peakWindow.to, delta) }
        : null,
      history: swell.history.map((run) => ({
        ...run,
        runDate: shiftDate(run.runDate, delta),
        peakAt: shiftInstant(run.peakAt, delta),
      })),
    })),
  };
}

/**
 * Simulator-only: `EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE=three|empty|disabled`.
 * undefined means "no fixture requested"; null is the disabled (403) answer.
 */
export function devOutlookFixture(now: Date = new Date()): SwellOutlookResponse | null | undefined {
  const name = process.env.EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE;
  if (name === 'disabled') return null;
  const body = name === 'three' ? threeFixture : name === 'empty' ? emptyFixture : null;
  if (!body) return undefined;
  const parsed = parseSwellOutlook(body);
  return parsed ? rebaseOutlookToNow(parsed, now) : null;
}
```

`src/features/swell-outlook/use-swell-outlook.ts`:
```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { shouldRetryNativeQuery } from '@/lib/query-error-policy';
import { useAuthStore } from '@/stores/auth-store';
import { devOutlookFixture } from './dev-fixture';
import { parseSwellOutlook } from './parse-outlook';
import type { SwellOutlookResponse } from './types';

export const SWELL_OUTLOOK_PATH = '/api/swell/outlook';
export const SWELL_OUTLOOK_QUERY_KEY = 'swell-outlook';
const STALE_MS = 5 * 60 * 1000;
/** The backend is flag + allowlist gated: these mean "not for this user", not "broken". */
const NOT_ENABLED_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

export async function fetchSwellOutlook(signal?: AbortSignal): Promise<SwellOutlookResponse | null> {
  if (__DEV__) {
    const fixture = devOutlookFixture();
    if (fixture !== undefined) return fixture;
  }
  try {
    return parseSwellOutlook(await apiGet<unknown>(SWELL_OUTLOOK_PATH, { signal }));
  } catch (error: unknown) {
    const status = errorStatus(error);
    if (status !== null && NOT_ENABLED_STATUSES.has(status)) return null;
    throw error;
  }
}

/**
 * `data === null` means the outlook is not enabled for this user; every
 * surface must then render exactly as it did before this feature. `undefined`
 * means loading, or a first failure: also no outlook UI on Home/Week Scout.
 */
export function useSwellOutlook(): UseQueryResult<SwellOutlookResponse | null, Error> {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery<SwellOutlookResponse | null, Error>({
    queryKey: [SWELL_OUTLOOK_QUERY_KEY, userId],
    queryFn: ({ signal }) => fetchSwellOutlook(signal),
    enabled: userId !== null,
    staleTime: STALE_MS,
    retry: (failureCount, error) => shouldRetryNativeQuery(failureCount, error, 1),
  });
}
```

Append to `src/features/swell-outlook/index.ts`:
```ts
export { fetchSwellOutlook, SWELL_OUTLOOK_PATH, SWELL_OUTLOOK_QUERY_KEY, useSwellOutlook } from './use-swell-outlook';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook && npm run typecheck`
Expected: PASS (parse, hook, dev-fixture suites), typecheck clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add gating query hook and dev fixture override"
```

### Task 3: Labels, grouping, fit and change copy (pure)
**Files:** Create `src/features/swell-outlook/outlook-format.ts`; Modify `src/features/swell-landing/types.ts:11`, `src/features/swell-outlook/index.ts`; Test `src/features/swell-outlook/__tests__/outlook-format.test.ts`.
**Interfaces:** Consumes: `swellConfidenceLabel(confidence: WeekScoutSwellConfidence): string` (`src/features/week-scout-swells/swell-format.ts:83`), `formatSwellNumber(value: number): string` (`src/features/swell-landing/swell-copy.ts:33`), `formatForecastDateInZone`, `formatForecastWeekdayInZone`, `formatForecastLongWeekdayInZone`, `getForecastDateParts` (`src/lib/forecast-time-formatting.ts`), `normalizeBoardClass`, `Colors` (`src/constants/theme.ts`). Produces (all exported from `outlook-format.ts`):
- `type DirectionFamily = 'south' | 'northwest'`, `directionFamily(deg: number): DirectionFamily`, `FAMILY_STROKE_ON_DARK`, `FAMILY_STROKE_ON_PAPER: Record<DirectionFamily, string>`
- `outlookTierLabel(tier: OutlookTier): string`, `OUTLOOK_TIER_ORDER: readonly VisibleOutlookTier[]`, `OUTLOOK_GROUP_NOTES`, `visibleOutlookSwells(swells: readonly OutlookSwell[]): OutlookSwell[]`, `interface OutlookGroup { tier; label; note; swells }`, `groupOutlookSwells(swells): OutlookGroup[]`
- `formatOutlookSize(range: OutlookSizeRange): string`, `formatOutlookSizeSpoken(range): string`, `outlookSizeMid(range): number`
- `outlookPeakDay(swell, timezone): { weekday: string; weekdayLong: string; date: string; windowLabel: string | null }`
- `outlookChangeNote(swell, timezone): string | null`, `outlookLeadHedge(peakAt: string, now: Date): 'so far' | 'needs watching' | null`
- `interface OutlookFitTreatment { label: string | null; dimmed: boolean; tone: 'none' | 'caution' }`, `outlookFitTreatment(fit: OutlookFit, userBoardClasses: readonly BoardClass[]): OutlookFitTreatment`, `boardClassesFromBoards(boards: ReadonlyArray<{ board_type: string }> | undefined): BoardClass[]`
- `outlookSourceLine(swell): string | null`, `outlookOrientationLine(orientation: OutlookSwell['sizeByOrientation']): string | null`
- `formatOutlookUpdated(generatedAt: string, now: Date): string`, `outlookHeaderLine(outlook: SwellOutlookResponse, now: Date): string`, `outlookFooterLine(count: number, beyondCount: number): string`, `outlookTierSummary(swells): string`
- `outlookRowAccessibilityLabel(swell, opts: { timezone: string; userBoardClasses: readonly BoardClass[]; homeBeachId: string | null; now: Date }): string`
- `buildOutlookLandingParams(swell, timezone): SwellLandingRouteParams`

Spec notes: (1) "Out-of-range swells at lower contrast" is implemented as `below_range` only, because the fit rules say `above_range` is never dimmed. (2) The contract carries `fit.boards` but not the user's full board list, so "name the board when only some fit" compares `fit.boards.length` with the distinct board classes from `useUserBoards`. (3) The contract has no beach timezone; day labels use the device timezone passed in by callers (`getDeviceTimezone() ?? 'UTC'`). (4) Pure helpers import `swell-format.ts` / `swell-copy.ts` by file path so unit tests stay off the Mapbox/WebView import chain that the `week-scout-swells` index pulls in.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/outlook-format.test.ts`:
```ts
import type { BoardClass } from '@/lib/board-class';
import { makeOutlook, makeSwell } from '../__fixtures__/make-swell';
import {
  boardClassesFromBoards,
  buildOutlookLandingParams,
  directionFamily,
  formatOutlookSize,
  formatOutlookSizeSpoken,
  formatOutlookUpdated,
  groupOutlookSwells,
  outlookChangeNote,
  outlookFitTreatment,
  outlookFooterLine,
  outlookHeaderLine,
  outlookLeadHedge,
  outlookOrientationLine,
  outlookPeakDay,
  outlookRowAccessibilityLabel,
  outlookSourceLine,
  outlookTierLabel,
  outlookTierSummary,
  visibleOutlookSwells,
} from '../outlook-format';

const TZ = 'America/Los_Angeles';
const USER_BOARDS: BoardClass[] = ['shortboard', 'fish', 'longboard'];
const runs = (...heights: number[]) =>
  heights.map((faceHeightFt, index) => ({
    runDate: `2026-10-0${index + 1}`,
    peakAt: '2026-10-05T19:00:00.000Z',
    faceHeightFt,
    periodS: 15,
  }));

describe('direction family and tier labels', () => {
  it.each([
    [205, 'south'], [140, 'south'], [260, 'south'], [-155, 'south'],
    [295, 'northwest'], [139.9, 'northwest'], [261, 'northwest'], [0, 'northwest'],
  ])('%d degrees is %s', (deg, family) => {
    expect(directionFamily(deg)).toBe(family);
  });

  it('labels every tier, including the one Phase 1 never draws', () => {
    expect(outlookTierLabel('locked')).toBe('Locked');
    expect(outlookTierLabel('likely')).toBe('Likely');
    expect(outlookTierLabel('on_the_radar')).toBe('On the radar');
    expect(outlookTierLabel('early_signal')).toBe('Early signal');
  });
});

describe('visibleOutlookSwells and groupOutlookSwells', () => {
  const early = makeSwell({ id: 'e', tier: 'early_signal', peakAt: '2026-10-12T19:00:00.000Z' });
  const radar = makeSwell({ id: 'r', tier: 'on_the_radar', peakAt: '2026-10-09T19:00:00.000Z' });
  const lockedLate = makeSwell({ id: 'l2', tier: 'locked', peakAt: '2026-10-06T19:00:00.000Z' });
  const lockedEarly = makeSwell({ id: 'l1', tier: 'locked', peakAt: '2026-10-05T19:00:00.000Z' });

  it('drops early_signal and sorts chronologically', () => {
    expect(visibleOutlookSwells([early, radar, lockedLate, lockedEarly]).map((s) => s.id)).toEqual(['l1', 'l2', 'r']);
  });

  it('groups by tier in locked, likely, radar order and omits empty groups', () => {
    const groups = groupOutlookSwells([early, radar, lockedLate, lockedEarly]);
    expect(groups.map((g) => g.tier)).toEqual(['locked', 'on_the_radar']);
    expect(groups[0].swells.map((s) => s.id)).toEqual(['l1', 'l2']);
    expect(groups[1].note).toMatch(/often change or fade/);
  });

  it('returns no groups when only early signals exist', () => {
    expect(groupOutlookSwells([early])).toEqual([]);
  });
});

describe('size formatting', () => {
  it('writes ranges, collapsed equal ends, and decimals', () => {
    expect(formatOutlookSize({ min: 2, max: 3 })).toBe('2–3 ft');
    expect(formatOutlookSize({ min: 3, max: 3 })).toBe('3 ft');
    expect(formatOutlookSize({ min: 1.5, max: 2 })).toBe('1.5–2 ft');
  });

  it('writes a spoken form for screen readers', () => {
    expect(formatOutlookSizeSpoken({ min: 2, max: 3 })).toBe('2 to 3 feet');
    expect(formatOutlookSizeSpoken({ min: 1, max: 1 })).toBe('1 foot');
  });
});

describe('outlookPeakDay', () => {
  it('names the peak day in the given zone', () => {
    expect(outlookPeakDay(makeSwell(), TZ)).toEqual({
      weekday: 'MON', weekdayLong: 'Monday', date: '5', windowLabel: null,
    });
  });

  it('adds a window label only when the window spans two weekdays', () => {
    const windowed = makeSwell({ peakWindow: { from: '2026-10-09T04:00:00.000Z', to: '2026-10-10T16:00:00.000Z' } });
    expect(outlookPeakDay(windowed, TZ).windowLabel).toBe('THU–SAT');
    const sameDay = makeSwell({ peakWindow: { from: '2026-10-09T18:00:00.000Z', to: '2026-10-09T22:00:00.000Z' } });
    expect(outlookPeakDay(sameDay, TZ).windowLabel).toBeNull();
  });
});

describe('outlookChangeNote', () => {
  it('writes the size delta for upgrades and downgrades from the last two runs', () => {
    expect(outlookChangeNote(makeSwell({ change: 'upgraded', history: runs(2, 2, 2, 2.5) }), TZ)).toBe('Up 0.5 ft');
    expect(outlookChangeNote(makeSwell({ change: 'downgraded', history: runs(4, 3) }), TZ)).toBe('Down 1 ft');
  });

  it('falls back to plain words when a delta cannot be computed or is tiny', () => {
    expect(outlookChangeNote(makeSwell({ change: 'upgraded', history: [] }), TZ)).toBe('Bigger than before');
    expect(outlookChangeNote(makeSwell({ change: 'downgraded', history: runs(3, 2.9) }), TZ)).toBe('Smaller than before');
  });

  it('says which day a moved swell now peaks', () => {
    const moved = makeSwell({
      change: 'earlier',
      history: [
        { runDate: '2026-10-03', peakAt: '2026-10-10T19:00:00.000Z', faceHeightFt: 4, periodS: 15 },
        { runDate: '2026-10-04', peakAt: '2026-10-09T19:00:00.000Z', faceHeightFt: 4, periodS: 15 },
      ],
    });
    expect(outlookChangeNote(moved, TZ)).toBe('Moved to Friday');
    expect(outlookChangeNote(makeSwell({ change: 'later', history: [] }), TZ)).toBe('Arriving later');
  });

  it('shows new, and nothing for steady', () => {
    expect(outlookChangeNote(makeSwell({ change: 'new' }), TZ)).toBe('New');
    expect(outlookChangeNote(makeSwell({ change: 'steady' }), TZ)).toBeNull();
  });

  it('lets a non-forecast status replace the change note', () => {
    expect(outlookChangeNote(makeSwell({ status: 'faded', change: 'new' }), TZ)).toBe('Faded from the forecast');
    expect(outlookChangeNote(makeSwell({ status: 'shrinking' }), TZ)).toBe('Shrinking');
    expect(outlookChangeNote(makeSwell({ status: 'arrived' }), TZ)).toBe('Here now');
  });
});

describe('outlookLeadHedge', () => {
  const now = new Date('2026-10-04T16:00:00.000Z');
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  it('is silent inside five days, "so far" to seven, "needs watching" beyond', () => {
    expect(outlookLeadHedge(at(2), now)).toBeNull();
    expect(outlookLeadHedge(at(5), now)).toBe('so far');
    expect(outlookLeadHedge(at(7), now)).toBe('so far');
    expect(outlookLeadHedge(at(7.5), now)).toBe('needs watching');
  });
});

describe('outlookFitTreatment', () => {
  it('labels above_range and never dims it', () => {
    expect(outlookFitTreatment({ status: 'above_range', boards: [] }, USER_BOARDS)).toEqual({
      label: 'Above your range', dimmed: false, tone: 'caution',
    });
  });

  it('dims and labels below_range', () => {
    expect(outlookFitTreatment({ status: 'below_range', boards: [] }, USER_BOARDS)).toEqual({
      label: 'Small for you', dimmed: true, tone: 'none',
    });
  });

  it('names the board only when some, not all, of the user boards fit', () => {
    expect(outlookFitTreatment({ status: 'in_range', boards: ['longboard'] }, USER_BOARDS).label).toBe('Longboard size');
    expect(outlookFitTreatment({ status: 'in_range', boards: ['shortboard', 'fish'] }, USER_BOARDS).label).toBe('Shortboard or fish size');
    expect(outlookFitTreatment({ status: 'in_range', boards: ['sup', 'longboard'] }, ['sup', 'longboard', 'fish']).label).toBe('SUP or longboard size');
    expect(outlookFitTreatment({ status: 'in_range', boards: ['longboard'] }, ['longboard']).label).toBeNull();
  });

  it('carries no label for unknown, rideable, an unrecorded board list, or empty boards', () => {
    expect(outlookFitTreatment({ status: 'unknown', boards: [] }, [])).toEqual({ label: null, dimmed: false, tone: 'none' });
    expect(outlookFitTreatment({ status: 'rideable', boards: [] }, USER_BOARDS).label).toBeNull();
    expect(outlookFitTreatment({ status: 'in_range', boards: ['longboard'] }, []).label).toBeNull();
    expect(outlookFitTreatment({ status: 'in_range', boards: [] }, USER_BOARDS).label).toBeNull();
  });
});

describe('boardClassesFromBoards', () => {
  it('maps board types to unique classes in first-seen order and drops unknowns', () => {
    expect(boardClassesFromBoards([
      { board_type: 'Shortboard' }, { board_type: 'long board' }, { board_type: 'fish' },
      { board_type: 'shortboard' }, { board_type: 'mystery' },
    ])).toEqual(['shortboard', 'longboard', 'fish']);
    expect(boardClassesFromBoards(undefined)).toEqual([]);
  });
});

describe('source and orientation lines', () => {
  it('prefers the storm name and omits unknown sources', () => {
    expect(outlookSourceLine(makeSwell({ source: 'tropical', stormName: 'Hurricane Rachel' }))).toBe('From Hurricane Rachel');
    expect(outlookSourceLine(makeSwell({ source: 'southern_hemisphere' }))).toBe('Southern Hemisphere swell');
    expect(outlookSourceLine(makeSwell({ source: 'north_pacific' }))).toBe('North Pacific swell');
    expect(outlookSourceLine(makeSwell({ source: 'tropical' }))).toBe('Tropical swell');
    expect(outlookSourceLine(makeSwell({ source: 'local' }))).toBe('Local swell');
    expect(outlookSourceLine(makeSwell({ source: 'unknown', stormName: null }))).toBeNull();
  });

  it('writes whichever orientation sides exist', () => {
    expect(outlookOrientationLine({ southFacing: { min: 7, max: 9 }, westFacing: { min: 4, max: 5 } }))
      .toBe('South-facing 7–9 ft · West-facing 4–5 ft');
    expect(outlookOrientationLine({ southFacing: null, westFacing: { min: 4, max: 5 } })).toBe('West-facing 4–5 ft');
    expect(outlookOrientationLine({ southFacing: { min: 7, max: 9 }, westFacing: null })).toBe('South-facing 7–9 ft');
    expect(outlookOrientationLine({ southFacing: null, westFacing: null })).toBeNull();
  });
});

describe('header, footer and summary lines', () => {
  const now = new Date('2026-10-04T16:00:00.000Z');
  it('words the update age', () => {
    expect(formatOutlookUpdated('2026-10-04T15:59:00.000Z', now)).toBe('updated just now');
    expect(formatOutlookUpdated('2026-10-04T15:15:00.000Z', now)).toBe('updated 45 min ago');
    expect(formatOutlookUpdated('2026-10-04T13:00:00.000Z', now)).toBe('updated 3 h ago');
    expect(formatOutlookUpdated('2026-10-02T15:00:00.000Z', now)).toBe('updated 2 d ago');
    expect(formatOutlookUpdated('garbage', now)).toBe('updated recently');
  });

  it('names the home beach or falls back to "Your beaches"', () => {
    expect(outlookHeaderLine(makeOutlook(), now)).toBe('Huntington Beach · next 9 days · updated 40 min ago');
    expect(outlookHeaderLine(makeOutlook({ homeBeach: null }), now)).toMatch(/^Your beaches · next 9 days/);
  });

  it('words the footer for none, one, many and beyond-this-week', () => {
    expect(outlookFooterLine(0, 0)).toBe('No notable swells on the way');
    expect(outlookFooterLine(1, 0)).toBe('1 swell on the way');
    expect(outlookFooterLine(3, 2)).toBe('3 swells on the way · 2 beyond this week');
  });

  it('summarises tiers, skipping empty ones and early signals', () => {
    const swells = [
      makeSwell({ tier: 'locked' }), makeSwell({ tier: 'likely' }),
      makeSwell({ tier: 'on_the_radar' }), makeSwell({ tier: 'early_signal' }),
    ];
    expect(outlookTierSummary(swells)).toBe('1 locked · 1 likely · 1 on the radar');
    expect(outlookTierSummary([])).toBe('');
  });
});

describe('outlookRowAccessibilityLabel', () => {
  const NOW = new Date('2026-10-04T16:00:00.000Z');
  const swell = makeSwell({
    change: 'upgraded',
    history: runs(2, 2, 2, 2.5),
    fit: { status: 'in_range', boards: ['longboard'] },
  });
  it('reads day, size, period, direction, tier, change and fit', () => {
    expect(outlookRowAccessibilityLabel(swell, { timezone: TZ, userBoardClasses: USER_BOARDS, homeBeachId: 'beach-hb', now: NOW }))
      .toBe('Monday 5, 2 to 3 feet, 15 seconds from SSW, Locked, Up 0.5 ft, Longboard size');
  });

  it('names the beach when it is not the home beach and drops a missing period', () => {
    const other = makeSwell({ periodS: null, beach: { id: 'beach-sb', name: 'Seal Beach' } });
    expect(outlookRowAccessibilityLabel(other, { timezone: TZ, userBoardClasses: [], homeBeachId: 'beach-hb', now: NOW }))
      .toBe('Monday 5, 2 to 3 feet, from SSW at Seal Beach, Locked');
  });
});

describe('buildOutlookLandingParams', () => {
  it('passes enough for the detail card to paint without its own fetch', () => {
    expect(buildOutlookLandingParams(makeSwell(), TZ)).toEqual({
      eventKey: 'beach-hb:SSW:2026-10-05',
      kind: 'coming',
      beachId: 'beach-hb',
      beachName: 'Huntington Beach',
      peakDate: '2026-10-05',
      peakHeightFt: 2.5,
      peakPeriodS: 15,
      entrySource: 'outlook',
    });
    expect(buildOutlookLandingParams(makeSwell({ periodS: null }), TZ)).not.toHaveProperty('peakPeriodS');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/outlook-format.test.ts`
Expected: FAIL with `Cannot find module '../outlook-format'`.

- [ ] **Step 3: Write the minimal implementation**

Edit `src/features/swell-landing/types.ts` line 11:
```ts
export type SwellLandingEntrySource = 'push' | 'link' | 'outlook';
```
(`sanitizeDeferredSwellLandingParams` still only accepts `push`/`link`, so deferred URLs are unchanged.)

`src/features/swell-outlook/outlook-format.ts`:
```ts
import { Colors } from '@/constants/theme';
import { formatSwellNumber } from '@/features/swell-landing/swell-copy';
import type { SwellLandingRouteParams } from '@/features/swell-landing/types';
import { swellConfidenceLabel } from '@/features/week-scout-swells/swell-format';
import { normalizeBoardClass, type BoardClass } from '@/lib/board-class';
import {
  formatForecastDateInZone,
  formatForecastLongWeekdayInZone,
  formatForecastWeekdayInZone,
  getForecastDateParts,
} from '@/lib/forecast-time-formatting';
import type {
  OutlookFit,
  OutlookSizeRange,
  OutlookSwell,
  OutlookTier,
  SwellOutlookResponse,
  VisibleOutlookTier,
} from './types';

const DAY_MS = 86_400_000;
const MATERIAL_CHANGE_FT = 0.5;

export type DirectionFamily = 'south' | 'northwest';

/** South swells (SSE through WSW) read teal, everything else reads gold, as in the approved mockup. */
export function directionFamily(deg: number): DirectionFamily {
  const normalised = ((deg % 360) + 360) % 360;
  return normalised >= 140 && normalised <= 260 ? 'south' : 'northwest';
}

export const FAMILY_STROKE_ON_DARK: Record<DirectionFamily, string> = {
  south: Colors.teal,
  northwest: Colors.accent,
};
export const FAMILY_STROKE_ON_PAPER: Record<DirectionFamily, string> = {
  south: Colors.tealInk,
  northwest: Colors.goldInk,
};

export function outlookTierLabel(tier: OutlookTier): string {
  return tier === 'early_signal' ? 'Early signal' : swellConfidenceLabel(tier);
}

export const OUTLOOK_TIER_ORDER: readonly VisibleOutlookTier[] = ['locked', 'likely', 'on_the_radar'];

export const OUTLOOK_GROUP_NOTES: Record<VisibleOutlookTier, string> = {
  locked: 'Firm. Timing and size are unlikely to move much.',
  likely: 'Holding so far. Expect small changes.',
  on_the_radar: 'Needs watching. Swells this far out often change or fade.',
};

export function visibleOutlookSwells(swells: readonly OutlookSwell[]): OutlookSwell[] {
  return swells
    .filter((swell) => swell.tier !== 'early_signal')
    .sort((a, b) => Date.parse(a.peakAt) - Date.parse(b.peakAt));
}

export interface OutlookGroup {
  tier: VisibleOutlookTier;
  label: string;
  note: string;
  swells: OutlookSwell[];
}

export function groupOutlookSwells(swells: readonly OutlookSwell[]): OutlookGroup[] {
  const visible = visibleOutlookSwells(swells);
  return OUTLOOK_TIER_ORDER
    .map((tier) => ({
      tier,
      label: outlookTierLabel(tier),
      note: OUTLOOK_GROUP_NOTES[tier],
      swells: visible.filter((swell) => swell.tier === tier),
    }))
    .filter((group) => group.swells.length > 0);
}

export function formatOutlookSize(range: OutlookSizeRange): string {
  const min = formatSwellNumber(range.min);
  const max = formatSwellNumber(range.max);
  return min === max ? `${min} ft` : `${min}–${max} ft`;
}

export function formatOutlookSizeSpoken(range: OutlookSizeRange): string {
  const min = formatSwellNumber(range.min);
  const max = formatSwellNumber(range.max);
  if (min === max) return `${min} ${min === '1' ? 'foot' : 'feet'}`;
  return `${min} to ${max} feet`;
}

/** Midpoint to the nearest half foot: the single number the swell card and route params carry. */
export function outlookSizeMid(range: OutlookSizeRange): number {
  return Math.round(((range.min + range.max) / 2) * 2) / 2;
}

export function outlookPeakDay(
  swell: OutlookSwell,
  timezone: string,
): { weekday: string; weekdayLong: string; date: string; windowLabel: string | null } {
  const peak = new Date(swell.peakAt);
  let windowLabel: string | null = null;
  if (swell.peakWindow) {
    const from = formatForecastWeekdayInZone(new Date(swell.peakWindow.from), timezone);
    const to = formatForecastWeekdayInZone(new Date(swell.peakWindow.to), timezone);
    windowLabel = from === to ? null : `${from}–${to}`;
  }
  return {
    weekday: formatForecastWeekdayInZone(peak, timezone),
    weekdayLong: formatForecastLongWeekdayInZone(peak, timezone, 'en-US'),
    date: String(getForecastDateParts(peak, timezone).day),
    windowLabel,
  };
}

function weekdayLong(iso: string, timezone: string): string {
  return formatForecastLongWeekdayInZone(new Date(iso), timezone, 'en-US');
}

/** One change note per row. A non-forecast status says more than the change kind, so it wins. */
export function outlookChangeNote(swell: OutlookSwell, timezone: string): string | null {
  if (swell.status === 'faded') return 'Faded from the forecast';
  if (swell.status === 'shrinking') return 'Shrinking';
  if (swell.status === 'arrived') return 'Here now';
  const last = swell.history[swell.history.length - 1];
  const previous = swell.history[swell.history.length - 2];
  switch (swell.change) {
    case 'new':
      return 'New';
    case 'steady':
      return null;
    case 'upgraded':
    case 'downgraded': {
      const up = swell.change === 'upgraded';
      const plain = up ? 'Bigger than before' : 'Smaller than before';
      if (!last || !previous) return plain;
      const delta = Math.abs(last.faceHeightFt - previous.faceHeightFt);
      return delta >= MATERIAL_CHANGE_FT ? `${up ? 'Up' : 'Down'} ${formatSwellNumber(delta)} ft` : plain;
    }
    case 'earlier':
    case 'later': {
      if (last && previous) {
        const lastDay = weekdayLong(last.peakAt, timezone);
        if (lastDay !== weekdayLong(previous.peakAt, timezone)) return `Moved to ${lastDay}`;
      }
      return swell.change === 'earlier' ? 'Arriving earlier' : 'Arriving later';
    }
    default:
      return null;
  }
}

/** Hedging follows lead, as a forecaster's wording does: firm inside 5 days, "so far" to 7, "needs watching" beyond. */
export function outlookLeadHedge(peakAt: string, now: Date): 'so far' | 'needs watching' | null {
  const days = (Date.parse(peakAt) - now.getTime()) / DAY_MS;
  if (days > 7) return 'needs watching';
  if (days >= 5) return 'so far';
  return null;
}

export interface OutlookFitTreatment {
  label: string | null;
  dimmed: boolean;
  tone: 'none' | 'caution';
}

const BOARD_LABELS: Record<BoardClass, string> = {
  foamie: 'Foamie',
  longboard: 'Longboard',
  'mid-length': 'Mid-length',
  funboard: 'Funboard',
  fish: 'Fish',
  shortboard: 'Shortboard',
  'step-up': 'Step-up',
  gun: 'Gun',
  sup: 'SUP',
  foil: 'Foil',
  bodyboard: 'Bodyboard',
};

function boardPhrase(boards: readonly BoardClass[]): string {
  return boards
    .map((board, index) => {
      const label = BOARD_LABELS[board];
      if (index === 0 || board === 'sup') return label;
      return label.charAt(0).toLowerCase() + label.slice(1);
    })
    .join(' or ');
}

/**
 * below_range is dimmed and labelled; above_range is labelled and never
 * dimmed (it is safety-relevant); in_range names the board(s) only when the
 * user owns more board classes than fit; rideable/unknown carry no label.
 */
export function outlookFitTreatment(
  fit: OutlookFit,
  userBoardClasses: readonly BoardClass[],
): OutlookFitTreatment {
  if (fit.status === 'above_range') return { label: 'Above your range', dimmed: false, tone: 'caution' };
  if (fit.status === 'below_range') return { label: 'Small for you', dimmed: true, tone: 'none' };
  if (fit.status === 'in_range' && fit.boards.length > 0 && userBoardClasses.length > fit.boards.length) {
    return { label: `${boardPhrase(fit.boards)} size`, dimmed: false, tone: 'none' };
  }
  return { label: null, dimmed: false, tone: 'none' };
}

export function boardClassesFromBoards(
  boards: ReadonlyArray<{ board_type: string }> | undefined,
): BoardClass[] {
  const classes: BoardClass[] = [];
  for (const board of boards ?? []) {
    const boardClass = normalizeBoardClass(board.board_type);
    if (boardClass && !classes.includes(boardClass)) classes.push(boardClass);
  }
  return classes;
}

const SOURCE_LINES: Record<OutlookSwell['source'], string | null> = {
  southern_hemisphere: 'Southern Hemisphere swell',
  tropical: 'Tropical swell',
  north_pacific: 'North Pacific swell',
  local: 'Local swell',
  unknown: null,
};

export function outlookSourceLine(swell: OutlookSwell): string | null {
  return swell.stormName ? `From ${swell.stormName}` : SOURCE_LINES[swell.source];
}

export function outlookOrientationLine(orientation: OutlookSwell['sizeByOrientation']): string | null {
  const parts: string[] = [];
  if (orientation.southFacing) parts.push(`South-facing ${formatOutlookSize(orientation.southFacing)}`);
  if (orientation.westFacing) parts.push(`West-facing ${formatOutlookSize(orientation.westFacing)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatOutlookUpdated(generatedAt: string, now: Date): string {
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated)) return 'updated recently';
  const minutes = Math.max(0, Math.round((now.getTime() - generated) / 60_000));
  if (minutes < 2) return 'updated just now';
  if (minutes < 60) return `updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `updated ${hours} h ago`;
  return `updated ${Math.floor(hours / 24)} d ago`;
}

export function outlookHeaderLine(outlook: SwellOutlookResponse, now: Date): string {
  return [
    outlook.homeBeach?.name ?? 'Your beaches',
    `next ${outlook.horizonDays} days`,
    formatOutlookUpdated(outlook.generatedAt, now),
  ].join(' · ');
}

export function outlookFooterLine(count: number, beyondCount: number): string {
  if (count === 0) return 'No notable swells on the way';
  const base = `${count} ${count === 1 ? 'swell' : 'swells'} on the way`;
  return beyondCount > 0 ? `${base} · ${beyondCount} beyond this week` : base;
}

export function outlookTierSummary(swells: readonly OutlookSwell[]): string {
  const visible = visibleOutlookSwells(swells);
  return OUTLOOK_TIER_ORDER
    .map((tier) => ({ tier, count: visible.filter((swell) => swell.tier === tier).length }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${outlookTierLabel(entry.tier).toLowerCase()}`)
    .join(' · ');
}

export function outlookRowAccessibilityLabel(
  swell: OutlookSwell,
  opts: { timezone: string; userBoardClasses: readonly BoardClass[]; homeBeachId: string | null; now: Date },
): string {
  const day = outlookPeakDay(swell, opts.timezone);
  const fit = outlookFitTreatment(swell.fit, opts.userBoardClasses);
  const beach = swell.beach.id !== opts.homeBeachId ? ` at ${swell.beach.name}` : '';
  const motion = swell.periodS !== null
    ? `${Math.round(swell.periodS)} seconds from ${swell.directionLabel}${beach}`
    : `from ${swell.directionLabel}${beach}`;
  return [
    `${day.weekdayLong} ${day.date}`,
    formatOutlookSizeSpoken(swell.faceHeightFt),
    motion,
    outlookTierLabel(swell.tier),
    outlookChangeNote(swell, opts.timezone),
    fit.label,
    outlookLeadHedge(swell.peakAt, opts.now),
  ].filter(Boolean).join(', ');
}

/**
 * The row hands the detail screen everything its card needs, so it paints
 * immediately and offline; the event record then only adds history and a
 * server-built headline.
 */
export function buildOutlookLandingParams(swell: OutlookSwell, timezone: string): SwellLandingRouteParams {
  return {
    eventKey: swell.eventKey,
    kind: 'coming',
    beachId: swell.beach.id,
    beachName: swell.beach.name,
    peakDate: formatForecastDateInZone(new Date(swell.peakAt), timezone),
    peakHeightFt: outlookSizeMid(swell.faceHeightFt),
    ...(swell.periodS !== null ? { peakPeriodS: swell.periodS } : {}),
    entrySource: 'outlook',
  };
}
```
Append to `src/features/swell-outlook/index.ts`:
```ts
export * from './outlook-format';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/outlook-format.test.ts src/features/swell-landing && npm run typecheck`
Expected: PASS (all format tests; swell-landing suites unchanged), typecheck clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook src/features/swell-landing/types.ts
git commit -m "feat(swell-outlook): add pure label, grouping, fit and change-note logic"
```

### Task 4: Analytics helper over the existing event allowlist
**Files:** Create `src/features/swell-outlook/analytics.ts`; Modify `src/features/swell-outlook/index.ts`; Test `src/features/swell-outlook/__tests__/analytics.test.ts`.
**Interfaces:** Consumes: `trackEvent(eventType: NativeAnalyticsEventType, metadata?: Record<string, unknown>, options?): void` (`src/lib/analytics.ts:1815`), `NATIVE_ANALYTICS_EVENT_TYPES` (`src/lib/analytics.ts:51`). Produces: `type SwellOutlookAction`, `type SwellOutlookEntrySurface = 'home_graphic' | 'home_footer' | 'week_scout'`, `trackSwellOutlook(action: SwellOutlookAction, metadata?: Record<string, string | number | boolean | null>): void`.

Where the allowlist lives: `NATIVE_ANALYTICS_EVENT_TYPES` in `src/lib/analytics.ts` (a TypeScript-enforced union that mirrors Quiver Web's `user_events_event_type_check`; an event type missing from the web constraint fails at insert and is lost silently). Spec note: to avoid a web migration, Outlook events ride the already-allowlisted `forecast_interaction` event with `feature: 'swell_outlook'` and an `action`, exactly as `swell_landing_viewed` does (`swell-landing-screen.tsx:152`). If a distinct event type is ever wanted it must be added alphabetically to that list AND to the web constraint in a web migration (out of scope here).

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/analytics.test.ts`:
```ts
import { trackEvent } from '@/lib/analytics';
import { trackSwellOutlook } from '../analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

describe('trackSwellOutlook', () => {
  beforeEach(() => jest.mocked(trackEvent).mockClear());

  it('sends every outlook action on the allowlisted forecast_interaction event', () => {
    trackSwellOutlook('swell_outlook_entry_tapped', { surface: 'week_scout' });
    trackSwellOutlook('swell_outlook_row_tapped', { event_key: 'k', tier: 'locked', rank: 1 });
    expect(trackEvent).toHaveBeenNthCalledWith(1, 'forecast_interaction', {
      feature: 'swell_outlook',
      action: 'swell_outlook_entry_tapped',
      surface: 'week_scout',
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'forecast_interaction', {
      feature: 'swell_outlook',
      action: 'swell_outlook_row_tapped',
      event_key: 'k',
      tier: 'locked',
      rank: 1,
    });
  });

  it('rides an event type that is really on the allowlist (a missing one is dropped silently)', () => {
    const actual = jest.requireActual('@/lib/analytics') as typeof import('@/lib/analytics');
    expect(actual.NATIVE_ANALYTICS_EVENT_TYPES).toContain('forecast_interaction');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/analytics.test.ts`
Expected: FAIL with `Cannot find module '../analytics'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/analytics.ts`:
```ts
import { trackEvent } from '@/lib/analytics';

export type SwellOutlookAction =
  | 'swell_outlook_home_viewed'
  | 'swell_outlook_viewed'
  | 'swell_outlook_entry_tapped'
  | 'swell_outlook_row_tapped'
  | 'swell_outlook_week_scout_tapped';

export type SwellOutlookEntrySurface = 'home_graphic' | 'home_footer' | 'week_scout';

export function trackSwellOutlook(
  action: SwellOutlookAction,
  metadata: Record<string, string | number | boolean | null> = {},
): void {
  trackEvent('forecast_interaction', { feature: 'swell_outlook', action, ...metadata });
}
```
Append to `src/features/swell-outlook/index.ts`:
```ts
export { trackSwellOutlook } from './analytics';
export type { SwellOutlookAction, SwellOutlookEntrySurface } from './analytics';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/analytics.test.ts && npm run typecheck`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add outlook analytics over forecast_interaction"
```

### Task 5: Week-graphic geometry (pure)
**Files:** Create `src/features/swell-outlook/week-graphic-geometry.ts`; Modify `index.ts`; Test `src/features/swell-outlook/__tests__/week-graphic-geometry.test.ts`.
**Interfaces:** Consumes: `getForecastZoneParts`, `getForecastDateParts`, `formatForecastWeekdayInZone`, `formatForecastLongWeekdayInZone` (`src/lib/forecast-time-formatting.ts`), `visibleOutlookSwells`, `directionFamily`, `formatOutlookSize`, `outlookTierLabel`, `outlookFitTreatment` (Task 3). Produces: `startOfLocalDayMs(now: Date, timezone: string): number`, `TIER_STYLE`, `interface TierStyle`, `interface WeekGraphicInput { swells; now; timezone; days; width; height }`, `interface BandGeometry`, `interface DayColumn`, `interface WeekGraphicGeometry`, `buildWeekGraphic(input): WeekGraphicGeometry`, `countPeaksBeyond(swells, now, timezone, days): number`, `outlookGraphicLabel(geometry, days): string`.

Spec note: the contract carries no per-swell hourly curve, so each band is an envelope derived from `peakAt`, the size range and the tier (rise 0.7 d / fall 1.5 d for locked and likely, a wider flat-topped bump sized by `peakWindow` for on the radar), exactly as the approved mockup draws it. Bands are never summed into a "total" line.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/week-graphic-geometry.test.ts`:
```ts
import { makeSwell } from '../__fixtures__/make-swell';
import {
  buildWeekGraphic,
  countPeaksBeyond,
  outlookGraphicLabel,
  startOfLocalDayMs,
  TIER_STYLE,
} from '../week-graphic-geometry';

const TZ = 'America/Los_Angeles';
const NOW = new Date('2026-10-04T16:41:00.000Z'); // 9:41 am PDT, Sunday
const DAY_MS = 86_400_000;
const base = { now: NOW, timezone: TZ, days: 7, width: 342, height: 214 };
const dayStart = Date.parse('2026-10-04T07:00:00.000Z');
const atDay = (t: number): string => new Date(dayStart + t * DAY_MS).toISOString();

describe('startOfLocalDayMs', () => {
  it('returns local midnight for the given zone', () => {
    expect(startOfLocalDayMs(NOW, TZ)).toBe(dayStart);
  });
});

describe('buildWeekGraphic', () => {
  it('lays out day columns, weekend shading and the now marker', () => {
    const geometry = buildWeekGraphic({ ...base, swells: [] });
    expect(geometry.days).toHaveLength(7);
    expect(geometry.days[0]).toMatchObject({ letter: 'S', date: '4', isToday: true, isWeekend: true });
    expect(geometry.days[1]).toMatchObject({ letter: 'M', date: '5', isToday: false, isWeekend: false });
    expect(geometry.days[6]).toMatchObject({ date: '10', isWeekend: true });
    expect(geometry.days[0].x1 - geometry.days[0].x0).toBeCloseTo(44, 5);
    expect(geometry.nowX).toBeCloseTo(43.75, 1);
  });

  it('draws a flat week (axis, days, now) with no bands when there are no swells', () => {
    const geometry = buildWeekGraphic({ ...base, swells: [] });
    expect(geometry.bands).toEqual([]);
    expect(geometry.ticks.map((tick) => tick.ft)).toEqual([2, 4, 6]);
    expect(geometry.ticks[2].y).toBeCloseTo(geometry.plot.top, 5);
  });

  it('never draws early_signal swells', () => {
    const geometry = buildWeekGraphic({ ...base, swells: [makeSwell({ tier: 'early_signal' })] });
    expect(geometry.bands).toEqual([]);
  });

  it('places the peak marker and label from the swell time and mid size', () => {
    const [band] = buildWeekGraphic({ ...base, swells: [makeSwell()] }).bands;
    expect(band.peak?.x).toBeCloseTo(92, 1);
    expect(band.peak?.y).toBeCloseTo(124.17, 1);
    expect(band.peak?.kind).toBe('solid');
    expect(band.label).toMatchObject({ size: '2–3 ft', meta: '15s SSW' });
    expect(band.family).toBe('south');
    expect(band.line.startsWith('M')).toBe(true);
    expect(band.area.endsWith('Z')).toBe(true);
    expect(band.range.endsWith('Z')).toBe(true);
  });

  it('gives each tier its own solidity and drops the period when it is null', () => {
    const swells = [
      makeSwell({ id: 'l', tier: 'locked' }),
      makeSwell({ id: 'k', tier: 'likely', peakAt: atDay(2.5) }),
      makeSwell({ id: 'r', tier: 'on_the_radar', peakAt: atDay(5), periodS: null }),
    ];
    const bands = buildWeekGraphic({ ...base, swells }).bands;
    expect(bands[0].style).toEqual(TIER_STYLE.locked);
    expect(bands[1].peak?.kind).toBe('hollow');
    expect(bands[2].style.dash).toBe('5 4');
    expect(bands[2].peak?.kind).toBe('bracket');
    expect(bands[2].label?.meta).toBe('SSW');
    expect(bands[2].window).not.toBeNull();
  });

  it('sizes a radar bracket from the peak window', () => {
    const swell = makeSwell({
      tier: 'on_the_radar',
      peakAt: atDay(5),
      peakWindow: { from: atDay(4), to: atDay(6) },
    });
    const { window } = buildWeekGraphic({ ...base, swells: [swell] }).bands[0];
    expect(window!.x2 - window!.x1).toBeCloseTo(88, 0);
  });

  it('draws below_range at lower contrast and leaves above_range at full strength', () => {
    const small = makeSwell({ id: 's', fit: { status: 'below_range', boards: [] } });
    const big = makeSwell({ id: 'b', fit: { status: 'above_range', boards: [] }, peakAt: atDay(4) });
    const [dimmed, full] = buildWeekGraphic({ ...base, swells: [small, big] }).bands;
    expect(dimmed.dimmed).toBe(true);
    expect(dimmed.style.fillOpacity).toBeCloseTo(TIER_STYLE.locked.fillOpacity * 0.45, 5);
    expect(dimmed.strokeOpacity).toBeCloseTo(0.45, 5);
    expect(full.dimmed).toBe(false);
    expect(full.strokeOpacity).toBe(1);
    expect(full.style.fillOpacity).toBe(TIER_STYLE.locked.fillOpacity);
  });

  it('grows the axis for a swell bigger than the default scale', () => {
    const geometry = buildWeekGraphic({ ...base, swells: [makeSwell({ faceHeightFt: { min: 7, max: 9 } })] });
    expect(geometry.maxFt).toBe(10);
    expect(geometry.ticks.map((tick) => tick.ft)).toEqual([2, 4, 6, 8, 10]);
  });

  it('keeps a swell that peaks after the frame as a truncated band with no marker', () => {
    const beyond = makeSwell({ tier: 'on_the_radar', peakAt: atDay(8.5) });
    const geometry = buildWeekGraphic({ ...base, swells: [beyond] });
    expect(geometry.bands).toHaveLength(1);
    expect(geometry.bands[0].peak).toBeNull();
    expect(geometry.bands[0].label).toBeNull();
    expect(countPeaksBeyond([beyond, makeSwell()], NOW, TZ, 7)).toBe(1);
  });

  it('skips a swell whose whole envelope is already behind us', () => {
    const gone = makeSwell({ peakAt: atDay(-9) });
    expect(buildWeekGraphic({ ...base, swells: [gone] }).bands).toEqual([]);
  });

  it('staggers the labels of two peaks that would overlap', () => {
    const a = makeSwell({ id: 'a' });
    const b = makeSwell({ id: 'b', peakAt: '2026-10-06T04:00:00.000Z' });
    const [first, second] = buildWeekGraphic({ ...base, swells: [a, b] }).bands;
    expect(Math.abs(first.label!.y - second.label!.y)).toBeGreaterThanOrEqual(21.99);
  });

  it('keeps labels inside the frame at the left edge and on a narrow screen', () => {
    const left = buildWeekGraphic({ ...base, swells: [makeSwell({ peakAt: atDay(0) })] }).bands[0];
    expect(left.label!.x).toBe(28);
    const narrow = buildWeekGraphic({ ...base, width: 280, swells: [makeSwell({ peakAt: atDay(6.9) })] }).bands[0];
    expect(narrow.label!.x).toBeLessThanOrEqual(252);
  });
});

describe('outlookGraphicLabel', () => {
  it('says plainly that nothing is forecast', () => {
    expect(outlookGraphicLabel(buildWeekGraphic({ ...base, swells: [] }), 7))
      .toBe('No notable swells forecast in the next 7 days.');
  });

  it('lists every band with size, direction, tier and peak day', () => {
    const label = outlookGraphicLabel(buildWeekGraphic({ ...base, swells: [makeSwell()] }), 7);
    expect(label).toBe('Swell outlook for the next 7 days. 2–3 ft SSW swell, Locked, peaking Monday.');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/week-graphic-geometry.test.ts`
Expected: FAIL with `Cannot find module '../week-graphic-geometry'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/week-graphic-geometry.ts`:
```ts
import {
  formatForecastLongWeekdayInZone,
  formatForecastWeekdayInZone,
  getForecastDateParts,
  getForecastZoneParts,
} from '@/lib/forecast-time-formatting';
import {
  directionFamily,
  formatOutlookSize,
  outlookFitTreatment,
  outlookTierLabel,
  visibleOutlookSwells,
  type DirectionFamily,
} from './outlook-format';
import type { OutlookSwell, VisibleOutlookTier } from './types';

const DAY_MS = 86_400_000;
const LEFT = 26;
const RIGHT_PAD = 8;
const TOP = 46;
const BOTTOM_PAD = 34;
const LABEL_EDGE = 28;
const LABEL_LIFT = 22;
const LABEL_MIN_GAP_X = 64;
const LABEL_TOP_MIN = 12;
const DIMMED_FACTOR = 0.45;
const SAMPLES_PER_DAY = 14;

export interface TierStyle {
  fillOpacity: number;
  rangeOpacity: number;
  strokeWidth: number;
  dash: string | null;
}

/** Solid to dashed: locked to on the radar. */
export const TIER_STYLE: Record<VisibleOutlookTier, TierStyle> = {
  locked: { fillOpacity: 0.55, rangeOpacity: 0.22, strokeWidth: 2.2, dash: null },
  likely: { fillOpacity: 0.4, rangeOpacity: 0.16, strokeWidth: 2, dash: null },
  on_the_radar: { fillOpacity: 0.2, rangeOpacity: 0.16, strokeWidth: 1.6, dash: '5 4' },
};

export interface WeekGraphicInput {
  swells: readonly OutlookSwell[];
  now: Date;
  timezone: string;
  days: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface BandLabel {
  x: number;
  y: number;
  size: string;
  meta: string;
}

export interface BandGeometry {
  id: string;
  family: DirectionFamily;
  tier: VisibleOutlookTier;
  dimmed: boolean;
  style: TierStyle;
  strokeOpacity: number;
  line: string;
  area: string;
  range: string;
  peak: { x: number; y: number; kind: 'solid' | 'hollow' | 'bracket' } | null;
  label: BandLabel | null;
  window: { x1: number; x2: number; y: number } | null;
  accessibilityLabel: string;
}

export interface DayColumn {
  x0: number;
  x1: number;
  xMid: number;
  letter: string;
  date: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface WeekGraphicGeometry {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  maxFt: number;
  ticks: Array<{ ft: number; y: number }>;
  days: DayColumn[];
  nowX: number;
  bands: BandGeometry[];
}

/** Local midnight in `timezone`; a DST day is at most an hour off, which no label reads. */
export function startOfLocalDayMs(now: Date, timezone: string): number {
  const { hour, minute } = getForecastZoneParts(now, timezone);
  const sinceMidnightMs = ((hour * 60 + minute) * 60 + now.getUTCSeconds()) * 1000 + now.getUTCMilliseconds();
  return now.getTime() - sinceMidnightMs;
}

function pathFromPoints(points: readonly Point[], first: 'M' | 'L' = 'M'): string {
  return points.map((p, index) => `${index === 0 ? first : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}

/** Builds faster than it fades; wide and flat-topped when the timing is a window. */
function envelope(tier: VisibleOutlookTier, offsetDays: number, windowSpanDays: number): number {
  if (tier === 'on_the_radar') {
    const half = Math.max(0.75, windowSpanDays / 2);
    const width = offsetDays < 0 ? half : half * 1.35;
    return Math.exp(-Math.pow(Math.abs(offsetDays) / width, 3));
  }
  return Math.exp(-Math.pow(offsetDays / (offsetDays < 0 ? 0.7 : 1.5), 2));
}

function peakLabelText(swell: OutlookSwell): BandLabel['meta'] {
  return swell.periodS !== null ? `${Math.round(swell.periodS)}s ${swell.directionLabel}` : swell.directionLabel;
}

function spreadLabels(labels: Array<{ bandIndex: number; label: BandLabel }>): void {
  const placed: BandLabel[] = [];
  for (const { label } of [...labels].sort((a, b) => a.label.x - b.label.x)) {
    let attempts = 0;
    while (
      attempts < 3 &&
      placed.some((other) => Math.abs(other.x - label.x) < LABEL_MIN_GAP_X && Math.abs(other.y - label.y) < LABEL_LIFT)
    ) {
      label.y = Math.max(LABEL_TOP_MIN, label.y - LABEL_LIFT);
      attempts += 1;
    }
    placed.push(label);
  }
}

export function buildWeekGraphic(input: WeekGraphicInput): WeekGraphicGeometry {
  const { now, timezone, days, width, height } = input;
  const swells = visibleOutlookSwells(input.swells);
  const right = width - RIGHT_PAD;
  const bottom = height - BOTTOM_PAD;
  const startMs = startOfLocalDayMs(now, timezone);
  const toDay = (iso: string): number => (Date.parse(iso) - startMs) / DAY_MS;
  const x = (t: number): number => LEFT + (t / days) * (right - LEFT);

  const framed = swells.filter((swell) => {
    const t = toDay(swell.peakAt);
    return t > -4.2 && t < days + 3.2;
  });
  const maxHi = Math.max(0, ...framed.map((swell) => swell.faceHeightFt.max));
  const maxFt = Math.max(6, Math.ceil((maxHi + 0.5) / 2) * 2);
  const y = (ft: number): number => bottom - (ft / maxFt) * (bottom - TOP);

  const tickStep = maxFt > 12 ? 4 : 2;
  const ticks: Array<{ ft: number; y: number }> = [];
  for (let ft = tickStep; ft <= maxFt; ft += tickStep) ticks.push({ ft, y: y(ft) });

  const columns: DayColumn[] = [];
  for (let d = 0; d < Math.ceil(days); d += 1) {
    const middle = new Date(startMs + (d + 0.5) * DAY_MS);
    const weekday = formatForecastWeekdayInZone(middle, timezone);
    columns.push({
      x0: x(d),
      x1: x(Math.min(days, d + 1)),
      xMid: x(d + 0.5),
      letter: weekday.charAt(0),
      date: String(getForecastDateParts(middle, timezone).day),
      isToday: d === 0,
      isWeekend: weekday === 'SAT' || weekday === 'SUN',
    });
  }

  const bands: BandGeometry[] = [];
  const labels: Array<{ bandIndex: number; label: BandLabel }> = [];
  for (const swell of swells) {
    if (swell.tier === 'early_signal') continue;
    const tier = swell.tier;
    const tPeak = toDay(swell.peakAt);
    const from = Math.max(0, tPeak - 3.2);
    const to = Math.min(days, tPeak + 4.2);
    if (to <= from) continue;

    const mid = (swell.faceHeightFt.min + swell.faceHeightFt.max) / 2;
    const span = swell.peakWindow
      ? Math.max(0.5, (Date.parse(swell.peakWindow.to) - Date.parse(swell.peakWindow.from)) / DAY_MS)
      : 1.5;
    const steps = Math.max(8, Math.round((to - from) * SAMPLES_PER_DAY));
    const midPoints: Point[] = [];
    const hiPoints: Point[] = [];
    const loPoints: Point[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = from + ((to - from) * i) / steps;
      const factor = envelope(tier, t - tPeak, span);
      midPoints.push({ x: x(t), y: y(mid * factor) });
      hiPoints.push({ x: x(t), y: y(swell.faceHeightFt.max * factor) });
      loPoints.push({ x: x(t), y: y(swell.faceHeightFt.min * factor) });
    }

    const dimmed = outlookFitTreatment(swell.fit, []).dimmed;
    const base = TIER_STYLE[tier];
    const style: TierStyle = dimmed
      ? { ...base, fillOpacity: base.fillOpacity * DIMMED_FACTOR, rangeOpacity: base.rangeOpacity * DIMMED_FACTOR }
      : base;
    const line = pathFromPoints(midPoints);
    const showPeak = tPeak >= 0 && tPeak <= days;
    const peakX = x(tPeak);
    const peakY = y(mid);
    const peak = showPeak
      ? { x: peakX, y: peakY, kind: tier === 'locked' ? ('solid' as const) : tier === 'likely' ? ('hollow' as const) : ('bracket' as const) }
      : null;
    const clamp = (value: number): number => Math.min(right, Math.max(LEFT, value));
    const window = showPeak && tier === 'on_the_radar'
      ? { x1: clamp(x(tPeak - span / 2)), x2: clamp(x(tPeak + span / 2)), y: peakY }
      : null;
    const label: BandLabel | null = showPeak
      ? {
          x: Math.min(width - LABEL_EDGE, Math.max(LABEL_EDGE, peakX)),
          y: peakY - 19,
          size: formatOutlookSize(swell.faceHeightFt),
          meta: peakLabelText(swell),
        }
      : null;
    const weekday = formatForecastLongWeekdayInZone(new Date(swell.peakAt), timezone, 'en-US');
    bands.push({
      id: swell.id,
      family: directionFamily(swell.directionDeg),
      tier,
      dimmed,
      style,
      strokeOpacity: dimmed ? DIMMED_FACTOR : 1,
      line,
      area: `${line}L${x(to).toFixed(1)} ${bottom}L${x(from).toFixed(1)} ${bottom}Z`,
      range: `${pathFromPoints(hiPoints)}${pathFromPoints([...loPoints].reverse(), 'L')}Z`,
      peak,
      label,
      window,
      accessibilityLabel: `${formatOutlookSize(swell.faceHeightFt)} ${swell.directionLabel} swell, ${outlookTierLabel(tier)}, peaking ${weekday}`,
    });
    if (label) labels.push({ bandIndex: bands.length - 1, label });
  }
  spreadLabels(labels);

  return {
    width,
    height,
    plot: { left: LEFT, right, top: TOP, bottom },
    maxFt,
    ticks,
    days: columns,
    nowX: x((now.getTime() - startMs) / DAY_MS),
    bands,
  };
}

/** Peaks that land after the frame (Home draws 7 days; the outlook is 9). */
export function countPeaksBeyond(
  swells: readonly OutlookSwell[],
  now: Date,
  timezone: string,
  days: number,
): number {
  const limit = startOfLocalDayMs(now, timezone) + days * DAY_MS;
  return visibleOutlookSwells(swells).filter((swell) => Date.parse(swell.peakAt) >= limit).length;
}

export function outlookGraphicLabel(geometry: WeekGraphicGeometry, days: number): string {
  if (geometry.bands.length === 0) return `No notable swells forecast in the next ${days} days.`;
  return `Swell outlook for the next ${days} days. ${geometry.bands.map((band) => band.accessibilityLabel).join('. ')}.`;
}
```
Append to `index.ts`: `export * from './week-graphic-geometry';`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/week-graphic-geometry.test.ts && npm run typecheck`
Expected: PASS (13 tests). The numeric assertions come from `LEFT=26, right=334, TOP=46, bottom=180`: day-1.5 peak x = 26 + 1.5/7 x 308 = 92; mid 2.5 ft on a 6 ft axis y = 180 - 2.5/6 x 134 = 124.17.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add week-graphic geometry with tier styles and label spreading"
```

### Task 6: WeekGraphic component and the Home section component
**Files:** Create `src/features/swell-outlook/week-graphic.tsx`, `home-week-plays-out.tsx`; Modify `index.ts`; Test `src/features/swell-outlook/__tests__/home-week-plays-out.test.tsx`.
**Interfaces:** Consumes: `buildWeekGraphic`, `countPeaksBeyond`, `outlookGraphicLabel` (Task 5), `visibleOutlookSwells`, `outlookFooterLine`, `FAMILY_STROKE_ON_DARK` (Task 3), `trackSwellOutlook` (Task 4), `useStaggeredEntrance(index: number, delay?: number)` (`src/lib/animations.ts:50`), `getDeviceTimezone(): string | null` (`src/lib/device-timezone.ts`), typography `Eyebrow`, `Body`, `Data`, `UIText` (`src/components/ui/typography.tsx`). Produces: `WeekGraphic` (props `{ geometry: WeekGraphicGeometry; accessibilityLabel?: string; testID?: string }`), `WeekGraphicLegend`, `HowThisWeekPlaysOut` (props `{ outlook: SwellOutlookResponse; onOpenOutlook: (surface: 'home_graphic' | 'home_footer') => void; now?: Date }`), constants `HOME_GRAPHIC_DAYS = 7`.

Drawing approach found in the codebase: `react-native-svg` (`SwellMark`, `forecast-media.tsx` tide line, `swell-field-hero.tsx`) with Reanimated `createAnimatedComponent(Circle)` + `useAnimatedProps` for motion; Skia is used only for the onboarding boat art. This plan uses `react-native-svg`.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/home-week-plays-out.test.tsx`:
```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeOutlook, makeSwell } from '../__fixtures__/make-swell';
import { trackSwellOutlook } from '../analytics';
import { HowThisWeekPlaysOut } from '../home-week-plays-out';

jest.mock('../analytics', () => ({ trackSwellOutlook: jest.fn() }));

const NOW = new Date('2026-10-04T16:41:00.000Z');
const swells = [
  makeSwell({ id: 'a' }),
  makeSwell({ id: 'b', tier: 'on_the_radar', peakAt: '2026-10-12T19:00:00.000Z' }),
];

describe('HowThisWeekPlaysOut', () => {
  beforeEach(() => jest.mocked(trackSwellOutlook).mockClear());

  it('draws one labelled graphic with a counted footer row', () => {
    render(<HowThisWeekPlaysOut outlook={makeOutlook({ swells })} now={NOW} onOpenOutlook={jest.fn()} />);
    expect(screen.getByText('HOW THIS WEEK PLAYS OUT')).toBeTruthy();
    expect(screen.getByText('2 swells on the way · 1 beyond this week')).toBeTruthy();
    const graphic = screen.getByTestId('home-week-graphic');
    expect(graphic.props.accessibilityLabel).toContain('2–3 ft SSW swell, Locked, peaking Monday');
    expect(graphic.props.accessibilityLabel).toContain('Opens Swell Outlook');
    expect(screen.getByText('Swell Outlook')).toBeTruthy();
    expect(screen.queryByTestId('home-week-empty')).toBeNull();
  });

  it('opens the outlook from the graphic and from the footer, reporting which', () => {
    const onOpen = jest.fn();
    render(<HowThisWeekPlaysOut outlook={makeOutlook({ swells })} now={NOW} onOpenOutlook={onOpen} />);
    fireEvent.press(screen.getByTestId('home-week-graphic'));
    fireEvent.press(screen.getByTestId('home-week-footer'));
    expect(onOpen).toHaveBeenNthCalledWith(1, 'home_graphic');
    expect(onOpen).toHaveBeenNthCalledWith(2, 'home_footer');
  });

  it('shows the flat week and one line when no swells are forecast (not an error)', () => {
    render(<HowThisWeekPlaysOut outlook={makeOutlook({ swells: [] })} now={NOW} onOpenOutlook={jest.fn()} />);
    expect(screen.getByTestId('home-week-empty')).toHaveTextContent('Nothing notable is forecast this week.');
    expect(screen.getByText('No notable swells on the way')).toBeTruthy();
    expect(screen.getByTestId('home-week-graphic').props.accessibilityLabel)
      .toContain('No notable swells forecast in the next 7 days.');
  });

  it('treats a list of only early signals as empty', () => {
    render(
      <HowThisWeekPlaysOut
        outlook={makeOutlook({ swells: [makeSwell({ tier: 'early_signal' })] })}
        now={NOW}
        onOpenOutlook={jest.fn()}
      />,
    );
    expect(screen.getByTestId('home-week-empty')).toBeTruthy();
  });

  it('reports the Home section view once', () => {
    const { rerender } = render(<HowThisWeekPlaysOut outlook={makeOutlook({ swells })} now={NOW} onOpenOutlook={jest.fn()} />);
    rerender(<HowThisWeekPlaysOut outlook={makeOutlook({ swells })} now={NOW} onOpenOutlook={jest.fn()} />);
    expect(trackSwellOutlook).toHaveBeenCalledTimes(1);
    expect(trackSwellOutlook).toHaveBeenCalledWith('swell_outlook_home_viewed', { swell_count: 2 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/home-week-plays-out.test.tsx`
Expected: FAIL with `Cannot find module '../home-week-plays-out'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/week-graphic.tsx`:
```tsx
import React, { useEffect, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Colors, Fonts } from '@/constants/theme';
import { FAMILY_STROKE_ON_DARK, type DirectionFamily } from './outlook-format';
import type { WeekGraphicGeometry } from './week-graphic-geometry';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const REVEAL_MS = 1800;
const FAMILIES: readonly DirectionFamily[] = ['south', 'northwest'];

export interface WeekGraphicProps {
  geometry: WeekGraphicGeometry;
  /** Standalone use (Outlook screen). Omit when a parent Pressable already carries the label. */
  accessibilityLabel?: string;
  testID?: string;
}

export function WeekGraphic({ geometry, accessibilityLabel, testID }: WeekGraphicProps): React.JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(reducedMotion ? 1 : 0);
  const { width, height, plot } = geometry;

  useEffect(() => {
    reveal.value = reducedMotion ? 1 : withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.ease) });
  }, [reducedMotion, reveal]);

  const revealProps = useAnimatedProps(() => ({ width: width * reveal.value }), [width]);

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      testID={testID}
    >
      <Defs>
        {FAMILIES.map((family) => (
          <LinearGradient key={family} id={`${uid}-${family}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FAMILY_STROKE_ON_DARK[family]} stopOpacity={1} />
            <Stop offset="1" stopColor={FAMILY_STROKE_ON_DARK[family]} stopOpacity={0.02} />
          </LinearGradient>
        ))}
        <ClipPath id={`${uid}-reveal`}>
          <AnimatedRect x={0} y={0} width={width} height={height} animatedProps={revealProps} />
        </ClipPath>
      </Defs>

      {geometry.days.filter((day) => day.isWeekend).map((day) => (
        <Rect
          key={`weekend-${day.xMid}`}
          x={day.x0}
          y={plot.top - 14}
          width={day.x1 - day.x0}
          height={plot.bottom - plot.top + 14}
          fill={Colors.white}
          opacity={0.035}
        />
      ))}

      {geometry.ticks.map((tick) => (
        <G key={`tick-${tick.ft}`}>
          <Line x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} stroke={Colors.textMuted} strokeOpacity={0.16} strokeDasharray="2 4" />
          <SvgText x={plot.left - 5} y={tick.y + 3} textAnchor="end" fontSize={9} fontFamily={Fonts.monoRegular} fill={Colors.textMuted} opacity={0.8}>
            {String(tick.ft)}
          </SvgText>
        </G>
      ))}
      <SvgText x={plot.left - 5} y={plot.top - 16} textAnchor="end" fontSize={9} fontFamily={Fonts.monoRegular} fill={Colors.textMuted} opacity={0.8}>
        ft
      </SvgText>

      <G clipPath={`url(#${uid}-reveal)`}>
        {geometry.bands.map((band) => {
          const color = FAMILY_STROKE_ON_DARK[band.family];
          return (
            <G key={band.id}>
              <Path d={band.range} fill={color} fillOpacity={band.style.rangeOpacity} />
              <Path d={band.area} fill={`url(#${uid}-${band.family})`} opacity={Math.min(1, band.style.fillOpacity * 1.3)} />
              <Path
                d={band.line}
                fill="none"
                stroke={color}
                strokeOpacity={band.strokeOpacity}
                strokeWidth={band.style.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={band.style.dash ?? undefined}
              />
            </G>
          );
        })}
      </G>

      <Line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={Colors.cardBorder} strokeWidth={1.5} />

      {geometry.bands.map((band) => {
        if (!band.peak) return null;
        const color = FAMILY_STROKE_ON_DARK[band.family];
        const { x, y, kind } = band.peak;
        return (
          <G key={`peak-${band.id}`} opacity={band.dimmed ? 0.55 : 1}>
            {kind !== 'bracket' ? (
              <Line x1={x} x2={x} y1={y} y2={plot.bottom} stroke={color} strokeOpacity={0.28} strokeDasharray="2 3" />
            ) : null}
            {kind === 'solid' ? (
              <>
                <Circle cx={x} cy={y} r={5} fill={color} />
                <Circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeOpacity={0.4} />
              </>
            ) : null}
            {kind === 'hollow' ? <Circle cx={x} cy={y} r={5} fill={Colors.card} stroke={color} strokeWidth={2} /> : null}
            {kind === 'bracket' && band.window ? (
              <Path
                d={`M${band.window.x1} ${y + 5}V${y - 3}H${band.window.x2}V${y + 5}`}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            ) : null}
            {band.label ? (
              <>
                <SvgText x={band.label.x} y={band.label.y} textAnchor="middle" fontSize={10.5} fontFamily={Fonts.monoBold} fill={Colors.cream}>
                  {band.label.size}
                </SvgText>
                <SvgText x={band.label.x} y={band.label.y + 10} textAnchor="middle" fontSize={8.5} fontFamily={Fonts.monoRegular} fill={Colors.textMuted}>
                  {band.label.meta}
                </SvgText>
              </>
            ) : null}
          </G>
        );
      })}

      {geometry.days.map((day) => (
        <G key={`day-${day.xMid}`}>
          <SvgText x={day.xMid} y={plot.bottom + 14} textAnchor="middle" fontSize={10} fontFamily={Fonts.uiMedium} fill={day.isToday ? Colors.primary : Colors.textMuted}>
            {day.letter}
          </SvgText>
          <SvgText x={day.xMid} y={plot.bottom + 26} textAnchor="middle" fontSize={9.5} fontFamily={Fonts.monoRegular} fill={Colors.textMuted} opacity={0.85}>
            {day.date}
          </SvgText>
        </G>
      ))}

      <Line x1={geometry.nowX} x2={geometry.nowX} y1={plot.top - 12} y2={plot.bottom} stroke={Colors.primary} strokeWidth={1.5} />
      <Circle cx={geometry.nowX} cy={plot.bottom} r={3.2} fill={Colors.primary} />
    </Svg>
  );
}

export function WeekGraphicLegend(): React.JSX.Element {
  return (
    <View style={styles.legend} testID="week-graphic-legend">
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: FAMILY_STROKE_ON_DARK.south }]} />
        <Text style={styles.legendText}>South swell</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: FAMILY_STROKE_ON_DARK.northwest }]} />
        <Text style={styles.legendText}>Northwest swell</Text>
      </View>
      <Text style={styles.legendText}>solid to dashed: locked to on the radar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, paddingHorizontal: 8, paddingTop: 4 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  swatch: { borderRadius: 2, height: 8, width: 14 },
  legendText: { color: Colors.textMuted, fontFamily: Fonts.monoRegular, fontSize: 10.5, flexShrink: 1 },
});
```

`src/features/swell-outlook/home-week-plays-out.tsx`:
```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Body, Data, Eyebrow, UIText } from '@/components/ui/typography';
import { Colors } from '@/constants/theme';
import { useStaggeredEntrance } from '@/lib/animations';
import { getDeviceTimezone } from '@/lib/device-timezone';
import { trackSwellOutlook, type SwellOutlookEntrySurface } from './analytics';
import { outlookFooterLine, visibleOutlookSwells } from './outlook-format';
import type { SwellOutlookResponse } from './types';
import { buildWeekGraphic, countPeaksBeyond, outlookGraphicLabel } from './week-graphic-geometry';
import { WeekGraphic, WeekGraphicLegend } from './week-graphic';

export const HOME_GRAPHIC_DAYS = 7;
const HOME_GRAPHIC_HEIGHT = 214;
const DEFAULT_WIDTH = 320;

export interface HowThisWeekPlaysOutProps {
  outlook: SwellOutlookResponse;
  onOpenOutlook: (surface: Exclude<SwellOutlookEntrySurface, 'week_scout'>) => void;
  now?: Date;
}

/** Replaces "How today changes" on Home, only for users the outlook endpoint answers. */
export function HowThisWeekPlaysOut({ outlook, onOpenOutlook, now: nowProp }: HowThisWeekPlaysOutProps): React.JSX.Element {
  const entrance = useStaggeredEntrance(6, 80);
  const timezone = useMemo(() => getDeviceTimezone() ?? 'UTC', []);
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const visible = useMemo(() => visibleOutlookSwells(outlook.swells), [outlook.swells]);
  const geometry = useMemo(
    () => buildWeekGraphic({ swells: visible, now, timezone, days: HOME_GRAPHIC_DAYS, width, height: HOME_GRAPHIC_HEIGHT }),
    [now, timezone, visible, width],
  );
  const beyond = countPeaksBeyond(visible, now, timezone, HOME_GRAPHIC_DAYS);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackSwellOutlook('swell_outlook_home_viewed', { swell_count: visible.length });
  }, [visible.length]);

  function handleLayout(event: LayoutChangeEvent): void {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  }

  return (
    <Animated.View style={[styles.container, entrance.animatedStyle]} testID="home-week-plays-out">
      <Eyebrow style={styles.sectionTitle}>HOW THIS WEEK PLAYS OUT</Eyebrow>
      <View style={styles.card}>
        <Pressable
          onPress={() => onOpenOutlook('home_graphic')}
          accessibilityRole="button"
          accessibilityLabel={`${outlookGraphicLabel(geometry, HOME_GRAPHIC_DAYS)} Opens Swell Outlook.`}
          onLayout={handleLayout}
          testID="home-week-graphic"
        >
          <WeekGraphic geometry={geometry} />
        </Pressable>
        {visible.length === 0 ? (
          <Body style={styles.emptyLine} testID="home-week-empty">Nothing notable is forecast this week.</Body>
        ) : (
          <WeekGraphicLegend />
        )}
        <Pressable
          onPress={() => onOpenOutlook('home_footer')}
          accessibilityRole="button"
          accessibilityLabel={`${outlookFooterLine(visible.length, beyond)}. Open Swell Outlook.`}
          hitSlop={8}
          style={styles.footer}
          testID="home-week-footer"
        >
          <Data style={styles.footerText} numberOfLines={2}>{outlookFooterLine(visible.length, beyond)}</Data>
          <View style={styles.footerLink}>
            <UIText style={styles.footerLinkText}>Swell Outlook</UIText>
            <Ionicons name="chevron-forward" size={15} color={Colors.teal} />
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 10 },
  sectionTitle: { color: Colors.textMuted, paddingVertical: 10 },
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  emptyLine: { color: Colors.textMuted, paddingHorizontal: 8, paddingTop: 4 },
  footer: {
    alignItems: 'center',
    borderColor: Colors.cardBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginHorizontal: 4,
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingTop: 10,
  },
  footerText: { color: Colors.cream, flexShrink: 1 },
  footerLink: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  footerLinkText: { color: Colors.teal },
});
```
Append to `index.ts`:
```ts
export { HowThisWeekPlaysOut, HOME_GRAPHIC_DAYS } from './home-week-plays-out';
export type { HowThisWeekPlaysOutProps } from './home-week-plays-out';
export { WeekGraphic, WeekGraphicLegend } from './week-graphic';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/home-week-plays-out.test.tsx && npm run typecheck && npx eslint src/features/swell-outlook`
Expected: PASS (5 tests), typecheck and lint clean. (The Reanimated test mock turns `useAnimatedProps` into a plain call and `createAnimatedComponent` into the identity, so the reveal renders fully in tests.)

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add week graphic and Home section component"
```

### Task 7: Outlook row building blocks and the row
**Files:** Create `src/features/swell-outlook/sparkline-geometry.ts`, `direction-glyph.tsx`, `run-sparkline.tsx`, `tier-chip.tsx`, `glyph-key.tsx`, `outlook-row.tsx`; Modify `index.ts`; Test `src/features/swell-outlook/__tests__/sparkline-geometry.test.ts`, `__tests__/outlook-row.test.tsx`.
**Interfaces:** Consumes: `OutlookSwell`, `OutlookHistoryRun` (Task 1); `directionFamily`, `FAMILY_STROKE_ON_PAPER`, `formatOutlookSize`, `outlookPeakDay`, `outlookChangeNote`, `outlookFitTreatment`, `outlookLeadHedge`, `outlookSourceLine`, `outlookTierLabel`, `outlookRowAccessibilityLabel` (Task 3); typography `Label`, `Data`, `UIText`; `Ionicons`. Produces: `sparklineGeometry(history, width?, height?, maxRuns?): SparklineGeometry`, `DirectionGlyph` (props `{ deg: number; label: string; color: string; size?: number; testID?: string }`), `RunSparkline` (props `{ history: readonly OutlookHistoryRun[]; color: string; testID?: string }`), `TierChip` (props `{ tier: OutlookTier }`), `GlyphKey`, `OutlookRow` (props `{ swell: OutlookSwell; timezone: string; now: Date; userBoardClasses: readonly BoardClass[]; homeBeachId: string | null; onPress: (swell: OutlookSwell) => void }`).

Row layout (restyled from the removed `week-scout-swells-section.tsx` row to current paper tokens): day box, direction glyph, size + tier chip, one detail line, one change note, fit label, sparkline, chevron. `below_range` rows render at `opacity: 0.6`; `above_range` rows never do.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/sparkline-geometry.test.ts`:
```ts
import { sparklineGeometry } from '../sparkline-geometry';

const run = (faceHeightFt: number, day = 1) => ({
  runDate: `2026-10-0${day}`,
  peakAt: '2026-10-05T19:00:00.000Z',
  faceHeightFt,
  periodS: 15,
});

describe('sparklineGeometry', () => {
  it('draws nothing for no runs', () => {
    expect(sparklineGeometry([])).toEqual({ path: null, dots: [], baselineY: 25 });
  });

  it('draws a single dot at the right edge and no line for one run', () => {
    const geometry = sparklineGeometry([run(8)]);
    expect(geometry.path).toBeNull();
    expect(geometry.dots).toHaveLength(1);
    expect(geometry.dots[0]).toMatchObject({ latest: true });
    expect(geometry.dots[0].x).toBeCloseTo(55, 5);
  });

  it('keeps a flat run flat instead of exaggerating noise', () => {
    const { dots } = sparklineGeometry([run(2, 1), run(2, 2), run(2, 3)]);
    expect(new Set(dots.map((dot) => dot.y)).size).toBe(1);
  });

  it('draws a rising run as a line that climbs (smaller y is higher)', () => {
    const { dots, path } = sparklineGeometry([run(2, 1), run(3, 2)]);
    expect(dots[1].y).toBeLessThan(dots[0].y);
    expect(path?.startsWith('M')).toBe(true);
    expect(path).toContain('L');
  });

  it('keeps only the latest four runs', () => {
    const { dots } = sparklineGeometry([run(1, 1), run(2, 2), run(3, 3), run(4, 4), run(5, 5)]);
    expect(dots).toHaveLength(4);
  });
});
```

`src/features/swell-outlook/__tests__/outlook-row.test.tsx`:
```tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BoardClass } from '@/lib/board-class';
import { makeSwell } from '../__fixtures__/make-swell';
import { OutlookRow } from '../outlook-row';

const NOW = new Date('2026-10-04T16:00:00.000Z');
const boards: BoardClass[] = ['shortboard', 'fish', 'longboard'];
const history = [
  { runDate: '2026-10-03', peakAt: '2026-10-05T19:00:00.000Z', faceHeightFt: 2, periodS: 15 },
  { runDate: '2026-10-04', peakAt: '2026-10-05T19:00:00.000Z', faceHeightFt: 2.5, periodS: 15 },
];

function renderRow(swell = makeSwell(), onPress = jest.fn()) {
  render(
    <OutlookRow
      swell={swell}
      timezone="America/Los_Angeles"
      now={NOW}
      userBoardClasses={boards}
      homeBeachId="beach-hb"
      onPress={onPress}
    />,
  );
  return onPress;
}

function rowOpacity(id: string): number | undefined {
  return StyleSheet.flatten(screen.getByTestId(`swell-outlook-row-${id}`).props.style)?.opacity;
}

describe('OutlookRow', () => {
  it('shows day, size, tier, one change note, detail line and the board that fits', () => {
    renderRow(makeSwell({ change: 'upgraded', history, fit: { status: 'in_range', boards: ['longboard'] } }));
    expect(screen.getByText('MON')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('2–3 ft')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Up 0.5 ft')).toBeTruthy();
    expect(screen.getByText('15 s · Southern Hemisphere swell')).toBeTruthy();
    expect(screen.getByText('Longboard size')).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-row-swell-1').props.accessibilityLabel)
      .toBe('Monday 5, 2 to 3 feet, 15 seconds from SSW, Locked, Up 0.5 ft, Longboard size');
    expect(rowOpacity('swell-1')).toBeUndefined();
  });

  it('carries no fit label for unknown or rideable fits', () => {
    renderRow(makeSwell({ fit: { status: 'unknown', boards: [] } }));
    expect(screen.queryByText(/ size$|Above your range|Small for you/)).toBeNull();
  });

  it('dims and labels a below_range swell', () => {
    renderRow(makeSwell({ fit: { status: 'below_range', boards: [] } }));
    expect(screen.getByText('Small for you')).toBeTruthy();
    expect(rowOpacity('swell-1')).toBeLessThanOrEqual(0.7);
  });

  it('labels an above_range swell and never dims it', () => {
    renderRow(makeSwell({ fit: { status: 'above_range', boards: [] } }));
    expect(screen.getByText('Above your range')).toBeTruthy();
    expect(rowOpacity('swell-1')).toBeUndefined();
  });

  it('uses the storm name, a window label, and omits a missing period', () => {
    renderRow(makeSwell({
      periodS: null,
      source: 'tropical',
      stormName: 'Hurricane Rachel',
      peakWindow: { from: '2026-10-09T04:00:00.000Z', to: '2026-10-10T16:00:00.000Z' },
    }));
    expect(screen.getByText('THU–SAT')).toBeTruthy();
    expect(screen.getByText('From Hurricane Rachel')).toBeTruthy();
  });

  it('draws one dot for a single history run and says so for screen readers', () => {
    renderRow(makeSwell({ history: [history[1]] }));
    expect(screen.getByTestId('swell-outlook-sparkline-swell-1').props.accessibilityLabel)
      .toBe('Forecast size across 1 run');
  });

  it('names a different beach and clamps a very long name to one line', () => {
    const longName = 'Playa Grande de la Costa del Sol y los Cabos Viejos';
    renderRow(makeSwell({ beach: { id: 'beach-x', name: longName } }));
    const label = screen.getByText(`at ${longName}`);
    expect(label.props.numberOfLines).toBe(1);
  });

  it('hedges a swell this far out', () => {
    renderRow(makeSwell({ tier: 'on_the_radar', peakAt: '2026-10-12T19:00:00.000Z' }));
    expect(screen.getByText('needs watching')).toBeTruthy();
  });

  it('calls onPress with the swell', () => {
    const swell = makeSwell();
    const onPress = renderRow(swell);
    fireEvent.press(screen.getByTestId('swell-outlook-row-swell-1'));
    expect(onPress).toHaveBeenCalledWith(swell);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/sparkline-geometry.test.ts src/features/swell-outlook/__tests__/outlook-row.test.tsx`
Expected: FAIL with `Cannot find module '../sparkline-geometry'` / `'../outlook-row'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/sparkline-geometry.ts`:
```ts
import type { OutlookHistoryRun } from './types';

export interface SparklineGeometry {
  path: string | null;
  dots: Array<{ x: number; y: number; latest: boolean }>;
  baselineY: number;
}

/** The latest runs share one slot grid, so a one-run swell sits at the right edge like the newest dot of a longer one. */
export function sparklineGeometry(
  history: readonly OutlookHistoryRun[],
  width = 58,
  height = 26,
  maxRuns = 4,
): SparklineGeometry {
  const runs = history.slice(-maxRuns);
  const baselineY = height - 1;
  if (runs.length === 0) return { path: null, dots: [], baselineY };
  const values = runs.map((run) => run.faceHeightFt);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1.5, high - low);
  const middle = (high + low) / 2;
  const y = (value: number): number => height - 3 - ((value - (middle - span / 2)) / span) * (height - 8);
  const offset = maxRuns - runs.length;
  const x = (index: number): number => 3 + ((offset + index) * (width - 6)) / (maxRuns - 1);
  const dots = runs.map((run, index) => ({
    x: x(index),
    y: y(run.faceHeightFt),
    latest: index === runs.length - 1,
  }));
  const path = runs.length > 1
    ? dots.map((dot, index) => `${index === 0 ? 'M' : 'L'}${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`).join('')
    : null;
  return { path, dots, baselineY };
}
```

`src/features/swell-outlook/direction-glyph.tsx`:
```tsx
import React from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';

export interface DirectionGlyphProps {
  deg: number;
  label: string;
  color: string;
  size?: number;
  testID?: string;
}

/** A compass ring with an arrow on the side the swell comes from, pointing in. */
export function DirectionGlyph({ deg, label, color, size = 42, testID }: DirectionGlyphProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="-21 -21 42 42"
      accessibilityRole="image"
      accessibilityLabel={`From ${label}, ${Math.round(deg)} degrees`}
      testID={testID}
    >
      <Circle r={16} fill="none" stroke={Colors.paperShadow} strokeWidth={1} />
      <G rotation={deg}>
        <Line x1={0} y1={-16} x2={0} y2={2} stroke={color} strokeWidth={1.6} strokeDasharray="1.5 2.5" />
        <Path d="M0 -4 L-5 -13 L5 -13Z" fill={color} />
      </G>
    </Svg>
  );
}
```

`src/features/swell-outlook/run-sparkline.tsx`:
```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { Label } from '@/components/ui/typography';
import { sparklineGeometry } from './sparkline-geometry';
import type { OutlookHistoryRun } from './types';

const WIDTH = 58;
const HEIGHT = 26;

export interface RunSparklineProps {
  history: readonly OutlookHistoryRun[];
  color: string;
  testID?: string;
}

export function RunSparkline({ history, color, testID }: RunSparklineProps): React.JSX.Element {
  const geometry = sparklineGeometry(history, WIDTH, HEIGHT);
  const runCount = Math.min(history.length, 4);
  return (
    <View style={styles.wrap}>
      <Svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        accessibilityRole="image"
        accessibilityLabel={`Forecast size across ${runCount} ${runCount === 1 ? 'run' : 'runs'}`}
        testID={testID}
      >
        <Line x1={2} x2={WIDTH - 2} y1={geometry.baselineY} y2={geometry.baselineY} stroke={Colors.paperShadow} />
        {geometry.path ? <Path d={geometry.path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" /> : null}
        {geometry.dots.map((dot) => (
          <Circle
            key={`${dot.x}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.latest ? 3 : 1.8}
            fill={dot.latest ? color : Colors.white}
            stroke={color}
            strokeWidth={1.2}
          />
        ))}
      </Svg>
      <Label style={styles.caption}>RUNS</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'center', gap: 2, width: WIDTH },
  caption: { color: Colors.inkMuted, fontSize: 8, letterSpacing: 1 },
});
```

`src/features/swell-outlook/tier-chip.tsx`:
```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Label } from '@/components/ui/typography';
import { Colors } from '@/constants/theme';
import { outlookTierLabel } from './outlook-format';
import type { OutlookTier } from './types';

const METER_BARS: Record<OutlookTier, number> = { locked: 4, likely: 3, on_the_radar: 2, early_signal: 1 };

export function TierChip({ tier }: { tier: OutlookTier }): React.JSX.Element {
  const textStyle = tier === 'locked' ? styles.lockedText : tier === 'likely' ? styles.likelyText : styles.radarText;
  return (
    <View
      style={[styles.chip, tier === 'locked' ? styles.locked : tier === 'likely' ? styles.likely : styles.radar]}
      accessible={false}
    >
      <View style={styles.meter}>
        {[0, 1, 2, 3].map((bar) => (
          <View
            key={bar}
            style={[
              styles.bar,
              { height: 5 + bar * 3, opacity: bar < METER_BARS[tier] ? 1 : 0.28 },
              tier === 'locked' ? styles.lockedBar : tier === 'likely' ? styles.likelyBar : styles.radarBar,
            ]}
          />
        ))}
      </View>
      <Label style={textStyle}>{outlookTierLabel(tier)}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  locked: { backgroundColor: Colors.tealInk, borderColor: Colors.tealInk },
  likely: { backgroundColor: 'transparent', borderColor: Colors.tealInk },
  radar: { backgroundColor: Colors.paperGold, borderColor: Colors.goldInk },
  lockedText: { color: Colors.paper },
  likelyText: { color: Colors.tealInk },
  radarText: { color: Colors.goldInk },
  meter: { alignItems: 'flex-end', flexDirection: 'row', gap: 1.5, height: 14 },
  bar: { borderRadius: 1, width: 3 },
  lockedBar: { backgroundColor: Colors.paper },
  likelyBar: { backgroundColor: Colors.tealInk },
  radarBar: { backgroundColor: Colors.goldInk },
});
```

`src/features/swell-outlook/glyph-key.tsx`:
```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dateline } from '@/components/ui/typography';
import { Colors } from '@/constants/theme';

/** One key for the whole list, so rows never repeat what a glyph already says. */
export function GlyphKey(): React.JSX.Element {
  return (
    <View style={styles.key} testID="swell-outlook-glyph-key" accessibilityLabel="Key: the arrow shows the direction a swell comes from. The small line shows its forecast size across recent runs. Solid chips are firmer than dashed ones.">
      <Dateline style={styles.text}>Arrow: where it comes from</Dateline>
      <Dateline style={styles.text}>Line: size across forecast runs</Dateline>
      <Dateline style={styles.text}>Solid to dashed: firm to uncertain</Dateline>
    </View>
  );
}

const styles = StyleSheet.create({
  key: { columnGap: 12, flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4, rowGap: 4 },
  text: { color: Colors.textMuted },
});
```

`src/features/swell-outlook/outlook-row.tsx`:
```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Data, Label, UIText } from '@/components/ui/typography';
import { Colors, Fonts } from '@/constants/theme';
import type { BoardClass } from '@/lib/board-class';
import { DirectionGlyph } from './direction-glyph';
import {
  directionFamily,
  FAMILY_STROKE_ON_PAPER,
  formatOutlookSize,
  outlookChangeNote,
  outlookFitTreatment,
  outlookLeadHedge,
  outlookPeakDay,
  outlookRowAccessibilityLabel,
  outlookSourceLine,
} from './outlook-format';
import { RunSparkline } from './run-sparkline';
import { TierChip } from './tier-chip';
import type { OutlookSwell } from './types';

const DIMMED_OPACITY = 0.6;

export interface OutlookRowProps {
  swell: OutlookSwell;
  timezone: string;
  now: Date;
  userBoardClasses: readonly BoardClass[];
  homeBeachId: string | null;
  onPress: (swell: OutlookSwell) => void;
}

export function OutlookRow({ swell, timezone, now, userBoardClasses, homeBeachId, onPress }: OutlookRowProps): React.JSX.Element {
  const day = outlookPeakDay(swell, timezone);
  const fit = outlookFitTreatment(swell.fit, userBoardClasses);
  const note = outlookChangeNote(swell, timezone);
  const hedge = outlookLeadHedge(swell.peakAt, now);
  const color = FAMILY_STROKE_ON_PAPER[directionFamily(swell.directionDeg)];
  const detail = [
    swell.periodS !== null ? `${Math.round(swell.periodS)} s` : null,
    outlookSourceLine(swell),
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => onPress(swell)}
      accessibilityRole="button"
      accessibilityLabel={outlookRowAccessibilityLabel(swell, { timezone, userBoardClasses, homeBeachId, now })}
      hitSlop={4}
      style={({ pressed }) => [styles.row, fit.dimmed ? styles.dimmed : null, pressed ? styles.pressed : null]}
      testID={`swell-outlook-row-${swell.id}`}
    >
      <View style={styles.dayBox}>
        <Label style={styles.dayName} numberOfLines={1}>{day.windowLabel ?? day.weekday}</Label>
        <UIText style={styles.dayDate}>{day.date}</UIText>
      </View>
      <View style={styles.glyph}>
        <DirectionGlyph deg={swell.directionDeg} label={swell.directionLabel} color={color} testID={`swell-outlook-glyph-${swell.id}`} />
        <Label style={styles.glyphLabel}>{swell.directionLabel}</Label>
      </View>
      <View style={styles.main}>
        <View style={styles.sizeLine}>
          <UIText style={styles.size} numberOfLines={1}>{formatOutlookSize(swell.faceHeightFt)}</UIText>
          <TierChip tier={swell.tier} />
        </View>
        {detail ? <Data style={styles.detail} numberOfLines={1}>{detail}</Data> : null}
        {swell.beach.id !== homeBeachId ? (
          <Data style={styles.detail} numberOfLines={1}>{`at ${swell.beach.name}`}</Data>
        ) : null}
        {note ? <UIText style={styles.note} numberOfLines={1}>{note}</UIText> : null}
        {hedge ? <UIText style={styles.hedge}>{hedge}</UIText> : null}
        {fit.label ? (
          <UIText style={fit.tone === 'caution' ? styles.caution : styles.fit} numberOfLines={1}>{fit.label}</UIText>
        ) : null}
      </View>
      <RunSparkline history={swell.history} color={color} testID={`swell-outlook-sparkline-${swell.id}`} />
      <Ionicons name="chevron-forward" size={18} color={Colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    backgroundColor: Colors.paper,
    borderColor: Colors.paperShadow,
    borderRadius: 12,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    minHeight: 44,
    padding: 12,
  },
  dimmed: { opacity: DIMMED_OPACITY },
  pressed: { opacity: 0.75 },
  dayBox: {
    alignItems: 'center',
    borderColor: Colors.paperShadow,
    borderRightWidth: 1,
    paddingRight: 10,
    width: 52,
  },
  dayName: { color: Colors.inkMuted, fontSize: 10, letterSpacing: 1.3 },
  dayDate: { color: Colors.ink, fontFamily: Fonts.displayBold, fontSize: 24, lineHeight: 28 },
  glyph: { alignItems: 'center', gap: 1, width: 44 },
  glyphLabel: { color: Colors.inkMuted, fontSize: 8, letterSpacing: 1 },
  main: { flex: 1, gap: 3, minWidth: 0 },
  sizeLine: { alignItems: 'center', columnGap: 8, flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  size: { color: Colors.ink, fontFamily: Fonts.displayBold, fontSize: 20, flexShrink: 1 },
  detail: { color: Colors.ink, fontSize: 12 },
  note: { color: Colors.goldInk, fontFamily: Fonts.uiMedium, fontSize: 13 },
  hedge: { color: Colors.inkMuted, fontFamily: Fonts.uiMedium, fontSize: 12, fontStyle: 'italic' },
  fit: { color: Colors.tealInk, fontFamily: Fonts.uiBold, fontSize: 12 },
  caution: { color: Colors.dangerInk, fontFamily: Fonts.uiBold, fontSize: 12 },
});
```
Append to `index.ts`:
```ts
export { OutlookRow } from './outlook-row';
export type { OutlookRowProps } from './outlook-row';
export { GlyphKey } from './glyph-key';
export { sparklineGeometry } from './sparkline-geometry';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/sparkline-geometry.test.ts src/features/swell-outlook/__tests__/outlook-row.test.tsx && npm run typecheck`
Expected: PASS (5 + 9 tests). Note: in the "single run" row test the sparkline label is "across 1 run".

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add outlook row with glyph, sparkline, tier chip and fit treatment"
```

### Task 8: Swell Outlook screen and route registration
**Files:** Create `src/features/swell-outlook/swell-outlook-screen.tsx`; Modify `src/navigation/types.ts:127` (add route), `src/navigation/root-navigator.tsx:214-218, 388-394, 1607` (lazy screen + registration), `src/features/swell-outlook/index.ts`; Test `src/features/swell-outlook/__tests__/swell-outlook-screen.test.tsx`.
**Interfaces:** Consumes: `useSwellOutlook` (Task 2), `groupOutlookSwells`, `outlookHeaderLine`, `boardClassesFromBoards`, `buildOutlookLandingParams`, `visibleOutlookSwells`, `OUTLOOK_GROUP_NOTES` (Task 3), `trackSwellOutlook` (Task 4), `buildWeekGraphic`, `outlookGraphicLabel` (Task 5), `WeekGraphic`, `WeekGraphicLegend` (Task 6), `OutlookRow`, `GlyphKey` (Task 7), `useUserBoards(userId: string | undefined)` (`src/hooks/use-user-boards.ts`), `ScreenErrorState` (`src/components/screen-error-state.tsx`, props `{ error: unknown; onRetry: () => void; testID?: string }`), `BrandIconButton` (`src/components/ui/brand-icon-button.tsx`), `haptics.light()`. Produces: `SwellOutlookScreen`, root route `SwellOutlook: undefined` in `RootStackParamList`, `RootScreenProps<'SwellOutlook'>` registration.

States: loading skeleton; error with retry (first load failed); "not available" (`data === null`: deep link or stale push for a user the endpoint answers 403 to); empty (valid body, no visible swells: designed, not an error); list. The screen draws the strip graphic at the response's `horizonDays`.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/swell-outlook-screen.test.tsx`:
```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { trackSwellOutlook } from '../analytics';
import { makeOutlook, makeSwell } from '../__fixtures__/make-swell';
import { SwellOutlookScreen } from '../swell-outlook-screen';
import type { SwellOutlookResponse } from '../types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRefetch = jest.fn();
let mockQuery: {
  data: SwellOutlookResponse | null | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isRefetching: boolean;
  dataUpdatedAt: number;
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: (props: object) => ReactLib.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('../use-swell-outlook', () => ({ useSwellOutlook: () => ({ ...mockQuery, refetch: mockRefetch }) }));
jest.mock('@/hooks/use-user-boards', () => ({
  useUserBoards: () => ({ data: [{ board_type: 'shortboard' }, { board_type: 'longboard' }] }),
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'user-1' } }),
}));
jest.mock('../analytics', () => ({ trackSwellOutlook: jest.fn() }));
jest.mock('@/lib/haptics', () => ({
  haptics: { light: jest.fn(async () => undefined), error: jest.fn(async () => undefined) },
}));

function setQuery(data: SwellOutlookResponse | null | undefined, extra: Partial<typeof mockQuery> = {}): void {
  mockQuery = {
    data,
    isPending: data === undefined,
    isError: false,
    error: null,
    isRefetching: false,
    dataUpdatedAt: Date.parse('2026-10-04T16:00:00.000Z'),
    ...extra,
  };
}

const three = makeOutlook({
  swells: [
    makeSwell({ id: 'a', tier: 'locked', fit: { status: 'in_range', boards: ['longboard'] } }),
    makeSwell({ id: 'b', eventKey: 'beach-sb:WNW:2026-10-06', tier: 'likely', peakAt: '2026-10-06T22:00:00.000Z', fit: { status: 'below_range', boards: [] } }),
    makeSwell({ id: 'c', eventKey: 'beach-hb:S:2026-10-09', tier: 'on_the_radar', peakAt: '2026-10-09T18:00:00.000Z', fit: { status: 'above_range', boards: [] } }),
  ],
});

describe('SwellOutlookScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockRefetch.mockClear();
    jest.mocked(trackSwellOutlook).mockClear();
  });

  it('shows header, strip graphic, key and rows grouped by tier', () => {
    setQuery(three);
    render(<SwellOutlookScreen />);
    expect(screen.getByText('Swell Outlook')).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-header-line')).toHaveTextContent(/^Huntington Beach · next 9 days · updated/);
    expect(screen.getByTestId('swell-outlook-graphic')).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-glyph-key')).toBeTruthy();
    expect(screen.getByText('LOCKED')).toBeTruthy();
    expect(screen.getByText('LIKELY')).toBeTruthy();
    expect(screen.getByText('ON THE RADAR')).toBeTruthy();
    expect(screen.getByText(/often change or fade/)).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-row-a')).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-row-c')).toBeTruthy();
  });

  it('reports the view once with tier counts', () => {
    setQuery(three);
    render(<SwellOutlookScreen />);
    expect(trackSwellOutlook).toHaveBeenCalledWith('swell_outlook_viewed', {
      swell_count: 3, locked_count: 1, likely_count: 1, radar_count: 1, in_range_count: 1,
    });
  });

  it('opens the swell detail with enough params to paint, and tracks the tap', () => {
    setQuery(three);
    render(<SwellOutlookScreen />);
    fireEvent.press(screen.getByTestId('swell-outlook-row-a'));
    expect(mockNavigate).toHaveBeenCalledWith('SwellLanding', expect.objectContaining({
      eventKey: 'beach-hb:SSW:2026-10-05',
      entrySource: 'outlook',
      beachName: 'Huntington Beach',
    }));
    expect(trackSwellOutlook).toHaveBeenCalledWith('swell_outlook_row_tapped', {
      event_key: 'beach-hb:SSW:2026-10-05', tier: 'locked', fit_status: 'in_range', change: 'steady', rank: 1,
    });
  });

  it('shows a designed empty state with the last-checked time and a Week Scout link', () => {
    setQuery(makeOutlook({ swells: [] }));
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-empty')).toBeTruthy();
    expect(screen.getByText('Nothing notable is forecast for the next 9 days.')).toBeTruthy();
    expect(screen.getByTestId('swell-outlook-empty-checked')).toHaveTextContent(/^Last checked/);
    expect(screen.queryByTestId('swell-outlook-error')).toBeNull();
    fireEvent.press(screen.getByTestId('swell-outlook-empty-week-scout'));
    expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'Explore', params: { mode: 'tabs' } });
    expect(trackSwellOutlook).toHaveBeenCalledWith('swell_outlook_week_scout_tapped', { source: 'outlook_empty' });
  });

  it('treats a list of only early signals as empty', () => {
    setQuery(makeOutlook({ swells: [makeSwell({ id: 'e', tier: 'early_signal' })] }));
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-empty')).toBeTruthy();
    expect(screen.queryByTestId('swell-outlook-row-e')).toBeNull();
  });

  it('shows a loading skeleton while the first request is pending', () => {
    setQuery(undefined);
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-loading')).toBeTruthy();
  });

  it('shows an error with retry when the first request failed', () => {
    setQuery(undefined, { isPending: false, isError: true, error: Object.assign(new Error('boom'), { status: 500 }) });
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-error-state-retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('says the outlook is not available when the endpoint is not enabled for this user', () => {
    setQuery(null);
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('swell-outlook-graphic')).toBeNull();
  });

  it('clamps a very long home beach name in the header', () => {
    setQuery(makeOutlook({ homeBeach: { id: 'x', name: 'Playa Grande de la Costa del Sol y los Cabos Viejos' } }));
    render(<SwellOutlookScreen />);
    expect(screen.getByTestId('swell-outlook-header-line').props.numberOfLines).toBe(2);
  });

  it('goes back', () => {
    setQuery(three);
    render(<SwellOutlookScreen />);
    fireEvent.press(screen.getByTestId('swell-outlook-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/swell-outlook-screen.test.tsx`
Expected: FAIL with `Cannot find module '../swell-outlook-screen'`.

- [ ] **Step 3: Write the minimal implementation**

`src/navigation/types.ts`, after line 127 (`SwellLanding: SwellLandingRouteParams;`):
```ts
  /** The list of every swell on the way. Only reachable for users the outlook endpoint answers. */
  SwellOutlook: undefined;
```

`src/navigation/root-navigator.tsx`: after the `SwellLandingScreen` lazy import (lines 214-218) add
```ts
const SwellOutlookScreen = lazy(() =>
  import('@/features/swell-outlook/swell-outlook-screen').then((m) => ({
    default: m.SwellOutlookScreen,
  })),
);
```
after `LazySwellLanding` (lines 388-394) add
```tsx
function LazySwellOutlook(_props: RootScreenProps<'SwellOutlook'>) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <SwellOutlookScreen />
    </Suspense>
  );
}
```
and after `<Stack.Screen name="SwellLanding" component={LazySwellLanding} />` (line 1607) add
```tsx
            <Stack.Screen name="SwellOutlook" component={LazySwellOutlook} />
```
(No `linking` path is added: the web app-link parity check `npm run verify:app-link-parity` stays untouched and Outlook is entered from in-app surfaces and the swell push back action.)

`src/features/swell-outlook/swell-outlook-screen.tsx`:
```tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenErrorState } from '@/components/screen-error-state';
import { BrandIconButton } from '@/components/ui/brand-icon-button';
import { Body, Dateline, Eyebrow, H1, H2, UIText } from '@/components/ui/typography';
import { Colors } from '@/constants/theme';
import { useUserBoards } from '@/hooks/use-user-boards';
import { getDeviceTimezone } from '@/lib/device-timezone';
import { haptics } from '@/lib/haptics';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/stores/auth-store';
import { trackSwellOutlook } from './analytics';
import { GlyphKey } from './glyph-key';
import {
  boardClassesFromBoards,
  buildOutlookLandingParams,
  formatOutlookUpdated,
  groupOutlookSwells,
  outlookHeaderLine,
  visibleOutlookSwells,
} from './outlook-format';
import { OutlookRow } from './outlook-row';
import type { OutlookSwell, SwellOutlookResponse } from './types';
import { useSwellOutlook } from './use-swell-outlook';
import { buildWeekGraphic, outlookGraphicLabel } from './week-graphic-geometry';
import { WeekGraphic, WeekGraphicLegend } from './week-graphic';

type OutlookNav = NativeStackNavigationProp<RootStackParamList, 'SwellOutlook'>;
const GRAPHIC_HEIGHT = 196;
const DEFAULT_WIDTH = 320;

export function SwellOutlookScreen(): React.JSX.Element {
  const navigation = useNavigation<OutlookNav>();
  const insets = useSafeAreaInsets();
  const outlook = useSwellOutlook();
  const userId = useAuthStore((state) => state.user?.id);
  const boards = useUserBoards(userId);
  const userBoardClasses = useMemo(() => boardClassesFromBoards(boards.data), [boards.data]);
  const timezone = useMemo(() => getDeviceTimezone() ?? 'UTC', []);
  const data = outlook.data;
  const now = useMemo(() => new Date(), [outlook.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps -- re-read the clock when new data lands
  const [graphicWidth, setGraphicWidth] = useState(DEFAULT_WIDTH);
  const viewedRef = useRef(false);
  const visible = useMemo(() => (data ? visibleOutlookSwells(data.swells) : []), [data]);
  const groups = useMemo(() => (data ? groupOutlookSwells(data.swells) : []), [data]);

  useEffect(() => {
    if (!data || viewedRef.current) return;
    viewedRef.current = true;
    trackSwellOutlook('swell_outlook_viewed', {
      swell_count: visible.length,
      locked_count: visible.filter((swell) => swell.tier === 'locked').length,
      likely_count: visible.filter((swell) => swell.tier === 'likely').length,
      radar_count: visible.filter((swell) => swell.tier === 'on_the_radar').length,
      in_range_count: visible.filter((swell) => swell.fit.status === 'in_range').length,
    });
  }, [data, visible]);

  const handleBack = useCallback((): void => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Home' });
  }, [navigation]);

  const handleRowPress = useCallback(
    (swell: OutlookSwell): void => {
      void haptics.light();
      trackSwellOutlook('swell_outlook_row_tapped', {
        event_key: swell.eventKey,
        tier: swell.tier,
        fit_status: swell.fit.status,
        change: swell.change,
        rank: visible.indexOf(swell) + 1,
      });
      navigation.navigate('SwellLanding', buildOutlookLandingParams(swell, timezone));
    },
    [navigation, timezone, visible],
  );

  const handleWeekScout = useCallback((): void => {
    void haptics.light();
    trackSwellOutlook('swell_outlook_week_scout_tapped', { source: 'outlook_empty' });
    navigation.navigate('Main', { screen: 'Explore', params: { mode: 'tabs' } });
  }, [navigation]);

  function handleGraphicLayout(event: LayoutChangeEvent): void {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== graphicWidth) setGraphicWidth(next);
  }

  const geometry = useMemo(
    () => (data
      ? buildWeekGraphic({ swells: visible, now, timezone, days: data.horizonDays, width: graphicWidth, height: GRAPHIC_HEIGHT })
      : null),
    [data, graphicWidth, now, timezone, visible],
  );

  function renderBody(response: SwellOutlookResponse): React.JSX.Element {
    if (visible.length === 0) {
      return (
        <View style={styles.emptyCard} testID="swell-outlook-empty">
          <H2 style={styles.onPaper}>{`Nothing notable is forecast for the next ${response.horizonDays} days.`}</H2>
          <Body style={styles.onPaperMuted} testID="swell-outlook-empty-checked">
            {`Last checked ${formatOutlookUpdated(response.generatedAt, now).replace('updated ', '')}.`}
          </Body>
          <Pressable
            onPress={handleWeekScout}
            accessibilityRole="button"
            accessibilityLabel="See the 7-day Week Scout"
            style={styles.link}
            testID="swell-outlook-empty-week-scout"
          >
            <UIText style={styles.linkText}>See the 7-day Week Scout</UIText>
          </Pressable>
        </View>
      );
    }
    return (
      <>
        <View style={styles.graphicCard} onLayout={handleGraphicLayout}>
          {geometry ? (
            <WeekGraphic
              geometry={geometry}
              accessibilityLabel={outlookGraphicLabel(geometry, response.horizonDays)}
              testID="swell-outlook-graphic"
            />
          ) : null}
          <WeekGraphicLegend />
        </View>
        <GlyphKey />
        {groups.map((group) => (
          <View key={group.tier} testID={`swell-outlook-group-${group.tier}`}>
            <View style={styles.groupHead}>
              <Eyebrow style={styles.groupName}>{group.label.toUpperCase()}</Eyebrow>
              <Dateline style={styles.groupNote}>{group.note}</Dateline>
            </View>
            {group.swells.map((swell) => (
              <OutlookRow
                key={swell.id}
                swell={swell}
                timezone={timezone}
                now={now}
                userBoardClasses={userBoardClasses}
                homeBeachId={response.homeBeach?.id ?? null}
                onPress={handleRowPress}
              />
            ))}
          </View>
        ))}
      </>
    );
  }

  function renderContent(): React.JSX.Element {
    if (data === null) {
      return (
        <View style={styles.emptyCard} testID="swell-outlook-unavailable">
          <H2 style={styles.onPaper}>Swell Outlook is not available for your account yet.</H2>
          <Body style={styles.onPaperMuted}>Your forecasts and Week Scout work as before.</Body>
        </View>
      );
    }
    if (data) return renderBody(data);
    if (outlook.isError) {
      return (
        <View testID="swell-outlook-error">
          <ScreenErrorState error={outlook.error} onRetry={() => void outlook.refetch()} />
        </View>
      );
    }
    return (
      <View style={styles.skeleton} testID="swell-outlook-loading">
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']} testID="swell-outlook-screen">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={outlook.isRefetching} onRefresh={() => void outlook.refetch()} tintColor={Colors.teal} />
        }
      >
        <View style={styles.nav}>
          <BrandIconButton name="chevron-back" accessibilityLabel="Back" onPress={handleBack} testID="swell-outlook-back" />
        </View>
        <H1 style={styles.title} numberOfLines={1}>Swell Outlook</H1>
        {data ? (
          <Dateline style={styles.headerLine} numberOfLines={2} testID="swell-outlook-header-line">
            {outlookHeaderLine(data, now)}
          </Dateline>
        ) : null}
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Colors.background, flex: 1 },
  content: { paddingHorizontal: 16 },
  nav: { alignItems: 'flex-start', marginBottom: 4, marginLeft: -4 },
  title: { color: Colors.cream },
  headerLine: { color: Colors.textMuted, marginBottom: 12, marginTop: 4 },
  graphicCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  groupHead: { gap: 2, marginBottom: 8, marginTop: 14, paddingHorizontal: 2 },
  groupName: { color: Colors.cream },
  groupNote: { color: Colors.textMuted },
  emptyCard: {
    backgroundColor: Colors.paper,
    borderColor: Colors.paperShadow,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  onPaper: { color: Colors.ink },
  onPaperMuted: { color: Colors.inkMuted },
  link: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  linkText: { color: Colors.primaryInk },
  skeleton: { gap: 10 },
  skeletonCard: { backgroundColor: Colors.card, borderRadius: 16, height: 200, opacity: 0.6 },
  skeletonRow: { backgroundColor: Colors.paper, borderRadius: 12, height: 84, opacity: 0.5 },
});
```
Append to `index.ts`: `export { SwellOutlookScreen } from './swell-outlook-screen';`

Spec note on gating: reaching this screen for a non-enabled user (a stale push, a pasted link) shows the "not available" card instead of a blank or an error; no data is requested beyond the outlook query.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/swell-outlook-screen.test.tsx && npm run typecheck && npx eslint src/features/swell-outlook src/navigation`
Expected: PASS (10 tests), typecheck and lint clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook src/navigation/types.ts src/navigation/root-navigator.tsx
git commit -m "feat(swell-outlook): add Swell Outlook screen and root route"
```

### Task 9: Home "How this week plays out" behind the gate
**Files:** Modify `src/screens/home.tsx` (import near lines 192-193; hook directly above `const weekScoutQuery = useWeekScout({` at ~832; handler directly above `const handleLookingAheadWeekScoutPress = useCallback(` at 3161; JSX at ~4141-4158 where `<ForecastTimeline` is rendered); Modify `src/__tests__/home-screen.test.tsx` (import block, mock next to `jest.mock('@/hooks/use-week-scout'` at line 157, new `describe` inside `describe('Home LOOKING AHEAD integration'` which starts at line 1313 and whose `describe('when Week Scout cannot be loaded'` block starts at 1413); Modify `src/__tests__/home-dashboard-stitch.test.tsx` (one mock line); Test the same files.
**Interfaces:** Consumes: `useSwellOutlook`, `HowThisWeekPlaysOut`, `trackSwellOutlook` from `@/features/swell-outlook` (Tasks 2, 4, 6), `haptics.light()`, Home's `navigation` (`HomeNavProp`, `home.tsx:558`), `showNowReportingSurfaces`, `deferredSectionsReady`, `recommendationsBlocked`, `suppressFilterForecastSurfaces`, `heroBeachId` (existing gate on the current `ForecastTimeline` block). Produces: a Home that renders `HowThisWeekPlaysOut` in the exact slot of "How today changes" when `swellOutlook.data` is a parsed body, and renders `ForecastTimeline` exactly as before otherwise.

Design: the existing `ForecastTimeline` block keeps its condition verbatim and gains `&& !swellOutlook.data`; a sibling block with the same condition plus `&& swellOutlook.data` renders the new section. That is the smallest diff and makes "outlook off means today's UI" a one-token invariant. Spec note: for an allowlisted user the section swaps in when the outlook query resolves, so on a cold start "How today changes" is replaced after the first outlook response (a one-time layout swap); it is deliberately not held back, to keep the non-allowlisted path free of any waiting.

- [ ] **Step 1: Write the failing test**

In `src/__tests__/home-screen.test.tsx`, add to the imports:
```tsx
import { makeOutlook, makeSwell } from '@/features/swell-outlook/__fixtures__/make-swell';
import type { SwellOutlookResponse } from '@/features/swell-outlook/types';
```
Add next to `jest.mock('@/hooks/use-week-scout', ...)` (line 157):
```tsx
let mockSwellOutlook: SwellOutlookResponse | null = null;
jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({
  useSwellOutlook: () => ({ data: mockSwellOutlook }),
}));
```
Inside `describe('Home LOOKING AHEAD integration', ...)`, directly before `describe('when Week Scout cannot be loaded', ...)` (line 1413), add:
```tsx
  describe('How this week plays out (Swell Outlook gate)', () => {
    afterEach(() => {
      mockSwellOutlook = null;
    });

    it('keeps "How today changes" and shows nothing new when the outlook is not enabled for the user', () => {
      jest.useFakeTimers({ now: new Date('2026-05-08T17:00:00.000Z') });
      try {
        configureLookingAheadHome();
        mockSwellOutlook = null;
        const screen = renderWithProviders(<HomeScreen />);
        expect(screen.getByText('HOW TODAY CHANGES')).toBeTruthy();
        expect(screen.queryByText('HOW THIS WEEK PLAYS OUT')).toBeNull();
        expect(screen.queryByTestId('home-week-plays-out')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('replaces "How today changes" with the week graphic when the outlook returns data', () => {
      jest.useFakeTimers({ now: new Date('2026-05-08T17:00:00.000Z') });
      try {
        configureLookingAheadHome();
        mockSwellOutlook = makeOutlook({ swells: [makeSwell({ peakAt: '2026-05-10T19:00:00.000Z' })] });
        const screen = renderWithProviders(<HomeScreen />);
        expect(screen.getByText('HOW THIS WEEK PLAYS OUT')).toBeTruthy();
        expect(screen.queryByText('HOW TODAY CHANGES')).toBeNull();
        expect(screen.queryByTestId('forecast-timeline-row-8')).toBeNull();
        expect(screen.getByText('1 swell on the way')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });

    it('shows the flat week and one line when no swells are forecast', () => {
      jest.useFakeTimers({ now: new Date('2026-05-08T17:00:00.000Z') });
      try {
        configureLookingAheadHome();
        mockSwellOutlook = makeOutlook({ swells: [] });
        const screen = renderWithProviders(<HomeScreen />);
        expect(screen.getByText('HOW THIS WEEK PLAYS OUT')).toBeTruthy();
        expect(screen.getByTestId('home-week-empty')).toBeTruthy();
        expect(screen.queryByText('HOW TODAY CHANGES')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('opens the Swell Outlook from the graphic and from the footer', () => {
      jest.useFakeTimers({ now: new Date('2026-05-08T17:00:00.000Z') });
      try {
        configureLookingAheadHome();
        mockSwellOutlook = makeOutlook({ swells: [makeSwell({ peakAt: '2026-05-10T19:00:00.000Z' })] });
        const screen = renderWithProviders(<HomeScreen />);
        fireEvent.press(screen.getByTestId('home-week-footer'));
        expect(mockNavigate).toHaveBeenCalledWith('SwellOutlook');
        mockNavigate.mockClear();
        fireEvent.press(screen.getByTestId('home-week-graphic'));
        expect(mockNavigate).toHaveBeenCalledWith('SwellOutlook');
      } finally {
        jest.useRealTimers();
      }
    });
  });
```
(`fireEvent` and `mockNavigate` are already in scope in this file: `mockNavigate` at line 86, `renderWithProviders` at 350, `configureLookingAheadHome` at 1242.)

In `src/__tests__/home-dashboard-stitch.test.tsx`, add beside its other `jest.mock(` calls:
```tsx
jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({
  useSwellOutlook: () => ({ data: null }),
}));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/__tests__/home-screen.test.tsx -t "How this week plays out"`
Expected: FAIL: "replaces ..." cannot find `HOW THIS WEEK PLAYS OUT` (the gate test "keeps How today changes" already passes, which is the point: it pins today's behaviour before the change).

- [ ] **Step 3: Write the minimal implementation**

`src/screens/home.tsx`:

1. Add beside the other `@/components/home` imports (after line 193):
```ts
import { HowThisWeekPlaysOut, trackSwellOutlook, useSwellOutlook } from '@/features/swell-outlook';
```
2. Directly above `const weekScoutQuery = useWeekScout({` (~line 832) add:
```ts
  const swellOutlook = useSwellOutlook();
```
3. Directly above `const handleLookingAheadWeekScoutPress = useCallback((): void => {` (line 3161) add:
```ts
  const handleSwellOutlookPress = useCallback(
    (surface: 'home_graphic' | 'home_footer'): void => {
      haptics.light();
      trackSwellOutlook('swell_outlook_entry_tapped', { surface });
      navigation.navigate('SwellOutlook');
    },
    [navigation],
  );
```
4. At the `ForecastTimeline` render (~4141), replace
```tsx
          {showNowReportingSurfaces && deferredSectionsReady && (recommendationsBlocked || !suppressFilterForecastSurfaces) && heroBeachId ? (
            <ForecastTimeline
```
with
```tsx
          {showNowReportingSurfaces && deferredSectionsReady && (recommendationsBlocked || !suppressFilterForecastSurfaces) && heroBeachId && swellOutlook.data ? (
            <HowThisWeekPlaysOut
              outlook={swellOutlook.data}
              onOpenOutlook={handleSwellOutlookPress}
            />
          ) : null}
          {showNowReportingSurfaces && deferredSectionsReady && (recommendationsBlocked || !suppressFilterForecastSurfaces) && heroBeachId && !swellOutlook.data ? (
            <ForecastTimeline
```
leaving the rest of the `ForecastTimeline` element and its `) : null}` untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/home-screen.test.tsx src/__tests__/home-dashboard-stitch.test.tsx src/__tests__/home-looking-ahead.test.tsx && npm run typecheck`
Expected: PASS, including the four new tests and every pre-existing "HOW TODAY CHANGES" assertion (lines 591, 1020, 1498, 1518, 1526, 2984, 8521 on `origin/main`). Then run `npm test -- home` and add the same `use-swell-outlook` mock line to any other Home-rendering suite that fails with an unmocked-network error.

- [ ] **Step 5: Simulator verification (visual task)**
Run the Fixture run three times in turn (`=three`, `=empty`, `=disabled`), restarting Metro with `--clear` each time, signed in as any test user with a home beach.
- `=three`, Home tab, scroll to the slot under the hero card: eyebrow "HOW THIS WEEK PLAYS OUT" (not "HOW TODAY CHANGES"); a card with a 7-day graphic: gold-dim weekend columns, three bands (teal south hump peaking tomorrow with a solid dot and label "2–3 ft / 15s SSW", a dimmed gold hump two days later, a dashed teal band with a bracket near the right edge), a legend row, and a footer "3 swells on the way" with "Swell Outlook ›". The bands unfold left to right once over about two seconds, with nothing looping afterwards. Tap the footer: the Swell Outlook opens (Task 8): header line "Huntington Beach · next 9 days · updated …", strip graphic, key, LOCKED / LIKELY / ON THE RADAR groups with one paper row each; the Seal Beach row reads "at Seal Beach", is visibly dimmed and says "Small for you"; the 7-9 ft row says "Above your range" at full strength and "From Hurricane Rachel"; the single-run swell shows one sparkline dot; the first row says "Longboard size". Back returns to Home.
- `=empty`: same slot shows a flat axis for the week, the line "Nothing notable is forecast this week." and the footer "No notable swells on the way"; tapping it opens the Outlook empty card ("Nothing notable is forecast for the next 9 days.", "Last checked …", "See the 7-day Week Scout").
- `=disabled`: Home is identical to `main`: "HOW TODAY CHANGES" and its rows, no outlook section anywhere.

- [ ] **Step 6: Commit**
```bash
git add src/screens/home.tsx src/__tests__/home-screen.test.tsx src/__tests__/home-dashboard-stitch.test.tsx
git commit -m "feat(home): replace How today changes with How this week plays out behind the outlook gate"
```

### Task 10: Week Scout entry row
**Files:** Create `src/features/swell-outlook/outlook-entry-row.tsx`; Modify `src/screens/week-scout.tsx` (import near line 31; JSX before `{!sessionPickUnavailable && model?.source === 'cached' ? (` at ~1168), `src/features/swell-outlook/index.ts`, `src/__tests__/week-scout-screen.test.tsx` (mock near line 360, reset in `beforeEach` at 487, two tests after the test at line 784); Test `src/features/swell-outlook/__tests__/outlook-entry-row.test.tsx` and the Week Scout test.
**Interfaces:** Consumes: `useSwellOutlook` (Task 2), `visibleOutlookSwells`, `outlookTierSummary`, `outlookFooterLine` (Task 3), `trackSwellOutlook` (Task 4), `useNavigation` (React Navigation). Produces: `SwellOutlookEntryRow` (props `{ surface: 'week_scout'; testID?: string }`), returns `null` unless the outlook is enabled for the user.

Week Scout is otherwise unchanged: no map, day-chip, search or model code is touched.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/outlook-entry-row.test.tsx`:
```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { trackSwellOutlook } from '../analytics';
import { makeOutlook, makeSwell } from '../__fixtures__/make-swell';
import { SwellOutlookEntryRow } from '../outlook-entry-row';
import type { SwellOutlookResponse } from '../types';

const mockNavigate = jest.fn();
let mockData: SwellOutlookResponse | null | undefined;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../use-swell-outlook', () => ({ useSwellOutlook: () => ({ data: mockData }) }));
jest.mock('../analytics', () => ({ trackSwellOutlook: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ haptics: { light: jest.fn(async () => undefined) } }));

describe('SwellOutlookEntryRow', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    jest.mocked(trackSwellOutlook).mockClear();
  });

  it.each([null, undefined])('renders nothing when the outlook is %s', (value) => {
    mockData = value;
    const view = render(<SwellOutlookEntryRow surface="week_scout" />);
    expect(view.toJSON()).toBeNull();
  });

  it('counts the swells and summarises the tiers', () => {
    mockData = makeOutlook({
      swells: [
        makeSwell({ id: 'a', tier: 'locked' }),
        makeSwell({ id: 'b', tier: 'likely' }),
        makeSwell({ id: 'c', tier: 'on_the_radar' }),
        makeSwell({ id: 'd', tier: 'early_signal' }),
      ],
    });
    render(<SwellOutlookEntryRow surface="week_scout" />);
    expect(screen.getByText('3 swells on the way')).toBeTruthy();
    expect(screen.getByText('Next 9 days · 1 locked · 1 likely · 1 on the radar')).toBeTruthy();
  });

  it('words the empty list as a quiet row, not an error', () => {
    mockData = makeOutlook({ swells: [] });
    render(<SwellOutlookEntryRow surface="week_scout" />);
    expect(screen.getByText('No notable swells on the way')).toBeTruthy();
    expect(screen.getByText('Next 9 days')).toBeTruthy();
  });

  it('opens the outlook and records the entry tap', () => {
    mockData = makeOutlook();
    render(<SwellOutlookEntryRow surface="week_scout" testID="entry" />);
    const row = screen.getByTestId('entry');
    expect(row.props.accessibilityLabel).toBe('1 swell on the way. Next 9 days · 1 locked. Open Swell Outlook.');
    fireEvent.press(row);
    expect(mockNavigate).toHaveBeenCalledWith('SwellOutlook');
    expect(trackSwellOutlook).toHaveBeenCalledWith('swell_outlook_entry_tapped', { surface: 'week_scout' });
  });
});
```

In `src/__tests__/week-scout-screen.test.tsx` add to the imports:
```tsx
import { makeOutlook, makeSwell } from '@/features/swell-outlook/__fixtures__/make-swell';
import type { SwellOutlookResponse } from '@/features/swell-outlook/types';
```
add beside `jest.mock('@/hooks/use-week-scout'` (line 360):
```tsx
let mockSwellOutlook: SwellOutlookResponse | null = null;
jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({
  useSwellOutlook: () => ({ data: mockSwellOutlook }),
}));
```
add `mockSwellOutlook = null;` after `mockFavoriteBeaches = [];` in the `beforeEach` (line ~521), and add these tests after `it('leads with the answer: ...` (line 784):
```tsx
  it('shows no Swell Outlook row when the outlook is not enabled for the user', () => {
    mockSwellOutlook = null;
    const { queryByTestId } = render(<WeekScoutScreen />);
    expect(queryByTestId('week-scout-swell-outlook-entry')).toBeNull();
  });

  it('adds one row into the Swell Outlook when it is enabled and leaves the rest of Week Scout alone', () => {
    mockSwellOutlook = makeOutlook({ swells: [makeSwell()] });
    const { getByTestId, getByPlaceholderText } = render(<WeekScoutScreen />);
    expect(getByPlaceholderText('Where to surf this week')).toBeTruthy();
    fireEvent.press(getByTestId('week-scout-swell-outlook-entry'));
    expect(mockNavigate).toHaveBeenCalledWith('SwellOutlook');
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'forecast_interaction',
      expect.objectContaining({ feature: 'swell_outlook', action: 'swell_outlook_entry_tapped', surface: 'week_scout' }),
    );
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/outlook-entry-row.test.tsx src/__tests__/week-scout-screen.test.tsx -t "Swell Outlook|SwellOutlookEntryRow"`
Expected: FAIL with `Cannot find module '../outlook-entry-row'` and the Week Scout test failing on the missing testID.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/outlook-entry-row.tsx`:
```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Data, UIText } from '@/components/ui/typography';
import { Colors, Fonts } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { RootStackParamList } from '@/navigation/types';
import { trackSwellOutlook } from './analytics';
import { outlookFooterLine, outlookTierSummary, visibleOutlookSwells } from './outlook-format';
import { useSwellOutlook } from './use-swell-outlook';

export interface SwellOutlookEntryRowProps {
  surface: 'week_scout';
  testID?: string;
}

/** One row into the Swell Outlook. Absent unless the outlook is enabled for this user. */
export function SwellOutlookEntryRow({ surface, testID = 'swell-outlook-entry-row' }: SwellOutlookEntryRowProps): React.JSX.Element | null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data } = useSwellOutlook();
  if (!data) return null;

  const visible = visibleOutlookSwells(data.swells);
  const title = outlookFooterLine(visible.length, 0);
  const subtitle = [`Next ${data.horizonDays} days`, outlookTierSummary(visible)].filter(Boolean).join(' · ');

  function handlePress(): void {
    void haptics.light();
    trackSwellOutlook('swell_outlook_entry_tapped', { surface });
    navigation.navigate('SwellOutlook');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. Open Swell Outlook.`}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.text}>
        <UIText style={styles.title} numberOfLines={1}>{title}</UIText>
        <Data style={styles.subtitle} numberOfLines={2}>{subtitle}</Data>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.teal} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.75 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  title: { color: Colors.text, fontFamily: Fonts.displayBold, fontSize: 16 },
  subtitle: { color: Colors.textMuted, fontSize: 12 },
});
```
Append to `src/features/swell-outlook/index.ts`: `export { SwellOutlookEntryRow } from './outlook-entry-row';`

`src/screens/week-scout.tsx`: after the `@/features/week-scout-swells` import (line 31) add
```ts
import { SwellOutlookEntryRow } from '@/features/swell-outlook';
```
and insert, immediately before `{!sessionPickUnavailable && model?.source === 'cached' ? (` (~line 1168, inside the `{!searchActive ? (<>` fragment and after the `headerBlock` conditional closes):
```tsx
            <SwellOutlookEntryRow surface="week_scout" testID="week-scout-swell-outlook-entry" />

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/outlook-entry-row.test.tsx src/__tests__/week-scout-screen.test.tsx src/__tests__/use-week-scout.test.tsx && npm run typecheck`
Expected: PASS (4 entry-row tests plus the two Week Scout tests; the existing Week Scout suite is unchanged).

- [ ] **Step 5: Simulator verification (visual task)**
Fixture run `=three`, then `=disabled`. Explore tab in "Tabs" mode (Week Scout): under the search bar and above the pick hero, one dark card row "3 swells on the way" / "Next 9 days · 1 locked · 1 likely · 1 on the radar" with a teal chevron; tap opens the Swell Outlook. With `=disabled` the row is absent and the screen is pixel-identical to `main`. With `=empty` the row reads "No notable swells on the way / Next 9 days".

- [ ] **Step 6: Commit**
```bash
git add src/features/swell-outlook src/screens/week-scout.tsx src/__tests__/week-scout-screen.test.tsx
git commit -m "feat(week-scout): add one entry row into the Swell Outlook behind the gate"
```

### Task 11: "How the forecast moved" chart (geometry and section)
**Files:** Create `src/features/swell-outlook/history-chart-geometry.ts`, `forecast-moved-section.tsx`; Modify `index.ts`; Test `src/features/swell-outlook/__tests__/history-chart-geometry.test.ts`, `__tests__/forecast-moved-section.test.tsx`.
**Interfaces:** Consumes: `SwellEventHistoryEntry` (`src/features/swell-landing/types.ts:44`, `{ runDate; peakAt: string | null; faceHeightFt: number | null; periodS: number | null }`), `formatSwellNumber`, `formatSwellShortDate` (`swell-copy.ts:33,28`), `formatForecastWeekdayInZone`, `formatForecastDateInZone` (Task 3 sources). Produces: `type HistoryRun = SwellEventHistoryEntry`, `HISTORY_CHART_MAX_RUNS = 6`, `interface HistoryColumn`, `interface HistoryChartGeometry`, `buildHistoryChart(runs: readonly HistoryRun[], opts: { width: number; timezone: string }): HistoryChartGeometry | null`, `ForecastMovedSection` (props `{ runs: readonly HistoryRun[]; timezone: string }`).

Chart construction (from mockup v4 `histSVG`): forecast run date on the x axis; a stepped size track with the value written at each run and a "+1 ft" chip where it stepped; one peak-day chip per run, filled on a run whose peak day moved, with "a day earlier/later" under it; the latest run in a soft highlighted column; one caption line. A single run draws that run and says tracking has just started. Runs with a null height are dropped before drawing.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/history-chart-geometry.test.ts`:
```ts
import { buildHistoryChart, type HistoryRun } from '../history-chart-geometry';

const TZ = 'America/Los_Angeles';
const SAT = '2026-10-10T19:00:00.000Z';
const FRI = '2026-10-09T19:00:00.000Z';
const run = (runDate: string, faceHeightFt: number | null, peakAt: string | null = SAT): HistoryRun => ({
  runDate, peakAt, faceHeightFt, periodS: 15,
});
const four = [run('2026-10-01', 3), run('2026-10-02', 3), run('2026-10-03', 4), run('2026-10-04', 4, FRI)];
const opts = { width: 326, timezone: TZ };

describe('buildHistoryChart', () => {
  it('lays out one column per run with sizes, run labels and peak days', () => {
    const chart = buildHistoryChart(four, opts)!;
    expect(chart.columns.map((c) => c.runLabel)).toEqual(['Oct 1', 'Oct 2', 'Oct 3', 'Oct 4']);
    expect(chart.columns.map((c) => c.sizeText)).toEqual(['3 ft', '3 ft', '4 ft', '4 ft']);
    expect(chart.columns.map((c) => c.peakDay)).toEqual(['Sat', 'Sat', 'Sat', 'Fri']);
    expect(chart.columns.map((c) => c.isLatest)).toEqual([false, false, false, true]);
    expect(chart.singleRun).toBe(false);
  });

  it('highlights only the run where the peak day moved and says by how much', () => {
    const chart = buildHistoryChart(four, opts)!;
    expect(chart.columns.map((c) => c.peakChanged)).toEqual([false, false, false, true]);
    expect(chart.columns[3].changedNote).toBe('1 day earlier');
    expect(chart.columns[0].changedNote).toBeNull();
  });

  it('draws a stepped track, climbing size as a smaller y, and a delta chip where it stepped', () => {
    const chart = buildHistoryChart(four, opts)!;
    expect(chart.stepPath.startsWith('M')).toBe(true);
    expect(chart.stepPath).toContain('V');
    expect(chart.columns[3].y).toBeLessThan(chart.columns[0].y);
    expect(chart.deltaChips).toHaveLength(1);
    expect(chart.deltaChips[0].text).toBe('+1 ft');
  });

  it('draws a flat track with no step or chip when the size never moved', () => {
    const chart = buildHistoryChart([run('2026-10-01', 3), run('2026-10-02', 3), run('2026-10-03', 3)], opts)!;
    expect(chart.stepPath).not.toContain('V');
    expect(chart.deltaChips).toEqual([]);
    expect(chart.caption).toBe('Holding steady across 3 forecast runs.');
  });

  it('writes the first-seen caption with the lead time', () => {
    expect(buildHistoryChart(four, opts)!.caption).toBe('First seen 9 days out at 3 ft Sat; now 4 ft Fri.');
  });

  it('highlights the latest column', () => {
    const chart = buildHistoryChart(four, opts)!;
    const last = chart.columns[3];
    expect(chart.latestBand.x).toBeLessThan(last.x);
    expect(chart.latestBand.x + chart.latestBand.width).toBeGreaterThan(last.x);
  });

  it('handles a single run: one column, no step, no chip, and says tracking just started', () => {
    const chart = buildHistoryChart([run('2026-10-04', 8)], opts)!;
    expect(chart.singleRun).toBe(true);
    expect(chart.columns).toHaveLength(1);
    expect(chart.columns[0].peakChanged).toBe(false);
    expect(chart.deltaChips).toEqual([]);
    expect(chart.caption).toMatch(/^Tracking just started/);
    expect(chart.stepPath.startsWith('M')).toBe(true);
  });

  it('drops runs with no height and returns null when none remain', () => {
    expect(buildHistoryChart([run('2026-10-01', null), run('2026-10-02', 3)], opts)!.singleRun).toBe(true);
    expect(buildHistoryChart([run('2026-10-01', null)], opts)).toBeNull();
    expect(buildHistoryChart([], opts)).toBeNull();
  });

  it('survives a run with no peak time', () => {
    const chart = buildHistoryChart([run('2026-10-01', 3, null), run('2026-10-02', 4, SAT)], opts)!;
    expect(chart.columns[0].peakDay).toBeNull();
    expect(chart.columns[1].peakChanged).toBe(false);
    expect(chart.caption).toBe('First seen at 3 ft; now 4 ft Sat.');
  });

  it('keeps only the latest six runs', () => {
    const many = Array.from({ length: 8 }, (_, i) => run(`2026-10-0${i + 1}`, 3 + i * 0.1));
    expect(buildHistoryChart(many, opts)!.columns).toHaveLength(6);
  });

  it('labels the chart for screen readers', () => {
    expect(buildHistoryChart(four, opts)!.accessibilityLabel).toBe(
      'Forecast runs from Oct 1 to Oct 4. Size: 3 feet, 3 feet, 4 feet, 4 feet. Peak day: Sat, Sat, Sat, Fri.',
    );
  });
});
```

`src/features/swell-outlook/__tests__/forecast-moved-section.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ForecastMovedSection } from '../forecast-moved-section';

const run = (runDate: string, faceHeightFt: number | null) => ({
  runDate, peakAt: '2026-10-10T19:00:00.000Z', faceHeightFt, periodS: 15,
});

describe('ForecastMovedSection', () => {
  it('draws the chart with its caption and a screen-reader summary', () => {
    render(<ForecastMovedSection runs={[run('2026-10-01', 3), run('2026-10-04', 4)]} timezone="America/Los_Angeles" />);
    expect(screen.getByText('How the forecast moved')).toBeTruthy();
    expect(screen.getByLabelText(/^Forecast runs from Oct 1 to Oct 4\./)).toBeTruthy();
    expect(screen.getByTestId('forecast-moved-caption')).toHaveTextContent('First seen 9 days out at 3 ft Sat; now 4 ft Sat.');
  });

  it('says tracking has just started for a single run', () => {
    render(<ForecastMovedSection runs={[run('2026-10-04', 8)]} timezone="America/Los_Angeles" />);
    expect(screen.getByTestId('forecast-moved-caption')).toHaveTextContent(/^Tracking just started/);
  });

  it('says so plainly when no run has a usable size', () => {
    render(<ForecastMovedSection runs={[run('2026-10-04', null)]} timezone="America/Los_Angeles" />);
    expect(screen.getByText('No forecast runs recorded yet.')).toBeTruthy();
    expect(screen.queryByLabelText(/Forecast runs from/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/history-chart-geometry.test.ts src/features/swell-outlook/__tests__/forecast-moved-section.test.tsx`
Expected: FAIL with `Cannot find module '../history-chart-geometry'` / `'../forecast-moved-section'`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/history-chart-geometry.ts`:
```ts
import { formatSwellNumber, formatSwellShortDate } from '@/features/swell-landing/swell-copy';
import type { SwellEventHistoryEntry } from '@/features/swell-landing/types';
import { formatForecastDateInZone, formatForecastWeekdayInZone } from '@/lib/forecast-time-formatting';

export type HistoryRun = SwellEventHistoryEntry;
export const HISTORY_CHART_MAX_RUNS = 6;

const DAY_MS = 86_400_000;
const LABEL_COLUMN = 54;
const SIZE_CENTER_Y = 101;
const SIZE_SPAN_PX = 34;
const CHART_HEIGHT = 196;
const MATERIAL_STEP_FT = 0.5;

export interface HistoryColumn {
  key: string;
  x: number;
  y: number;
  runLabel: string;
  isLatest: boolean;
  sizeText: string;
  peakDay: string | null;
  peakChanged: boolean;
  changedNote: string | null;
}

export interface HistoryChartGeometry {
  width: number;
  height: number;
  labelColumn: number;
  singleRun: boolean;
  columns: HistoryColumn[];
  stepPath: string;
  deltaChips: Array<{ x: number; y: number; text: string }>;
  latestBand: { x: number; width: number };
  caption: string;
  accessibilityLabel: string;
}

type SizedRun = HistoryRun & { faceHeightFt: number };

function titleCase(upper: string): string {
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

function peakDayName(peakAt: string | null, timezone: string): string | null {
  return peakAt ? titleCase(formatForecastWeekdayInZone(new Date(peakAt), timezone)) : null;
}

function peakLocalDate(peakAt: string | null, timezone: string): string | null {
  return peakAt ? formatForecastDateInZone(new Date(peakAt), timezone) : null;
}

function dayDiff(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T12:00:00.000Z`) - Date.parse(`${fromDate}T12:00:00.000Z`)) / DAY_MS);
}

function feet(value: number): string {
  return `${formatSwellNumber(value)} ft`;
}

function spokenFeet(value: number): string {
  const text = formatSwellNumber(value);
  return `${text} ${text === '1' ? 'foot' : 'feet'}`;
}

function buildCaption(runs: readonly SizedRun[], timezone: string): string {
  if (runs.length === 1) return 'Tracking just started: this is the first forecast run that saw this swell.';
  const first = runs[0];
  const last = runs[runs.length - 1];
  const firstDate = peakLocalDate(first.peakAt, timezone);
  const lastDate = peakLocalDate(last.peakAt, timezone);
  const sameSize = Math.abs(last.faceHeightFt - first.faceHeightFt) < MATERIAL_STEP_FT;
  const sameDay = !firstDate || !lastDate || firstDate === lastDate;
  if (sameSize && sameDay) return `Holding steady across ${runs.length} forecast runs.`;
  const lead = first.peakAt
    ? Math.round((Date.parse(first.peakAt) - Date.parse(`${first.runDate.slice(0, 10)}T12:00:00.000Z`)) / DAY_MS)
    : null;
  const seen = lead !== null && lead >= 0 ? `First seen ${lead} ${lead === 1 ? 'day' : 'days'} out` : 'First seen';
  const firstDay = peakDayName(first.peakAt, timezone);
  const lastDay = peakDayName(last.peakAt, timezone);
  return `${seen} at ${feet(first.faceHeightFt)}${firstDay ? ` ${firstDay}` : ''}; now ${feet(last.faceHeightFt)}${lastDay ? ` ${lastDay}` : ''}.`;
}

export function buildHistoryChart(
  runs: readonly HistoryRun[],
  opts: { width: number; timezone: string },
): HistoryChartGeometry | null {
  const sized = runs
    .filter((run): run is SizedRun => run.faceHeightFt !== null)
    .slice(-HISTORY_CHART_MAX_RUNS);
  if (sized.length === 0) return null;
  const { width, timezone } = opts;
  const count = sized.length;
  const columnWidth = (width - LABEL_COLUMN - 4) / count;
  const x = (index: number): number => LABEL_COLUMN + (index + 0.5) * columnWidth;
  const sizes = sized.map((run) => run.faceHeightFt);
  const low = Math.min(...sizes);
  const high = Math.max(...sizes);
  const span = Math.max(1, high - low);
  const middle = (high + low) / 2;
  const y = (value: number): number => SIZE_CENTER_Y - ((value - middle) / span) * SIZE_SPAN_PX;

  let previousDate: string | null = null;
  const columns: HistoryColumn[] = sized.map((run, index) => {
    const date = peakLocalDate(run.peakAt, timezone);
    const diff = date && previousDate ? dayDiff(previousDate, date) : 0;
    if (date) previousDate = date;
    const changed = index > 0 && diff !== 0;
    return {
      key: run.runDate,
      x: x(index),
      y: y(run.faceHeightFt),
      runLabel: formatSwellShortDate(run.runDate.slice(0, 10)) ?? run.runDate,
      isLatest: index === count - 1,
      sizeText: feet(run.faceHeightFt),
      peakDay: peakDayName(run.peakAt, timezone),
      peakChanged: changed,
      changedNote: changed ? `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'day' : 'days'} ${diff < 0 ? 'earlier' : 'later'}` : null,
    };
  });

  let stepPath = `M${(x(0) - columnWidth * 0.36).toFixed(1)} ${columns[0].y.toFixed(1)}`;
  for (let i = 0; i < count; i += 1) {
    const end = i < count - 1 ? (x(i) + x(i + 1)) / 2 : x(i) + columnWidth * 0.36;
    stepPath += `H${end.toFixed(1)}`;
    if (i < count - 1 && columns[i + 1].y !== columns[i].y) stepPath += `V${columns[i + 1].y.toFixed(1)}`;
  }

  const deltaChips: HistoryChartGeometry['deltaChips'] = [];
  for (let i = 1; i < count; i += 1) {
    const delta = sizes[i] - sizes[i - 1];
    if (Math.abs(delta) < MATERIAL_STEP_FT) continue;
    deltaChips.push({
      x: (x(i - 1) + x(i)) / 2 + 6,
      y: y((sizes[i] + sizes[i - 1]) / 2) - 2,
      text: `${delta > 0 ? '+' : '-'}${feet(Math.abs(delta))}`,
    });
  }

  const first = columns[0];
  const last = columns[count - 1];
  return {
    width,
    height: CHART_HEIGHT,
    labelColumn: LABEL_COLUMN,
    singleRun: count === 1,
    columns,
    stepPath,
    deltaChips,
    latestBand: { x: LABEL_COLUMN + (count - 1) * columnWidth + 2, width: columnWidth - 4 },
    caption: buildCaption(sized, timezone),
    accessibilityLabel: `Forecast runs from ${first.runLabel} to ${last.runLabel}. Size: ${sizes.map(spokenFeet).join(', ')}. Peak day: ${columns.map((c) => c.peakDay ?? 'unknown').join(', ')}.`,
  };
}
```
Check against the "lead" test: the first-seen test in `forecast-moved-section.test.tsx` uses runs on Oct 1 and Oct 4 with the same peak (Sat), sizes 3 and 4, so its caption is "First seen 9 days out at 3 ft Sat; now 4 ft Sat." (the size changed, so it is not "holding steady"); that test's regex accepts it.

`src/features/swell-outlook/forecast-moved-section.tsx`:
```tsx
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Body, Eyebrow } from '@/components/ui/typography';
import { Colors, Fonts } from '@/constants/theme';
import { buildHistoryChart, type HistoryChartGeometry, type HistoryRun } from './history-chart-geometry';

const DEFAULT_WIDTH = 326;

function Chart({ geometry }: { geometry: HistoryChartGeometry }): React.JSX.Element {
  const { width, height, labelColumn, columns } = geometry;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessibilityRole="image"
      accessibilityLabel={geometry.accessibilityLabel}
      testID="forecast-moved-chart"
    >
      <Rect
        x={geometry.latestBand.x}
        y={2}
        width={geometry.latestBand.width}
        height={height - 6}
        rx={10}
        fill={Colors.teal}
        fillOpacity={0.12}
        stroke={Colors.teal}
        strokeOpacity={0.55}
      />
      <SvgText x={6} y={22} fontSize={8.5} fontFamily={Fonts.monoBold} fill={Colors.textMuted}>RUN DATE</SvgText>
      {columns.map((column) => (
        <SvgText
          key={`head-${column.key}`}
          x={column.x}
          y={22}
          textAnchor="middle"
          fontSize={11}
          fontFamily={Fonts.monoBold}
          fill={column.isLatest ? Colors.teal : Colors.textMuted}
        >
          {column.runLabel}
        </SvgText>
      ))}
      <Line x1={6} x2={width - 6} y1={34} y2={34} stroke={Colors.cardBorder} />
      <SvgText x={6} y={92} fontSize={12} fontFamily={Fonts.uiMedium} fill={Colors.cream}>Size</SvgText>
      <SvgText x={6} y={156} fontSize={12} fontFamily={Fonts.uiMedium} fill={Colors.cream}>Peak day</SvgText>
      <Line x1={labelColumn} x2={width - 6} y1={122} y2={122} stroke={Colors.cardBorder} strokeDasharray="2 4" />
      <Path d={geometry.stepPath} fill="none" stroke={Colors.cream} strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" />
      {columns.map((column) => (
        <React.Fragment key={`dot-${column.key}`}>
          <Circle
            cx={column.x}
            cy={column.y}
            r={column.isLatest ? 5.5 : 4}
            fill={column.isLatest ? Colors.teal : Colors.card}
            stroke={Colors.cream}
            strokeWidth={1.8}
          />
          <SvgText
            x={column.x}
            y={column.y - 12}
            textAnchor="middle"
            fontSize={11.5}
            fontFamily={Fonts.monoBold}
            fill={column.isLatest ? Colors.white : Colors.cream}
          >
            {column.sizeText}
          </SvgText>
        </React.Fragment>
      ))}
      {geometry.deltaChips.map((chip) => (
        <React.Fragment key={`delta-${chip.x}`}>
          <Rect x={chip.x} y={chip.y - 11} width={38} height={17} rx={8.5} fill={Colors.teal} />
          <SvgText x={chip.x + 19} y={chip.y + 1} textAnchor="middle" fontSize={11} fontFamily={Fonts.monoBold} fill={Colors.ink}>
            {chip.text}
          </SvgText>
        </React.Fragment>
      ))}
      {columns.map((column) => (
        <React.Fragment key={`chip-${column.key}`}>
          <Rect
            x={column.x - 21}
            y={136}
            width={42}
            height={26}
            rx={13}
            fill={column.peakChanged ? Colors.teal : 'none'}
            stroke={column.peakChanged ? Colors.teal : Colors.textMuted}
            strokeOpacity={column.peakChanged ? 1 : 0.5}
          />
          <SvgText
            x={column.x}
            y={153.5}
            textAnchor="middle"
            fontSize={11.5}
            fontFamily={Fonts.monoBold}
            fill={column.peakChanged ? Colors.ink : Colors.text}
          >
            {column.peakDay ?? '--'}
          </SvgText>
          {column.changedNote ? (
            <SvgText x={column.x} y={178} textAnchor="middle" fontSize={9.5} fontFamily={Fonts.monoBold} fill={Colors.teal}>
              {column.changedNote}
            </SvgText>
          ) : null}
        </React.Fragment>
      ))}
    </Svg>
  );
}

export interface ForecastMovedSectionProps {
  runs: readonly HistoryRun[];
  timezone: string;
}

export function ForecastMovedSection({ runs, timezone }: ForecastMovedSectionProps): React.JSX.Element {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const geometry = useMemo(() => buildHistoryChart(runs, { width, timezone }), [runs, timezone, width]);

  function handleLayout(event: LayoutChangeEvent): void {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  }

  return (
    <View style={styles.section} testID="forecast-moved">
      <Eyebrow style={styles.eyebrow}>How the forecast moved</Eyebrow>
      {geometry ? (
        <View style={styles.card} onLayout={handleLayout}>
          <Chart geometry={geometry} />
        </View>
      ) : null}
      <Body style={styles.caption} testID="forecast-moved-caption">
        {geometry ? geometry.caption : 'No forecast runs recorded yet.'}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  eyebrow: { color: Colors.textMuted },
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 8,
    paddingHorizontal: 6,
    paddingTop: 10,
  },
  caption: { color: Colors.textMuted },
});
```
Append to `index.ts`:
```ts
export { buildHistoryChart, HISTORY_CHART_MAX_RUNS } from './history-chart-geometry';
export type { HistoryChartGeometry, HistoryColumn, HistoryRun } from './history-chart-geometry';
export { ForecastMovedSection } from './forecast-moved-section';
```
In the "no usable size" test the section text is `Body` (React Native `Text`), so `getByText` finds it; chart text itself is SVG text and is asserted through the Svg's accessibility label instead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/history-chart-geometry.test.ts src/features/swell-outlook/__tests__/forecast-moved-section.test.tsx && npm run typecheck`
Expected: PASS (10 geometry tests, 3 section tests).

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook
git commit -m "feat(swell-outlook): add How the forecast moved chart with single-run state"
```

### Task 12: Map hero: DetailMap props, scrub model and SwellMapHero
**Files:** Modify `src/features/beach-forecast/detail-map.tsx` (interface at line 19, signature at line 47, effect after line 89, message handler at lines 119-123) and `src/features/beach-forecast/detail-map.test.tsx` (append two tests); Create `src/features/swell-outlook/scrub-model.ts`, `swell-map-hero.tsx`; Modify `src/features/swell-outlook/index.ts`; Test `src/features/swell-outlook/__tests__/scrub-model.test.ts`, `__tests__/swell-map-hero.test.tsx`.
**Interfaces:** Consumes: `DetailMap` props `{ lat; lon; forecastAt: string | null; layer: WebViewMapLayerId; zoom?; interactive?; surface?; timelineStart?; ... }` (`detail-map.tsx:19`), the bridge commands `setForecastTime { index; forecastAt?; smooth? }` and `setForecastPlaying { playing }` (`src/types/webview-map.ts:38,47`), `SwellFieldTimeSlider` (`src/components/forecast/swell-field-time-slider.tsx`, props `testID; timeLabel; forecastCount; forecastIndex; onNextForecast; onForecastIndexChange?; onForecastAction; variant?; onScrubStart?`), `haptics.selection()`, `formatOutlookSize` (Task 3). Produces: `DetailMap` additive props `playing?: boolean` and `onForecastTimeChange?: (forecastAt: string) => void`; from `scrub-model.ts`: `SCRUB_STEP_MS`, `interface ScrubDay`, `interface ScrubModel`, `buildScrubModel(input: { peakAt: string; now: Date; timezone: string }): ScrubModel`, `interface ScrubState`, `type ScrubAction`, `initialScrubState(model): ScrubState`, `reduceScrub(model, state, action): ScrubState`, `outlookStageLabel(hoursToPeak: number): string`, `scrubTimeLabel(ms: number, timezone: string): string`, `outlookMapLayer(swell: OutlookSwell): WebViewMapLayerId`, `findOutlookSwell(outlook: SwellOutlookResponse | null, eventKey: string): OutlookSwell | null`; `SwellMapHero` (props `{ lat; lon; peakAt; layer; timezone; sizeRange: OutlookSizeRange | null; directionLabel: string; directionDeg: number | null; periodS: number | null; sourceLine: string | null; now?: Date }`).

How a screen hosts the map (verified): `DetailMap` renders `SharedMapWebView`, which only registers with the app map host when a `MapSlotContext` exists (`shared-map-webview.tsx:11`); `AddSpotSheet` and `swell-direction-selector` use `DetailMap` with no `MapHostSurface`/`MapHostViewport`, which falls back to an inline `MapTransportWebView`. SwellLanding does the same: no host registration, so it does not need `MapHostViewport` (mounted only in Home today). One map on screen at a time holds because Home's map surface deactivates when Home is not focused (`beach-hero.tsx:1460` gates `active` on `isFocused`) and `DetailMap` itself sets `setActive` from `useIsFocused`.

Two traps handled here: (1) `DetailMap` remounts when its `timelineStart` changes (`detail-map.tsx:41` keys the instance on it), so the hero passes a constant `timelineStart` (the scrub window start) instead of letting it derive from `forecastAt`; (2) while the embed plays itself, re-sending `setForecastTime` for every reported frame would fight it, so the committed `forecastAt` prop freezes during playback and only the displayed slider position follows the embed's `forecastTimeChanged` reports.

Spec notes: (a) `OutlookSwell` has no partition field, so `outlookMapLayer` returns `'s1'` for every swell today (the primary partition); it is one function so a future contract field changes one line. (b) The scrubber reuses `SwellFieldTimeSlider` (continuous touch scrub, 3-hour steps, accessible increment/decrement) plus day tick buttons, instead of the mockup's HTML range input. (c) The mockup's per-day size at the beach is an illustration with no data behind it, so the stage label ("Far offshore", "Approaching", "Close", "Arriving, peak", "Easing") is derived from hours to the peak, and a size is written only within 12 hours of the peak, from the contract's own range.

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/scrub-model.test.ts`:
```ts
import { makeOutlook, makeSwell } from '../__fixtures__/make-swell';
import {
  buildScrubModel,
  findOutlookSwell,
  initialScrubState,
  outlookMapLayer,
  outlookStageLabel,
  reduceScrub,
  scrubTimeLabel,
} from '../scrub-model';

const TZ = 'America/Los_Angeles';
const HOUR = 3_600_000;
const PEAK = '2026-10-09T19:00:00.000Z';
const NOW = new Date('2026-10-04T16:00:00.000Z');

describe('buildScrubModel', () => {
  it('spans three days before the peak to one day after, on a 3-hour grid that contains the peak', () => {
    const model = buildScrubModel({ peakAt: PEAK, now: NOW, timezone: TZ });
    expect(model.startMs).toBe(Date.parse(PEAK) - 72 * HOUR);
    expect(model.endMs).toBe(Date.parse(PEAK) + 24 * HOUR);
    expect(model.count).toBe(33);
    expect(model.peakIndex).toBe(24);
    expect(model.instantAt(model.peakIndex)).toBe(Date.parse(PEAK));
    expect(model.timelineStartIso).toBe('2026-10-06T19:00:00.000Z');
    expect(model.days.map((d) => [d.label, d.date, d.index])).toEqual([
      ['Tue', '6', 0], ['Wed', '7', 8], ['Thu', '8', 16], ['Fri', '9', 24], ['Sat', '10', 32],
    ]);
  });

  it('starts at the current hour when the peak is close, dropping days already behind us', () => {
    const model = buildScrubModel({ peakAt: '2026-10-05T19:00:00.000Z', now: NOW, timezone: TZ });
    expect(model.startMs).toBe(Date.parse('2026-10-04T16:00:00.000Z'));
    expect(model.peakIndex).toBe(9);
    expect(model.days.map((d) => d.label)).toEqual(['Sun', 'Mon', 'Tue']);
  });

  it('starts at the peak when it has already passed', () => {
    const model = buildScrubModel({ peakAt: '2026-10-03T19:00:00.000Z', now: NOW, timezone: TZ });
    expect(model.peakIndex).toBe(0);
    expect(model.days.map((d) => d.label)).toEqual(['Sat', 'Sun']);
  });

  it('clamps indices and instants to the window', () => {
    const model = buildScrubModel({ peakAt: PEAK, now: NOW, timezone: TZ });
    expect(model.instantAt(-5)).toBe(model.startMs);
    expect(model.instantAt(999)).toBe(model.endMs);
    expect(model.indexForInstant(model.startMs - 10 * HOUR)).toBe(0);
    expect(model.indexForInstant(model.endMs + 10 * HOUR)).toBe(32);
    expect(model.indexForInstant(Date.parse(PEAK) + HOUR)).toBe(24);
  });
});

describe('reduceScrub', () => {
  const model = buildScrubModel({ peakAt: PEAK, now: NOW, timezone: TZ });
  const start = initialScrubState(model);

  it('starts paused on the peak', () => {
    expect(start).toEqual({ index: 24, liveIndex: 24, playing: false });
  });

  it('a scrub commits the index and stops playback', () => {
    const playing = reduceScrub(model, start, { type: 'play' });
    expect(reduceScrub(model, playing, { type: 'scrub', index: 8 })).toEqual({ index: 8, liveIndex: 8, playing: false });
    expect(reduceScrub(model, start, { type: 'scrub', index: 99 }).index).toBe(32);
  });

  it('play commits the current spot so the map is told where to start, and restarts from the beginning at the end', () => {
    expect(reduceScrub(model, start, { type: 'play' })).toEqual({ index: 24, liveIndex: 24, playing: true });
    const atEnd = { index: 32, liveIndex: 32, playing: false };
    expect(reduceScrub(model, atEnd, { type: 'play' })).toEqual({ index: 0, liveIndex: 0, playing: true });
  });

  it('ticks move only the live position while playing, so the committed map time stays frozen', () => {
    const playing = reduceScrub(model, start, { type: 'play' });
    const ticked = reduceScrub(model, playing, { type: 'tick', ms: Date.parse(PEAK) + 6 * HOUR });
    expect(ticked).toEqual({ index: 24, liveIndex: 26, playing: true });
    expect(reduceScrub(model, start, { type: 'tick', ms: Date.parse(PEAK) + 6 * HOUR })).toBe(start);
  });

  it('stops at the end of the window and commits the last frame', () => {
    const playing = reduceScrub(model, start, { type: 'play' });
    expect(reduceScrub(model, playing, { type: 'tick', ms: model.endMs })).toEqual({ index: 32, liveIndex: 32, playing: false });
  });

  it('pause commits wherever playback had reached', () => {
    const playing = reduceScrub(model, start, { type: 'play' });
    const ticked = reduceScrub(model, playing, { type: 'tick', ms: Date.parse(PEAK) + 9 * HOUR });
    expect(reduceScrub(model, ticked, { type: 'pause' })).toEqual({ index: 27, liveIndex: 27, playing: false });
  });
});

describe('labels and lookups', () => {
  it.each([[60, 'Far offshore'], [40, 'Approaching'], [20, 'Close'], [0, 'Arriving, peak'], [-11, 'Arriving, peak'], [-20, 'Easing']])(
    '%d hours to the peak reads "%s"',
    (hours, label) => expect(outlookStageLabel(hours)).toBe(label),
  );

  it('writes the scrub time in the given zone', () => {
    expect(scrubTimeLabel(Date.parse('2026-10-09T19:00:00.000Z'), TZ)).toBe('Fri 12pm');
    expect(scrubTimeLabel(Date.parse('2026-10-10T02:00:00.000Z'), TZ)).toBe('Fri 7pm');
    expect(scrubTimeLabel(Date.parse('2026-10-10T07:00:00.000Z'), TZ)).toBe('Sat 12am');
  });

  it('maps every swell to the primary partition layer for now', () => {
    expect(outlookMapLayer(makeSwell())).toBe('s1');
  });

  it('finds a swell by its event key and is null-safe', () => {
    const outlook = makeOutlook({ swells: [makeSwell({ eventKey: 'k1' }), makeSwell({ id: '2', eventKey: 'k2' })] });
    expect(findOutlookSwell(outlook, 'k2')?.id).toBe('2');
    expect(findOutlookSwell(outlook, 'nope')).toBeNull();
    expect(findOutlookSwell(null, 'k1')).toBeNull();
  });
});
```

`src/features/swell-outlook/__tests__/swell-map-hero.test.tsx`:
```tsx
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SwellMapHero } from '../swell-map-hero';

const mockDetailMap = jest.fn();
jest.mock('@/features/beach-forecast/detail-map', () => ({
  DetailMap: (props: Record<string, unknown>) => {
    mockDetailMap(props);
    return null;
  },
}));
jest.mock('@/lib/haptics', () => ({ haptics: { selection: jest.fn(async () => undefined), light: jest.fn(async () => undefined) } }));

const PEAK = '2026-10-09T19:00:00.000Z';
const NOW = new Date('2026-10-04T16:00:00.000Z');
const base = {
  lat: 33.66,
  lon: -118,
  peakAt: PEAK,
  layer: 's1' as const,
  timezone: 'America/Los_Angeles',
  sizeRange: { min: 7, max: 9 },
  directionLabel: 'S',
  directionDeg: 190,
  periodS: 17,
  sourceLine: 'From Hurricane Rachel',
  now: NOW,
};
const lastProps = (): Record<string, any> => mockDetailMap.mock.lastCall![0];

describe('SwellMapHero', () => {
  beforeEach(() => mockDetailMap.mockClear());

  it('hosts the embed on the swell layer at the peak, with a constant timeline start and no touch handling', () => {
    render(<SwellMapHero {...base} />);
    expect(lastProps()).toMatchObject({
      lat: 33.66, lon: -118, layer: 's1', zoom: 7, interactive: false, surface: 'SwellLanding',
      forecastAt: PEAK, timelineStart: '2026-10-06T19:00:00.000Z', playing: false,
    });
    expect(screen.getByText('Arriving, peak')).toBeTruthy();
    expect(screen.getByText('At your beach 7–9 ft')).toBeTruthy();
    expect(screen.getByText('S swell · from 190°')).toBeTruthy();
    expect(screen.getByText('17 s · From Hurricane Rachel')).toBeTruthy();
  });

  it('moves the map time to a tapped day and keeps the timeline start unchanged (no remount)', () => {
    render(<SwellMapHero {...base} />);
    const startBefore = lastProps().timelineStart;
    fireEvent.press(screen.getByTestId('swell-map-hero-day-0'));
    expect(lastProps().forecastAt).toBe('2026-10-06T19:00:00.000Z');
    expect(lastProps().timelineStart).toBe(startBefore);
    expect(screen.getByText('Far offshore')).toBeTruthy();
    expect(screen.queryByText(/At your beach/)).toBeNull();
  });

  it('plays through the embed: freezes the committed time, follows reports, and stops at the end', () => {
    render(<SwellMapHero {...base} />);
    fireEvent.press(screen.getByTestId('swell-map-hero-play'));
    expect(lastProps().playing).toBe(true);
    expect(screen.getByLabelText('Pause')).toBeTruthy();

    act(() => lastProps().onForecastTimeChange('2026-10-10T07:00:00.000Z'));
    expect(lastProps().forecastAt).toBe(PEAK);
    expect(screen.getByText('Sat 12am')).toBeTruthy();

    act(() => lastProps().onForecastTimeChange('2026-10-10T19:00:00.000Z'));
    expect(lastProps().playing).toBe(false);
    expect(lastProps().forecastAt).toBe('2026-10-10T19:00:00.000Z');
    expect(screen.getByLabelText('Play through the days')).toBeTruthy();
  });

  it('a day tap while playing stops playback', () => {
    render(<SwellMapHero {...base} />);
    fireEvent.press(screen.getByTestId('swell-map-hero-play'));
    fireEvent.press(screen.getByTestId('swell-map-hero-day-8'));
    expect(lastProps().playing).toBe(false);
    expect(lastProps().forecastAt).toBe('2026-10-07T19:00:00.000Z');
  });

  it('omits the size, direction degrees and source lines when the contract has none', () => {
    render(<SwellMapHero {...base} sizeRange={null} directionDeg={null} periodS={null} sourceLine={null} />);
    expect(screen.queryByText(/At your beach/)).toBeNull();
    expect(screen.getByText('S swell')).toBeTruthy();
  });
});
```

Append to `src/features/beach-forecast/detail-map.test.tsx` (it already defines `mockPostMessage`, `emit`, `commands`, `at`):
```tsx
it('sends setForecastPlaying for a playing prop after ready and reports embed time changes', async () => {
  const onForecastTimeChange = jest.fn();
  render(<DetailMap lat={21} lon={-157} forecastAt={at} layer="s1" interactive={false} playing onForecastTimeChange={onForecastTimeChange} />);
  await act(async () => emit('ready', { viewport: { center: { lat: 21, lon: -157 } } }));
  expect(commands().filter((command) => command.type === 'setForecastPlaying').at(-1)).toEqual({
    type: 'setForecastPlaying',
    payload: { playing: true },
  });
  emit('forecastTimeChanged', { index: 2, forecastAt: at });
  expect(onForecastTimeChange).toHaveBeenCalledWith(at);
});

it('keeps the single setForecastPlaying(false) of existing callers when no playing prop is given', async () => {
  render(<DetailMap lat={21} lon={-157} forecastAt={at} layer="s1" interactive={false} />);
  await act(async () => emit('ready', { viewport: { center: { lat: 21, lon: -157 } } }));
  expect(commands().filter((command) => command.type === 'setForecastPlaying')).toEqual([
    { type: 'setForecastPlaying', payload: { playing: false } },
  ]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/scrub-model.test.ts src/features/swell-outlook/__tests__/swell-map-hero.test.tsx src/features/beach-forecast/detail-map.test.tsx`
Expected: FAIL with `Cannot find module '../scrub-model'`, `'../swell-map-hero'`, and the first new DetailMap test failing (no `setForecastPlaying` true, `onForecastTimeChange` never called).

- [ ] **Step 3: Write the minimal implementation**

`src/features/beach-forecast/detail-map.tsx` (four small additive edits; line numbers from `origin/main`):
1. Line 19, interface `Props`: change `stage?: 'dark'; chromeTop?: number }` to
```ts
stage?: 'dark'; chromeTop?: number; playing?: boolean; onForecastTimeChange?: (forecastAt: string) => void }
```
2. Line 47, signature: change `onReady, stage, chromeTop }: Props): React.ReactElement {` to
```ts
onReady, stage, chromeTop, playing, onForecastTimeChange }: Props): React.ReactElement {
```
3. Directly after the `setLayer` effect (lines 86-89, ending `}, [readyGeneration, layer, send]);`) add
```ts
  useEffect(() => {
    if (readyGeneration && playing !== undefined) send({ type: 'setForecastPlaying', payload: { playing } });
  }, [readyGeneration, playing, send]);
```
(It is declared after the ready effect that sends `playing: false`, so a `playing` prop wins on first ready; callers that omit it are unchanged.)
4. In `onMessage`, inside `if (message?.type === 'forecastTimeChanged') {`, change
```ts
      if (at) {
        setUnavailableAt(null);
```
to
```ts
      if (at) {
        onForecastTimeChange?.(at);
        setUnavailableAt(null);
```

`src/features/swell-outlook/scrub-model.ts`:
```ts
import { formatForecastWeekdayInZone, getForecastDateParts, getForecastZoneParts } from '@/lib/forecast-time-formatting';
import type { WebViewMapLayerId } from '@/types/webview-map';
import type { OutlookSwell, SwellOutlookResponse } from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const SCRUB_STEP_MS = 3 * HOUR_MS;
const LEAD_DAYS = 3;
const TAIL_DAYS = 1;

export interface ScrubDay {
  label: string;
  date: string;
  index: number;
}

export interface ScrubModel {
  startMs: number;
  endMs: number;
  count: number;
  peakIndex: number;
  days: ScrubDay[];
  timelineStartIso: string;
  instantAt: (index: number) => number;
  indexForInstant: (ms: number) => number;
}

function titleCase(upper: string): string {
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

/**
 * Three days before the peak to one day after, on a 3-hour grid anchored on
 * the peak so the peak is always an exact stop and day ticks (peak +/- n days)
 * land on the same clock time.
 */
export function buildScrubModel(input: { peakAt: string; now: Date; timezone: string }): ScrubModel {
  const peak = Date.parse(input.peakAt);
  const floorHour = Math.floor(input.now.getTime() / HOUR_MS) * HOUR_MS;
  const low = Math.min(Math.max(floorHour, peak - LEAD_DAYS * DAY_MS), peak);
  const stepsBeforePeak = Math.ceil((peak - low) / SCRUB_STEP_MS);
  const startMs = peak - stepsBeforePeak * SCRUB_STEP_MS;
  const endMs = peak + TAIL_DAYS * DAY_MS;
  const count = (endMs - startMs) / SCRUB_STEP_MS + 1;
  const clamp = (index: number): number => Math.min(count - 1, Math.max(0, Math.round(index)));
  const days: ScrubDay[] = [];
  for (let offset = -LEAD_DAYS; offset <= TAIL_DAYS; offset += 1) {
    const instant = peak + offset * DAY_MS;
    if (instant < startMs || instant > endMs) continue;
    const date = new Date(instant);
    days.push({
      label: titleCase(formatForecastWeekdayInZone(date, input.timezone)),
      date: String(getForecastDateParts(date, input.timezone).day),
      index: (instant - startMs) / SCRUB_STEP_MS,
    });
  }
  return {
    startMs,
    endMs,
    count,
    peakIndex: stepsBeforePeak,
    days,
    timelineStartIso: new Date(startMs).toISOString(),
    instantAt: (index) => startMs + clamp(index) * SCRUB_STEP_MS,
    indexForInstant: (ms) => clamp((ms - startMs) / SCRUB_STEP_MS),
  };
}

export interface ScrubState {
  /** The committed map time: what the embed was last told with `setForecastTime`. */
  index: number;
  /** Where the slider shows playback to be; only differs from `index` while playing. */
  liveIndex: number;
  playing: boolean;
}

export type ScrubAction =
  | { type: 'scrub'; index: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'tick'; ms: number };

export function initialScrubState(model: ScrubModel): ScrubState {
  return { index: model.peakIndex, liveIndex: model.peakIndex, playing: false };
}

export function reduceScrub(model: ScrubModel, state: ScrubState, action: ScrubAction): ScrubState {
  switch (action.type) {
    case 'scrub': {
      const index = Math.min(model.count - 1, Math.max(0, Math.round(action.index)));
      return { index, liveIndex: index, playing: false };
    }
    case 'play': {
      const start = state.liveIndex >= model.count - 1 ? 0 : state.liveIndex;
      return { index: start, liveIndex: start, playing: true };
    }
    case 'pause':
      return { index: state.liveIndex, liveIndex: state.liveIndex, playing: false };
    case 'tick': {
      if (!state.playing) return state;
      if (action.ms >= model.endMs) {
        const last = model.count - 1;
        return { index: last, liveIndex: last, playing: false };
      }
      return { ...state, liveIndex: model.indexForInstant(action.ms) };
    }
    default:
      return state;
  }
}

export function outlookStageLabel(hoursToPeak: number): string {
  if (hoursToPeak > 53) return 'Far offshore';
  if (hoursToPeak > 29) return 'Approaching';
  if (hoursToPeak > 11) return 'Close';
  if (hoursToPeak >= -11) return 'Arriving, peak';
  return 'Easing';
}

export function scrubTimeLabel(ms: number, timezone: string): string {
  const date = new Date(ms);
  const { hour } = getForecastZoneParts(date, timezone);
  const clock = `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'am' : 'pm'}`;
  return `${titleCase(formatForecastWeekdayInZone(date, timezone))} ${clock}`;
}

/** The contract carries no partition, so every swell shows the primary swell layer until it does. */
export function outlookMapLayer(_swell: OutlookSwell): WebViewMapLayerId {
  return 's1';
}

export function findOutlookSwell(outlook: SwellOutlookResponse | null, eventKey: string): OutlookSwell | null {
  return outlook?.swells.find((swell) => swell.eventKey === eventKey) ?? null;
}
```

`src/features/swell-outlook/swell-map-hero.tsx`:
```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useReducer, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SwellFieldTimeSlider } from '@/components/forecast/swell-field-time-slider';
import { Data, Label, UIText } from '@/components/ui/typography';
import { Colors, Fonts } from '@/constants/theme';
import { DetailMap } from '@/features/beach-forecast/detail-map';
import { haptics } from '@/lib/haptics';
import type { WebViewMapLayerId } from '@/types/webview-map';
import { formatOutlookSize } from './outlook-format';
import {
  buildScrubModel,
  initialScrubState,
  outlookStageLabel,
  reduceScrub,
  scrubTimeLabel,
  type ScrubAction,
  type ScrubState,
} from './scrub-model';
import type { OutlookSizeRange } from './types';

const MAP_HEIGHT = 300;
const MAP_ZOOM = 7;
const SIZE_WINDOW_HOURS = 12;
const HOUR_MS = 3_600_000;

export interface SwellMapHeroProps {
  lat: number;
  lon: number;
  peakAt: string;
  layer: WebViewMapLayerId;
  timezone: string;
  sizeRange: OutlookSizeRange | null;
  directionLabel: string;
  directionDeg: number | null;
  periodS: number | null;
  sourceLine: string | null;
  now?: Date;
}

export function SwellMapHero(props: SwellMapHeroProps): React.JSX.Element {
  const { lat, lon, peakAt, layer, timezone, sizeRange, directionLabel, directionDeg, periodS, sourceLine } = props;
  const [now] = useState(() => props.now ?? new Date());
  const model = useMemo(() => buildScrubModel({ peakAt, now, timezone }), [peakAt, now, timezone]);
  const [state, dispatch] = useReducer(
    (current: ScrubState, action: ScrubAction) => reduceScrub(model, current, action),
    model,
    initialScrubState,
  );
  const displayIndex = state.playing ? state.liveIndex : state.index;
  const displayMs = model.instantAt(displayIndex);
  const forecastAt = useMemo(() => new Date(model.instantAt(state.index)).toISOString(), [model, state.index]);
  const hoursToPeak = (Date.parse(peakAt) - displayMs) / HOUR_MS;
  const showSize = sizeRange !== null && Math.abs(hoursToPeak) <= SIZE_WINDOW_HOURS;

  const handleForecastTime = useCallback((at: string): void => dispatch({ type: 'tick', ms: Date.parse(at) }), []);
  const handleScrub = useCallback((index: number): void => dispatch({ type: 'scrub', index }), []);

  function handlePlayToggle(): void {
    void haptics.selection();
    dispatch({ type: state.playing ? 'pause' : 'play' });
  }

  function handleSliderAction(event: { nativeEvent: { actionName: string } }): void {
    if (event.nativeEvent.actionName === 'increment') handleScrub(displayIndex + 1);
    if (event.nativeEvent.actionName === 'decrement') handleScrub(displayIndex - 1);
  }

  const chipLine = [periodS !== null ? `${Math.round(periodS)} s` : null, sourceLine].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap} testID="swell-map-hero">
      <View style={styles.mapFrame}>
        <DetailMap
          lat={lat}
          lon={lon}
          forecastAt={forecastAt}
          layer={layer}
          zoom={MAP_ZOOM}
          interactive={false}
          surface="SwellLanding"
          timelineStart={model.timelineStartIso}
          playing={state.playing}
          onForecastTimeChange={handleForecastTime}
        />
        <View style={styles.chip} pointerEvents="none">
          <Label style={styles.chipTitle} numberOfLines={1}>
            {`${directionLabel} swell${directionDeg !== null ? ` · from ${Math.round(directionDeg)}°` : ''}`}
          </Label>
          {chipLine ? <Data style={styles.chipLine} numberOfLines={1}>{chipLine}</Data> : null}
        </View>
        <Pressable
          onPress={handlePlayToggle}
          accessibilityRole="button"
          accessibilityLabel={state.playing ? 'Pause' : 'Play through the days'}
          hitSlop={4}
          style={styles.play}
          testID="swell-map-hero-play"
        >
          <Ionicons name={state.playing ? 'pause' : 'play'} size={18} color={Colors.cream} />
        </Pressable>
      </View>

      <View style={styles.stageRow}>
        <UIText style={styles.stage}>{outlookStageLabel(hoursToPeak)}</UIText>
        {showSize && sizeRange ? <Data style={styles.atBeach}>{`At your beach ${formatOutlookSize(sizeRange)}`}</Data> : null}
      </View>

      <SwellFieldTimeSlider
        testID="swell-map-hero-slider"
        variant="map"
        timeLabel={scrubTimeLabel(displayMs, timezone)}
        forecastCount={model.count}
        forecastIndex={displayIndex}
        onNextForecast={() => handleScrub(displayIndex + 1)}
        onForecastIndexChange={handleScrub}
        onForecastAction={handleSliderAction}
        onScrubStart={() => dispatch({ type: 'pause' })}
      />

      <View style={styles.ticks}>
        {model.days.map((day) => {
          const selected = Math.abs(displayIndex - day.index) < 4;
          return (
            <Pressable
              key={day.index}
              onPress={() => handleScrub(day.index)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${day.label} ${day.date}`}
              accessibilityState={{ selected }}
              style={styles.tick}
              testID={`swell-map-hero-day-${day.index}`}
            >
              <UIText style={[styles.tickLabel, selected && styles.tickSelected]}>{day.label}</UIText>
              <Data style={[styles.tickDate, selected && styles.tickDateSelected]}>{day.date}</Data>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  mapFrame: {
    backgroundColor: Colors.background,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    height: MAP_HEIGHT,
    overflow: 'hidden',
  },
  chip: {
    backgroundColor: Colors.paper,
    borderColor: Colors.ink,
    borderRadius: 12,
    borderWidth: 1,
    left: 10,
    maxWidth: '70%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 10,
  },
  chipTitle: { color: Colors.ink },
  chipLine: { color: Colors.inkMuted, fontSize: 12 },
  play: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlpha70,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
  },
  stageRow: { alignItems: 'baseline', columnGap: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stage: { color: Colors.cream, fontFamily: Fonts.displayBold, fontSize: 20 },
  atBeach: { color: Colors.teal },
  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { alignItems: 'center', flex: 1, minHeight: 44, justifyContent: 'center' },
  tickLabel: { color: Colors.textMuted, fontSize: 12 },
  tickSelected: { color: Colors.cream },
  tickDate: { color: Colors.textMuted, fontSize: 11 },
  tickDateSelected: { color: Colors.teal },
});
```
Append to `index.ts`:
```ts
export * from './scrub-model';
export { SwellMapHero } from './swell-map-hero';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-outlook/__tests__/scrub-model.test.ts src/features/swell-outlook/__tests__/swell-map-hero.test.tsx src/features/beach-forecast && npm run typecheck`
Expected: PASS (scrub model 17 tests, hero 5 tests, the whole `beach-forecast` folder including the two new DetailMap tests and every existing one). The test "a day tap" uses index 8 because the tick for Wed sits eight 3-hour steps after Tue.

- [ ] **Step 5: Commit**
```bash
git add src/features/swell-outlook src/features/beach-forecast/detail-map.tsx src/features/beach-forecast/detail-map.test.tsx
git commit -m "feat(swell-outlook): add map hero with day scrubber, playback and DetailMap play props"
```

### Task 13: Swell detail integration (hero, tier track, chart) and push back to the outlook
**Files:** Create `src/features/swell-outlook/tier-track.tsx`; Modify `src/features/swell-outlook/index.ts`, `src/features/swell-landing/swell-landing-screen.tsx` (imports after line 32; derived values after line 100; `handleBack` block at 158-164; `showDetail` at 232; hero insertion after the header `View` ending at 247; history block condition at 294; new sections before `<CtaButton` at 313; styles before `below:` at 351), `src/features/swell-landing/__tests__/swell-landing-screen.test.tsx` (two mock lines); Test `src/features/swell-outlook/__tests__/tier-track.test.tsx`, `src/features/swell-landing/__tests__/swell-landing-outlook.test.tsx`.
**Interfaces:** Consumes: `useSwellOutlook`, `findOutlookSwell`, `outlookMapLayer`, `outlookOrientationLine`, `outlookSourceLine`, `SwellMapHero`, `ForecastMovedSection`, `HistoryRun`, `outlookTierLabel` (Tasks 2, 3, 11, 12), `useBeachCoordinates(beachIds: readonly string[])` (`src/hooks/use-beach-coordinates.ts`, returns `{ data?: Record<string, { lat; lon }> }`), `getDeviceTimezone()`, the existing `SwellLandingScreen` values `event`, `params`, `eventKey`, `keyParts`, `beachRef`, `changeLine`, `unknownSwell`, `loadingSwell`, `styles.panel`. Produces: `TierTrack` (props `{ tier: OutlookTier }`, `testID="tier-track"`); in the screen, the gated branch below.

Behaviour (gated by `outlookEnabled = useSwellOutlook().data !== null`):
- Not enabled: the screen is exactly today's (run table, trend line, "Since we last told you"), so existing tests stay green once the hook is mocked to `{ data: null }`.
- Enabled: map hero above the card (only when the beach has coordinates and a peak time is known), the existing card and share action unchanged, "Since we last told you" kept, the run table and trend line replaced by the tier track and the "How the forecast moved" chart (history from the event record when it has runs, else the outlook swell's own history), plus a one-line "South-facing / West-facing" size line when the contract has either side.
- A swell push (`entrySource === 'push'`) with the outlook enabled sends the back action (header button, iOS swipe, Android back) to the Swell Outlook via a `beforeRemove` listener and `navigation.replace('SwellOutlook')`; opens from the outlook list (`entrySource: 'outlook'`), links, and non-enabled users go back normally. No change is needed in `src/lib/push-notifications.ts`: `swell_watch` already routes to `SwellLanding` (`push-notifications.ts:867-885`).

- [ ] **Step 1: Write the failing test**

`src/features/swell-outlook/__tests__/tier-track.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TierTrack } from '../tier-track';

describe('TierTrack', () => {
  it.each([
    ['locked', 'Confidence: Locked. Timing and size are firm.'],
    ['likely', 'Confidence: Likely. It locks in closer to arrival.'],
    ['on_the_radar', 'Confidence: On the radar. This far out a swell often changes or fades.'],
    ['early_signal', 'Confidence: Early signal. Expected to change.'],
  ] as const)('reads the %s tier for screen readers', (tier, label) => {
    render(<TierTrack tier={tier} />);
    expect(screen.getByTestId('tier-track').props.accessibilityLabel).toBe(label);
  });

  it('shows the three stops and the one-line meaning of the current tier', () => {
    render(<TierTrack tier="likely" />);
    expect(screen.getByText('On the radar')).toBeTruthy();
    expect(screen.getByText('Likely')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Likely now. It locks in closer to arrival.')).toBeTruthy();
  });
});
```

`src/features/swell-landing/__tests__/swell-landing-outlook.test.tsx`:
```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { makeOutlook, makeSwell } from '@/features/swell-outlook/__fixtures__/make-swell';
import type { SwellOutlookResponse } from '@/features/swell-outlook/types';
import { apiGet } from '@/lib/api-client';
import type { SwellLandingRouteParams } from '../types';
import { SwellLandingScreen } from '../swell-landing-screen';

type RemoveEvent = { preventDefault: () => void; data: { action: { type: string } } };
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockDetailMap = jest.fn();
let mockBeforeRemove: ((event: RemoveEvent) => void) | null = null;
let mockParams: SwellLandingRouteParams;
let mockOutlook: SwellOutlookResponse | null = null;
let mockCoordinates: Record<string, { lat: number; lon: number }> = {};

jest.mock('react-native-safe-area-context', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: (props: object) => ReactLib.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    canGoBack: () => true,
    addListener: (name: string, handler: (event: RemoveEvent) => void) => {
      if (name === 'beforeRemove') mockBeforeRemove = handler;
      return jest.fn();
    },
  }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/lib/api-client', () => ({ apiGet: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn(), recordNativeError: jest.fn() }));
jest.mock('@/lib/alert-attribution', () => ({ trackAlertAttribution: jest.fn() }));
jest.mock('@/lib/haptics', () => ({
  haptics: {
    light: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
    selection: jest.fn(async () => undefined),
  },
}));
jest.mock('@/lib/share/share-utils', () => ({ fetchShareCardImage: jest.fn() }));
jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({ useSwellOutlook: () => ({ data: mockOutlook }) }));
jest.mock('@/hooks/use-beach-coordinates', () => ({ useBeachCoordinates: () => ({ data: mockCoordinates }) }));
jest.mock('@/features/beach-forecast/detail-map', () => ({
  DetailMap: (props: Record<string, unknown>) => {
    mockDetailMap(props);
    return null;
  },
}));

const EVENT_KEY = 'beach-hb:S:2026-10-09';
const swell = makeSwell({
  id: 'c',
  eventKey: EVENT_KEY,
  tier: 'on_the_radar',
  peakAt: '2026-10-09T18:00:00.000Z',
  faceHeightFt: { min: 7, max: 9 },
  periodS: 17,
  directionDeg: 190,
  directionLabel: 'S',
  source: 'tropical',
  stormName: 'Hurricane Rachel',
  sizeByOrientation: { southFacing: { min: 7, max: 9 }, westFacing: null },
  history: [{ runDate: '2026-10-04', peakAt: '2026-10-09T18:00:00.000Z', faceHeightFt: 8, periodS: 17 }],
});
const eventBody = {
  eventKey: EVENT_KEY,
  beach: { id: 'beach-hb', name: 'Huntington Beach', slug: 'huntington-beach' },
  status: 'forecast',
  faceHeightFt: 8,
  periodS: 17,
  directionLabel: 'S',
  peakAt: '2026-10-09T18:00:00.000Z',
  peakLocalDate: '2026-10-09',
  history: [
    { runDate: '2026-10-02', peakAt: '2026-10-10T18:00:00.000Z', faceHeightFt: 6, periodS: 16 },
    { runDate: '2026-10-03', peakAt: '2026-10-09T18:00:00.000Z', faceHeightFt: 7, periodS: 17 },
    { runDate: '2026-10-04', peakAt: '2026-10-09T18:00:00.000Z', faceHeightFt: 8, periodS: 17 },
  ],
  card: null,
};
const outlookParams: SwellLandingRouteParams = {
  eventKey: EVENT_KEY,
  kind: 'coming',
  beachId: 'beach-hb',
  beachName: 'Huntington Beach',
  peakDate: '2026-10-09',
  peakHeightFt: 8,
  peakPeriodS: 17,
  entrySource: 'outlook',
};

function renderScreen(params: SwellLandingRouteParams) {
  mockParams = params;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <SwellLandingScreen />
    </QueryClientProvider>,
  );
}

describe('SwellLandingScreen with the outlook enabled', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReplace.mockClear();
    mockDetailMap.mockClear();
    mockBeforeRemove = null;
    mockOutlook = makeOutlook({ swells: [swell] });
    mockCoordinates = { 'beach-hb': { lat: 33.66, lon: -118 } };
    jest.mocked(apiGet).mockReset();
    jest.mocked(apiGet).mockResolvedValue(eventBody);
  });

  it('shows the map hero, tier track and forecast chart, and drops the run table and trend line', async () => {
    const view = renderScreen(outlookParams);
    expect(await view.findByTestId('swell-map-hero')).toBeTruthy();
    expect(mockDetailMap.mock.lastCall![0]).toMatchObject({
      lat: 33.66, lon: -118, layer: 's1', forecastAt: '2026-10-09T18:00:00.000Z', interactive: false,
    });
    expect(view.getByTestId('tier-track')).toBeTruthy();
    expect(await view.findByTestId('forecast-moved-chart')).toBeTruthy();
    expect(view.queryByTestId('swell-landing-history-row')).toBeNull();
    expect(view.queryByTestId('swell-landing-trend')).toBeNull();
    expect(view.getByTestId('swell-landing-share')).toBeTruthy();
    expect(view.getByTestId('swell-landing-week-scout')).toBeTruthy();
    expect(view.getByTestId('swell-landing-orientation')).toHaveTextContent('South-facing 7–9 ft');
  });

  it('draws the chart from the outlook swell and says tracking just started when the record is unavailable', async () => {
    jest.mocked(apiGet).mockRejectedValue(new Error('Not found'));
    const view = renderScreen(outlookParams);
    await waitFor(() => expect(view.getByTestId('forecast-moved-caption')).toHaveTextContent(/^Tracking just started/));
  });

  it('omits the size-by-orientation line when neither side exists', async () => {
    mockOutlook = makeOutlook({ swells: [{ ...swell, sizeByOrientation: { southFacing: null, westFacing: null } }] });
    const view = renderScreen(outlookParams);
    await view.findByTestId('forecast-moved');
    expect(view.queryByTestId('swell-landing-orientation')).toBeNull();
  });

  it('shows no map when the beach has no coordinates, but keeps the chart', async () => {
    mockCoordinates = {};
    const view = renderScreen(outlookParams);
    await view.findByTestId('forecast-moved');
    expect(view.queryByTestId('swell-map-hero')).toBeNull();
  });

  it('sends back from a swell push to the outlook once, ignoring unrelated removals', async () => {
    renderScreen({ ...outlookParams, entrySource: 'push' });
    await waitFor(() => expect(mockBeforeRemove).not.toBeNull());
    const preventDefault = jest.fn();
    mockBeforeRemove!({ preventDefault, data: { action: { type: 'REPLACE' } } });
    expect(preventDefault).not.toHaveBeenCalled();
    mockBeforeRemove!({ preventDefault, data: { action: { type: 'GO_BACK' } } });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('SwellOutlook');
    mockBeforeRemove!({ preventDefault, data: { action: { type: 'GO_BACK' } } });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('goes back normally when opened from the outlook list', async () => {
    const view = renderScreen(outlookParams);
    await view.findByTestId('swell-map-hero');
    expect(mockBeforeRemove).toBeNull();
    fireEvent.press(view.getByTestId('swell-landing-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('SwellLandingScreen with the outlook not enabled', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockDetailMap.mockClear();
    mockBeforeRemove = null;
    mockOutlook = null;
    mockCoordinates = { 'beach-hb': { lat: 33.66, lon: -118 } };
    jest.mocked(apiGet).mockReset();
    jest.mocked(apiGet).mockResolvedValue(eventBody);
  });

  it('keeps today\'s run table, trend line and back behaviour, and adds nothing', async () => {
    const view = renderScreen({ ...outlookParams, entrySource: 'push' });
    expect(await view.findAllByTestId('swell-landing-history-row')).toHaveLength(3);
    expect(view.getByTestId('swell-landing-trend')).toBeTruthy();
    expect(view.queryByTestId('swell-map-hero')).toBeNull();
    expect(view.queryByTestId('tier-track')).toBeNull();
    expect(view.queryByTestId('forecast-moved')).toBeNull();
    expect(mockBeforeRemove).toBeNull();
    expect(mockDetailMap).not.toHaveBeenCalled();
  });
});
```

In `src/features/swell-landing/__tests__/swell-landing-screen.test.tsx`, add beside its other `jest.mock(` calls so existing assertions (including `apiGet` call counts) are unchanged:
```tsx
jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({ useSwellOutlook: () => ({ data: null }) }));
jest.mock('@/features/beach-forecast/detail-map', () => ({ DetailMap: () => null }));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/swell-outlook/__tests__/tier-track.test.tsx src/features/swell-landing/__tests__/swell-landing-outlook.test.tsx`
Expected: FAIL with `Cannot find module '../tier-track'`, then the screen test failing on the missing `swell-map-hero`.

- [ ] **Step 3: Write the minimal implementation**

`src/features/swell-outlook/tier-track.tsx`:
```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Eyebrow, Label } from '@/components/ui/typography';
import { Colors } from '@/constants/theme';
import { outlookTierLabel } from './outlook-format';
import type { OutlookTier, VisibleOutlookTier } from './types';

const STOPS: readonly VisibleOutlookTier[] = ['on_the_radar', 'likely', 'locked'];

const TIER_MEANING: Record<OutlookTier, string> = {
  on_the_radar: 'This far out a swell often changes or fades.',
  likely: 'It locks in closer to arrival.',
  locked: 'Timing and size are firm.',
  early_signal: 'Expected to change.',
};

/** Where this swell sits on the way to locked. A swell only moves along it; the copy never promises it will. */
export function TierTrack({ tier }: { tier: OutlookTier }): React.JSX.Element {
  const current = STOPS.indexOf(tier as VisibleOutlookTier);
  const label = outlookTierLabel(tier);
  return (
    <View
      style={styles.section}
      accessible
      accessibilityLabel={`Confidence: ${label}. ${TIER_MEANING[tier]}`}
      testID="tier-track"
    >
      <Eyebrow style={styles.eyebrow}>Confidence</Eyebrow>
      <View style={styles.track}>
        {STOPS.map((stop, index) => (
          <View key={stop} style={styles.stop}>
            <View style={[styles.bar, index < current && styles.done, index === current && styles.current, index > current && styles.future]} />
            <Label style={[styles.stopLabel, index === current && styles.stopLabelCurrent]}>{outlookTierLabel(stop)}</Label>
          </View>
        ))}
      </View>
      <Body style={styles.meaning}>{`${label} now. ${TIER_MEANING[tier]}`}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  eyebrow: { color: Colors.textMuted },
  track: { flexDirection: 'row', gap: 6 },
  stop: { flex: 1, gap: 5 },
  bar: { borderRadius: 4, height: 7 },
  done: { backgroundColor: Colors.teal, opacity: 0.4 },
  current: { backgroundColor: Colors.teal },
  future: { borderColor: Colors.cardBorder, borderStyle: 'dashed', borderWidth: 1 },
  stopLabel: { color: Colors.textMuted, fontSize: 10 },
  stopLabelCurrent: { color: Colors.cream },
  meaning: { color: Colors.textMuted },
});
```
Append to `src/features/swell-outlook/index.ts`: `export { TierTrack } from './tier-track';`

`src/features/swell-landing/swell-landing-screen.tsx` (edits in order; line numbers from `origin/main`):

1. After `import { useSwellEvent } from './use-swell-event';` (line 32) add:
```ts
import { useBeachCoordinates } from '@/hooks/use-beach-coordinates';
import {
  findOutlookSwell,
  ForecastMovedSection,
  outlookMapLayer,
  outlookOrientationLine,
  outlookSourceLine,
  SwellMapHero,
  TierTrack,
  useSwellOutlook,
  type HistoryRun,
} from '@/features/swell-outlook';
import { getDeviceTimezone } from '@/lib/device-timezone';
```
2. Directly after the `beachRef` declaration (lines 96-100, ending `?? null;`) add:
```ts
  const outlookData = useSwellOutlook().data ?? null;
  const outlookEnabled = outlookData !== null;
  const outlookSwell = useMemo(() => findOutlookSwell(outlookData, eventKey), [outlookData, eventKey]);
  const timezone = useMemo(() => getDeviceTimezone() ?? 'UTC', []);
  const mapBeachId = params.beachId
    ?? (event?.beach.id || null)
    ?? keyParts?.beachId
    ?? outlookSwell?.beach.id
    ?? null;
  const coordinates = useBeachCoordinates(outlookEnabled && mapBeachId ? [mapBeachId] : []);
  const mapPoint = mapBeachId ? coordinates.data?.[mapBeachId] ?? null : null;
  const mapPeakAt = outlookSwell?.peakAt ?? event?.peakAt ?? null;
  const chartRuns = useMemo<HistoryRun[]>(
    () => (event?.history.length ? event.history : outlookSwell?.history ?? []),
    [event?.history, outlookSwell?.history],
  );
  const orientationLine = outlookSwell ? outlookOrientationLine(outlookSwell.sizeByOrientation) : null;
```
3. After the `handleBack` callback (lines 158-164) add the push back redirect:
```ts
  // A swell push with the outlook on: back (button, iOS swipe, Android back) lands on the outlook, not Home.
  const redirectBackToOutlook = params.entrySource === 'push' && outlookEnabled;
  const leavingToOutlookRef = useRef(false);
  useEffect(() => {
    if (!redirectBackToOutlook) return;
    return navigation.addListener('beforeRemove', (removeEvent) => {
      const type = removeEvent.data.action.type;
      if (leavingToOutlookRef.current || (type !== 'GO_BACK' && type !== 'POP')) return;
      removeEvent.preventDefault();
      leavingToOutlookRef.current = true;
      navigation.replace('SwellOutlook');
    });
  }, [navigation, redirectBackToOutlook]);
```
4. Replace line 232 `const showDetail = !unknownSwell && Boolean(changeLine || trendLine || history.length > 0);` with:
```ts
  const showOutlookDetail = outlookEnabled && !unknownSwell && !loadingSwell;
  const showDetail = !unknownSwell && (showOutlookDetail
    ? Boolean(changeLine)
    : Boolean(changeLine || trendLine || history.length > 0));
```
5. Between the header `</View>` (line 247) and `<Animated.View style={cardEntrance.animatedStyle}>` (line 249) insert:
```tsx
        {showOutlookDetail && mapPoint && mapPeakAt ? (
          <View style={styles.hero}>
            <SwellMapHero
              lat={mapPoint.lat}
              lon={mapPoint.lon}
              peakAt={mapPeakAt}
              layer={outlookSwell ? outlookMapLayer(outlookSwell) : 's1'}
              timezone={timezone}
              sizeRange={outlookSwell?.faceHeightFt ?? null}
              directionLabel={outlookSwell?.directionLabel ?? event?.directionLabel ?? ''}
              directionDeg={outlookSwell?.directionDeg ?? null}
              periodS={outlookSwell?.periodS ?? event?.periodS ?? null}
              sourceLine={outlookSwell ? outlookSourceLine(outlookSwell) : null}
            />
          </View>
        ) : null}

```
6. Line 294: change `{trendLine || history.length > 0 ? (` to `{!showOutlookDetail && (trendLine || history.length > 0) ? (`.
7. Immediately before `<CtaButton` (line 313) insert:
```tsx
          {showOutlookDetail ? (
            <>
              {outlookSwell ? <TierTrack tier={outlookSwell.tier} /> : null}
              <ForecastMovedSection runs={chartRuns} timezone={timezone} />
              {orientationLine ? (
                <Body style={styles.orientation} testID="swell-landing-orientation">{orientationLine}</Body>
              ) : null}
            </>
          ) : null}

```
8. Immediately before `  below: {` (line 351) add to the `StyleSheet`:
```ts
  hero: {
    marginBottom: 4,
  },
  orientation: {
    color: Colors.textMuted,
  },
```
Spec note: the spec says "tier track ... stays", but `SwellLanding` on `origin/main` has no tier track (only the card, share action, "Since we last told you" and the run table), so this task adds the mockup's "Confidence" track.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/swell-landing src/features/swell-outlook/__tests__/tier-track.test.tsx && npm run typecheck`
Expected: PASS: new outlook-enabled tests (6), new not-enabled test, tier track (5), and every pre-existing swell-landing test unchanged.

- [ ] **Step 5: Simulator verification (visual task)**
Fixture run `=three` (restart Metro with `--clear`). From the Outlook (Home footer, Task 9), tap the third row (the 7-9 ft "Above your range" swell, event key `…:S:<date>`).
- Header back chevron, then a 300 pt rounded map showing the real swell field for the beach (zoom 7, particles moving slowly, no layer chips or forecast bar because the embed hides them inside the native WebView), a paper chip "S swell · from 190°" with "17 s · From Hurricane Rachel", and a round play button top right.
- Below it: a stage line ("Approaching" with the scrubber on the peak day reads "Arriving, peak" and "At your beach 7–9 ft"), the continuous time slider ("Fri 12pm" style), and day ticks (Tue 6 … Sat 10). Tap a tick: the field re-renders for that day with a soft crossfade (the `smooth` flag), the stage label changes ("Far offshore") and the size line disappears. Drag the slider: the label tracks the finger and the map time follows. Press play: the icon becomes pause, the field advances by itself, the slider thumb follows, and playback stops at the last day on its own; press a tick during playback and it stops.
- Then the swell card (unchanged), "Send this to someone", the Confidence track with "Likely"/"On the radar" etc. (this swell: "On the radar now. This far out a swell often changes or fades."), "How the forecast moved" with one dot labelled "8 ft", a Fri chip and the caption "Tracking just started: this is the first forecast run that saw this swell.", the line "South-facing 7–9 ft", then "See the whole week" and "Open Huntington Beach". There is no run table.
- Tap the first row instead (4 runs, "Longboard size"): the chart shows four columns, a "+0.5 ft" chip at the step, the latest column highlighted.
- With `=disabled`, open any swell via `xcrun simctl openurl booted "quiver://swell/beach-hb%3ASSW%3A2026-10-05?k=coming"`: today's screen (card, share, run table or "no longer in the forecast" message), no map, no track.

- [ ] **Step 6: Commit**
```bash
git add src/features/swell-outlook src/features/swell-landing
git commit -m "feat(swell-landing): add map hero, tier track and forecast-moved chart behind the outlook gate"
```

### Task 14: Full local verification and pull request
**Files:** none created; verification of the whole branch, then a PR against `main`.
**Interfaces:** Consumes: everything above. Produces: an open PR (not merged), a verification record.

- [ ] **Step 1: Write the failing test**

No new test: this task is the gate. The pre-existing suites are the "tests that must stay green" and there is no red state to create.

- [ ] **Step 2: Run it to verify it fails**

Run the baseline on the untouched base to confirm what "green" means here (so any later failure is attributable):
```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/swell-outlook-native-20261004
git stash list | head -1; git status --short | head -5
git log --oneline origin/main -1
```
Expected: clean working tree on `feat/swell-outlook-native`, 13 task commits above `origin/main`.

- [ ] **Step 3: Run the full local gate (quiver-native PRs show no CI, so this is the evidence)**
```bash
source ~/.nvm/nvm.sh && nvm use 22
npm run typecheck 2>&1 | tail -n 8 | tee /private/tmp/outlook-gate-typecheck.txt
npm run lint 2>&1 | tail -n 8 | tee /private/tmp/outlook-gate-lint.txt
npm test 2>&1 | tail -n 12 | tee /private/tmp/outlook-gate-jest.txt
```
Run each in the background and wait for it to finish; do not wrap `git push` or the pre-push gate in a short timeout. Fix any failure in the same change (including a pre-existing unit-test failure in a file this branch touches). If a test elsewhere fails with an unmocked-network error from `useSwellOutlook`, add the one-line `jest.mock('@/features/swell-outlook/use-swell-outlook', () => ({ useSwellOutlook: () => ({ data: null }) }))` to that suite.
Then the focused groups once more, to prove the gate invariants: `npm test -- src/features/swell-outlook src/features/swell-landing src/features/beach-forecast src/__tests__/home-screen.test.tsx src/__tests__/week-scout-screen.test.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Expected: `typecheck` exit 0; `lint` exit 0 (warnings only, none new in `src/features/swell-outlook`); `npm test` all suites PASS. Record the three results and the count of new tests in the PR description.
Optional but recommended before asking Steven to try it: one end-to-end fixture pass per the simulator steps in Tasks 9, 10 and 13 (`=three`, `=empty`, `=disabled`), Metro restarted with `--clear` each time.

- [ ] **Step 5: Commit and open the PR (do not merge, no OTA)**
```bash
git status --short                      # expect clean; commit nothing else
git fetch origin && git rebase origin/main   # only if origin/main moved; then rerun the three commands above
git push -u origin feat/swell-outlook-native
```
`git push` runs the repo's pre-push gate (full Jest plus Maestro, and it needs the generated `ios/Quiver/Supporting/Expo.plist` and Node 22; copy the plist from the primary checkout if the worktree lacks it). Let it finish.
```bash
gh pr create --base main --head feat/swell-outlook-native \
  --title "feat(swell-outlook): native Swell Outlook (Home section, outlook screen, detail map hero)" \
  --body "$(cat <<'EOF'
## What
Native half of Swell Outlook Phase 1 (spec: quiver docs/superpowers/specs/2026-10-04-swell-outlook-design.md): Home "How this week plays out", Swell Outlook screen, Week Scout entry row, swell detail map hero + scrubber + "How the forecast moved", push back to the outlook.

## Gating
Everything keys off `GET /api/swell/outlook` returning a body. 401/403/404, an unparseable body, or a signed-out user leaves today's UI unchanged (Home keeps "HOW TODAY CHANGES", Week Scout has no row, SwellLanding keeps its run table).

## Analytics
Reuses the allowlisted `forecast_interaction` event with `feature: 'swell_outlook'` and new `action` values; no new event type, no web migration.

## Verification
Local gate output (typecheck, lint, full Jest) and the simulator fixture run (`EXPO_PUBLIC_SWELL_OUTLOOK_FIXTURE=three|empty|disabled`, Metro `--clear`) are posted as the first comment.

## Not done here
No OTA, no store action, no flag change. Real-device push-tap check and OTA publish need Steven.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Post the evidence as the first comment (the files were written by Step 3), then report the PR URL:
```bash
gh pr comment --body "$(printf 'Local gate on feat/swell-outlook-native\n\ntypecheck:\n%s\n\nlint:\n%s\n\njest:\n%s\n\nSimulator fixture run (three, empty, disabled; Metro --clear) done per Tasks 9, 10 and 13.' "$(cat /private/tmp/outlook-gate-typecheck.txt)" "$(cat /private/tmp/outlook-gate-lint.txt)" "$(cat /private/tmp/outlook-gate-jest.txt)")"
```
Only post that last sentence if the simulator pass was actually done; otherwise delete it from the command. Stop: no merge, no `npm run update:production`, no EAS command.

## ⚠️ Human judgment / approvals
**Approvals Steven must give (nothing here is done by this plan):**
- **OTA publish** (`npm run update:production`) after the PR merges: the plan adds no dependency and no native module, so the Expo fingerprint is expected to match the installed binary, but it must be measured in a real checkout before publishing; do not publish a runtime that matches a build under store review unless this JavaScript was part of it. Never merge `main` into a deployed OTA branch; cherry-pick.
- **Store submission:** none needed for this change.
- **Backend dependency and flags:** the screens do nothing until the backend ships `GET /api/swell/outlook` and Steven puts himself on the allowlist (flag change = his approval at the time).
- **Real-device push-tap check:** a swell push must be tapped on a phone to confirm it opens the swell detail and that back lands on the Swell Outlook (the simulator cannot verify push routing; `beforeRemove` back handling is unit-tested only).
- **Analytics rows:** after the first device run, confirm `forecast_interaction` rows with `feature: 'swell_outlook'` actually land in `user_events` / PostHog (the allowlist is enforced by a web DB constraint this plan could not query).

**Design choices made between two reasonable readings (what the plan wrote):**
- Analytics ride `forecast_interaction` + `action` rather than new event types (avoids a web migration; costs a coarser event name).
- "Out-of-range swells at lower contrast" means `below_range` only; `above_range` is never dimmed (the fit rules win over the Home wording).
- "Name the board when only some fit" compares `fit.boards.length` with the user's distinct board classes from `useUserBoards`, because the contract does not carry the user's full list.
- Day labels use the device timezone because the contract has no beach timezone; a traveller far from the beach can see a one-day edge case near midnight.
- Map layer is `'s1'` for every swell because `OutlookSwell` has no partition field; ask the backend for an additive `partition` if the secondary swell should show its own layer.
- Scrubber is the existing `SwellFieldTimeSlider` (3-hour steps) plus day ticks, not a new range control; size at the beach is written only within 12 hours of the peak.
- Home swaps the section only after the outlook query resolves (a one-time layout swap for allowlisted users) instead of holding the old section back.
- Outlook rows pass full route params (`kind: 'coming'`, midpoint size, `entrySource: 'outlook'`) so the detail paints instantly and works while `/api/swell/<key>` is unavailable; the Share card still uses the server card when it loads.
- The detail's run history prefers the event record's runs and falls back to the outlook swell's own runs.
- No `quiver://swell-outlook` deep link and no Maestro flow were added (keeps `verify:app-link-parity` and the e2e gate untouched).

**Mockup items that could not be mapped to existing components or data:**
- The per-day "At your beach" size curve and the "Far offshore" front (illustrative in the mockup; no per-day curve in the contract), so only a stage label and a peak-window size are shown.
- The "By confidence / By week" segmented control and the Early signal group and "coarse" labels (Phase 2).
- The "now" pulse and the dashed-line flow animation (dropped for the slow, subtle motion rule; only one reveal remains).
- The mockup's own HTML slider and crossfading iframes (replaced by `SwellFieldTimeSlider` and the embed's `setForecastTime` with `smooth`).
- The mockup's "Confidence" track dates ("Oct 1", "about Oct 8"): the contract has no tier-change history, so the track shows only the current tier.
- Per-element screen-reader labels inside the SVG (react-native-svg elements are not individually focusable): the graphic carries one summary label that lists every band, and each row carries its own label.

## Spec coverage
| Spec requirement (Native screens, Pushes, Honest labels) | Task |
|---|---|
| API client + types for `GET /api/swell/outlook`; contract fixed; tolerant parse | 1, 2 |
| Gating: endpoint 401/403/404 or no data leaves today's UI untouched | 2, 8, 9, 10, 13 |
| Home "How this week plays out" replaces "How today changes"; bands by direction family, peak markers with size and period, solidity by tier, out-of-range lower contrast, footer row, no-swell state | 5, 6, 9 |
| Swell Outlook root-stack screen: header, strip graphic, list by tier, row = peak day, size range, tier chip, one change note, glyph, sparkline, fit, one glyph key | 3, 5, 6, 7, 8 |
| Designed empty state (one-line summary, last checked, Week Scout link); loading and error states | 8 |
| Week Scout entry row; Week Scout otherwise unchanged | 10 |
| Detail hero: real map via the embed WebView, `layer` from the swell, day scrubber with smooth `setForecastTime`, play via `setForecastPlaying`; one map at a time | 12, 13 |
| "How the forecast moved": run date x axis, stepped size track with values, peak-day chips with the changed run highlighted, one caption, single-run state, run table removed | 11, 13 |
| Tier track, share action and existing card stay | 13 |
| Fit treatment: `in_range` names the board when only some fit, `below_range` dimmed and labelled, `above_range` labelled never dimmed, `rideable`/`unknown` no label | 3, 7 |
| Honest labels: group notes on tiers, "so far"/"needs watching" by lead, sizes as ranges, peak window as a window, no AI/ML copy | 3, 5, 7 |
| `source`, `stormName`, `sizeByOrientation` shown with null-safe copy | 3, 7, 13 |
| Push destination: swell pushes open the detail, back goes to the outlook | 13 |
| Analytics for outlook opened, row opened, entry taps (allowlist mechanism) | 4, 6, 8, 9, 10 |
| Motion slow, organic, subtle; reduced motion respected | 6, 12 |
| Accessibility labels on chart elements and rows | 6, 7, 8, 11, 12 |
| Full local verification, PR against main, no merge, no OTA | 14 |

