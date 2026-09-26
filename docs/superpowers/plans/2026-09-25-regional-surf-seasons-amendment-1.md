# Amendment 1 to the Regional Surf Seasons plan: reading Newport's season

> Applies to `docs/superpowers/plans/2026-09-25-regional-surf-seasons.md`. Spec: `docs/superpowers/specs/2026-09-25-regional-surf-seasons-design.md`, section "Amendment 1".
> Executors of Tasks 8, 9, 12 and 13 read their task in the main plan AND the matching section here. Where they conflict, this file wins.

Also note: the climatology test fixtures now live in `__tests__/lib/climatology/__fixtures__/` (not `fixtures/`). Every import in the main plan that says `./fixtures/…` or `../../lib/climatology/fixtures/…` must use `__fixtures__` instead.

---

## Task 5c: 3 ft+ days by swell direction, and a rebuild

Runs after Task 5 and before Task 6.

**Files:**
- Modify: `lib/climatology/types.ts` (`WaveMonthStats`)
- Modify: `lib/climatology/stats.ts` (`waveMonthStats`)
- Modify: `lib/climatology/csv.ts` (8 new columns)
- Modify: `__tests__/lib/climatology/stats.test.ts`, `__tests__/lib/climatology/score.test.ts`, `__tests__/lib/climatology/build-dataset.test.ts`
- Regenerate and commit: `lib/data/surf-climatology/*.json`, `public/data/surf-climatology/*.csv`

**Interfaces:**
- Produces: `WaveMonthStats.threeFootDaysBySector: Record<Sector, number>` — share of observed days whose daytime (06:00–18:59 local) median was 3 ft or more, grouped by the day's most common daytime swell direction sector. Ties go to the earlier sector in `SECTORS` order. Days with no direction readings count as observed but in no sector. Rounded to 0.01 like the other shares.

- [ ] **Step 1: Failing tests.** In `__tests__/lib/climatology/stats.test.ts`:

1. In the existing "summarises height, small and big days, period and direction" expectation, add after `directionMix`:

```ts
      threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0.68, NW: 0 },
```

(Days 11–31 have a 3.28 ft daytime median from the west: 105 of 155 observed days.)

2. Add inside `describe("waveMonthStats", …)`:

```ts
  it("groups 3 ft+ days by the day's most common swell direction", () => {
    // Days 1-10: 1.2 m (3.9 ft) from the south all day.
    // Days 11-20: 1.2 m; daytime hours 6-13 from the west (8 h), 14-18 from the south (5 h).
    // Days 21-31: 0.5 m (1.6 ft), below 3 ft.
    const months = YEARS.map((year) =>
      localMonth(year, 1, (day, hour) => ({
        waveHeightM: day <= 20 ? 1.2 : 0.5,
        meanWaveDirDeg: day > 10 && day <= 20 && hour >= 6 && hour <= 13 ? 270 : 180,
      })),
    );

    expect(waveMonthStats(months)?.threeFootDaysBySector).toEqual({
      N: 0, NE: 0, E: 0, SE: 0, S: 0.32, SW: 0, W: 0.32, NW: 0,
    });
  });
```

In `__tests__/lib/climatology/score.test.ts`, add to the `waves` literal after `directionMix`:

```ts
    threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 },
```

In `__tests__/lib/climatology/build-dataset.test.ts`:
- in "gates each station and scores every month", add `expect(dataset.months[0].waves?.threeFootDaysBySector.E).toBe(1);` (1.0 m from 90° every day);
- in the CSV test, add `expect(rows[0]).toContain("days_3ft_s_share");`. The existing `startsWith("1,W1,waves,3.3,")` and `endsWith(",75,75,75,1,82")` stay true because the new columns sit between the direction columns and the water columns.

Run: `yarn test:unit __tests__/lib/climatology/` — expect the three new assertions to FAIL.

- [ ] **Step 2: Implement.**

`types.ts`, in `WaveMonthStats` after `directionMix`:

```ts
  /** Share of observed days with a 3 ft+ daytime median, by the day's most common swell direction. */
  threeFootDaysBySector: Record<Sector, number>;
```

`stats.ts`:

```ts
const THREE_FOOT_DAY_FT = 3;

// The day's most common daytime swell direction; ties go to the earlier sector.
function dominantSector(hours: LocalHourObservation[]): Sector | null {
  const counts = new Map<Sector, number>();
  for (const o of hours) {
    if (o.meanWaveDirDeg === null) continue;
    const sector = sectorOf(o.meanWaveDirDeg);
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  let best: Sector | null = null;
  for (const sector of SECTORS) {
    const count = counts.get(sector) ?? 0;
    if (count > 0 && (best === null || count > (counts.get(best) ?? 0))) best = sector;
  }
  return best;
}
```

