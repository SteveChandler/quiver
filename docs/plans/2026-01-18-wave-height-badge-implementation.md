# Wave Height Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a wave height badge (e.g., "2-3ft") after the time badge in the hero recommendation.

**Architecture:** Add `waveHeightBadge` field to recommendation type, generate it in the orchestrator from forecast data, render it in the hero component between time and condition badges.

**Tech Stack:** TypeScript, React, Jest

---

## Task 1: Add Type Definition

**Files:**
- Modify: `types/personalization.ts:205`

**Step 1: Add waveHeightBadge to SurfDiscoveryRecommendation**

In `types/personalization.ts`, add after line 205 (`conditionBadges`):

```typescript
  /** Top condition badges explaining why conditions are good */
  conditionBadges?: ConditionBadge[];
  /** Wave height display badge (e.g., "2-3ft") */
  waveHeightBadge?: string;
```

**Step 2: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add types/personalization.ts
git commit -m "feat(types): add waveHeightBadge to SurfDiscoveryRecommendation"
```

---

## Task 2: Add Wave Height Formatting Function with Tests

**Files:**
- Modify: `lib/services/discovery/surf-discovery-orchestrator.ts:66`
- Create: `__tests__/lib/services/surf-discovery-wave-height-badge.test.ts`

**Step 1: Write the failing tests**

Create `__tests__/lib/services/surf-discovery-wave-height-badge.test.ts`:

```typescript
/**
 * Wave Height Badge Formatting Tests
 */

// Import the function once it exists
import { formatWaveHeightRange } from "@/lib/services/discovery/surf-discovery-orchestrator";

