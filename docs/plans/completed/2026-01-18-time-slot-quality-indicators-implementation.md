# Time Slot Quality Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show tomorrow's forecasts with quality indicators when a time slot filter has passed for today.

**Architecture:** Remove score threshold in window-selector when specific time slot is selected, add four-tier quality system (great/good/fair/marginal) to hero-recommendation with dynamic headlines, color-coded scores, and condition badges.

**Tech Stack:** TypeScript, React, Next.js, Tailwind CSS, Jest

**Design Doc:** `docs/plans/2026-01-18-time-slot-quality-indicators-design.md`

---

## Task 1: Update Window Selector Logic

**Files:**
- Modify: `lib/services/discovery/window-selector.ts:650-660`
- Test: `__tests__/services/select-best-window-time-slot.test.ts`

**Step 1: Write failing test for low-score window with time slot**

Add to `__tests__/services/select-best-window-time-slot.test.ts`:

```typescript
it('returns low-score window when specific time slot is selected', () => {
  // Create forecast with low score (conditions that would score ~30)
  const lowScoreForecast = {
    ...createForecast(tomorrowStr, 15), // 7am PST (15:00 UTC) - dawn patrol
    wave_height: '1', // Small waves = low score
    wave_period: '6s', // Short period = low score
    wind_speed: '20', // Strong wind = low score
    wind_direction: 'W', // Onshore = low score
    wind_direction_deg: 270,
  };

  const forecasts = [
    lowScoreForecast,
    createForecast(tomorrowStr, 22), // 2pm PST - afternoon, higher score
  ];

  // With specific time slot, should return the dawn patrol window even with low score
  const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

  expect(result).not.toBeNull();
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles",
    }).format(result!.start),
    10
  );
  // Should be dawn patrol time (7am), not afternoon
  expect(localHour).toBe(7);
});
```

**Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/services/select-best-window-time-slot.test.ts --no-coverage -t "returns low-score window"`

Expected: FAIL (currently returns null due to score threshold)

**Step 3: Update window-selector.ts to skip threshold for specific time slots**

In `lib/services/discovery/window-selector.ts`, find the threshold logic around line 650-660 and update:

```typescript
// Around line 648-658, replace:
// Morning priority: use lower threshold for today's forecasts before noon
const effectiveThreshold = (isMorning && isToday)
  ? MIN_SCORE_THRESHOLD_MORNING
  : MIN_SCORE_THRESHOLD;

// With:
// When a specific time slot is requested (not 'any'), skip score threshold
// Always return best window in that slot so UI can show quality indicator
const shouldApplyThreshold = !actualTimeSlot || actualTimeSlot === 'any';
const effectiveThreshold = shouldApplyThreshold
  ? (isMorning && isToday) ? MIN_SCORE_THRESHOLD_MORNING : MIN_SCORE_THRESHOLD
  : 0; // No threshold for specific time slots
```

**Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/services/select-best-window-time-slot.test.ts --no-coverage -t "returns low-score window"`

Expected: PASS

**Step 5: Run all window-selector tests**

Run: `yarn jest --testPathPattern="window-selector|select-best-window" --no-coverage`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add lib/services/discovery/window-selector.ts __tests__/services/select-best-window-time-slot.test.ts
git commit -m "feat(discovery): skip score threshold for specific time slots

When user selects a specific time slot (dawn-patrol, morning, afternoon),
always return the best window in that slot regardless of score.
This allows the UI to show quality indicators instead of 'no results'.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Condition Tier Helpers

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx`
- Test: `__tests__/components/home-screen/hero-recommendation.test.tsx`

**Step 1: Write failing tests for tier helpers**

Add to `__tests__/components/home-screen/hero-recommendation.test.tsx`:

```typescript
import { getConditionTier, getScoreColorClass, getConditionBadge } from '@/components/home-screen/hero-recommendation';