In `waveMonthStats`, declare before the loops:

```ts
  const threeFootDays = Object.fromEntries(SECTORS.map((sector) => [sector, 0])) as Record<Sector, number>;
```

and change the per-day block so the daytime hours are kept and the median is computed once:

```ts
      const daytimeHours = day.filter((o) => o.hour >= DAYTIME_FIRST_HOUR && o.hour <= DAYTIME_LAST_HOUR);
      const daytime = values(daytimeHours, heightFt);
      if (daytime.length < MIN_DAYTIME_HOURS) continue;
      observedDays += 1;
      const dayMedianFt = percentile(daytime, 50);
      if (dayMedianFt < SMALL_DAY_FT) smallDays += 1;
      if (dayMedianFt >= THREE_FOOT_DAY_FT) {
        const sector = dominantSector(daytimeHours);
        if (sector) threeFootDays[sector] += 1;
      }
      if (values(day, heightFt).filter((ft) => ft >= BIG_DAY_FT).length >= BIG_DAY_MIN_HOURS) bigDays += 1;
```

In the returned object, after `directionMix`:

```ts
    threeFootDaysBySector: Object.fromEntries(
      SECTORS.map((sector) => [sector, share(threeFootDays[sector], observedDays)]),
    ) as Record<Sector, number>,
```

`csv.ts`: in `COLUMNS`, directly after the `dir_*_share` spread:

```ts
  ...SECTORS.map((sector) => `days_3ft_${sector.toLowerCase()}_share`),
```

and in `row()`, directly after the direction-mix spread:

```ts
    ...SECTORS.map((sector) => waves?.threeFootDaysBySector[sector]),
```

- [ ] **Step 3: Run the climatology tests.** `yarn test:unit __tests__/lib/climatology/` — all pass.

- [ ] **Step 4: Rebuild.** `yarn tsx scripts/climatology/build-surf-climatology.ts` (every archive is cached in `.cache/climatology/`; no downloads expected). Confirm the printed score lines are unchanged from Task 5:
- cocoa-beach `59 57 61 56 52 42 37 44 61 61 66 61`
- newport-beach `84 81 81 84 86 88 91 88 87 88 84 83`
- honolulu `60 61 69 78 87 87 82 85 84 81 68 64`

If any score changed, stop and report: this task must not change scoring.

Spot-check: `node -e "const d=require('./lib/data/surf-climatology/newport-beach.json');console.log([1,7].map(m=>JSON.stringify(d.months[m-1].waves.threeFootDaysBySector)).join('\n'))"` — January should be mostly `W`, July mostly `S`.

- [ ] **Step 5: Lint, typecheck, commit.** `npx eslint --max-warnings=0` on the changed source and test files; `yarn typecheck`.

```bash
git add lib/climatology/types.ts lib/climatology/stats.ts lib/climatology/csv.ts __tests__/lib/climatology/stats.test.ts __tests__/lib/climatology/score.test.ts __tests__/lib/climatology/build-dataset.test.ts lib/data/surf-climatology public/data/surf-climatology
git commit -m "feat(climatology): count 3 ft+ days by swell direction

Lets the Newport page show that the buoy's winter days are west swell and
its summer days are south swell. Scores are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Additions to Task 8 (season view)

**Fixture** (`__tests__/lib/climatology/__fixtures__/dataset.ts`): add to `waveStats()` defaults, after `directionMix`:

```ts
    threeFootDaysBySector: { N: 0, NE: 0.05, E: 0.1, SE: 0.05, S: 0, SW: 0, W: 0, NW: 0 },
```

**Interface additions** in `lib/climatology/season-view.ts`:
- `DataBackedSeasonView` gains `hasClearSeason: boolean` and `scoreRange: { min: number; max: number } | null`.
- New export `threeFootDaysShare(dataset: SurfClimatologyDataset, sectors: readonly Sector[], months: readonly number[]): number | null`.

**Behaviour** — replace the main plan's peak handling in `buildDataBackedSeasonView` with:

```ts
  const { peakMonth, peakBand } = derivePeak(dataset.months);
  const scored = dataset.months.flatMap((month) => (month.score === null ? [] : [month.score]));
  const scoreRange = scored.length === 0 ? null : { min: Math.min(...scored), max: Math.max(...scored) };
  // When every scored month is inside the band, badges would mark the whole year.
  const hasClearSeason = peakBand.length < scored.length;
  const band = new Set(hasClearSeason ? peakBand : []);
