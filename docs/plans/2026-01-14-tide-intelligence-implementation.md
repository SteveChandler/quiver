# Tide Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate tide preference data for 30 San Diego beaches into scoring, UI, and alerts.

**Architecture:** Database seeding via migration → extend useDynamicTide hook to detect rising/falling → display prose and tips in beach detail → show optimal/waiting alerts based on tide direction match.

**Tech Stack:** Supabase (PostgreSQL), React hooks, TypeScript, Tailwind CSS, Jest/React Testing Library.

---

## Part D: Database Seeding

### Task 1: Create Tide Preferences Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_seed_san_diego_tide_preferences.sql`

**Step 1: Create the migration file**

```sql
-- Seed San Diego beaches with tide preferences, prose, and tips
-- Source: Local knowledge research covering 30 SD County surf spots

-- Part 1: Update existing beaches with tide preferences

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'San Onofre is a model of consistency, working well on almost any tide. The soft waves peel slowly over the cobbles, making it perfect for logging. While the wave shape holds up at high tide, surfers should be cautious of exposed rocks during extreme low tides.',
  wave_tips = 'Bring a longboard. Watch for rocks at low tide. The vibe is mellow, so relax and enjoy the glide.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'San Onofre State Beach';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Lowers fires best on a medium tide. High tides can make the wave soft and slow, while extreme low tides can drain the energy and make the inside rocks hazardous. A mid-tide allows for the perfect balance of wall steepness and ride length.',
  wave_tips = 'The crowd is competitive. Stick to the peak that matches your stance (rights are often longer). Respect the locals.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Lower Trestles';

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Reliable and consistent, the Pier works on all tides. However, when other North County spots are closing out at high tide, the Pier often remains rideable, offering a good alternative.',
  wave_tips = 'Paddle out near the pier for the defined banks, but watch for fishing lines and drift.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Oceanside Pier';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Terramar is highly sensitive. Aim for a low or slack tide (under 3ft). High tides generate backwash from the bluffs that destroys the wave face.',
  wave_tips = 'Check the tide chart religiously. It''s often uncrowded when other spots are packed.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Terramar Point';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Ponto prefers a lower tide to give the waves definition. Mid-tide is generally safe, but high tide tends to make the wave mushy and less powerful.',
  wave_tips = 'Can be heavy. Watch for currents from the lagoon mouth.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Ponto';

UPDATE beaches SET
  preferred_tide_direction = 'falling',
  best_conditions_prose = 'Grandview comes alive as the tide drops. High tides often result in backwash from the cliffs that crumbles the wave face. A falling tide reveals the reef structure and improves the wave''s definition.',
  wave_tips = 'Access is via a long staircase. Best for intermediate surfers looking for less aggressive crowds.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Grandview';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Catch this spot on the incoming tide. The ''push'' of the rising water helps organize the beach break peaks, preventing them from closing out and giving the wave more power.',
  wave_tips = 'Great for beginners. Early mornings offer the cleanest conditions before the wind picks up.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Moonlight State Beach';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Timing is key at D Street. Aim for a mid-to-low tide to catch the sandbars working at their best. Too much water swamps the break, making it slow and mushy.',
  wave_tips = 'Can get crowded and competitive. Look for the A-frames peaking between the main packs.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'D Street';

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Swami''s is a tide-tolerant machine. The reef structure allows it to hold shape on high tides when other spots fail, yet it remains rideable (though shallower) at low tide.',
  wave_tips = 'The paddle out is long. Be respectful of the established lineup hierarchy.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Swami%';

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Consistent and reliable, Cardiff Reef works across the tidal spectrum. The flat reef shelf maintains wave shape regardless of the tide, though extreme highs can cause backwash.',
  wave_tips = 'Popular with SUPs and longboards. Watch out for the ''Cardiff Kook'' statue nearby.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Cardiff Reef';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Pipes works best at a mid-tide. This avoids the shallow reef issues of low tide and the swamping effect of high tide.',
  wave_tips = 'Great for camping surf trips. Mellow vibe.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'San Elijo State Beach';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Pipes works best at a mid-tide. This avoids the shallow reef issues of low tide and the swamping effect of high tide.',
  wave_tips = 'Great for camping surf trips. Mellow vibe.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Pipes';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'This spot is highly sensitive to water flow. Target a rising tide (ideally 4.5ft+) to give the wave the necessary push and connection. Falling tides can drain the power as the lagoon empties.',
  wave_tips = 'Water quality can be an issue after rain due to lagoon runoff.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Del Mar Rivermouth';

UPDATE beaches SET
  preferred_tide_direction = 'falling',
  best_conditions_prose = 'For the legendary hollow barrels Black''s is famous for, try to catch a fading high tide (falling). This window often grooms the wave face and hollows out the tube sections without the close-out risk of a dead low tide.',
  wave_tips = 'Be prepared for a long hike. The hold-downs are heavy, and the canyon makes waves much larger than they appear from the cliffs.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Blacks';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Scripps prefers an incoming tide. The rising water helps organize the fast, shifty peaks and prevents the closeouts common at low tide.',
  wave_tips = 'Watch for the pier pilings and currents. Popular with UCSD students.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Scripps';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'The Shores favors an incoming tide. The rising water helps the soft waves stand up and peel, providing longer, more forgiving rides for beginners.',
  wave_tips = 'Extremely popular with surf schools. Arrive early for parking.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'La Jolla Shores';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Windansea thrives on an incoming tide. The push of the ocean helps the swell mount over the slab reef, creating the steep, hollow A-frames the spot is known for. Low tide can expose the reef dangerously.',
  wave_tips = 'Localism is a factor here. Observe the peak before paddling out and respect the rotation.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Windansea';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'PB Point is a low-tide spot. It needs the water to drain out for the reef and sandbars to trip the swell. On higher tides, the wave becomes too fat and slow to ride effectively.',
  wave_tips = 'A long paddle is required. Bring a board with volume (longboard or fish).',
  region = COALESCE(region, 'San Diego')
WHERE name = 'PB Point';

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Tourmaline works on most tides. It is very forgiving, though lower tides can help the wave break further out and provide a longer wall.',
  wave_tips = 'Party waves are common. Relaxed vibe.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Tourmaline%';

UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Crystal Pier is a dependable option regardless of tide. The pier structure maintains the sandbars. Just watch out for extreme high tide backwash.',
  wave_tips = 'Can get crowded. Respect the pier fishermen.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Crystal Pier';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'PB works best with a bit of tidal push. An incoming mid-tide is ideal for organizing the peaks.',
  wave_tips = 'Crowded with tourists and schools. Be careful.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Pacific Beach';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Like PB, Mission Beach benefits from an incoming tide to give the waves power and shape.',
  wave_tips = 'Good central location. Lots of parking.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE 'Mission Beach%';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'The Pier works best when the tide is lower (low to mid). This prevents the waves from passing through the pilings unbroken and helps the sandbars create defined peaks.',
  wave_tips = 'Watch out for the pier pilings and fishing lines. The vibe is gritty but generally welcoming.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Ocean Beach Pier';

UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'The OB Jetty prefers a mid-tide to balance the wedge reflection with enough depth to clear the sandbar.',
  wave_tips = 'Dog beach runoff can be an issue. Check water quality.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Ocean Beach';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'For the best experience at the Cliffs (specifically Garbage), paddle out on a rising tide. The incoming water helps the wave clear the reef shelf while providing enough push for long walls. Avoid extreme high tides which can cause backwash.',
  wave_tips = 'Access is difficult (rope or steep trail). Be mindful of the reef and tide status to ensure a safe exit.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Sunset Cliffs%Garbage%';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Coronado needs water. The best sessions occur on a rising high tide, which prevents the steep beach from causing the waves to close out instantly. The extra depth allows for better shape.',
  wave_tips = 'Water quality can be an issue. Often uncrowded due to the swell shadow.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Coronado%';

UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Target an incoming tide at IB. The flooding tide helps to counteract the strong rip currents and organizes the sandbars, creating cleaner, more manageable peaks.',
  wave_tips = 'Check water quality reports carefully before surfing here due to proximity to the river mouth.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE 'Imperial Beach%';


-- Part 2: Insert missing beaches

INSERT INTO beaches (
  name, state, region, timezone,
  center_lat, center_lng,
  break_type, preferred_tide_direction,
  best_conditions_prose, wave_tips
) VALUES
(
  'La Jolla Cove',
  'CA', 'San Diego', 'America/Los_Angeles',
  32.8503, -117.2729,
  'Reef', 'either',
  'The Cove is not tide-sensitive, but swell-sensitive. If the waves are big enough to break here (10ft+), they will break on any tide.',
  'Experts only. Entry is off the rocks.'
),
(
  'Bird Rock',
  'CA', 'San Diego', 'America/Los_Angeles',
  32.8135, -117.2739,
  'Reef', 'slack',
  'This spot is tide-sensitive. It requires a low tide to expose the reef shelf enough for the waves to break properly. High tides tend to swamp the reef, resulting in unbroken swells.',
  'Rocky entry. Booties are recommended.'
),
(
  'Pumphouse',
  'CA', 'San Diego', 'America/Los_Angeles',
  32.8098, -117.2728,
  'Reef', 'falling',
  'Pumphouse needs the tide to be dropping to activate the reef. An outgoing tide helps the waves stand up on the shelf.',
  'Can be inconsistent. Check it when Bird Rock is working.'
),
(
  'South Mission Jetty',
  'CA', 'San Diego', 'America/Los_Angeles',
  32.7549, -117.2534,
  'Jetty', 'slack',
  'To score the hollow wedges at the Jetty, target a low-to-mid tide. This depth allows the wave to interact perfectly with the jetty structure and sandbar, creating steep, fast walls.',
  'Tight takeoff zone. Competitive crowd.'
),
(
  'Ocean Beach Jetty',
  'CA', 'San Diego', 'America/Los_Angeles',
  32.7516, -117.2489,
  'Jetty', 'slack',
  'The OB Jetty prefers a mid-tide to balance the wedge reflection with enough depth to clear the sandbar.',
  'Dog beach runoff can be an issue. Check water quality.'
)
ON CONFLICT (name) DO UPDATE SET
  preferred_tide_direction = EXCLUDED.preferred_tide_direction,
  best_conditions_prose = EXCLUDED.best_conditions_prose,
  wave_tips = EXCLUDED.wave_tips,
  region = COALESCE(beaches.region, EXCLUDED.region);
```