describe("formatWaveHeightRange", () => {
  it("returns null for flat conditions (< 0.5ft)", () => {
    expect(formatWaveHeightRange(0)).toBeNull();
    expect(formatWaveHeightRange(0.3)).toBeNull();
    expect(formatWaveHeightRange(0.49)).toBeNull();
  });

  it("formats very small waves correctly", () => {
    expect(formatWaveHeightRange(0.5)).toBe("0.5-1ft");
    expect(formatWaveHeightRange(0.7)).toBe("0.5-1.5ft");
  });

  it("formats typical wave heights as ranges", () => {
    expect(formatWaveHeightRange(1.5)).toBe("1.5-2.5ft");
    expect(formatWaveHeightRange(2)).toBe("2-3ft");
    expect(formatWaveHeightRange(2.3)).toBe("2-3ft");
    expect(formatWaveHeightRange(3)).toBe("3-4ft");
  });

  it("formats larger waves correctly", () => {
    expect(formatWaveHeightRange(5)).toBe("5-6ft");
    expect(formatWaveHeightRange(8)).toBe("8-9ft");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test __tests__/lib/services/surf-discovery-wave-height-badge.test.ts`
Expected: FAIL with "formatWaveHeightRange is not exported"

**Step 3: Implement the formatting function**

In `lib/services/discovery/surf-discovery-orchestrator.ts`, add after line 64 (before `generateConditionBadges`):

```typescript
/**
 * Format wave height as a range string for badge display.
 * Returns null for flat conditions (< 0.5ft).
 *
 * @param waveHeight - Wave height in feet
 * @returns Range string like "2-3ft" or null if flat
 */
export function formatWaveHeightRange(waveHeight: number): string | null {
  if (waveHeight < 0.5) return null;

  // Round down to nearest 0.5
  const lower = Math.floor(waveHeight * 2) / 2;
  // Add ~1ft for upper range
  const upper = lower + 1;

  // Format without unnecessary decimals
  const formatNum = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1);

  return `${formatNum(lower)}-${formatNum(upper)}ft`;
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test __tests__/lib/services/surf-discovery-wave-height-badge.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add lib/services/discovery/surf-discovery-orchestrator.ts __tests__/lib/services/surf-discovery-wave-height-badge.test.ts
git commit -m "feat(discovery): add formatWaveHeightRange function with tests"
```

---

## Task 3: Generate waveHeightBadge in Orchestrator

**Files:**
- Modify: `lib/services/discovery/surf-discovery-orchestrator.ts:333-340`

**Step 1: Update scoreBeachForDiscovery return**

Find this block around line 332-340:

```typescript
  // Generate condition badges (keep existing badge generation)
  const conditionBadges = generateConditionBadges(forecast, beach, detailedScore.subscores);

  return {
    ...detailedScore,
    conditionBadges,
    reasons: detailedScore.reasons.slice(0, 5),
  };
```

Replace with:

```typescript
  // Generate condition badges (keep existing badge generation)
  const conditionBadges = generateConditionBadges(forecast, beach, detailedScore.subscores);

  // Generate wave height badge from forecast
  const waveHeight = parseFloat(String(forecast.wave_height ?? '0'));
  const waveHeightBadge = formatWaveHeightRange(waveHeight);

  return {
    ...detailedScore,
    conditionBadges,
    waveHeightBadge: waveHeightBadge ?? undefined,
    reasons: detailedScore.reasons.slice(0, 5),
  };
```

**Step 2: Update return type annotation**

Find the function signature around line 261:

```typescript
export async function scoreBeachForDiscovery(params: {
```

The return type is inferred, so no change needed there. But verify TypeScript is happy.

**Step 3: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Run existing tests to verify no regression**

Run: `yarn test __tests__/lib/services/surf-discovery`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/services/discovery/surf-discovery-orchestrator.ts
git commit -m "feat(discovery): generate waveHeightBadge in scoring"
```

---

## Task 4: Render Wave Height Badge in Component

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx:230,285-305`

**Step 1: Destructure waveHeightBadge from recommendation**

Find line 230:

```typescript
  const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges } = recommendation;
```

Add `waveHeightBadge`:

```typescript
  const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges, waveHeightBadge } = recommendation;
```

**Step 2: Add wave height badge after time badge**

Find the time badge block (around line 285-293). After it, before the Perfect Match badge, add:

```tsx
        {/* Wave height badge */}
        {waveHeightBadge && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {waveHeightBadge}
            </Badge>
          </motion.div>
        )}
```

The full badges section should look like:

```tsx
      <motion.div
        className="flex flex-wrap items-center gap-2"
        data-testid="hero-badges"
        ...
      >
        {/* Time badge */}
        <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
          <Badge ...>
            <Clock ... />
            {timeWindow}
          </Badge>
        </motion.div>

        {/* Wave height badge */}
        {waveHeightBadge && (
          <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
            <Badge
              variant="outline"
              className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
            >
              {waveHeightBadge}
            </Badge>
          </motion.div>
        )}

        {/* Perfect Match badge */}
        {score >= 90 && (
          <motion.div ...>
            <Badge ...>Perfect Match</Badge>
          </motion.div>
        )}

        {/* Condition badges */}
        {conditionBadges?.slice(0, 3).map(...)}
      </motion.div>
```

**Step 3: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx
git commit -m "feat(hero): render wave height badge after time"
```

---

## Task 5: Add Component Tests

**Files:**
- Modify: `__tests__/components/home-screen/hero-recommendation.test.tsx`

**Step 1: Update mock to include waveHeightBadge**

Find the mock recommendation (around line 20-32) and add `waveHeightBadge`:

```typescript
  const mockRecommendation = {
    beach: { id: "beach-1", name: "Test Beach" },
    score: 85,
    window: {
      start: new Date("2026-01-18T16:00:00"),
      end: new Date("2026-01-18T17:00:00"),
      timezone: "America/Los_Angeles",
    },
    matchQuality: "good",
    recommendationLabel: "Great conditions",
    message: "Clean waves with light offshore winds",
    waveHeightBadge: "2-3ft",
    conditionBadges: [
      { label: "Clean" },
      { label: "Offshore" },
    ],
  } as any;
```

**Step 2: Add test for wave height badge rendering**

Add a new test:

```typescript
  it("renders wave height badge when provided", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("2-3ft")).toBeInTheDocument();
  });

  it("does not render wave height badge when not provided", () => {
    const recWithoutWaveHeight = {
      ...mockRecommendation,
      waveHeightBadge: undefined,
    };

    render(
      <HeroRecommendation
        recommendation={recWithoutWaveHeight}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByText(/^\d+-\d+ft$/)).not.toBeInTheDocument();
  });
```

**Step 3: Run tests to verify they pass**

Run: `yarn test __tests__/components/home-screen/hero-recommendation.test.tsx`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add __tests__/components/home-screen/hero-recommendation.test.tsx
git commit -m "test(hero): add wave height badge rendering tests"
```

---

## Task 6: Visual Verification

**Step 1: Start dev server**

Run: `yarn dev`

**Step 2: Open browser and verify**

Navigate to `http://localhost:3000` and check:
- [ ] Wave height badge appears after time badge
- [ ] Badge shows range like "2-3ft"
- [ ] Styling matches other badges
- [ ] Animation is consistent with other badges
- [ ] No badge shows for flat conditions

**Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix(hero): adjust wave height badge styling"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add type definition | `types/personalization.ts` |
| 2 | Add formatting function + tests | `surf-discovery-orchestrator.ts`, new test file |
| 3 | Generate badge in orchestrator | `surf-discovery-orchestrator.ts` |
| 4 | Render badge in component | `hero-recommendation.tsx` |
| 5 | Add component tests | `hero-recommendation.test.tsx` |
| 6 | Visual verification | Manual check |
