# Oracle Skill-Based Beach Routing

## Problem

The Oracle recommends surf spots based on wave height ceilings but ignores inherent beach difficulty. A beginner at a heavy reef break on a small day sees that spot ranked the same as a mellow beach break. Two users at the same location with different skill levels get nearly identical recommendations.

## Goals

1. Beginners are actively steered toward beginner-friendly beaches
2. The hero recommendation (top pick + Today's Windows) is always skill-appropriate for beginners and intermediates
3. Nearby spots still shows all beaches so users can explore
4. Steering strength graduates — strongest for beginners, minimal for experts
5. Every beach in the database has a valid `skill_level` classification

## Non-Goals

- Real-time reclassification of beaches based on conditions
- Filtering beaches out of search/explore features (Oracle only)
- New UI components or visual changes (existing warnings suffice)

## Design

### 1. Beach Skill Classification Migration

Populate `beaches.skill_level` for all beaches currently NULL (~140 of ~186).

**Process:**
1. Export all beaches with NULL `skill_level` (name, break type, description, wave exposure, location)
2. Use Claude to classify each as `beginner`, `intermediate`, `advanced`, or `expert`
3. Generate a SQL migration with `UPDATE` statements per beach
4. Human review before applying

**Normalization of existing compound values:**
- `beginner-intermediate` -> `intermediate`
- `intermediate-advanced` -> `advanced`

Rationale: round up to the harder level. If a beach has intermediate-level hazards, treat it as intermediate.

**Post-migration:** Add `CHECK` constraint limiting `skill_level` to the four canonical values. Add `NOT NULL DEFAULT 'intermediate'` so new beaches always have a classification.

**Deploy ordering:** Migration must run before or simultaneously with the code deploy. During the gap, `parseSkillLevel()` returns null for compound values, which the scoring function treats as `intermediate` — safe but slightly incorrect (e.g., `intermediate-advanced` treated as `intermediate` instead of `advanced`).

**Files:**
- `supabase/migrations/YYYYMMDD_classify_beach_skill_levels.sql` — backfill + normalize
- `supabase/migrations/YYYYMMDD_constrain_beach_skill_level.sql` — CHECK + NOT NULL

### 2. Skill Match Scoring

New function `calculateBeachSkillMatchBonus()` in `discovery-adapter.ts`.

Compares `user.experience_level` to `beach.skill_level` and returns a graduated bonus/penalty:

| User Skill | Beach = beginner | Beach = intermediate | Beach = advanced | Beach = expert |
|---|---|---|---|---|
| **Beginner** | +20 | -5 | -15 | -25 |
| **Intermediate** | +5 | +10 | -3 | -10 |
| **Advanced** | 0 | +3 | +5 | 0 |
| **Expert** | 0 | 0 | +3 | +3 |

Key properties:
- Beginners get strongest steering — big bonus for beginner beaches, harsh penalty for advanced/expert
- Intermediate users get moderate steering
- Advanced/expert get minimal adjustment — never penalized for "easy" spots
- Stacks with existing wave-height ceiling penalty (different problems: beach difficulty vs current conditions)
- Expert gets smaller "home turf" bonus (+3) than Advanced (+5) because experts are comfortable everywhere — the bonus is less meaningful to them

**Reason strings:**
- Positive match: "Great match for your skill level"
- Negative match: "This spot may be challenging for your level"

**NULL handling:** If `parseSkillLevel(beach.skill_level)` returns null, treat as `intermediate` (neutral).

**Function location:** Defined in `discovery-adapter.ts` alongside `checkSkillCeiling` and `calculateSkillBonus`. Pure function signature: `calculateBeachSkillMatchBonus(userSkillLevel: SkillLevel, beachSkillLevel: SkillLevel): { bonus: number; reason: string | null; warning: string | null }`.

**Call site:** In `scoreBeachForDiscovery()` inside `surf-discovery-orchestrator.ts`, at line ~332 (after `scoreBeachWithEngine` returns a `DetailedScore`, before personalization bonus). Uses the same pattern as the existing personalization bonus (lines 332-336): directly mutate `detailedScore.total` with `Math.max(0, Math.min(100, detailedScore.total + bonus))`. The `beach` object and `userSkillLevel` are both available at this scope. Parse `beach.skill_level` with `parseSkillLevel()`, defaulting to `'intermediate'` if null.

**Warning deduplication:** The new skill-match warning replaces the existing static warning at orchestrator lines 349-352. Remove the old `'Advanced spot - check conditions carefully'` block — the new function produces more specific, skill-relative warnings.

### 3. Hero Hard Gate

The hero gate operates in two locations because hero selection involves both server ranking and a client-side home beach override.

**Server-side (orchestrator):** After scoring and sorting, reorder `recommendations[]` so the first element passes the skill gate:

**Gate rules:**
- Beginner user: first recommendation must be `beginner` or `intermediate` beach
- Intermediate user: first recommendation must NOT be `expert` beach
- Advanced/expert user: no restriction

Implementation: Find the highest-scored recommendation that passes the gate, swap it to position [0]. All recommendations remain in the array (nearby spots needs them).

**Client-side (oracle-home-screen.tsx):** The client currently overrides the hero with the user's home beach (`heroRec = homeBeachRec ?? topRec`). This must respect the gate:

- If the home beach rec passes the gate for the user's skill level, use it as hero (current behavior).
- If the home beach rec fails the gate (e.g., beginner with expert home beach), fall back to `topRec` (which the server already gated). Add a subtle warning to the home beach entry in nearby spots.

This requires passing `userSkillLevel` and a `passesHeroGate(beachSkillLevel, userSkillLevel)` helper to the client. The helper is a pure function that can be shared between server and client.

**Edge case — no qualifying beach:** If the gate filters out ALL recommendations, fall back to the highest-scored beach regardless. Better to show something with a warning than an empty Oracle.

### 4. End-to-End Data Flow

Both users at the same spot, 5ft day:

**Scoring example — Pipeline (expert beach):**

| Factor | Beginner | Advanced |
|---|---|---|
| Base conditions | 65 | 65 |
| Wave ceiling penalty | -8 (5ft > 4ft max) | 0 |
| Beach skill match | -25 (beginner at expert) | 0 (advanced at expert) |
| Skill ideal bonus | 0 | +3 |
| **Adjusted** | **32** | **68** |

**Scoring example — mellow beach break (beginner beach, 3ft):**

| Factor | Beginner | Advanced |
|---|---|---|
| Base conditions | 60 | 60 |
| Wave ceiling penalty | 0 | 0 |
| Beach skill match | +20 (beginner at beginner) | 0 |
| Skill ideal bonus | +3 | +3 |
| **Adjusted** | **83** | **63** |

**Hero selection:**
- Beginner: Pipeline gated out (server). Even if Pipeline is home beach, client gate blocks it. Mellow break (83 pts) is hero + Today's Windows.
- Advanced: Pipeline (68 pts) is hero. Mellow break in nearby spots.

**Display (unchanged):**
- Hero + Today's Windows = gated hero beach
- Nearby Spots = all beaches ranked by adjusted scores

## Files Changed

1. `supabase/migrations/YYYYMMDD_classify_beach_skill_levels.sql` — backfill all NULL beaches, normalize compounds
2. `supabase/migrations/YYYYMMDD_constrain_beach_skill_level.sql` — CHECK constraint + NOT NULL DEFAULT
3. `lib/domains/scoring/discovery-adapter.ts` — add `calculateBeachSkillMatchBonus()` pure function and `BEACH_SKILL_MATCH_SCORES` config constant (no signature changes to existing functions)
4. `lib/services/discovery/surf-discovery-orchestrator.ts` — import and call `calculateBeachSkillMatchBonus()` in `scoreBeachForDiscovery()` (after `scoreBeachWithEngine`, before personalization bonus), add hero gate reordering after scoring loop, remove old static skill warning (lines 349-352)
5. `lib/domains/user-preferences/skill-level.ts` — add `passesHeroGate(beachSkillLevel, userSkillLevel)` pure function (shared server/client)
6. `components/oracle/oracle-home-screen.tsx` — apply hero gate to home beach override: if `homeBeachRec` fails gate, fall back to `topRec`
7. `hooks/use-oracle-data.ts` — add `userSkillLevel: SkillLevel | null` to the `OracleData` interface, derived by calling `parseSkillLevel(profile?.experience_level)` inside the hook. Expose it so `oracle-home-screen.tsx` can use it for the client-side hero gate
8. `__tests__/domains/scoring/beach-skill-match.test.ts` — unit tests for scoring function (all 16 matrix cells)
9. `__tests__/services/discovery/hero-gate.test.ts` — unit tests for hero gate logic
10. Regenerate `types/database.generated.ts` after migration (skill_level becomes non-nullable)

## Testing Strategy

- Unit tests for `calculateBeachSkillMatchBonus()` covering all 16 cells of the scoring matrix
- Unit tests for `passesHeroGate()`: beginner gated from advanced/expert, intermediate gated from expert, advanced/expert ungated, null handling
- Unit tests for hero gate in orchestrator: reordering, fallback when all gated
- Unit test for client-side home beach gate override in `oracle-home-screen.tsx`
- Integration: verify two users with different skill levels at the same location get different hero recommendations
- Manual: review LLM beach classifications before applying migration