**Step 2: Apply the migration**

Run: `supabase migration up` or push to trigger CI

**Step 3: Verify the data**

```sql
SELECT name, preferred_tide_direction, LEFT(best_conditions_prose, 50) as prose_preview
FROM beaches
WHERE region = 'San Diego'
ORDER BY name;
```

Expected: 30+ rows with populated `preferred_tide_direction` values.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): seed San Diego beaches with tide preferences

- 27 UPDATEs to existing beaches with direction, prose, tips
- 5 INSERTs for missing beaches (La Jolla Cove, Bird Rock, etc.)
- Set region to 'San Diego' for all affected beaches"
```

---

## Part A: Scoring Integration

### Task 2: Add Direction Detection Tests

**Files:**
- Modify: `__tests__/hooks/use-dynamic-tide.test.ts`

**Step 1: Write failing tests for currentDirection**

Add to the test file:

```typescript
describe("useDynamicTide - direction detection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-14T17:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 'rising' when next tide is high", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 5.2, type: "high" },
        { time: futureTime + 21600, height: 0.5, type: "low" }, // 6 hours later
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.currentDirection).toBe("rising");
  });

  it("returns 'falling' when next tide is low", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 0.5, type: "low" },
        { time: futureTime + 21600, height: 5.2, type: "high" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.currentDirection).toBe("falling");
  });

  it("returns 'slack' when within 30 minutes of extreme", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 1500; // 25 minutes
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 5.2, type: "high" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.currentDirection).toBe("slack");
  });

  it("returns null when no tide schedule", () => {
    const forecasts = [createMockForecast()];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.currentDirection).toBeNull();
  });

  it("calculates minutesToDirectionChange correctly", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 5.2, type: "high" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.minutesToDirectionChange).toBe(120);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`

Expected: FAIL - `currentDirection` property does not exist

**Step 3: Commit test file**

```bash
git add __tests__/hooks/use-dynamic-tide.test.ts
git commit -m "test(hooks): add direction detection tests for useDynamicTide"
```

---

### Task 3: Implement Direction Detection in Hook

**Files:**
- Modify: `hooks/use-dynamic-tide.ts`

**Step 1: Update the interface**

```typescript
export interface DynamicTideResult {
  /** The soonest upcoming tide (high or low) */
  nextTide: TideExtreme | null;
  /** Minutes until nextTide */
  minutesUntil: number | null;
  /** Next high tide */
  nextHigh: TideExtreme | null;
  /** Next low tide */
  nextLow: TideExtreme | null;
  /** Minutes until next high */
  minutesToHigh: number | null;
  /** Minutes until next low */
  minutesToLow: number | null;
  /** True if using fallback (no tide_schedule found) */
  usingFallback: boolean;
  /** Current tide direction: rising toward high, falling toward low, or slack near extreme */
  currentDirection: "rising" | "falling" | "slack" | null;
  /** Minutes until tide direction changes (at next extreme) */
  minutesToDirectionChange: number | null;
}
```

**Step 2: Add direction computation logic**

Inside the `tideResult` useMemo, after computing `minutesUntil`, add:

```typescript
// Determine current direction based on next tide
// If next tide is HIGH → currently RISING
// If next tide is LOW → currently FALLING
// If within 30 minutes of extreme → SLACK
let currentDirection: "rising" | "falling" | "slack" | null = null;
let minutesToDirectionChange: number | null = null;

