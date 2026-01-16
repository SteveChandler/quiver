# Tide Direction Scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tide direction sensitivity scoring so beaches that close out on wrong tide direction show significantly lower scores and clear warnings.

**Architecture:** New `tideDirectionScorer` plugin (15% weight) that penalizes score based on beach-specific sensitivity (derived from break_type or explicit override). Sensitivity levels: low (-2 pts), medium (-5 pts), high (-9 pts final impact).

**Tech Stack:** TypeScript, Supabase migrations, Jest for testing

---

## Task 1: Add Database Column for Tide Direction Sensitivity

**Files:**
- Create: `supabase/migrations/20260116100000_add_tide_direction_sensitivity.sql`

**Step 1: Write the migration**

```sql
-- Add tide direction sensitivity column to beaches table
-- Allows per-beach override of sensitivity (derived from break_type when NULL)

ALTER TABLE public.beaches
ADD COLUMN IF NOT EXISTS tide_direction_sensitivity TEXT
CHECK (tide_direction_sensitivity IS NULL OR tide_direction_sensitivity IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.beaches.tide_direction_sensitivity IS
'Override for tide direction sensitivity. NULL = derive from break_type. low/medium/high = explicit override.';
```

**Step 2: Verify migration syntax**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && grep -c "ADD COLUMN" supabase/migrations/20260116100000_add_tide_direction_sensitivity.sql`
Expected: `1`

**Step 3: Commit**

```bash
git add supabase/migrations/20260116100000_add_tide_direction_sensitivity.sql
git commit -m "feat(db): add tide_direction_sensitivity column to beaches"
```

---

## Task 2: Update SpotProfile Types

**Files:**
- Modify: `lib/domains/spot-profile/types.ts`

**Step 1: Add directionSensitivity to TidePreferences interface**

Find `TidePreferences` interface (around line 43) and add the new field:

```typescript
/**
 * Tide preferences for optimal conditions.
 */