```

and `const bandMonths = hasClearSeason ? peakBand.map(byMonth) : [];`. Return `hasClearSeason` and `scoreRange`.

`buildWeekAnswer` takes `hasClearSeason` as a fifth argument. After the `if (!peak) return lead;` line:

```ts
  if (!hasClearSeason) {
    return peak.month === current.month
      ? `${lead} It's the highest-scoring month, and every month scores within ${PEAK_BAND_POINTS} points of it.`
      : `${lead} Every month scores within ${PEAK_BAND_POINTS} points of ${peak.name}, the highest, so the buoy doesn't single out a season.`;
  }
```

`buildHeroDetail` takes `hasClearSeason` as a fourth argument and uses `${hasClearSeason ? "Peak month" : "Highest month"}: ${peak.name}.`

`bestMonthFaq`, when `peak` exists, `!hasClearSeason` and `scoreRange` exists:

```ts
`${peak.name} scores highest for ${dataset.cityName} on Quiver's buoy score (${peak.score}/100), but every month scores between ${scoreRange.min} and ${scoreRange.max}, so the buoy record doesn't pick a season.`
```

(otherwise the main plan's sentence).

```ts
/** Share of observed days in `months` with a 3 ft+ buoy median mostly from `sectors`, weighted by observed days. */
export function threeFootDaysShare(
  dataset: SurfClimatologyDataset,
  sectors: readonly Sector[],
  months: readonly number[],
): number | null {
  const stats = dataset.months
    .filter((month) => months.includes(month.month))
    .map((month) => month.waves)
    .filter((waves): waves is WaveMonthStats => waves !== null);
  const days = stats.reduce((sum, waves) => sum + waves.observedDays, 0);
  if (days === 0) return null;
  const weighted = stats.reduce(
    (sum, waves) => sum + sectors.reduce((acc, sector) => acc + waves.threeFootDaysBySector[sector], 0) * waves.observedDays,
    0,
  );
  return Math.round((weighted / days) * 100) / 100;
}
```

**Tests to add** to `__tests__/lib/climatology/season-view.test.ts`:

```ts
describe("a city without a clear season", () => {
  const FLAT = [84, 81, 81, 84, 86, 88, 91, 88, 87, 88, 84, 83];

  it("shows no Peak badges and says the buoy doesn't pick a season", () => {
    const view = buildDataBackedSeasonView(makeDataset(FLAT), 1);

    expect(view.hasClearSeason).toBe(false);
    expect(view.scoreRange).toEqual({ min: 81, max: 91 });
    expect(view.months.some((m) => m.isPeak)).toBe(false);
    expect(view.peakBand).toEqual([]);
    expect(view.peakMonth?.name).toBe("July");
    expect(view.weekAnswer).toBe(
      "January scores 84/100 on the Cape Canaveral Nearshore buoy record. Every month scores within 10 points of July, the highest, so the buoy doesn't single out a season.",
    );
    expect(view.heroDetail.endsWith("Highest month: July.")).toBe(true);
    expect(view.bestMonthFaq).toBe(
      "July scores highest for Cocoa Beach on Quiver's buoy score (91/100), but every month scores between 81 and 91, so the buoy record doesn't pick a season.",
    );
  });

  it("words the top month itself without a band", () => {
    expect(buildDataBackedSeasonView(makeDataset(FLAT), 7).weekAnswer).toBe(
      "July scores 91/100 on the Cape Canaveral Nearshore buoy record. It's the highest-scoring month, and every month scores within 10 points of it.",
    );
  });
});

describe("threeFootDaysShare", () => {
  it("sums the sectors and weights months by observed days", () => {
    const dataset = makeDataset([40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50]);
    dataset.months[5].waves = waveStats({ observedDays: 100, threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0.2, SW: 0.1, W: 0, NW: 0 } });
    dataset.months[6].waves = waveStats({ observedDays: 300, threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0.1, SW: 0, W: 0.3, NW: 0 } });
    dataset.months[7].waves = null;

    // (0.3 x 100 + 0.1 x 300) / 400 = 0.15
    expect(threeFootDaysShare(dataset, ["S", "SW"], [6, 7, 8])).toBe(0.15);
    expect(threeFootDaysShare(dataset, ["S"], [8])).toBeNull();
  });
});
```

Also add `expect(view.hasClearSeason).toBe(true);` to the first "marks the peak band…" test, and change the committed-dataset consistency test's inner assertion to:

```ts
        expect(month.isPeak).toBe(view.hasClearSeason && month.score !== null && month.score >= top - 10);