if (nextTide) {
  minutesToDirectionChange = minutesUntil;

  // Within 30 minutes of extreme = slack
  if (minutesUntil !== null && minutesUntil <= 30) {
    currentDirection = "slack";
  } else if (nextTide.type === "high") {
    currentDirection = "rising";
  } else {
    currentDirection = "falling";
  }
}
```

**Step 3: Update the return object**

```typescript
return {
  nextTide,
  minutesUntil,
  nextHigh,
  nextLow,
  minutesToHigh,
  minutesToLow,
  usingFallback: false,
  currentDirection,
  minutesToDirectionChange,
};
```

**Step 4: Update the fallback return**

```typescript
return {
  nextTide: null,
  minutesUntil: null,
  nextHigh: null,
  nextLow: null,
  minutesToHigh: null,
  minutesToLow: null,
  usingFallback: true,
  currentDirection: null,
  minutesToDirectionChange: null,
};
```

**Step 5: Run tests to verify they pass**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add hooks/use-dynamic-tide.ts
git commit -m "feat(hooks): add currentDirection and minutesToDirectionChange to useDynamicTide"
```

---

### Task 4: Create Direction Multiplier Helper

**Files:**
- Create: `lib/surf/tide-direction.ts`
- Create: `__tests__/lib/surf/tide-direction.test.ts`

