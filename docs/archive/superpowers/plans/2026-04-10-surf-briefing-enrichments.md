# Surf Briefing Enrichments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the oracle home screen with data-driven strategy tags on Nearby Spots cards, a regional call replacing the generic hero tagline, and a sunset-driven evening transition to tomorrow's briefing.

**Architecture:** All new logic lives in the discovery engine (`surf-discovery-orchestrator.ts`). The API response gets three new fields (`strategyTag` per recommendation, `regionalCall`, `eveningTransition`). Web and native UIs consume these fields with minimal component changes. No new sections or layout changes.

**Tech Stack:** TypeScript, Next.js (web), Expo/React Native (native), existing discovery engine + window selector

**Spec:** `docs/archive/superpowers/specs/2026-04-10-surf-briefing-enrichments-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/services/discovery/strategy-tags.ts` | Strategy tag assignment logic |
| Create | `lib/services/discovery/regional-call.ts` | Regional call template generation |
| Create | `lib/services/discovery/evening-transition.ts` | Sunset-driven tomorrow swap logic |
| Create | `__tests__/lib/services/discovery/strategy-tags.test.ts` | Strategy tag unit tests |
| Create | `__tests__/lib/services/discovery/regional-call.test.ts` | Regional call unit tests |
| Create | `__tests__/lib/services/discovery/evening-transition.test.ts` | Evening transition unit tests |
| Modify | `types/personalization.ts` | Add `StrategyTag`, `EveningTransition` types, extend `SurfDiscoveryRecommendation` and `SurfDiscoveryResponse` |
| Modify | `lib/services/discovery/surf-discovery-orchestrator.ts` | Wire strategy tags, regional call, evening transition into response |
| Modify | `lib/oracle/greeting.ts` | Accept optional `regionalCall` override |
| Modify | `components/oracle/nearby-spots.tsx` | Render strategy tag pill badges |
| Modify | `components/oracle/oracle-home-screen.tsx` | Pass `strategyTag` and `regionalCall` through |
| Modify | `components/oracle/oracle-hero.tsx` | Use `regionalCall` for tagline |
| Modify | `components/oracle/todays-windows.tsx` | Render "Rest of Today" when evening transition active |
| Modify | `../quiver-native/src/types/discovery.ts` | Add `StrategyTag`, `EveningTransition` types |
| Modify | `../quiver-native/src/components/home/nearby-spot-card.tsx` | Render strategy tag pill |
| Modify | `../quiver-native/src/components/home/nearby-spots.tsx` | Pass strategy tag to cards |
| Modify | `../quiver-native/src/components/home/beach-hero.tsx` | Use `regionalCall` for greeting |
| Modify | `../quiver-native/src/components/home/forecast-timeline.tsx` | Render "Rest of Today" row |
| Modify | `../quiver-native/src/screens/home.tsx` | Pass new fields to components |

---

## Task 1: Add Types

**Files:**
- Modify: `types/personalization.ts:27` (add `late-morning` to `TimeSlot`)
- Modify: `types/personalization.ts:193-251` (extend `SurfDiscoveryRecommendation`)
- Modify: `types/personalization.ts:256-285` (extend `SurfDiscoveryResponse`)

- [ ] **Step 1: Add `StrategyTag` type and `late-morning` TimeSlot**

In `types/personalization.ts`, add `'late-morning'` to the `TimeSlot` union and add the `StrategyTag` interface before `DetailedScore`:

```ts
// Update TimeSlot (line 27)
export type TimeSlot = 'any' | 'lunch-session' | 'afternoon' | 'dawn-patrol' | 'late-morning';

// Add before DetailedScore (before line 150)
/**
 * Strategy tag types for surf briefing enrichments.
 * Assigned to non-hero recommendations to highlight their standout trait.
 */
export type StrategyTagType = 'biggest_waves' | 'cleanest' | 'sleep_in' | 'low_crowd' | 'skip';

export interface StrategyTag {
  type: StrategyTagType;
  /** Display label, e.g. "Biggest waves" */
  label: string;
  /** Short reason, e.g. "Offshore at 8am · 13s SSW" */
  reason: string;
}

/**
 * Evening transition data — shown after sunset to preview tomorrow.
 */
export interface EveningTransition {
  active: boolean;
  restOfToday: {
    summary: string;
    conditions: string;
    waveHeight: string;
  };
  tomorrowRegionalCall: string;
}
```

- [ ] **Step 2: Extend `SurfDiscoveryRecommendation`**

Add `strategyTag` field after the `conditionBadges` field (after line 228):

```ts
  /** Strategy tag highlighting this spot's standout trait vs other recommendations */
  strategyTag?: StrategyTag;
```

- [ ] **Step 3: Extend `SurfDiscoveryResponse`**

Add `regionalCall` and `eveningTransition` to the response interface (after `metadata` block, before the closing `}`):

```ts
  /** One-line regional conditions synthesis for hero tagline */
  regionalCall: string;
  /** Evening transition data — present after sunset */
  eveningTransition?: EveningTransition;
```

- [ ] **Step 4: Verify types compile**

Run: `cd quiver && yarn typecheck`
Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add types/personalization.ts
git commit -m "feat: add StrategyTag, EveningTransition, and regionalCall types"
```

---

## Task 2: Strategy Tag Assignment

**Files:**
- Create: `lib/services/discovery/strategy-tags.ts`
- Create: `__tests__/lib/services/discovery/strategy-tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/discovery/strategy-tags.test.ts`:

```ts
import { assignStrategyTags } from '@/lib/services/discovery/strategy-tags';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