export interface TidePreferences {
  /** Minimum preferred tide height (feet) */
  readonly minHeightFt: number;
  /** Maximum preferred tide height (feet) */
  readonly maxHeightFt: number;
  /** Preferred tide movement direction */
  readonly preferredDirection: 'rising' | 'falling' | 'either' | 'slack';
  /** How sensitive this spot is to wrong tide direction */
  readonly directionSensitivity: 'low' | 'medium' | 'high';
}
```

**Step 2: Update SPOT_PROFILE_DEFAULTS**

Find `SPOT_PROFILE_DEFAULTS` (around line 89) and add default sensitivity:

```typescript
/** Default tide preferences: any tide */
tidePreferences: {
  minHeightFt: -2,
  maxHeightFt: 8,
  preferredDirection: 'either' as const,
  directionSensitivity: 'medium' as const,
},
```

**Step 3: Run type check**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn typecheck 2>&1 | grep -E "(error|Error)" | head -20`
Expected: Errors about missing `directionSensitivity` in spot-profile.ts (we'll fix next)

**Step 4: Commit**

```bash
git add lib/domains/spot-profile/types.ts
git commit -m "feat(types): add directionSensitivity to TidePreferences"
```

---

## Task 3: Update SpotProfile Factory to Compute Sensitivity

**Files:**
- Modify: `lib/domains/spot-profile/spot-profile.ts`

**Step 1: Add sensitivity derivation function**

Add after `parseTideDirection` function (around line 193):

```typescript
/**
 * Derives tide direction sensitivity from break type.
 * Reef breaks are most sensitive, point breaks least.
 */
function deriveSensitivityFromBreakType(
  breakType: string | null
): TidePreferences['directionSensitivity'] {
  if (!breakType) return 'medium';

  const normalized = breakType.toLowerCase().trim();

  // Reef breaks are highly sensitive to tide direction
  if (normalized.includes('reef')) {
    return 'high';
  }

  // Point breaks are generally more forgiving
  if (normalized.includes('point')) {
    return 'low';
  }

  // Beach breaks, river mouths, etc. - medium sensitivity
  return 'medium';
}

/**
 * Parses tide direction sensitivity from database or derives from break type.
 */
function parseTideDirectionSensitivity(
  explicit: string | null,
  breakType: string | null
): TidePreferences['directionSensitivity'] {
  // If explicitly set, use that value
  if (explicit) {
    const normalized = explicit.toLowerCase().trim();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
      return normalized;
    }
  }

  // Otherwise derive from break type
  return deriveSensitivityFromBreakType(breakType);
}
```

**Step 2: Update createTidePreferences to include sensitivity**

Modify the `createTidePreferences` function (around line 138):

```typescript
/**
 * Creates TidePreferences from beach tide configuration.
 */
function createTidePreferences(beach: Beach): TidePreferences {
  return {
    minHeightFt:
      beach.preferred_tide_ft_min ??
      SPOT_PROFILE_DEFAULTS.tidePreferences.minHeightFt,
    maxHeightFt:
      beach.preferred_tide_ft_max ??
      SPOT_PROFILE_DEFAULTS.tidePreferences.maxHeightFt,
    preferredDirection: parseTideDirection(beach.preferred_tide_direction),
    directionSensitivity: parseTideDirectionSensitivity(
      (beach as Beach & { tide_direction_sensitivity?: string | null }).tide_direction_sensitivity ?? null,
      beach.break_type
    ),
  };
}
```

**Step 3: Run type check**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn typecheck 2>&1 | grep -c "error"`
Expected: `0` (no errors)

**Step 4: Commit**

```bash
git add lib/domains/spot-profile/spot-profile.ts
git commit -m "feat(spot-profile): derive tide direction sensitivity from break type"
```

---

## Task 4: Add Scorer Weight and Types

**Files:**
- Modify: `lib/domains/scoring/types.ts`

**Step 1: Add tideDirection weight to SCORER_WEIGHTS**

Find `SCORER_WEIGHTS` (around line 140) and add the new weight. Rebalance by reducing trendPreference and tideFit:

```typescript
export const SCORER_WEIGHTS = {
  /** Base conditions (wave height, period) */
  baseConditions: 0.25,

  /** Swell alignment with beach window */
  swellAlignment: 0.15,

  /** Swell interference (primary vs secondary) */
  swellInterference: 0.15,

  /** Wind quality (offshore/cross/onshore) */
  windQuality: 0.15,

  /** Tide fit (height only - direction moved to tideDirection) */
  tideFit: 0.05,

  /** Tide direction match with beach preference - NEW */
  tideDirection: 0.15,

  /** Window stability */
  windowStability: 0.05,

  /** Trend preference (improving conditions) */
  trendPreference: 0.05,
} as const;
```

**Step 2: Run type check**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn typecheck 2>&1 | grep -c "error"`
Expected: `0`

**Step 3: Commit**

```bash
git add lib/domains/scoring/types.ts
git commit -m "feat(scoring): add tideDirection weight and rebalance scorers"
```

---

## Task 5: Write Failing Tests for Tide Direction Scorer

**Files:**
- Create: `__tests__/lib/domains/scoring/scorers/tide-direction-scorer.test.ts`

**Step 1: Write comprehensive test file**

```typescript
/**
 * Tests for tide direction scorer.
 */

import { tideDirectionScorer } from '@/lib/domains/scoring/scorers/tide-direction-scorer';
import type { ScorerInput } from '@/lib/domains/scoring/types';

// Helper to create minimal scorer input
function createInput(overrides: {
  tideDirection?: 'rising' | 'falling' | 'slack';
  preferredDirection?: 'rising' | 'falling' | 'either' | 'slack';
  sensitivity?: 'low' | 'medium' | 'high';
}): ScorerInput {
  return {
    snapshot: {
      timestamp: new Date(),
      tide: {
        heightFt: 3,
        direction: overrides.tideDirection ?? 'rising',
      },
      wind: { speedMph: 5, directionDeg: 90 },
      swell: {
        primary: { heightFt: 4, periodS: 12, directionDeg: 270 },
        secondary: null,
      },
      confidence: 80,
    },
    profile: {
      id: 'test-beach',
      name: 'Test Beach',
      timezone: 'America/Los_Angeles',
      coordinates: { lat: 33.0, lon: -117.0 },
      swellWindow: { minDeg: 250, maxDeg: 290, centerDeg: 270, halfWidthDeg: 20 },
      windThresholds: {
        offshoreDeg: 90,
        offshoreToleranceDeg: 45,
        maxOnshoreMph: 10,
        maxAnyMph: 18,
        crossShoreOkKts: 15,
      },
      tidePreferences: {
        minHeightFt: 2,
        maxHeightFt: 5,
        preferredDirection: overrides.preferredDirection ?? 'rising',
        directionSensitivity: overrides.sensitivity ?? 'medium',
      },
      skillLevel: null,
      breakType: 'beach break',
    },
    window: null,
  };
}

describe('tideDirectionScorer', () => {
  describe('when beach has no preference (either)', () => {
    it('returns neutral score', () => {
      const input = createInput({
        tideDirection: 'falling',
        preferredDirection: 'either',
        sensitivity: 'high',
      });

      const result = tideDirectionScorer.score(input);

      expect(result.score).toBe(70);
      expect(result.skip).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('when tide direction matches preference', () => {
    it('gives bonus for low sensitivity', () => {
      const input = createInput({
        tideDirection: 'rising',
        preferredDirection: 'rising',
        sensitivity: 'low',
      });

      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeGreaterThan(70);
      expect(result.reasons).toContain(expect.stringMatching(/tide.*rising/i));
    });

    it('gives larger bonus for high sensitivity', () => {
      const low = tideDirectionScorer.score(
        createInput({ tideDirection: 'rising', preferredDirection: 'rising', sensitivity: 'low' })
      );
      const high = tideDirectionScorer.score(
        createInput({ tideDirection: 'rising', preferredDirection: 'rising', sensitivity: 'high' })
      );

      expect(high.score).toBeGreaterThan(low.score);
    });
  });

  describe('when tide direction opposes preference', () => {
    it('applies penalty for low sensitivity', () => {
      const input = createInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        sensitivity: 'low',
      });

      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeLessThan(70);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('applies larger penalty for high sensitivity', () => {
      const low = tideDirectionScorer.score(
        createInput({ tideDirection: 'falling', preferredDirection: 'rising', sensitivity: 'low' })
      );
      const high = tideDirectionScorer.score(
        createInput({ tideDirection: 'falling', preferredDirection: 'rising', sensitivity: 'high' })
      );

      expect(high.score).toBeLessThan(low.score);
    });

    it('includes descriptive warning for high sensitivity mismatch', () => {
      const input = createInput({
        tideDirection: 'falling',
        preferredDirection: 'rising',
        sensitivity: 'high',
      });

      const result = tideDirectionScorer.score(input);

      expect(result.warnings).toContain(
        expect.stringMatching(/tide.*dropping|falling|outgoing/i)
      );
    });
  });

  describe('when tide is slack', () => {
    it('applies half penalty when beach prefers movement', () => {
      const slack = tideDirectionScorer.score(
        createInput({ tideDirection: 'slack', preferredDirection: 'rising', sensitivity: 'medium' })
      );
      const opposite = tideDirectionScorer.score(
        createInput({ tideDirection: 'falling', preferredDirection: 'rising', sensitivity: 'medium' })
      );

      // Slack should be better than opposite direction
      expect(slack.score).toBeGreaterThan(opposite.score);
      // But worse than neutral
      expect(slack.score).toBeLessThan(70);
    });

    it('gives bonus when beach prefers slack', () => {
      const input = createInput({
        tideDirection: 'slack',
        preferredDirection: 'slack',
        sensitivity: 'medium',
      });

      const result = tideDirectionScorer.score(input);

      expect(result.score).toBeGreaterThan(70);
    });
  });

  describe('scorer metadata', () => {
    it('has correct name', () => {
      expect(tideDirectionScorer.name).toBe('tideDirection');
    });

    it('has correct weight', () => {
      expect(tideDirectionScorer.weight).toBe(0.15);
    });

    it('never triggers skip', () => {
      const inputs = [
        createInput({ tideDirection: 'falling', preferredDirection: 'rising', sensitivity: 'high' }),
        createInput({ tideDirection: 'rising', preferredDirection: 'rising', sensitivity: 'low' }),
        createInput({ preferredDirection: 'either' }),
      ];

      inputs.forEach((input) => {
        const result = tideDirectionScorer.score(input);
        expect(result.skip).toBe(false);
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn test:unit -- --testPathPattern="tide-direction-scorer" 2>&1 | tail -10`
Expected: Error about module not found (scorer doesn't exist yet)

**Step 3: Commit**

```bash
git add __tests__/lib/domains/scoring/scorers/tide-direction-scorer.test.ts
git commit -m "test(scoring): add failing tests for tide direction scorer"
```

---

## Task 6: Implement Tide Direction Scorer

**Files:**
- Create: `lib/domains/scoring/scorers/tide-direction-scorer.ts`

**Step 1: Write the scorer implementation**

```typescript
/**
 * Tide Direction Scorer
 *
 * Scores tide direction (rising/falling) against beach preferences.
 * Different beaches have different sensitivities to tide direction.
 *
 * Weight: 0.15 (15% of total score)
 *
 * Key behaviors:
 * - Sensitivity determines penalty magnitude (low/medium/high)
 * - Match: bonus based on sensitivity
 * - Mismatch: penalty based on sensitivity
 * - Slack tide: half penalty when movement preferred
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS } from '../types';

/**
 * Score adjustments by sensitivity level.
 * These translate to final score impact of ~2/5/9 points.
 */
const SENSITIVITY_SCORES = {
  low: {
    match: 80,      // +1.2 points final (0.15 * 80 - 70 baseline)
    mismatch: 55,   // -2.25 points final
    slack: 62,      // -1.2 points final (half of mismatch)
  },
  medium: {
    match: 85,      // +2.25 points final
    mismatch: 35,   // -5.25 points final
    slack: 52,      // -2.7 points final
  },
  high: {
    match: 90,      // +3 points final
    mismatch: 10,   // -9 points final
    slack: 40,      // -4.5 points final
  },
} as const;

/**
 * Warning messages by sensitivity level.
 */
const MISMATCH_WARNINGS = {
  low: 'Tide direction not ideal for this spot',
  medium: 'Tide dropping - may affect wave shape',
  high: 'Tide dropping - this spot closes out on outgoing tide',
} as const;

const MATCH_REASONS = {
  low: 'Tide direction favorable',
  medium: 'Tide rising - good for this spot',
  high: 'Tide rising - optimal for this spot',
} as const;

/**
 * Tide direction scorer plugin.
 */
export const tideDirectionScorer: ScorerPlugin = {
  name: 'tideDirection',
  weight: SCORER_WEIGHTS.tideDirection,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const actualDirection = snapshot.tide.direction;
    const { preferredDirection, directionSensitivity } = profile.tidePreferences;

    const reasons: string[] = [];
    const warnings: string[] = [];

    // If beach has no preference, return neutral score
    if (preferredDirection === 'either') {
      return {
        name: 'tideDirection',
        score: 70,
        weight: SCORER_WEIGHTS.tideDirection,
        reasons: [],
        warnings: [],
        skip: false,
        skipReason: null,
      };
    }

    const scores = SENSITIVITY_SCORES[directionSensitivity];
    let score: number;

    // Check for match
    if (actualDirection === preferredDirection) {
      score = scores.match;
      reasons.push(getMatchReason(preferredDirection, directionSensitivity));
    }
    // Check for slack when movement preferred
    else if (actualDirection === 'slack' && preferredDirection !== 'slack') {
      score = scores.slack;
      warnings.push('Tide slack - spot prefers ' + preferredDirection + ' tide');
    }
    // Check for slack match
    else if (actualDirection === 'slack' && preferredDirection === 'slack') {
      score = scores.match;
      reasons.push('Slack tide - good for this spot');
    }
    // Mismatch - opposite direction
    else {
      score = scores.mismatch;
      warnings.push(getMismatchWarning(actualDirection, preferredDirection, directionSensitivity));
    }

    return {
      name: 'tideDirection',
      score,
      weight: SCORER_WEIGHTS.tideDirection,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};

/**
 * Get reason message for tide direction match.
 */
function getMatchReason(
  direction: 'rising' | 'falling' | 'slack',
  sensitivity: 'low' | 'medium' | 'high'
): string {
  if (direction === 'slack') {
    return 'Slack tide - good for this spot';
  }

  const base = MATCH_REASONS[sensitivity];
  // Customize for falling tide preference
  if (direction === 'falling') {
    return base.replace('rising', 'dropping').replace('Tide rising', 'Tide dropping');
  }
  return base;
}

/**
 * Get warning message for tide direction mismatch.
 */
function getMismatchWarning(
  actual: 'rising' | 'falling' | 'slack',
  preferred: 'rising' | 'falling' | 'either' | 'slack',
  sensitivity: 'low' | 'medium' | 'high'
): string {
  const base = MISMATCH_WARNINGS[sensitivity];

  // Customize message based on actual condition
  if (actual === 'rising' && preferred === 'falling') {
    return base.replace('dropping', 'rising').replace('outgoing', 'incoming');
  }

  return base;
}
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn test:unit -- --testPathPattern="tide-direction-scorer" 2>&1 | tail -20`
Expected: All tests passing

**Step 3: Commit**

```bash
git add lib/domains/scoring/scorers/tide-direction-scorer.ts
git commit -m "feat(scoring): implement tide direction scorer with sensitivity levels"
```

---

## Task 7: Export and Register the Scorer

**Files:**
- Modify: `lib/domains/scoring/scorers/index.ts`
- Modify: `lib/domains/scoring/index.ts`

**Step 1: Export from scorers index**

Add to `lib/domains/scoring/scorers/index.ts`:

```typescript
export { tideDirectionScorer } from './tide-direction-scorer';
```

**Step 2: Register in scoring index**

In `lib/domains/scoring/index.ts`, find where scorers are registered and add the new one. Look for the list of scorer imports and add:

```typescript
import { tideDirectionScorer } from './scorers/tide-direction-scorer';
```

Then add to the registration array (wherever `registerAll` is called or scorers are listed):

```typescript
tideDirectionScorer,
```

**Step 3: Run full scoring tests**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn test:unit -- --testPathPattern="scoring" 2>&1 | grep -E "(PASS|FAIL|Tests:)" | tail -5`
Expected: All scoring tests pass

**Step 4: Commit**

```bash
git add lib/domains/scoring/scorers/index.ts lib/domains/scoring/index.ts
git commit -m "feat(scoring): register tide direction scorer in scoring engine"
```

---

## Task 8: Data Migration - Parse Notes for Tide Direction

**Files:**
- Create: `supabase/migrations/20260116100100_parse_tide_direction_from_notes.sql`

**Step 1: Write the migration**

```sql
-- Parse tide direction preferences from best_conditions notes field
-- Keywords: incoming/rising/push -> 'rising', outgoing/falling/dropping/pull -> 'falling'

UPDATE public.beaches
SET preferred_tide_direction = 'rising'
WHERE preferred_tide_direction IS NULL
  AND best_conditions IS NOT NULL
  AND (
    best_conditions->>'notes' ~* '\bincoming\b'
    OR best_conditions->>'notes' ~* '\brising\b'
    OR best_conditions->>'notes' ~* '\bpush\b'
    OR best_conditions->>'notes' ~* '\bincoming tide\b'
    OR best_conditions->>'notes' ~* '\brising water\b'
  );

UPDATE public.beaches
SET preferred_tide_direction = 'falling'
WHERE preferred_tide_direction IS NULL
  AND best_conditions IS NOT NULL
  AND (
    best_conditions->>'notes' ~* '\boutgoing\b'
    OR best_conditions->>'notes' ~* '\bfalling\b'
    OR best_conditions->>'notes' ~* '\bdropping\b'
    OR best_conditions->>'notes' ~* '\bpull\b'
    OR best_conditions->>'notes' ~* '\boutgoing tide\b'
  );

-- Log how many were updated
DO $$
DECLARE
  rising_count INTEGER;
  falling_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rising_count FROM public.beaches WHERE preferred_tide_direction = 'rising';
  SELECT COUNT(*) INTO falling_count FROM public.beaches WHERE preferred_tide_direction = 'falling';
  RAISE NOTICE 'Tide direction parsed: % rising, % falling', rising_count, falling_count;
END $$;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260116100100_parse_tide_direction_from_notes.sql
git commit -m "feat(db): parse tide direction preferences from beach notes"
```

---

## Task 9: Integration Test - Full Scoring Pipeline

**Files:**
- Create: `__tests__/lib/domains/scoring/integration/tide-direction-integration.test.ts`

**Step 1: Write integration test**

```typescript
/**
 * Integration tests for tide direction scoring in full pipeline.
 */

import { ScoringEngine, createScoringEngine } from '@/lib/domains/scoring';
import { tideDirectionScorer } from '@/lib/domains/scoring/scorers/tide-direction-scorer';
import { tideFitScorer } from '@/lib/domains/scoring/scorers/tide-fit-scorer';
import { baseConditionsScorer } from '@/lib/domains/scoring/scorers/base-conditions-scorer';
import type { ScorerInput } from '@/lib/domains/scoring/types';

function createFullInput(overrides: {
  tideDirection?: 'rising' | 'falling' | 'slack';
  preferredDirection?: 'rising' | 'falling' | 'either' | 'slack';
  sensitivity?: 'low' | 'medium' | 'high';
  waveHeightFt?: number;
}): ScorerInput {
  return {
    snapshot: {
      timestamp: new Date(),
      tide: {
        heightFt: 3,
        direction: overrides.tideDirection ?? 'rising',
      },
      wind: { speedMph: 5, directionDeg: 90 },
      swell: {
        primary: { heightFt: overrides.waveHeightFt ?? 4, periodS: 12, directionDeg: 270 },
        secondary: null,
      },
      confidence: 80,
    },
    profile: {
      id: 'test-beach',
      name: 'Test Beach',
      timezone: 'America/Los_Angeles',
      coordinates: { lat: 33.0, lon: -117.0 },
      swellWindow: { minDeg: 250, maxDeg: 290, centerDeg: 270, halfWidthDeg: 20 },
      windThresholds: {
        offshoreDeg: 90,
        offshoreToleranceDeg: 45,
        maxOnshoreMph: 10,
        maxAnyMph: 18,
        crossShoreOkKts: 15,
      },
      tidePreferences: {
        minHeightFt: 2,
        maxHeightFt: 5,
        preferredDirection: overrides.preferredDirection ?? 'rising',
        directionSensitivity: overrides.sensitivity ?? 'high',
      },
      skillLevel: null,
      breakType: 'reef break',
    },
    window: null,
  };
}

describe('Tide Direction Scoring Integration', () => {
  let engine: ScoringEngine;

  beforeEach(() => {
    engine = createScoringEngine();
    engine.registerAll([baseConditionsScorer, tideFitScorer, tideDirectionScorer]);
  });

  it('high sensitivity mismatch drops score significantly', () => {
    const matchInput = createFullInput({
      tideDirection: 'rising',
      preferredDirection: 'rising',
      sensitivity: 'high',
    });

    const mismatchInput = createFullInput({
      tideDirection: 'falling',
      preferredDirection: 'rising',
      sensitivity: 'high',
    });

    const matchResult = engine.score(matchInput);
    const mismatchResult = engine.score(mismatchInput);

    // Should drop by at least 8 points for high sensitivity
    expect(matchResult.total - mismatchResult.total).toBeGreaterThanOrEqual(8);
  });

  it('includes tide direction warning in composite result', () => {
    const input = createFullInput({
      tideDirection: 'falling',
      preferredDirection: 'rising',
      sensitivity: 'high',
    });

    const result = engine.score(input);

    expect(result.warnings).toContain(
      expect.stringMatching(/tide.*dropping|close.*out/i)
    );
  });

  it('low sensitivity mismatch has minimal impact', () => {
    const matchInput = createFullInput({
      tideDirection: 'rising',
      preferredDirection: 'rising',
      sensitivity: 'low',
    });

    const mismatchInput = createFullInput({
      tideDirection: 'falling',
      preferredDirection: 'rising',
      sensitivity: 'low',
    });

    const matchResult = engine.score(matchInput);
    const mismatchResult = engine.score(mismatchInput);

    // Low sensitivity should have less than 5 point difference
    expect(matchResult.total - mismatchResult.total).toBeLessThan(5);
  });
});
```

**Step 2: Run integration tests**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn test:unit -- --testPathPattern="tide-direction-integration" 2>&1 | tail -15`
Expected: All tests pass

**Step 3: Commit**

```bash
git add __tests__/lib/domains/scoring/integration/tide-direction-integration.test.ts
git commit -m "test(scoring): add integration tests for tide direction scoring"
```

---

## Task 10: Final Verification and Merge Prep

**Step 1: Run all scoring tests**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn test:unit -- --testPathPattern="scoring" 2>&1 | grep -E "Tests:"`
Expected: All tests pass

**Step 2: Run type check**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn typecheck 2>&1 | grep -c "error"`
Expected: `0`

**Step 3: Run lint**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/tide-direction-scoring && yarn lint 2>&1 | tail -5`
Expected: No errors

**Step 4: Create summary commit**

```bash
git log --oneline main..HEAD
```

**Step 5: Ready for merge**

Report branch is ready for review and merge to main.

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/migrations/20260116100000_add_tide_direction_sensitivity.sql` | Create |
| `supabase/migrations/20260116100100_parse_tide_direction_from_notes.sql` | Create |
| `lib/domains/spot-profile/types.ts` | Modify |
| `lib/domains/spot-profile/spot-profile.ts` | Modify |
| `lib/domains/scoring/types.ts` | Modify |
| `lib/domains/scoring/scorers/tide-direction-scorer.ts` | Create |
| `lib/domains/scoring/scorers/index.ts` | Modify |
| `lib/domains/scoring/index.ts` | Modify |
| `__tests__/lib/domains/scoring/scorers/tide-direction-scorer.test.ts` | Create |
| `__tests__/lib/domains/scoring/integration/tide-direction-integration.test.ts` | Create |