**Step 1: Write failing tests**

```typescript
// __tests__/lib/surf/tide-direction.test.ts
import { getDirectionMultiplier, getTideAlert } from "@/lib/surf/tide-direction";

describe("getDirectionMultiplier", () => {
  it("returns 1.0 when beach preference is null", () => {
    expect(getDirectionMultiplier(null, "rising")).toBe(1.0);
  });

  it("returns 1.0 when beach preference is 'either'", () => {
    expect(getDirectionMultiplier("either", "rising")).toBe(1.0);
    expect(getDirectionMultiplier("either", "falling")).toBe(1.0);
  });

  it("returns 1.0 when direction matches preference", () => {
    expect(getDirectionMultiplier("rising", "rising")).toBe(1.0);
    expect(getDirectionMultiplier("falling", "falling")).toBe(1.0);
  });

  it("returns 0.7 when direction mismatches preference", () => {
    expect(getDirectionMultiplier("rising", "falling")).toBe(0.7);
    expect(getDirectionMultiplier("falling", "rising")).toBe(0.7);
  });

  it("returns 0.85 for slack preference when not slack", () => {
    expect(getDirectionMultiplier("slack", "rising")).toBe(0.85);
    expect(getDirectionMultiplier("slack", "falling")).toBe(0.85);
  });

  it("returns 1.0 for slack preference when slack", () => {
    expect(getDirectionMultiplier("slack", "slack")).toBe(1.0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test __tests__/lib/surf/tide-direction.test.ts`

Expected: FAIL - module not found

**Step 3: Create the helper module**