function mockRec(overrides: Partial<SurfDiscoveryRecommendation> & { beach: { id: string; name: string; crowd_level?: string } }): SurfDiscoveryRecommendation {
  return {
    beach: { id: overrides.beach.id, name: overrides.beach.name, crowd_level: overrides.beach.crowd_level ?? 'crowded' } as any,
    window: { start: new Date('2026-04-11T12:00:00Z'), end: new Date('2026-04-11T15:00:00Z') } as any,
    forecast: { wave_height: '3-4ft', wind_speed: '5 mph' } as any,
    score: 70,
    matchQuality: 'good' as const,
    subscores: {
      waveHeightFit: 18,
      periodEnergyScore: 14,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: 'Good conditions',
    reasons: [],
    warnings: [],
    waveHeightBadge: '3-4ft',
    generated_at: new Date().toISOString(),
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

describe('assignStrategyTags', () => {
  it('does not tag the hero (index 0)', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero Beach' }, score: 90 }),
      mockRec({ beach: { id: '2', name: 'Other Beach' }, score: 60 }),
    ];
    const result = assignStrategyTags(recs);
    expect(result[0].strategyTag).toBeUndefined();
  });

  it('assigns biggest_waves to the rec with highest waveHeightFit exceeding hero', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' }, subscores: { waveHeightFit: 18, periodEnergyScore: 14, windAlignment: 15, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 }, waveHeightBadge: '3-4ft' }),
      mockRec({ beach: { id: '2', name: 'Big Waves' }, subscores: { waveHeightFit: 24, periodEnergyScore: 14, windAlignment: 12, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 }, waveHeightBadge: '5-6ft' }),
    ];
    const result = assignStrategyTags(recs);
    expect(result[1].strategyTag?.type).toBe('biggest_waves');
  });

  it('assigns cleanest to the rec with highest windAlignment >= 16', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' }, subscores: { waveHeightFit: 20, periodEnergyScore: 14, windAlignment: 14, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 } }),
      mockRec({ beach: { id: '2', name: 'Glassy' }, subscores: { waveHeightFit: 15, periodEnergyScore: 14, windAlignment: 19, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 } }),
    ];
    const result = assignStrategyTags(recs);
    expect(result[1].strategyTag?.type).toBe('cleanest');
  });

  it('assigns low_crowd to rec with light/moderate crowd and score >= 40', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' } }),
      mockRec({ beach: { id: '2', name: 'Quiet Spot', crowd_level: 'light' }, score: 55 }),
    ];
    const result = assignStrategyTags(recs);
    expect(result[1].strategyTag?.type).toBe('low_crowd');
  });

  it('assigns skip to recs with score < 40', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' }, score: 80 }),
      mockRec({ beach: { id: '2', name: 'Bad Spot' }, score: 30 }),
      mockRec({ beach: { id: '3', name: 'Also Bad' }, score: 25 }),
    ];
    const result = assignStrategyTags(recs);
    expect(result[1].strategyTag?.type).toBe('skip');
    expect(result[2].strategyTag?.type).toBe('skip');
  });

  it('assigns each non-skip tag at most once', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' }, score: 90 }),
      mockRec({ beach: { id: '2', name: 'Big1' }, subscores: { waveHeightFit: 24, periodEnergyScore: 14, windAlignment: 12, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 }, waveHeightBadge: '5-6ft' }),
      mockRec({ beach: { id: '3', name: 'Big2' }, subscores: { waveHeightFit: 23, periodEnergyScore: 14, windAlignment: 12, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 }, waveHeightBadge: '4-5ft' }),
    ];
    const result = assignStrategyTags(recs);
    const biggestCount = result.filter(r => r.strategyTag?.type === 'biggest_waves').length;
    expect(biggestCount).toBe(1);
  });

  it('respects priority: biggest_waves > cleanest > low_crowd', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'Hero' }, subscores: { waveHeightFit: 15, periodEnergyScore: 14, windAlignment: 14, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 }, waveHeightBadge: '2-3ft' }),
      mockRec({
        beach: { id: '2', name: 'Multi', crowd_level: 'light' },
        subscores: { waveHeightFit: 24, periodEnergyScore: 14, windAlignment: 19, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        waveHeightBadge: '5-6ft',
        score: 85,
      }),
    ];
    const result = assignStrategyTags(recs);
    // Beach qualifies for biggest_waves, cleanest, AND low_crowd — should get biggest_waves
    expect(result[1].strategyTag?.type).toBe('biggest_waves');
  });

  it('returns recs unchanged when only one recommendation', () => {
    const recs = [mockRec({ beach: { id: '1', name: 'Hero' } })];
    const result = assignStrategyTags(recs);
    expect(result[0].strategyTag).toBeUndefined();
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/strategy-tags.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement strategy tag assignment**

Create `lib/services/discovery/strategy-tags.ts`:

```ts
import type { SurfDiscoveryRecommendation, StrategyTag, StrategyTagType } from '@/types/personalization';

const TAG_LABELS: Record<StrategyTagType, string> = {
  biggest_waves: 'Biggest waves',
  cleanest: 'Cleanest',
  sleep_in: 'Sleep-in friendly',
  low_crowd: 'Low crowd',
  skip: 'Skip',
};

/**
 * Assign at most one strategy tag per non-hero recommendation.
 * Hero (index 0) never gets a tag. Each non-skip tag type is
 * assigned at most once. Priority: biggest_waves > cleanest > low_crowd > sleep_in > skip.
 *
 * Mutates the input array's strategyTag fields and returns it.
 */
export function assignStrategyTags(
  recs: SurfDiscoveryRecommendation[],
  sleepInScores?: Map<string, number>,
): SurfDiscoveryRecommendation[] {
  if (recs.length <= 1) return recs;

  const hero = recs[0];
  const candidates = recs.slice(1);
  const assigned = new Set<StrategyTagType>();
  const taggedBeaches = new Set<string>();

  // --- biggest_waves ---
  const biggestCandidate = candidates
    .filter(r => r.subscores.waveHeightFit > hero.subscores.waveHeightFit)
    .sort((a, b) => b.subscores.waveHeightFit - a.subscores.waveHeightFit)[0];

  if (biggestCandidate) {
    biggestCandidate.strategyTag = {
      type: 'biggest_waves',
      label: TAG_LABELS.biggest_waves,
      reason: buildReason(biggestCandidate),
    };
    assigned.add('biggest_waves');
    taggedBeaches.add(biggestCandidate.beach.id);
  }

  // --- cleanest ---
  const cleanestCandidate = candidates
    .filter(r => !taggedBeaches.has(r.beach.id) && r.subscores.windAlignment >= 16)
    .sort((a, b) => b.subscores.windAlignment - a.subscores.windAlignment)[0];

  if (cleanestCandidate) {
    cleanestCandidate.strategyTag = {
      type: 'cleanest',
      label: TAG_LABELS.cleanest,
      reason: buildReason(cleanestCandidate),
    };
    assigned.add('cleanest');
    taggedBeaches.add(cleanestCandidate.beach.id);
  }

  // --- low_crowd ---
  const crowdLevel = (r: SurfDiscoveryRecommendation) =>
    (r.beach as any).crowd_level as string | undefined;

  const lowCrowdCandidate = candidates
    .filter(r =>
      !taggedBeaches.has(r.beach.id) &&
      r.score >= 40 &&
      (crowdLevel(r) === 'light' || crowdLevel(r) === 'moderate')
    )
    .sort((a, b) => b.score - a.score)[0];

  if (lowCrowdCandidate) {
    lowCrowdCandidate.strategyTag = {
      type: 'low_crowd',
      label: TAG_LABELS.low_crowd,
      reason: buildReason(lowCrowdCandidate),
    };
    assigned.add('low_crowd');
    taggedBeaches.add(lowCrowdCandidate.beach.id);
  }

  // --- sleep_in ---
  if (sleepInScores) {
    const sleepInCandidate = candidates
      .filter(r => {
        if (taggedBeaches.has(r.beach.id)) return false;
        const lateScore = sleepInScores.get(r.beach.id);
        if (lateScore == null) return false;
        return lateScore >= r.score * 0.7;
      })
      .sort((a, b) => b.score - a.score)[0];

    if (sleepInCandidate) {
      sleepInCandidate.strategyTag = {
        type: 'sleep_in',
        label: TAG_LABELS.sleep_in,
        reason: `Holds ${sleepInCandidate.waveHeightBadge ?? 'size'} past 9am`,
      };
      assigned.add('sleep_in');
      taggedBeaches.add(sleepInCandidate.beach.id);
    }
  }

  // --- skip (multiple allowed) ---
  for (const rec of candidates) {
    if (!taggedBeaches.has(rec.beach.id) && rec.score < 40) {
      rec.strategyTag = {
        type: 'skip',
        label: TAG_LABELS.skip,
        reason: rec.warnings[0] ?? 'Conditions not favorable',
      };
    }
  }

  return recs;
}

function buildReason(rec: SurfDiscoveryRecommendation): string {
  const parts: string[] = [];
  const forecast = rec.forecast;

  if (forecast.wind_speed) {
    const speed = forecast.wind_speed;
    if (/^0\s*(mph|kn)/i.test(speed)) {
      parts.push('Glassy');
    } else if (forecast.wind_direction) {
      parts.push(`${speed} ${forecast.wind_direction}`);
    }
  }

  if (forecast.swell_1_period && forecast.swell_1_direction) {
    parts.push(`${forecast.swell_1_period} ${forecast.swell_1_direction}`);
  }

  return parts.join(' · ') || rec.summary;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/strategy-tags.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/discovery/strategy-tags.ts __tests__/lib/services/discovery/strategy-tags.test.ts
git commit -m "feat: add strategy tag assignment for discovery recommendations"
```

---

## Task 3: Regional Call Generation

**Files:**
- Create: `lib/services/discovery/regional-call.ts`
- Create: `__tests__/lib/services/discovery/regional-call.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/discovery/regional-call.test.ts`:

```ts
import { generateRegionalCall } from '@/lib/services/discovery/regional-call';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

function mockRec(overrides: Record<string, any>): SurfDiscoveryRecommendation {
  return {
    beach: { id: '1', name: 'Test Beach', aspect_deg: 180 } as any,
    forecast: {
      swell_1_direction: 'SSW',
      swell_1_period: '13s',
      wind_speed: '5 mph',
      wind_direction: 'NW',
    } as any,
    window: { start: new Date('2026-04-11T12:00:00Z') } as any,
    score: 70,
    subscores: { waveHeightFit: 18, periodEnergyScore: 14, windAlignment: 15, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

describe('generateRegionalCall', () => {
  it('includes dominant swell direction and period', () => {
    const recs = [
      mockRec({ forecast: { swell_1_direction: 'SSW', swell_1_period: '13s', wind_speed: '5 mph', wind_direction: 'NW' } }),
      mockRec({ forecast: { swell_1_direction: 'SSW', swell_1_period: '12s', wind_speed: '5 mph', wind_direction: 'NW' } }),
      mockRec({ forecast: { swell_1_direction: 'SSW', swell_1_period: '13s', wind_speed: '5 mph', wind_direction: 'W' } }),
    ];
    const call = generateRegionalCall(recs);
    expect(call).toContain('SSW');
    expect(call).toMatch(/13s|12s/);
  });

  it('includes wind trend when dawn and midday differ', () => {
    const recs = [
      mockRec({}),
    ];
    const dawnWind = { speed: '0 mph', direction: '' };
    const middayWind = { speed: '10 mph', direction: 'SW' };
    const call = generateRegionalCall(recs, { dawnWind, middayWind });
    expect(call.toLowerCase()).toContain('glassy');
    expect(call.toLowerCase()).toContain('onshore');
  });

  it('returns flat-day fallback when no swell data', () => {
    const recs = [
      mockRec({ forecast: { swell_1_direction: null, swell_1_period: null, wind_speed: '5 mph', wind_direction: 'NW' } }),
    ];
    const call = generateRegionalCall(recs);
    expect(call).toBeTruthy();
    expect(call.length).toBeGreaterThan(5);
  });

  it('includes aspect advantage when top recs share facing', () => {
    const recs = [
      mockRec({ beach: { id: '1', name: 'A', aspect_deg: 190 } }),
      mockRec({ beach: { id: '2', name: 'B', aspect_deg: 200 } }),
      mockRec({ beach: { id: '3', name: 'C', aspect_deg: 195 } }),
    ];
    const call = generateRegionalCall(recs);
    expect(call.toLowerCase()).toContain('south');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/regional-call.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement regional call generation**

Create `lib/services/discovery/regional-call.ts`:

```ts
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

interface WindSnapshot {
  speed: string;
  direction: string;
}

interface RegionalCallOptions {
  dawnWind?: WindSnapshot;
  middayWind?: WindSnapshot;
}

/**
 * Generate a one-line regional conditions synthesis from ranked recommendations.
 * Deterministic template — no LLM.
 */
export function generateRegionalCall(
  recs: SurfDiscoveryRecommendation[],
  options?: RegionalCallOptions,
): string {
  const parts: string[] = [];

  // 1. Dominant swell
  const swellClause = buildSwellClause(recs);
  if (swellClause) parts.push(swellClause);

  // 2. Aspect advantage
  const aspectClause = buildAspectClause(recs);
  if (aspectClause) parts.push(aspectClause);

  // 3. Wind trend
  const windClause = buildWindClause(recs, options);
  if (windClause) parts.push(windClause);

  if (parts.length === 0) {
    return 'Small surf, pick your spot for fun.';
  }

  // Join swell + aspect with space, then wind with " · "
  const swellAspect = [swellClause, aspectClause].filter(Boolean).join(' ');
  if (swellAspect && windClause) {
    return `${swellAspect} · ${windClause}`;
  }
  return parts.join(' · ');
}

function buildSwellClause(recs: SurfDiscoveryRecommendation[]): string | null {
  const directions: string[] = [];
  const periods: number[] = [];

  for (const rec of recs.slice(0, 5)) {
    const dir = rec.forecast.swell_1_direction;
    const per = rec.forecast.swell_1_period;
    if (dir) directions.push(dir);
    if (per) {
      const num = parseInt(per, 10);
      if (!isNaN(num)) periods.push(num);
    }
  }

  if (directions.length === 0) return null;

  const dominant = mode(directions);
  const avgPeriod = periods.length > 0 ? Math.round(median(periods)) : null;

  if (avgPeriod) {
    return `${dominant} swell at ${avgPeriod}s`;
  }
  return `${dominant} swell`;
}

function buildAspectClause(recs: SurfDiscoveryRecommendation[]): string | null {
  const aspects = recs
    .slice(0, 5)
    .map(r => (r.beach as any).aspect_deg as number | undefined)
    .filter((a): a is number => a != null);

  if (aspects.length < 2) return null;

  const avgAspect = circularMean(aspects);
  const spread = aspects.reduce((max, a) => {
    const diff = Math.abs(((a - avgAspect + 540) % 360) - 180);
    return Math.max(max, diff);
  }, 0);

  // Only report aspect if top recs are within 45 degrees of each other
  if (spread > 45) return null;

  const facing = aspectToFacing(avgAspect);
  return `favoring ${facing}-facing breaks`;
}

function buildWindClause(
  recs: SurfDiscoveryRecommendation[],
  options?: RegionalCallOptions,
): string | null {
  if (options?.dawnWind && options?.middayWind) {
    const dawnCalm = isCalm(options.dawnWind.speed);
    const middaySpeed = parseSpeed(options.middayWind.speed);

    if (dawnCalm && middaySpeed >= 8) {
      return `Glassy at dawn, onshore by 11am`;
    }
    if (dawnCalm) {
      return 'Glassy at dawn';
    }
    if (middaySpeed >= 10) {
      return `Onshore building to ${options.middayWind.speed} by midday`;
    }
  }

  // Fallback: check hero's wind
  const heroWind = recs[0]?.forecast?.wind_speed;
  if (heroWind && isCalm(heroWind)) {
    return 'Light winds';
  }

  return null;
}

function isCalm(speed: string): boolean {
  return /^0\s*(mph|kn)/i.test(speed) || speed === '0';
}

function parseSpeed(speed: string): number {
  const match = speed.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function mode(arr: string[]): string {
  const counts = new Map<string, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [k, v] of counts) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function circularMean(degrees: number[]): number {
  const rads = degrees.map(d => (d * Math.PI) / 180);
  const sinSum = rads.reduce((s, r) => s + Math.sin(r), 0);
  const cosSum = rads.reduce((s, r) => s + Math.cos(r), 0);
  let mean = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  if (mean < 0) mean += 360;
  return mean;
}

function aspectToFacing(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'north';
  if (normalized < 67.5) return 'northeast';
  if (normalized < 112.5) return 'east';
  if (normalized < 157.5) return 'southeast';
  if (normalized < 202.5) return 'south';
  if (normalized < 247.5) return 'southwest';
  if (normalized < 292.5) return 'west';
  return 'northwest';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/regional-call.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/discovery/regional-call.ts __tests__/lib/services/discovery/regional-call.test.ts
git commit -m "feat: add deterministic regional call generation"
```

---

## Task 4: Evening Transition Logic

**Files:**
- Create: `lib/services/discovery/evening-transition.ts`
- Create: `__tests__/lib/services/discovery/evening-transition.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/discovery/evening-transition.test.ts`:

```ts
import { isAfterSunset, buildRestOfToday } from '@/lib/services/discovery/evening-transition';

describe('isAfterSunset', () => {
  it('returns true when current time is past sunset', () => {
    const now = new Date('2026-04-11T03:30:00Z'); // 8:30pm PDT
    const sunTimesCache = new Map([
      ['beach-1', { sunrises: [new Date('2026-04-11T13:30:00Z')], sunsets: [new Date('2026-04-11T02:45:00Z')] }],
    ]);
    expect(isAfterSunset('beach-1', now, sunTimesCache)).toBe(true);
  });

  it('returns false when current time is before sunset', () => {
    const now = new Date('2026-04-11T00:00:00Z'); // 5:00pm PDT
    const sunTimesCache = new Map([
      ['beach-1', { sunrises: [new Date('2026-04-11T13:30:00Z')], sunsets: [new Date('2026-04-11T02:45:00Z')] }],
    ]);
    expect(isAfterSunset('beach-1', now, sunTimesCache)).toBe(false);
  });

  it('returns false when no sunset data available', () => {
    const now = new Date('2026-04-11T03:30:00Z');
    const sunTimesCache = new Map<string, { sunrises: Date[]; sunsets: Date[] }>();
    expect(isAfterSunset('beach-1', now, sunTimesCache)).toBe(false);
  });
});

describe('buildRestOfToday', () => {
  it('builds summary from remaining window', () => {
    const window = {
      start: new Date('2026-04-11T00:00:00Z'),
      end: new Date('2026-04-11T03:00:00Z'),
      waveHeight: '2-3ft',
      windSpeed: '5 mph',
      windDirection: 'offshore',
      tideHeight: '2.1ft',
      tideStatus: 'Falling',
      title: 'Evening glass-off possible',
    };
    const result = buildRestOfToday(window as any, 'America/Los_Angeles');
    expect(result.summary).toBeTruthy();
    expect(result.waveHeight).toBe('2-3ft');
    expect(result.conditions).toContain('5 mph');
  });

  it('returns "Done for today" when no window provided', () => {
    const result = buildRestOfToday(null, 'America/Los_Angeles');
    expect(result.summary).toBe('Done for today');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/evening-transition.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement evening transition**

Create `lib/services/discovery/evening-transition.ts`:

```ts
import type { EveningTransition } from '@/types/personalization';
import type { PersonalizedForecastWindow } from '@/types/personalization';

type SunTimesCache = Map<string, { sunrises: Date[]; sunsets: Date[] }>;

/**
 * Check if current time is past sunset for a given beach.
 */
export function isAfterSunset(
  beachId: string,
  now: Date,
  sunTimesCache: SunTimesCache,
): boolean {
  const sunTimes = sunTimesCache.get(beachId);
  if (!sunTimes?.sunsets.length) return false;

  // Find today's sunset (closest sunset that hasn't been more than 12 hours ago)
  const todaySunset = sunTimes.sunsets.find(s => {
    const diff = now.getTime() - s.getTime();
    return diff > 0 && diff < 12 * 60 * 60 * 1000;
  });

  if (!todaySunset) {
    // Check if any sunset is in the past today
    return sunTimes.sunsets.some(s => s.getTime() < now.getTime());
  }

  return now.getTime() > todaySunset.getTime();
}

/**
 * Build the condensed "Rest of Today" summary from the remaining best window.
 */
export function buildRestOfToday(
  remainingWindow: PersonalizedForecastWindow | null,
  timezone: string,
): EveningTransition['restOfToday'] {
  if (!remainingWindow) {
    return {
      summary: 'Done for today',
      conditions: '',
      waveHeight: '—',
    };
  }

  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: undefined,
    hour12: true,
    timeZone: timezone,
  }).format(remainingWindow.start);

  const conditionParts = [hour];
  if (remainingWindow.windSpeed) {
    conditionParts.push(`${remainingWindow.windSpeed} ${remainingWindow.windDirection ?? ''}`.trim());
  }
  if (remainingWindow.waveHeight) {
    conditionParts.push(remainingWindow.waveHeight);
  }
  if (remainingWindow.tideStatus) {
    const tidePart = remainingWindow.tideHeight
      ? `${remainingWindow.tideHeight} ${remainingWindow.tideStatus}`
      : remainingWindow.tideStatus;
    conditionParts.push(tidePart);
  }

  return {
    summary: remainingWindow.title ?? 'Evening session',
    conditions: conditionParts.join(' · '),
    waveHeight: remainingWindow.waveHeight ?? '—',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/evening-transition.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/discovery/evening-transition.ts __tests__/lib/services/discovery/evening-transition.test.ts
git commit -m "feat: add sunset-driven evening transition logic"
```

---

## Task 5: Wire Into Discovery Orchestrator

**Files:**
- Modify: `lib/services/discovery/surf-discovery-orchestrator.ts` (~lines 727-844, the response assembly section)

- [ ] **Step 1: Add imports at the top of the orchestrator**

Add after existing imports (around line 25):

```ts
import { assignStrategyTags } from '@/lib/services/discovery/strategy-tags';
import { generateRegionalCall } from '@/lib/services/discovery/regional-call';
import { isAfterSunset, buildRestOfToday } from '@/lib/services/discovery/evening-transition';
```

- [ ] **Step 2: Compute sleep-in scores for strategy tags**

In `discoverSurfSpotsInner`, after the main recommendation assembly (after the `allRecs` array is built and sorted, around line 746), add the sleep-in re-scoring pass:

```ts
// --- Sleep-in re-scoring for strategy tags ---
const sleepInScores = new Map<string, number>();
for (const rec of topRecs.slice(1)) {
  const lateWindow = selectBestWindow({
    forecasts: beachForecastMap.get(rec.beach.id) ?? [],
    beach: rec.beach,
    userPrefs,
    horizonHours,
    sunTimesCache,
    timeSlot: 'late-morning' as any,
  });
  if (lateWindow) {
    const lateScore = scoreBeachForDiscovery({
      beach: rec.beach,
      forecast: lateWindow.forecast,
      window: lateWindow,
      userPrefs,
      sunTimesCache,
      personalizationCtx,
      userLocation: options.userLocation,
    });
    sleepInScores.set(rec.beach.id, lateScore.total);
  }
}
```

Note: `beachForecastMap` is the map of beach ID → forecasts built earlier in the function. Read the orchestrator code to find the exact variable name — it may be stored differently. The key is to re-run `selectBestWindow` with `timeSlot: 'late-morning'` for each non-hero candidate.

- [ ] **Step 3: Add `late-morning` handling to window selector filter**

Read `lib/services/discovery/window-selector/window-selector-core.ts` to find the `filterByTimeSlot` function (around lines 116-143). Add a case for `'late-morning'`:

```ts
case 'late-morning':
  return forecasts.filter(f => {
    const hour = getLocalHour(f, beachTz);
    return hour >= 9 && hour <= 14; // 9am - 2pm
  });
```

- [ ] **Step 4: Assign strategy tags and generate regional call**

After the sleep-in scoring block and photo enrichment, before the return statement:

```ts
// --- Strategy tags ---
assignStrategyTags(topRecs, sleepInScores);

// --- Regional call ---
// Build wind snapshots from hero's slot forecasts for dawn (5am) and midday (11am)
const heroSlots = topRecs[0]?.slotForecasts;
const dawnWind = heroSlots?.[5]
  ? { speed: heroSlots[5].windSpeed ?? '0 mph', direction: heroSlots[5].windDirection ?? '' }
  : undefined;
const middayWind = heroSlots?.[11]
  ? { speed: heroSlots[11].windSpeed ?? '0 mph', direction: heroSlots[11].windDirection ?? '' }
  : undefined;
const regionalCall = generateRegionalCall(topRecs, { dawnWind, middayWind });
```

- [ ] **Step 5: Build evening transition if past sunset**

After the regional call:

```ts
// --- Evening transition ---
let eveningTransition: EveningTransition | undefined;
const heroBeachId = topRecs[0]?.beach?.id;
if (heroBeachId && isAfterSunset(heroBeachId, new Date(), sunTimesCache)) {
  // Find remaining today window
  const todayForecasts = beachForecastMap.get(heroBeachId) ?? [];
  const todayStr = getLocalDateStr(new Date(), getTimezoneFromCoords(topRecs[0].beach.lat ?? 0, topRecs[0].beach.lon ?? 0));
  const remainingToday = todayForecasts.filter(f =>
    getLocalDateStr(new Date(f.forecast_at), getTimezoneFromCoords(topRecs[0].beach.lat ?? 0, topRecs[0].beach.lon ?? 0)) === todayStr
  );
  const remainingWindow = remainingToday.length > 0
    ? selectBestWindow({ forecasts: remainingToday, beach: topRecs[0].beach, userPrefs, sunTimesCache })
    : null;

  const beachTz = getTimezoneFromCoords(topRecs[0].beach.lat ?? 0, topRecs[0].beach.lon ?? 0);
  eveningTransition = {
    active: true,
    restOfToday: buildRestOfToday(remainingWindow, beachTz),
    tomorrowRegionalCall: regionalCall, // Already computed from tomorrow's data due to natural fallthrough
  };
}
```

- [ ] **Step 6: Add regionalCall and eveningTransition to the response**

In the return statement (around line 830-844), add the new fields:

```ts
return {
  recommendations: topRecs,
  regionalCall,
  eveningTransition,
  searchCriteria: { ... },
  metadata: { ... },
};
```

- [ ] **Step 7: Verify types compile**

Run: `cd quiver && yarn typecheck`
Expected: PASS

- [ ] **Step 8: Run existing orchestrator tests**

Run: `cd quiver && yarn test __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
Expected: PASS (no regressions)

- [ ] **Step 9: Commit**

```bash
git add lib/services/discovery/surf-discovery-orchestrator.ts lib/services/discovery/window-selector/window-selector-core.ts
git commit -m "feat: wire strategy tags, regional call, and evening transition into discovery"
```

---

## Task 6: Web UI — Nearby Spots Strategy Tags

**Files:**
- Modify: `components/oracle/nearby-spots.tsx`
- Modify: `components/oracle/oracle-home-screen.tsx` (~lines 235-255, `transformToNearbySpots`)

- [ ] **Step 1: Extend `NearbySpot` interface**

In `components/oracle/nearby-spots.tsx`, add `strategyTag` to the interface (after line 17):

```ts
export interface NearbySpot {
  id: string;
  name: string;
  conditions: string;
  height: string;
  photoUrl: string | null;
  score?: number;
  skillMismatch?: boolean;
  strategyTag?: {
    type: string;
    label: string;
    reason: string;
  };
}
```

- [ ] **Step 2: Add tag color map and render pill in SpotCard**

Add the color map above `SpotCard`:

```ts
const STRATEGY_TAG_COLORS: Record<string, string> = {
  biggest_waves: '#F78E42',
  cleanest: '#22C55E',
  sleep_in: '#8B5CF6',
  low_crowd: '#06B6D4',
  skip: '#EF4444',
};
```

In the `SpotCard` component, add the pill badge inside the photo `<div>` (the `h-[90px]` container), after the `<Image>` or gradient fallback, as a positioned element:

```tsx
{/* Inside the h-[90px] div, add: */}
{spot.strategyTag && (
  <span
    className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wide"
    style={{ backgroundColor: STRATEGY_TAG_COLORS[spot.strategyTag.type] ?? '#6B7280' }}
  >
    {spot.strategyTag.label}
  </span>
)}
```

Make the photo container `relative` by adding `relative` to its className.

- [ ] **Step 3: Apply skip card opacity**

On the outer card `<div>`, conditionally add reduced opacity:

```tsx
className={`bg-[#2D357D] border border-[#404C92] noise-texture rounded-xl w-[280px] min-w-[280px] flex-shrink-0 snap-start cursor-pointer${spot.strategyTag?.type === 'skip' ? ' opacity-60' : ''}`}
```

- [ ] **Step 4: Use tag reason for conditions text**

In the conditions `<p>` tag, prefer the tag reason when available:

```tsx
<p className="text-medium text-xs line-clamp-1">
  {spot.strategyTag?.reason ?? spot.conditions}
</p>
```

- [ ] **Step 5: Pass strategyTag through in oracle-home-screen.tsx**

In `transformToNearbySpots` (around line 235-255), pass through the `strategyTag`:

```ts
return remainingSpots.map((rec) => ({
  id: rec.beach.id,
  name: rec.beach.name,
  conditions: rec.summary,
  height: rec.waveHeightBadge ?? rec.forecast.wave_height ?? "—",
  photoUrl: rec.beach.photo_url ?? null,
  score: rec.score,
  skillMismatch: /* existing logic */,
  strategyTag: rec.strategyTag,
}));
```

- [ ] **Step 6: Verify it builds**

Run: `cd quiver && yarn typecheck && yarn build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/oracle/nearby-spots.tsx components/oracle/oracle-home-screen.tsx
git commit -m "feat: render strategy tag pills on nearby spots cards"
```

---

## Task 7: Web UI — Regional Call in Hero

**Files:**
- Modify: `components/oracle/oracle-hero.tsx` (~line 137-148)
- Modify: `components/oracle/oracle-home-screen.tsx` (pass `regionalCall` to hero)

- [ ] **Step 1: Add `regionalCall` prop to OracleHero**

Find the props interface in `oracle-hero.tsx` and add:

```ts
regionalCall?: string;
```

- [ ] **Step 2: Use regionalCall when available**

In the greeting computation (lines 137-148), prefer `regionalCall` over `getOracleGreeting`:

```ts
const greeting = regionalCall ?? (() => {
  const hour = getHourInTimezone(new Date(), timezone || "America/Los_Angeles");
  return getOracleGreeting({
    score,
    hour,
    swellPeriod,
    windCondition: windCondition ?? null,
    userName: userName ?? "Surfer",
    beachName: beachName ?? null,
    daysAbsent,
  });
})();
```

- [ ] **Step 3: Pass regionalCall from oracle-home-screen.tsx**

Where `OracleHero` is rendered (search for `<OracleHero`), pass the new prop:

```tsx
<OracleHero
  {...existingProps}
  regionalCall={oracle.discovery?.regionalCall}
/>
```

This requires the `useSurfDiscovery` hook's response to include `regionalCall`. Check that the hook reads the full `SurfDiscoveryResponse` and surfaces the field. It likely returns `discovery.recommendations` — you may need to also expose `discovery.regionalCall` from the hook. Read `hooks/use-oracle-data.ts` to confirm and wire it through.

- [ ] **Step 4: Verify it builds**

Run: `cd quiver && yarn typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/oracle/oracle-hero.tsx components/oracle/oracle-home-screen.tsx hooks/use-oracle-data.ts
git commit -m "feat: use regional call for hero tagline"
```

---

## Task 8: Web UI — Evening Transition in TodaysWindows

**Files:**
- Modify: `components/oracle/todays-windows.tsx`
- Modify: `components/oracle/oracle-home-screen.tsx`

- [ ] **Step 1: Add `eveningTransition` prop**

Extend `TodaysWindowsProps` in `todays-windows.tsx`:

```ts
export interface TodaysWindowsProps {
  windows: TimeWindow[];
  preferredTime: string | null;
  forecastUrl?: string;
  isTomorrow?: boolean;
  eveningTransition?: {
    active: boolean;
    restOfToday: {
      summary: string;
      conditions: string;
      waveHeight: string;
    };
  };
}
```

- [ ] **Step 2: Render "Rest of Today" card when active**

Before the existing `<div>` with the windows, add:

```tsx
{eveningTransition?.active && eveningTransition.restOfToday.summary !== 'Done for today' && (
  <div className="mb-4">
    <h3 className="text-sm font-semibold text-medium mb-2">Rest of Today</h3>
    <div className="noise-texture rounded-lg border border-[#404C92] bg-[#2D357D] px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{eveningTransition.restOfToday.summary}</p>
        <p className="text-xs text-medium mt-0.5">{eveningTransition.restOfToday.conditions}</p>
      </div>
      <span className="text-sm font-bold text-[#4A70D9] shrink-0 ml-3">
        {eveningTransition.restOfToday.waveHeight}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 3: Pass eveningTransition from oracle-home-screen.tsx**

Where `TodaysWindows` is rendered, add the prop:

```tsx
<TodaysWindows
  {...existingProps}
  eveningTransition={oracle.discovery?.eveningTransition}
/>
```

Wire `eveningTransition` through from the discovery response in `use-oracle-data.ts`, same as `regionalCall`.

- [ ] **Step 4: Verify it builds**

Run: `cd quiver && yarn typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/oracle/todays-windows.tsx components/oracle/oracle-home-screen.tsx hooks/use-oracle-data.ts
git commit -m "feat: render 'Rest of Today' card in evening transition"
```

---

## Task 9: Native — Types and NearbySpotCard

**Files:**
- Modify: `../quiver-native/src/types/discovery.ts`
- Modify: `../quiver-native/src/components/home/nearby-spot-card.tsx`
- Modify: `../quiver-native/src/components/home/nearby-spots.tsx`

- [ ] **Step 1: Add types to native discovery.ts**

Add to `../quiver-native/src/types/discovery.ts`:

```ts
export type StrategyTagType = 'biggest_waves' | 'cleanest' | 'sleep_in' | 'low_crowd' | 'skip';

export interface StrategyTag {
  type: StrategyTagType;
  label: string;
  reason: string;
}

export interface EveningTransition {
  active: boolean;
  restOfToday: {
    summary: string;
    conditions: string;
    waveHeight: string;
  };
  tomorrowRegionalCall: string;
}
```

Add `strategyTag?: StrategyTag;` to the existing `SurfDiscoveryRecommendation` interface.

Add to the `DiscoveryResponse` interface (or equivalent):

```ts
regionalCall: string;
eveningTransition?: EveningTransition;
```

- [ ] **Step 2: Add strategyTag prop to NearbySpotCard**

In `../quiver-native/src/components/home/nearby-spot-card.tsx`, extend `NearbySpotCardProps`:

```ts
export interface NearbySpotCardProps {
  beach: {
    id: string;
    name: string;
    photo_url?: string | null;
    matchText?: string;
    waveHeight?: string;
    strategyTag?: StrategyTag;
  };
  onPress: (beachId: string) => void;
}
```

- [ ] **Step 3: Render pill badge in NearbySpotCard**

Add the color map:

```ts
const TAG_COLORS: Record<string, string> = {
  biggest_waves: '#F78E42',
  cleanest: '#22C55E',
  sleep_in: '#8B5CF6',
  low_crowd: '#06B6D4',
  skip: '#EF4444',
};
```

Inside the card's image container, render the pill:

```tsx
{beach.strategyTag && (
  <View style={[styles.tagPill, { backgroundColor: TAG_COLORS[beach.strategyTag.type] ?? '#6B7280' }]}>
    <Text style={styles.tagText}>{beach.strategyTag.label}</Text>
  </View>
)}
```

Add styles:

```ts
tagPill: {
  position: 'absolute',
  top: 6,
  left: 6,
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
},
tagText: {
  color: '#fff',
  fontSize: 10,
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
},
```

Apply `opacity: 0.6` to skip cards on the outer container.

- [ ] **Step 4: Pass strategyTag through in nearby-spots.tsx**

In the discovery data mapping (lines 34-44), add `strategyTag`:

```ts
return discoverySpots!.map((rec) => ({
  id: rec.beach.id,
  name: rec.beach.name,
  photo_url: rec.beach.photo_url ?? null,
  waveHeight: rec.waveHeightBadge ?? undefined,
  matchText: rec.matchQuality === 'perfect' || rec.matchQuality === 'excellent'
    ? `${Math.round(rec.score)}/100`
    : undefined,
  strategyTag: rec.strategyTag,
}));
```

- [ ] **Step 5: Verify it compiles**

Run: `cd ../quiver-native && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ../quiver-native/src/types/discovery.ts ../quiver-native/src/components/home/nearby-spot-card.tsx ../quiver-native/src/components/home/nearby-spots.tsx
git commit -m "feat(native): add strategy tag pills to nearby spot cards"
```

---

## Task 10: Native — Hero Regional Call and Evening Transition

**Files:**
- Modify: `../quiver-native/src/components/home/beach-hero.tsx`
- Modify: `../quiver-native/src/components/home/forecast-timeline.tsx`
- Modify: `../quiver-native/src/screens/home.tsx`
- Modify: `../quiver-native/src/hooks/use-surf-discovery.ts`

- [ ] **Step 1: Surface regionalCall and eveningTransition from the discovery hook**

In `../quiver-native/src/hooks/use-surf-discovery.ts`, the hook currently returns only `res.data.recommendations`. Change it to return the full response shape so consumers can access `regionalCall` and `eveningTransition`:

```ts
export function useSurfDiscovery(lat?: number | null, lon?: number | null) {
  // ... existing code ...
  return useQuery({
    queryKey: ['surf-discovery', lat, lon],
    queryFn: async (): Promise<{
      recommendations: SurfDiscoveryRecommendation[];
      regionalCall?: string;
      eveningTransition?: EveningTransition;
    }> => {
      // ... existing fetch code ...
      return {
        recommendations: res.data.recommendations,
        regionalCall: res.data.regionalCall,
        eveningTransition: res.data.eveningTransition,
      };
    },
    // ... existing options ...
  });
}
```

Update all existing consumers that access `.data` to now use `.data?.recommendations` instead of `.data` directly. Search the native codebase for `useSurfDiscovery` usages.

- [ ] **Step 2: Pass regionalCall to BeachHero**

In `../quiver-native/src/screens/home.tsx`, where `BeachHero` is rendered, pass `regionalCall`:

```tsx
<BeachHero
  {...existingProps}
  greeting={discoveryResults?.regionalCall ?? heroGreeting}
/>
```

The `greeting` prop on `BeachHero` already renders as the tagline (line 114: `<Text style={styles.greeting}>{greeting}</Text>`). No changes needed to `beach-hero.tsx` — just pass `regionalCall` as the greeting value.

- [ ] **Step 3: Add eveningTransition to ForecastTimeline**

In `../quiver-native/src/components/home/forecast-timeline.tsx`, add the `eveningTransition` prop:

```ts
interface ForecastTimelineProps {
  beachId: string;
  beachName: string;
  onTimeSlotPress?: (hour: number) => void;
  eveningTransition?: EveningTransition;
}
```

Render the "Rest of Today" row before the existing timeline when active:

```tsx
{eveningTransition?.active && eveningTransition.restOfToday.summary !== 'Done for today' && (
  <YStack marginBottom="$3">
    <Text fontSize={13} fontWeight="600" color="$gray10" marginBottom="$1.5">Rest of Today</Text>
    <XStack
      backgroundColor="$blue2"
      borderRadius="$3"
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      justifyContent="space-between"
      alignItems="center"
    >
      <YStack flex={1}>
        <Text fontSize={13} fontWeight="600" color="white">{eveningTransition.restOfToday.summary}</Text>
        <Text fontSize={11} color="$gray10" marginTop="$0.5">{eveningTransition.restOfToday.conditions}</Text>
      </YStack>
      <Text fontSize={14} fontWeight="700" color="$blue9" marginLeft="$2">{eveningTransition.restOfToday.waveHeight}</Text>
    </XStack>
  </YStack>
)}
```

- [ ] **Step 4: Pass eveningTransition in home.tsx**

Where `ForecastTimeline` is rendered:

```tsx
<ForecastTimeline
  {...existingProps}
  eveningTransition={discoveryResults?.eveningTransition}
/>
```

- [ ] **Step 5: Verify it compiles**

Run: `cd ../quiver-native && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ../quiver-native/src/hooks/use-surf-discovery.ts ../quiver-native/src/screens/home.tsx ../quiver-native/src/components/home/beach-hero.tsx ../quiver-native/src/components/home/forecast-timeline.tsx
git commit -m "feat(native): add regional call and evening transition"
```

---

## Task 11: API Route — Pass Through New Fields

**Files:**
- Modify: `app/api/surf/discover/route.ts`

- [ ] **Step 1: Verify the API route passes through the full response**

Read `app/api/surf/discover/route.ts`. The route likely calls `discoverSurfSpots()` and returns the result. Verify that `regionalCall` and `eveningTransition` are included in the response JSON. If the route cherry-picks fields (e.g., only forwarding `recommendations` and `metadata`), add the new fields:

```ts
return createSuccessResponse({
  recommendations: result.recommendations,
  regionalCall: result.regionalCall,
  eveningTransition: result.eveningTransition,
  searchCriteria: result.searchCriteria,
  metadata: result.metadata,
});
```

- [ ] **Step 2: Verify it builds**

Run: `cd quiver && yarn typecheck`
Expected: PASS

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add app/api/surf/discover/route.ts
git commit -m "feat: pass regionalCall and eveningTransition through discovery API"
```

---

## Task 12: Smoke Test

- [ ] **Step 1: Run all unit tests**

Run: `cd quiver && yarn test`
Expected: PASS

- [ ] **Step 2: Run typecheck on both projects**

Run: `cd quiver && yarn typecheck`
Run: `cd ../quiver-native && npm run typecheck`
Expected: Both PASS

- [ ] **Step 3: Run dev server and verify visually**

Run: `cd quiver && yarn dev`

Open `localhost:3000`, log in, and verify:
- Hero tagline shows a data-driven regional call (not generic "Long-period swell rolling in")
- Nearby Spots cards show strategy tag pills (if any qualify)
- Skip cards appear dimmed
- Tag reason text appears in the conditions line

- [ ] **Step 4: Commit any fixes**

If any issues found, fix and commit with appropriate message.