describe('Condition tier helpers', () => {
  describe('getConditionTier', () => {
    it('returns great for score >= 80', () => {
      expect(getConditionTier(80)).toBe('great');
      expect(getConditionTier(95)).toBe('great');
    });

    it('returns good for score 60-79', () => {
      expect(getConditionTier(60)).toBe('good');
      expect(getConditionTier(79)).toBe('good');
    });

    it('returns fair for score 40-59', () => {
      expect(getConditionTier(40)).toBe('fair');
      expect(getConditionTier(59)).toBe('fair');
    });

    it('returns marginal for score < 40', () => {
      expect(getConditionTier(39)).toBe('marginal');
      expect(getConditionTier(0)).toBe('marginal');
    });
  });

  describe('getScoreColorClass', () => {
    it('returns orange for great and good tiers', () => {
      expect(getScoreColorClass('great')).toBe('text-accent-orange');
      expect(getScoreColorClass('good')).toBe('text-accent-orange');
    });

    it('returns amber for fair tier', () => {
      expect(getScoreColorClass('fair')).toBe('text-amber-400');
    });

    it('returns gray for marginal tier', () => {
      expect(getScoreColorClass('marginal')).toBe('text-white/60');
    });
  });

  describe('getConditionBadge', () => {
    it('returns Great Conditions badge for great tier', () => {
      const badge = getConditionBadge('great');
      expect(badge?.label).toBe('Great Conditions');
      expect(badge?.className).toContain('emerald');
    });

    it('returns null for good tier', () => {
      expect(getConditionBadge('good')).toBeNull();
    });

    it('returns Fair Conditions badge for fair tier', () => {
      const badge = getConditionBadge('fair');
      expect(badge?.label).toBe('Fair Conditions');
      expect(badge?.className).toContain('amber');
    });

    it('returns Marginal badge for marginal tier', () => {
      const badge = getConditionBadge('marginal');
      expect(badge?.label).toBe('Marginal');
      expect(badge?.className).toContain('white/60');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn jest __tests__/components/home-screen/hero-recommendation.test.tsx --no-coverage -t "Condition tier helpers"`

Expected: FAIL (functions not exported/defined)

**Step 3: Add helper functions to hero-recommendation.tsx**

Add after the imports in `components/home-screen/hero-recommendation.tsx`:

```typescript
// ============================================================================
// Condition Tier Helpers
// ============================================================================

export type ConditionTier = 'great' | 'good' | 'fair' | 'marginal';

/**
 * Determine condition tier based on score (0-100)
 * - great: 80+
 * - good: 60-79
 * - fair: 40-59
 * - marginal: <40
 */
export function getConditionTier(score: number): ConditionTier {
  if (score >= 80) return 'great';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'marginal';
}

/**
 * Get Tailwind color class for score based on tier
 */
export function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case 'great':
    case 'good':
      return 'text-accent-orange';
    case 'fair':
      return 'text-amber-400';
    case 'marginal':
      return 'text-white/60';
  }
}

/**
 * Get condition badge config based on tier
 * Returns null for 'good' tier (no badge needed)
 */
export function getConditionBadge(tier: ConditionTier): { label: string; className: string } | null {
  switch (tier) {
    case 'great':
      return {
        label: 'Great Conditions',
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      };
    case 'good':
      return null;
    case 'fair':
      return {
        label: 'Fair Conditions',
        className: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      };
    case 'marginal':
      return {
        label: 'Marginal',
        className: 'bg-white/10 text-white/60 border-white/20',
      };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn jest __tests__/components/home-screen/hero-recommendation.test.tsx --no-coverage -t "Condition tier helpers"`

Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx __tests__/components/home-screen/hero-recommendation.test.tsx
git commit -m "feat(ui): add condition tier helper functions

Add getConditionTier, getScoreColorClass, and getConditionBadge
helpers for the four-tier quality system (great/good/fair/marginal).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add timeSlot Prop to HeroRecommendation

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx`
- Modify: `components/home-screen/index.tsx`

**Step 1: Add timeSlot to HeroRecommendationProps**

In `components/home-screen/hero-recommendation.tsx`, update the props interface:

```typescript
import type { TimeSlot } from '@/types/personalization';

export interface HeroRecommendationProps {
  /** Top surf spot recommendation data */
  recommendation: SurfDiscoveryRecommendation | null;
  /** Personalized insights from session history */
  insights?: PersonalizedInsights | null;
  /** Loading state indicator */
  loading?: boolean;
  /** Error object if fetch failed */
  error?: Error | null;
  /** Selected time slot filter */
  timeSlot?: TimeSlot;
  /** Callback when user clicks "Plan Session" */
  onPlanSession: () => void;
  /** Callback when user clicks on the beach name/card */
  onViewBeach: (beachId: string) => void;
  /** Callback to enable reminder notifications */
  onEnableReminder?: (beachId: string, beachName: string) => Promise<boolean>;
  /** Whether forecast alerts are already enabled */
  forecastAlertsEnabled?: boolean;
  /** User's current home beach ID */
  homeBeachId?: string | null;
}
```

**Step 2: Update component signature to accept timeSlot**

In the component function:

```typescript
export const HeroRecommendation = React.memo(function HeroRecommendation({
  recommendation,
  insights,
  loading = false,
  error = null,
  timeSlot,  // Add this
  onPlanSession,
  onViewBeach,
  onEnableReminder,
  forecastAlertsEnabled = false,
  homeBeachId,
}: HeroRecommendationProps) {
```

**Step 3: Pass timeSlot from home-screen/index.tsx**

In `components/home-screen/index.tsx`, find the HeroRecommendation usage and add the prop:

```typescript
<HeroRecommendation
  recommendation={topRecommendation}
  insights={insights}
  loading={loading}
  error={error}
  timeSlot={timeSlot}  // Add this line
  onPlanSession={handlePlanSession}
  onViewBeach={handleViewBeach}
  onEnableReminder={handleEnableReminder}
  forecastAlertsEnabled={forecastAlertsEnabled}
  homeBeachId={homeBeachId}
/>
```

**Step 4: Verify build passes**

Run: `yarn build`

Expected: Build succeeds

**Step 5: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx components/home-screen/index.tsx
git commit -m "feat(ui): pass timeSlot prop to HeroRecommendation

Add timeSlot to HeroRecommendationProps and pass it from home-screen.
This enables context-aware headlines (e.g., 'Tomorrow's dawn patrol').

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update Headline Rendering

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx`
- Test: `__tests__/components/home-screen/hero-recommendation.test.tsx`

**Step 1: Add headline builder helper**

Add to `components/home-screen/hero-recommendation.tsx` after the other helpers:

```typescript
/**
 * Build headline parts based on condition tier and time context
 */
export function buildHeadlineText(
  beachName: string,
  tier: ConditionTier,
  isTomorrow: boolean,
  timeSlot?: TimeSlot
): { prefix: string; beachPart: string; connector: string } {
  // Build tomorrow prefix based on time slot
  let prefix = '';
  if (isTomorrow) {
    switch (timeSlot) {
      case 'dawn-patrol':
        prefix = "Tomorrow's dawn patrol at ";
        break;
      case 'morning':
        prefix = "Tomorrow morning at ";
        break;
      case 'afternoon':
        prefix = "Tomorrow afternoon at ";
        break;
      default:
        prefix = "Tomorrow at ";
    }
  }

  // Build main headline based on tier
  switch (tier) {
    case 'great':
      return { prefix, beachPart: beachName, connector: 'is your best bet at' };
    case 'good':
      return { prefix, beachPart: beachName, connector: 'is a good option at' };
    case 'fair':
      return {
        prefix: prefix || 'Conditions are fair at ',
        beachPart: prefix ? beachName : beachName,
        connector: prefix ? '— conditions are fair at' : '—',
      };
    case 'marginal':
      return {
        prefix: prefix || 'Conditions are marginal at ',
        beachPart: prefix ? beachName : beachName,
        connector: prefix ? '— conditions are marginal at' : '—',
      };
  }
}
```

**Step 2: Write test for headline builder**

Add to `__tests__/components/home-screen/hero-recommendation.test.tsx`:

```typescript
import { buildHeadlineText } from '@/components/home-screen/hero-recommendation';

describe('buildHeadlineText', () => {
  it('builds great tier headline', () => {
    const result = buildHeadlineText('Blacks', 'great', false);
    expect(result.connector).toBe('is your best bet at');
  });

  it('builds good tier headline', () => {
    const result = buildHeadlineText('Blacks', 'good', false);
    expect(result.connector).toBe('is a good option at');
  });

  it('builds fair tier headline', () => {
    const result = buildHeadlineText('Blacks', 'fair', false);
    expect(result.prefix).toContain('fair');
  });

  it('builds marginal tier headline', () => {
    const result = buildHeadlineText('Blacks', 'marginal', false);
    expect(result.prefix).toContain('marginal');
  });

  it('adds tomorrow prefix for dawn-patrol', () => {
    const result = buildHeadlineText('Blacks', 'good', true, 'dawn-patrol');
    expect(result.prefix).toContain("Tomorrow's dawn patrol");
  });

  it('adds tomorrow prefix for morning', () => {
    const result = buildHeadlineText('Blacks', 'good', true, 'morning');
    expect(result.prefix).toContain('Tomorrow morning');
  });

  it('adds tomorrow prefix for afternoon', () => {
    const result = buildHeadlineText('Blacks', 'good', true, 'afternoon');
    expect(result.prefix).toContain('Tomorrow afternoon');
  });
});
```

**Step 3: Run tests**

Run: `yarn jest __tests__/components/home-screen/hero-recommendation.test.tsx --no-coverage -t "buildHeadlineText"`

Expected: PASS

**Step 4: Update headline JSX in HeroRecommendation**

Replace the headline section in the component with:

```typescript
// Inside the component, before the return:
const tier = getConditionTier(score);
const scoreColorClass = getScoreColorClass(tier);

// Determine if showing tomorrow's forecast
const isTomorrow = (() => {
  const now = new Date();
  const todayStr = formatBeachDateTime(now, window.timezone, "yyyy-MM-dd");
  const startDayStr = formatBeachDateTime(window.start, window.timezone, "yyyy-MM-dd");
  return todayStr !== startDayStr && window.start > now;
})();

const headline = buildHeadlineText(beach.name, tier, isTomorrow, timeSlot);

// In the JSX, replace the h1:
<h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
  {headline.prefix && <span>{headline.prefix}</span>}
  <button
    onClick={() => onViewBeach(beach.id)}
    className="hover:text-accent-orange focus-visible:text-accent-orange focus-visible:outline-none focus-visible:underline transition-colors text-left min-h-[44px] inline"
    aria-label={`View details for ${beach.name}`}
  >
    {headline.beachPart}
  </button>{" "}
  {headline.connector}{" "}
  <motion.span
    className={scoreColorClass}
    data-testid="hero-score"
    animate={shouldReduceMotion ? undefined : {
      textShadow: [...HOME_HEADER_MOTION.hero.scoreGlow.textShadow],
      transition: HOME_HEADER_MOTION.hero.scoreGlow.transition,
    }}
  >
    {formattedScore}/10
  </motion.span>.
</h1>
```

**Step 5: Run component tests**

Run: `yarn jest __tests__/components/home-screen/hero-recommendation.test.tsx --no-coverage`

Expected: PASS

**Step 6: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx __tests__/components/home-screen/hero-recommendation.test.tsx
git commit -m "feat(ui): add dynamic headlines based on condition tier

Headlines now adapt based on quality:
- great: 'is your best bet'
- good: 'is a good option'
- fair: 'Conditions are fair at'
- marginal: 'Conditions are marginal at'

Also adds 'Tomorrow's dawn patrol/morning/afternoon' prefix.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update Score Color and Condition Badge

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx`

**Step 1: Update condition badge rendering**

Replace the "Perfect Match" badge logic with tier-based badges:

```typescript
{/* Remove this: */}
{score >= 90 && (
  <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
    <Badge
      variant="outline"
      className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
    >
      Perfect Match
    </Badge>
  </motion.div>
)}

{/* Replace with: */}
{(() => {
  const conditionBadge = getConditionBadge(tier);
  if (!conditionBadge) return null;
  return (
    <motion.div variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}>
      <Badge
        variant="outline"
        className={`text-xs sm:text-sm font-medium py-1.5 px-2.5 ${conditionBadge.className}`}
      >
        {conditionBadge.label}
      </Badge>
    </motion.div>
  );
})()}
```

**Step 2: Hide other condition badges for marginal tier**

Update the condition badges section to only show for good+ tiers:

```typescript
{/* Condition badges - only show for good or better conditions */}
{tier !== 'marginal' && conditionBadges?.slice(0, 3).map((badge) => (
  <motion.div
    key={badge.label}
    variants={shouldReduceMotion ? {} : HOME_HEADER_MOTION.hero.badge}
  >
    <Badge
      variant="outline"
      className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
    >
      {badge.label}
    </Badge>
  </motion.div>
))}
```

**Step 3: Verify build**

Run: `yarn build`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/home-screen/hero-recommendation.tsx
git commit -m "feat(ui): add tier-based condition badges and score colors

- Replace 'Perfect Match' with tier-based badges
- Great: 'Great Conditions' (green)
- Fair: 'Fair Conditions' (amber)
- Marginal: 'Marginal' (gray)
- Hide detail badges for marginal conditions
- Score color: orange for great/good, amber for fair, gray for marginal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update Existing Test Expectations

**Files:**
- Modify: `__tests__/services/select-best-window-time-slot.test.ts`

**Step 1: Update test that expected null for mismatched time slots**

The test "returns null when no forecasts match time slot" needs updating since we now return low-score windows:

```typescript
// This test should be updated - we now return windows regardless of score
it('returns null when NO forecasts exist in time slot (not just low score)', () => {
  // Only afternoon forecasts, no morning forecasts at all
  const forecasts = [
    createForecast(tomorrowStr, 20),  // 12pm PST (20:00 UTC) - afternoon only
    createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC) - afternoon only
  ];

  // Morning slot should return null because there are literally no 6am-12pm forecasts
  const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

  // Should return null - no forecasts exist within the requested time slot
  expect(result).toBeNull();
});
```

**Step 2: Run all time slot tests**

Run: `yarn jest __tests__/services/select-best-window-time-slot.test.ts --no-coverage`

Expected: All PASS

**Step 3: Commit**

```bash
git add __tests__/services/select-best-window-time-slot.test.ts
git commit -m "test: update time slot tests for new quality indicator behavior

Tests now expect windows to be returned regardless of score when a
specific time slot is selected. Null is only returned when no
forecasts exist in the requested time slot.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Final Verification

**Step 1: Run all related tests**

Run: `yarn jest --testPathPattern="window-selector|select-best-window|hero-recommendation" --no-coverage`

Expected: All PASS

**Step 2: Run full build**

Run: `yarn build`

Expected: Build succeeds

**Step 3: Manual verification checklist**

- [ ] Select "Dawn patrol" at evening time → shows "Tomorrow's dawn patrol" with appropriate tier
- [ ] Low score (< 40) shows gray score + "Marginal" badge
- [ ] Fair score (40-59) shows amber score + "Fair Conditions" badge
- [ ] Good score (60-79) shows orange score, no extra badge
- [ ] Great score (80+) shows orange score + "Great Conditions" badge
- [ ] Morning/Afternoon filters also show "Tomorrow" when window passed

**Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for time slot quality indicators

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Skip score threshold for specific time slots | window-selector.ts |
| 2 | Add condition tier helpers | hero-recommendation.tsx |
| 3 | Pass timeSlot prop | hero-recommendation.tsx, index.tsx |
| 4 | Update headline rendering | hero-recommendation.tsx |
| 5 | Update score color and badges | hero-recommendation.tsx |
| 6 | Update test expectations | select-best-window-time-slot.test.ts |
| 7 | Final verification | All files |