```typescript
// lib/surf/tide-direction.ts

export type TideDirection = "rising" | "falling" | "slack";
export type TidePreference = "rising" | "falling" | "slack" | "either";

/**
 * Returns a multiplier (0.0-1.0) based on how well the current tide direction
 * matches the beach's preference.
 *
 * - Perfect match or "either" preference: 1.0
 * - Slack preference but not slack: 0.85
 * - Mismatch: 0.7
 */
export function getDirectionMultiplier(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null
): number {
  // No preference or unknown direction = no adjustment
  if (!beachPref || beachPref === "either" || !currentDir) {
    return 1.0;
  }

  // Perfect match
  if (beachPref === currentDir) {
    return 1.0;
  }

  // Slack preference has softer penalty
  if (beachPref === "slack") {
    return 0.85;
  }

  // Mismatch (rising vs falling, or vice versa)
  return 0.7;
}

export interface TideAlert {
  status: "optimal" | "waiting" | "neutral";
  message: string;
}

/**
 * Generates an alert message based on tide direction match.
 */
export function getTideAlert(
  beachPref: TidePreference | string | null,
  currentDir: TideDirection | null,
  minutesToChange: number | null
): TideAlert {
  if (!beachPref || beachPref === "either") {
    return { status: "neutral", message: "Good on any tide" };
  }

  if (!currentDir) {
    return { status: "neutral", message: "Tide data unavailable" };
  }

  if (beachPref === currentDir) {
    return {
      status: "optimal",
      message: `Optimal now – tide is ${currentDir}`,
    };
  }

  const hours = minutesToChange ? Math.round(minutesToChange / 60) : null;
  const timeStr = hours !== null ? (hours > 0 ? `in ${hours}h` : "soon") : "";

  return {
    status: "waiting",
    message: `Better ${timeStr} (${beachPref} tide)`.trim(),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test __tests__/lib/surf/tide-direction.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/surf/tide-direction.ts __tests__/lib/surf/tide-direction.test.ts
git commit -m "feat(lib): add tide direction multiplier and alert helpers"
```

---

## Part C: Educational UI

### Task 5: Create TideConditionsCard Component

**Files:**
- Create: `components/beach-detail/tide-conditions-card.tsx`
- Modify: `components/beach-detail/tabs/forecast-tab.tsx` (Tides tab section)

**Step 1: Create the component**

```typescript
// components/beach-detail/tide-conditions-card.tsx
"use client";

import { Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TideConditionsCardProps {
  prose: string | null;
  preferredDirection: string | null;
}

const directionLabels: Record<string, string> = {
  rising: "Rising tide preferred",
  falling: "Falling tide preferred",
  slack: "Mid-tide preferred",
  either: "Works on any tide",
};

export function TideConditionsCard({
  prose,
  preferredDirection,
}: TideConditionsCardProps) {
  if (!prose) return null;

  const directionLabel = preferredDirection
    ? directionLabels[preferredDirection] || preferredDirection
    : null;

  return (
    <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg mt-6">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
        <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
          <Waves className="h-5 w-5 text-blue-600" />
          Best Tide Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {prose}
        </p>
        {directionLabel && (
          <Badge variant="secondary" className="text-xs">
            {directionLabel}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to Tides tab in forecast-tab.tsx**

Import at top:
```typescript
import { TideConditionsCard } from "@/components/beach-detail/tide-conditions-card";
```

Inside the Tides TabsContent, after the TideChartEnhanced section:
```typescript
{/* Tides Tab */}
<TabsContent value="tides" className="mt-6">
  <section className="rounded-3xl border border-blue-100/60 bg-white/95 p-6 shadow-lg backdrop-blur">
    <h2 className="text-xl font-roboto font-semibold text-dark-grey mb-4">
      Tide Forecast
    </h2>
    <TideChartEnhanced
      forecasts={forecasts}
      diagnostics={tideDiagnostics ?? undefined}
      compact={false}
      now={new Date()}
      showNextExtreme={!!tideDiagnostics}
      showHourlyTable={true}
      showWarnings={true}
      showVerifiedBadge={!!tideDiagnostics}
    />
  </section>

  {/* Tide Conditions Card */}
  <TideConditionsCard
    prose={beach.best_conditions_prose}
    preferredDirection={beach.preferred_tide_direction}
  />
</TabsContent>
```

**Step 3: Run type check**

Run: `yarn typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add components/beach-detail/tide-conditions-card.tsx components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat(ui): add TideConditionsCard to Tides tab"
```

---

### Task 6: Create WaveTipsCard Component

**Files:**
- Create: `components/beach-detail/wave-tips-card.tsx`
- Modify: `components/beach-detail/spot-overview.tsx`

**Step 1: Create the component**

```typescript
// components/beach-detail/wave-tips-card.tsx
"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WaveTipsCardProps {
  tips: string | null;
}