```

---

## Additions to Task 9 (charts)

**New file:** `components/best-time-to-surf/buoy-record/swell-days-chart.tsx`; tests go in the same `buoy-record-charts.test.tsx`.

**Interface:** `SwellDaysChart({ abbrevs: readonly string[]; primary: { label: string; values: Array<number | null> }; secondary: { label: string; values: Array<number | null> }; stationName: string; chartId: string })`.

```tsx
// components/best-time-to-surf/buoy-record/swell-days-chart.tsx
import { formatShare } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_MUTED, CHART_PEAK, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 16;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const BASELINE = TOP + PLOT_HEIGHT;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 14;

interface SwellDaysSeries {
  label: string;
  values: Array<number | null>;
}

interface SwellDaysChartProps {
  abbrevs: readonly string[];
  primary: SwellDaysSeries;
  secondary: SwellDaysSeries;
  stationName: string;
  chartId: string;
}

export function SwellDaysChart({ abbrevs, primary, secondary, stationName, chartId }: SwellDaysChartProps) {
  const titleId = `${chartId}-title`;
  const all = [...primary.values, ...secondary.values].flatMap((value) => (value === null ? [] : [value]));
  // Round the axis up to the next 10%, never below 10%.
  const max = Math.max(0.1, Math.ceil(Math.max(0, ...all) * 10) / 10);
  const y = (share: number): number => BASELINE - PLOT_HEIGHT * (share / max);
  const ticks = Array.from({ length: Math.round(max * 10) }, (_, index) => (index + 1) / 10).filter(
    (tick, index, list) => list.length <= 5 || index % 2 === 1,
  );
  const summary = abbrevs
    .map((abbrev, index) => {
      const a = primary.values[index];
      const b = secondary.values[index];
      return a === null || b === null ? `${abbrev} n/a` : `${abbrev} ${formatShare(a)} / ${formatShare(b)}`;
    })
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`${primary.label} / ${secondary.label} at ${stationName}: ${summary}`}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
            <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
              {formatShare(tick)}
            </text>
          </g>
        ))}
        {abbrevs.map((abbrev, index) => {
          const center = LEFT + index * STEP + STEP / 2;
          const a = primary.values[index];
          const b = secondary.values[index];
          return (
            <g key={abbrev + index}>
              {a === null || b === null ? (
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={10} fill={CHART_MUTED}>
                  n/a
                </text>
              ) : (
                <>
                  <rect data-testid="swell-days-bar" x={center - BAR_WIDTH - 1} y={y(a)} width={BAR_WIDTH} height={BASELINE - y(a)} rx={2} fill={CHART_PEAK} />
                  <rect data-testid="swell-days-bar" x={center + 1} y={y(b)} width={BAR_WIDTH} height={BASELINE - y(b)} rx={2} fill={CHART_SERIES} />
                </>
              )}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                {abbrev}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-[#655C4C]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_PEAK }} aria-hidden="true" />
            {primary.label}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_SERIES }} aria-hidden="true" />
            {secondary.label}
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
```

**Test to add** to `__tests__/components/best-time-to-surf/buoy-record-charts.test.tsx`:

```tsx
describe("SwellDaysChart", () => {
  it("draws two bars per month with data, marks gaps, and labels both series", () => {
    const south = [0.04, 0.05, 0.07, 0.15, 0.26, 0.21, 0.26, 0.18, 0.24, 0.2, 0.09, null];
    const west = [0.46, 0.38, 0.36, 0.35, 0.21, 0.17, 0.04, 0.07, 0.08, 0.13, 0.23, null];
    const { container } = render(
      <SwellDaysChart
        abbrevs={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
        primary={{ label: "3 ft+ days, mostly south or southwest swell", values: south }}
        secondary={{ label: "3 ft+ days, mostly west or northwest swell", values: west }}
        stationName="San Pedro South"
        chartId="swell-days"
      />,
    );

    expect(container.querySelectorAll('[data-testid="swell-days-bar"]')).toHaveLength(22);
    expect(screen.getByText("n/a")).toBeInTheDocument();
    expect(screen.getByText("3 ft+ days, mostly south or southwest swell")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toContain("Jul 26% / 4%");
  });
});
```

(Import `SwellDaysChart` at the top of the test file with the other chart imports.)

---

## Additions to Task 12 (copy)

**`lib/climatology/season-copy.ts`:**
- import `Sector` from `./types`;
- add two optional fields to `SeasonCopy`:

```ts
  /** A city-specific section on how to read the buoy's season. */
  seasonNote?: {
    heading: string;
    paragraphs: (context: SeasonCopyContext) => string[];
    chart?: {
      primarySectors: readonly Sector[];
      primaryLabel: string;
      secondarySectors: readonly Sector[];
      secondaryLabel: string;
    };
  };
  /** Replaces the view's best-month FAQ answer. */
  bestMonthFaq?: (context: SeasonCopyContext) => string;
```

- in `describePeakAndQuiet`, directly after the "not enough data" guard:

```ts
  if (!view.hasClearSeason && view.scoreRange) {
    const medians = view.months.flatMap((month) => (month.waves ? [month.waves.hsFt.median] : []));
    return [
      `Every month scores between ${view.scoreRange.min} and ${view.scoreRange.max} on the ${primary.name} buoy record, so the buoy on its own doesn't pick a season. ${peakMonth.name} scores highest, ${peakMonth.score}/100.`,
      `The buoy's monthly median reading stays between ${Math.min(...medians)} and ${Math.max(...medians)} ft all year.`,
    ];
  }
```

**`lib/data/surf-climatology/copy/newport-beach.ts`:** import `threeFootDaysShare` from `@/lib/climatology/season-view` (next to `formatShare`, `seasonalDirectionMix`). Change `answerHeading` to `() => "What the San Pedro South buoy says"`. Add to `NEWPORT_BEACH_SEASON_COPY`:

```ts
  seasonNote: {
    heading: "Why Newport's best days still come in summer",
    chart: {
      primarySectors: ["S", "SW"],
      primaryLabel: "3 ft+ days, mostly south or southwest swell",
      secondarySectors: ["W", "NW"],
      secondaryLabel: "3 ft+ days, mostly west or northwest swell",
    },
    paragraphs: ({ dataset }) => {
      const winterWest = threeFootDaysShare(dataset, ["W", "NW"], [12, 1, 2]);
      const julyWest = threeFootDaysShare(dataset, ["W", "NW"], [7]);
      const summerSouth = threeFootDaysShare(dataset, ["S", "SW"], [5, 6, 7, 8, 9, 10]);
      const winterSouth = threeFootDaysShare(dataset, ["S", "SW"], [12, 1, 2]);
      if (winterWest === null || julyWest === null || summerSouth === null || winterSouth === null || dataset.shoreNormalDeg === null) {
        return [];
      }
      return [
        `The buoy's bigger winter days mostly come from the west. From December to February, ${formatShare(winterWest)} of days had a daytime median of 3 ft or more with swell mainly from the west or northwest. In July it was ${formatShare(julyWest)}.`,
        `Newport's beaches face southwest (${dataset.shoreNormalDeg}°). Surfline's Orange County guide says the county's southerly orientation holds many of its breaks back from November to April, when Ventura and San Diego can run twice the size.`,
        `South swell runs the other way. From May to October, ${formatShare(summerSouth)} of days had 3 ft or more of swell mainly from the south or southwest, against ${formatShare(winterSouth)} from December to February. That is the swell the Wedge needs: it forms when south swell reflects off the harbor jetty.`,
        "So the buoy scores winter almost as high as summer, but the summer south-swell days are the ones Newport is built for.",
      ];
    },
  },
  bestMonthFaq: ({ dataset, view }) => {
    const summerSouth = threeFootDaysShare(dataset, ["S", "SW"], [5, 6, 7, 8, 9, 10]);
    const winterSouth = threeFootDaysShare(dataset, ["S", "SW"], [12, 1, 2]);
    if (summerSouth === null || winterSouth === null || !view.scoreRange) return view.bestMonthFaq;
    return `Summer into fall. The ${view.primary.name} buoy scores every month between ${view.scoreRange.min} and ${view.scoreRange.max}, but from May to October ${formatShare(summerSouth)} of days bring 3 ft or more of south or southwest swell, the direction Newport's beaches face, against ${formatShare(winterSouth)} from December to February.`;
  },
```

and add to `sources`:

```ts
    { label: "Surfline: Orange County surf guide", url: "https://www.surfline.com/travel/united-states/california/orange-county-surfing-and-beaches/5379524" },
```

**Voice test** (`__tests__/data/surf-climatology-copy-voice.test.ts`): inside `renderedText`, after the existing `copy` pushes, add

```ts
    if (copy.seasonNote) texts.push(copy.seasonNote.heading, ...copy.seasonNote.paragraphs(context));
    if (copy.bestMonthFaq) texts.push(copy.bestMonthFaq(context));
```

and add the season-note heading to the distinct-headings helper's returned list when present. Also add:

```ts
  it("gives Newport a season note built from the dataset", () => {
    const dataset = getSurfClimatology("newport-beach");
    const copy = getSeasonCopy("newport-beach");
    if (!dataset || !copy?.seasonNote) throw new Error("missing Newport season note");
    const paragraphs = copy.seasonNote.paragraphs({ dataset, view: buildDataBackedSeasonView(dataset, 7) });
    expect(paragraphs).toHaveLength(4);
    expect(paragraphs[0]).toMatch(/From December to February, \d+% of days/);
  });
```

**Ruling carried from the pre-flight scan:** skip the "bold emphasis" pattern when scanning component SOURCE files (a JSDoc `/**` is not emphasis); keep it for rendered copy.

---

## Additions to Task 13 (sections and page)

**`BuoyRecordSections`:**
- import `SwellDaysChart` and `MONTH_ABBREVS` (from `@/lib/climatology/season-view`);
- photo slots: `const midPhotos = photosFor(copy?.seasonNote ? ["big-swell", "typical-day"] : ["big-swell", "typical-day", "south-swell"]);` and `const seasonNotePhotos = copy?.seasonNote ? photosFor(["south-swell"]) : [];`
- directly after the "Month by month at the buoy" section, render:

```tsx
      {copy?.seasonNote && (
        <section className={SECTION}>
          <h2 className={HEADING}>{copy.seasonNote.heading}</h2>
          {copy.seasonNote.chart && (
            <div className={CARD}>
              <SwellDaysChart
                abbrevs={MONTH_ABBREVS}
                primary={{
                  label: copy.seasonNote.chart.primaryLabel,
                  values: view.months.map((month) =>
                    month.waves ? sumSectors(month.waves.threeFootDaysBySector, copy.seasonNote?.chart?.primarySectors ?? []) : null,
                  ),
                }}
                secondary={{
                  label: copy.seasonNote.chart.secondaryLabel,
                  values: view.months.map((month) =>
                    month.waves ? sumSectors(month.waves.threeFootDaysBySector, copy.seasonNote?.chart?.secondarySectors ?? []) : null,
                  ),
                }}
                stationName={view.primary.name}
                chartId="buoy-swell-days"
              />
            </div>
          )}
          <div className={`${PROSE} mt-4`}>
            {copy.seasonNote.paragraphs(context).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {seasonNotePhotos.map((photo) => (
            <SeasonPhotoFigure key={photo.slot} photo={photo} className="mt-6 max-w-xl" />
          ))}
        </section>
      )}
```

with, at module level:

```ts
function sumSectors(shares: Record<Sector, number>, sectors: readonly Sector[]): number {
  return Math.round(sectors.reduce((sum, sector) => sum + shares[sector], 0) * 100) / 100;
}
```

(import `Sector` from `@/lib/climatology/types`).

**Page FAQ** (`app/best-time-to-surf/[city]/page.tsx`), best-month answer becomes:

```tsx
      answer:
        seasonView && climatology
          ? seasonCopy?.bestMonthFaq?.({ dataset: climatology, view: seasonView }) ?? seasonView.bestMonthFaq
          : /* the existing template string, unchanged */,
```

**Test additions:**
- `buoy-record-sections.test.tsx`: a case rendering Newport copy (`getSeasonCopy("newport-beach")`) with `makeDataset(FLAT_SCORES, { cityName: "Newport Beach", shoreNormalDeg: 217, places: [Newport Pier, Huntington Beach Pier, Doheny State Beach] })`, the Newport photos, and assert the heading "Why Newport's best days still come in summer", `container.querySelectorAll('[data-testid="swell-days-bar"]').length > 0`, the Wedge photo alt text inside that section, and no "Peak" text in the month table.
- `best-time-city-page.test.ts`: `expect(source).toContain("bestMonthFaq?.(");`.

## Addition to Task 14 (E2E)

In `e2e/guest-best-time-buoy-record.spec.ts`, the Newport case also checks `await expect(page.getByRole("heading", { name: "Why Newport's best days still come in summer" })).toBeVisible();` and that the month table contains no "Peak" label: `await expect(page.getByRole("table").getByText("Peak")).toHaveCount(0);`.