export function WaveTipsCard({ tips }: WaveTipsCardProps) {
  if (!tips) return null;

  return (
    <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-amber-50/60 border-amber-200/50 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/80 to-yellow-50/80 border-b border-amber-100/50">
        <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
          <Lightbulb className="h-5 w-5 text-amber-600" />
          Wave Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tips}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to spot-overview.tsx**

Import at top:
```typescript
import { WaveTipsCard } from "@/components/beach-detail/wave-tips-card";
```

Add after the Spot Summary card (first card in the component):
```typescript
{/* Wave Tips */}
<WaveTipsCard tips={beach.wave_tips} />
```

**Step 3: Run type check**

Run: `yarn typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add components/beach-detail/wave-tips-card.tsx components/beach-detail/spot-overview.tsx
git commit -m "feat(ui): add WaveTipsCard to spot overview"
```

---

## Part B: Tide Window Alerts

### Task 7: Create TideAlert Component

**Files:**
- Create: `components/beach-detail/tide-alert.tsx`
- Modify: `components/beach-detail/tabs/forecast-tab.tsx`

**Step 1: Create the component**

```typescript
// components/beach-detail/tide-alert.tsx
"use client";

import { CheckCircle2, Clock, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TideAlert as TideAlertType } from "@/lib/surf/tide-direction";

interface TideAlertProps {
  alert: TideAlertType;
  className?: string;
}

const alertStyles = {
  optimal: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    icon: CheckCircle2,
  },
  waiting: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: Clock,
  },
  neutral: {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
    icon: Waves,
  },
};

export function TideAlertBadge({ alert, className }: TideAlertProps) {
  const style = alertStyles[alert.status];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
        style.bg,
        style.text,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{alert.message}</span>
    </div>
  );
}
```

**Step 2: Add to forecast-tab.tsx hero section**

Import at top:
```typescript
import { getTideAlert } from "@/lib/surf/tide-direction";
import { TideAlertBadge } from "@/components/beach-detail/tide-alert";
```

After the dynamicTide hook call, compute the alert:
```typescript
// Tide alert based on direction match
const tideAlert = useMemo(() => {
  return getTideAlert(
    beach.preferred_tide_direction,
    dynamicTide.currentDirection,
    dynamicTide.minutesToDirectionChange
  );
}, [beach.preferred_tide_direction, dynamicTide.currentDirection, dynamicTide.minutesToDirectionChange]);
```

Inside the Today tab, after the "Current Conditions" header div, add:
```typescript
{/* Tide Alert */}
{beach.preferred_tide_direction && (
  <TideAlertBadge alert={tideAlert} className="mt-2" />
)}
```

**Step 3: Run type check and dev server**

Run: `yarn typecheck && yarn dev`

Expected: No errors, badge appears on beach detail pages

**Step 4: Commit**

```bash
git add components/beach-detail/tide-alert.tsx components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat(ui): add TideAlertBadge to forecast tab

Shows 'Optimal now' (green), 'Better in Xh' (amber), or 'Good on any tide' (gray)
based on beach tide preference vs current tide direction."
```

---

## Task 8: Final Integration Test

**Step 1: Run full test suite**

Run: `yarn test`

Expected: All tests pass

**Step 2: Manual verification checklist**

- [ ] Open a San Diego beach (e.g., Windansea)
- [ ] Verify Tides tab shows "Best Tide Conditions" card with prose
- [ ] Verify Overview shows "Wave Tips" card
- [ ] Verify Today tab shows tide alert badge
- [ ] Verify score adjusts based on tide direction (inspect React DevTools)

**Step 3: Commit any fixes**

```bash
git add .
git commit -m "test: verify tide intelligence integration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create migration | `supabase/migrations/` |
| 2 | Add direction tests | `__tests__/hooks/use-dynamic-tide.test.ts` |
| 3 | Implement direction in hook | `hooks/use-dynamic-tide.ts` |
| 4 | Create multiplier helper | `lib/surf/tide-direction.ts` |
| 5 | TideConditionsCard | `components/beach-detail/tide-conditions-card.tsx` |
| 6 | WaveTipsCard | `components/beach-detail/wave-tips-card.tsx` |
| 7 | TideAlertBadge | `components/beach-detail/tide-alert.tsx` |
| 8 | Integration test | Manual verification |

**Estimated commits:** 8
**Dependencies:** Part D must complete before testing Parts A/B/C in production
