# Board Model Merge Implementation Plan

> **For agentic workers:** executed as Codex packets (`codex exec`), reviewed by Claude and `codex exec review`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One board-choice rule, one break-type rule and one "sessions like this" rule shared by the match score and the board picker, plus a picker that learns from "wrong type" feedback.

**Architecture:**
- The TypeScript `recommendBoard` (`lib/scoring/personal-board.ts`) becomes the only "which board" rule. The match-score API attaches its pick, and the SQL `tips` CTE is deleted.
- Break types resolve to families in one table, mirrored in TypeScript and SQL.
- The match score's user-facing "profile peak" bullets are replaced by a count of good sessions in similar conditions. The count uses a SQL port of the same similarity kernel the picker uses.
- Native shows the pick with the same "Bring your …" phrasing Explore uses.

**Tech stack:**
- Web: Next.js API route (`withAuth`), TypeScript, Jest, PostgreSQL/Supabase migration.
- Native: Expo/React Native, Jest.

**Spec / evidence:** `/Users/stevenchandler/Desktop/dev/quiver-native/.planning/2026-09-27-why-quiver-picked/report.md` (§3, §4, §6B).

**Worktrees:**
- Web: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/board-model-merge-20260927`, branch `feat/board-model-merge-20260927`, from `origin/main` f762b1f89.
- Native: `/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/board-model-merge-20260927`, branch `feat/board-model-merge-20260927`, from `origin/main` ffc2de07.
- In both, `node_modules` and the `.env*` files are symlinks. Never stage them.

## Global Constraints

- Mobile-consumed API contracts are **additive only**. Keep `board_tip` (string or null) in the match-score response. Add `board_pick`; never rename or remove existing fields.
- Migrations go in `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, wrapped in `BEGIN; … COMMIT;`. Keep `SECURITY DEFINER` and `SET search_path TO 'public', 'pg_temp'` on the recreated function.
- **Never apply a migration to any remote or production database.** Validate only on the disposable local PostgreSQL harness (`scripts/test-week-scout-match-postgres.sh` pattern). Production reads go only through the read-only helper `/private/tmp/claude-501/-Users-stevenchandler-Desktop-dev-quiver/9be52a9f-f78d-48c8-8672-df41bb250973/scratchpad/q.sh`, and only `SELECT`.
- Do not change the match score's numeric formula (`base_score`, `aversion_penalty`, `fit_adjustment`, `board_adjustment`) beyond what the break-family change implies.
- Do not use `useState`/`useEffect` for server data on native. Keep the TanStack Query patterns.
- User-facing copy uses no scoring jargon: no "profile peak", no "band" unless it already exists, and never "You usually ride".
- Stage explicitly by path. Never run `git add -A` or `git add .`. Commit atomically with a Conventional Commit. Do not push.

## Review Focus

1. **A `beach/reef break` session scoring a `beach` target.** It must now count toward the target's profile and similarity, where today it is excluded. Test in SQL and TypeScript.
2. **A board whose `board_type` is `thruster` or unknown.** Today TypeScript drops it from the picker. `thruster` must now map to `shortboard`; an unknown type must fall back to the name.
3. **A learned user with zero similar good sessions.** The bullet must read "0 of your N good sessions were in conditions like this." — not crash, not empty.
4. **Board loading failing in the match-score API.** The response must still succeed with `board_pick: null` and `board_tip: null`, never a 500.
5. **An old native binary reading the new response.** `board_tip` is still a plain board name, so an older app shows "You usually ride: Twin pin" without breaking.

---

### Task 1 (web): break families, thruster alias, and wrong-type weighting in the picker

**Files:**
- Create: `lib/scoring/break-family.ts`
- Modify: `lib/scoring/personal-board.ts` (`similarity()` break term at the `historicalBeach?.break_type … distance += 0.5` line; the feedback and rating loop in `recommendBoard`)
- Modify: `lib/domains/rideability/board-class.ts` (`BOARD_TYPE_TO_BOARD_CLASS`: add `thruster: 'shortboard'`)
- Test: `__tests__/lib/scoring/break-family.test.ts` (new), `__tests__/lib/scoring/personal-board.test.ts`, and the existing board-class test (find it with `git grep -l normalizeBoardClass __tests__`)

**Interfaces (produced):**

```ts
// lib/scoring/break-family.ts
export type BreakFamily = 'beach' | 'reef' | 'point' | (string & {});
/** Families for a beaches.break_type value; null when unknown/blank (treated as matching anything). */
export function breakTypeFamilies(raw: string | null | undefined): readonly BreakFamily[] | null;
/** True when either side is null/blank or the family sets intersect. */
export function breakTypesMatch(a: string | null | undefined, b: string | null | undefined): boolean;
```

**Rules (copy exactly; Task 2 ports them to SQL):**

- **Tokens:** lower-case the value, split on `/`, trim each part, and strip a trailing `" break"`. Discard empty tokens.
- **Token to family:**
  - `beach`, `pier`, `jetty`, `breakwater`, `inlet`, `river-mouth` → `beach`
  - `reef` → `reef`
  - `point` → `point`
  - any other token → itself
- **Result:** the distinct families in first-seen order, or `null` when there are no tokens.

**Fixture table** (identical in the TypeScript and SQL tests):

| input | families |
|---|---|
| `'beach'` | `['beach']` |
| `'Beach '` | `['beach']` |
| `'beach/reef break'` | `['beach','reef']` |
| `'reef/point'` | `['reef','point']` |
| `'jetty/beach'` | `['beach']` |
| `'pier'` | `['beach']` |
| `'jetty'` | `['beach']` |
| `'breakwater'` | `['beach']` |
| `'inlet'` | `['beach']` |
| `'river-mouth'` | `['beach']` |
| `'reef'` | `['reef']` |
| `'point'` | `['point']` |
| `'slab'` | `['slab']` |
| `''` | `null` |
| `null` | `null` |

**Match cases:**

| a | b | match |
|---|---|---|
| `'beach'` | `'beach/reef break'` | true |
| `'beach'` | `'reef'` | false |
| `null` | `'reef'` | true |
| `'jetty'` | `'beach'` | true |
| `'point'` | `'reef/point'` | true |

**Picker changes in `recommendBoard`:**

- `similarity()`: replace the break-type inequality with `if (!breakTypesMatch(historicalBeach?.break_type, beach.break_type)) distance += 0.5;`. Keep the 0.5 penalty. Only the definition of "same break" changes.
- **Board-fit feedback weights:**

  ```ts
  const BOARD_FIT_WEIGHT = { right: 1, too_small: -1, too_much_board: -1, wrong_type: -2 } as const
  ```

  Any other value weighs 0. Use `feedback += entry.weight * (BOARD_FIT_WEIGHT[fit] ?? 0)`.
- **Rating credit:** a matched session whose `session_board_fit` is `wrong_type`, `too_small` or `too_much_board` contributes `entry.weight * Math.min(rating - baseline, 0)` to `ratingSum`. The rating describes the session; the flag says the board was the wrong tool, so it cannot earn credit. `ratingWeight` accumulation is unchanged.
- Everything else in the formula (`historyBlend`, `boardBlend`, `personal`, recency, the session-count term) is unchanged.

**Tests to add** (build fixtures from the existing helpers in `personal-board.test.ts`):

- The break-family fixture table and match cases above.
- `normalizeBoardClass('thruster') === 'shortboard'` and `normalizeBoardClass('twin-pin') === 'fish'`.
- **Relative penalty:** boards A and B are identical, with the same matched sessions. Adding one extra matched session flagged `wrong_type` to A, and the identical session flagged `too_small` to B, leaves A's score strictly below B's. Expose scores through a test-only helper, or assert pick order when A and B compete with a neutral third board. Prefer asserting pick order.
- **No credit for a mismatched 5★:** boards A and B share history. A gets an extra 5★ session flagged `wrong_type`; B gets the identical session flagged `right`. B is picked over A.
- **Break family in similarity:** a historical session at a `beach/reef break` beach and an otherwise identical one at a `beach` beach produce the same similarity against a `beach` target. Assert through the picked board's `reason` session count, or export `similarity` for tests only if needed.

- [ ] Write the failing tests, then run `yarn jest __tests__/lib/scoring/break-family.test.ts __tests__/lib/scoring/personal-board.test.ts` and confirm they fail for the right reason.
- [ ] Implement.
- [ ] Re-run until they pass. Then run `yarn jest __tests__/lib/scoring __tests__/lib/domains` and fix any regressions.
- [ ] Commit: `git add lib/scoring/break-family.ts lib/scoring/personal-board.ts lib/domains/rideability/board-class.ts <test files>` then `git commit -m "feat(scoring): break families, thruster alias and wrong-type weighting in board picker"`.

### Task 2 (web): SQL migration — break families, similar-sessions bullet, aligned board class, no SQL board tip

**Files:**
- Create: `supabase/migrations/20260927230000_board_model_merge_match_score.sql`
- Create: `supabase/tests/match_score_board_model.sql` (disposable-Postgres fixture, the same style as `supabase/tests/week_scout_match_equivalence.sql`)
- Create: `scripts/test-match-score-board-model-postgres.sh` (mirror `scripts/test-week-scout-match-postgres.sh`)
- Test: `__tests__/lib/scoring/condition-similarity-parity.test.ts` (TypeScript side of the parity fixture)

**Interfaces (produced):**

```sql
public.break_type_families(p_break_type text) RETURNS text[]  -- IMMUTABLE, NULL for blank
public.break_types_match(p_a text, p_b text) RETURNS boolean   -- IMMUTABLE
public.session_condition_similarity(
  p_past_wave numeric, p_past_period numeric, p_past_wind numeric, p_past_wind_dir numeric,
  p_past_rel_tide numeric, p_past_tide_dir text, p_past_break_type text,
  p_cur_wave numeric, p_cur_period numeric, p_cur_wind numeric, p_cur_wind_dir numeric,
  p_cur_rel_tide numeric, p_cur_tide_dir text, p_cur_break_type text
) RETURNS numeric  -- IMMUTABLE; a port of similarity() in lib/scoring/personal-board.ts
```

`compute_user_match_scores(uuid, uuid[], jsonb)` keeps the same signature, recreated from the body in `supabase/migrations/20260923040000_share_match_score_inputs.sql`.

**`session_condition_similarity` must port `similarity()` exactly:**

1. **Paired Gaussian terms.** Each term is `importance * ((past - cur) / width)^2`, skipped when either side is null:
   - height: width 1.5, importance 0.4
   - period: width 4, importance 0.25
   - wind: width 8, importance 0.2
   - relative tide: width 2, importance 0.15
2. **Wind direction.** `0.1 * (min(d, 360 - d) / 90)^2`, where `d = abs(past - cur) % 360`. Skipped if either side is null.
3. **Tide direction.** `+0.25` when both sides are known and differ. Directions come from tide status: `rising|incoming|flood` → `incoming`, `falling|outgoing|ebb` → `outgoing`, else null.
4. **Break type.** `+0.5` when `NOT break_types_match(past, cur)`.
5. **Steepness.** `0.15 * ((past_wave / past_period^2 - cur_wave / cur_period^2) / 0.04)^2` when both periods are nonzero.
6. **Result.** `exp(-distance / 2)`. Return 0 when either wave height is null.

Relative tide is `tide_height - (preferred_tide_ft_min + preferred_tide_ft_max) / 2` of that session's own beach (or of the requested beach for the current side). It is null if either bound is null.

**Changes to `compute_user_match_scores`:**

1. **`history` CTE.** Also select the session beach's `preferred_tide_ft_min`/`max`, the snapshot `tide_status`, and the current board row's `board_type` and `name`. `boards.board_type` is already joined as `boards`.
2. **`chosen_board` class resolution.** Order the candidate keys as:
   - `boards.board_type` (current row, `source_priority` 0)
   - `boards.name` (1)
   - snapshot `board_type` (2)
   - snapshot `name` (3)

   Add `'thruster'` → `'shortboard'` to the `CASE`. Keep ranking by `use_count DESC, last_used_at DESC`, then priority. With this change, Steven's "Twin pin" (row type `shortboard`) resolves to `shortboard` in both SQL and TypeScript. A row edited to `twin-pin` resolves to `fish` in both.
3. **`peaks` and `fit_pairs`.** Replace `(t.break_type IS NULL OR h.break_type = t.break_type OR h.break_type IS NULL)` with `public.break_types_match(t.break_type, h.break_type)`.
4. **Delete the `tips` CTE** and its join. Remove `'board_tip'` from every result object. The API now owns the board pick (Task 3).
5. **Learned branch reason bullets.** Replace the three `format('… profile peak …')` bullets with one bullet: `format('%s of your %s good sessions were in conditions like this.', similar_good, good_total)`.
   - `good_total` = eligible sessions with `rating >= 4` (all break types).
   - `similar_good` = eligible sessions with `rating >= 4` and `session_condition_similarity(...) >= 0.35` against the slot. The current side uses the slot's `f_*` values, the requested beach's relative tide and break type, and a null tide direction because slots carry no tide status.
   - Keep the fit-feedback and board-band bullets after it.
   - Add result keys `'good_session_count', good_total` and `'similar_good_session_count', similar_good`.
   - Compute these once per scenario, not per history row per bullet.
6. **Leave unchanged:** the `base_score` and `p_*` means (only their row set changes, through item 3), and every other branch.

**Disposable-Postgres test** (`supabase/tests/match_score_board_model.sql`) must assert:

- `break_type_families` equals the Task 1 fixture table, row by row, and `break_types_match` equals the Task 1 match cases.
- A fixture user with at least 5 eligible sessions, including a 5★ session at a `beach/reef break` beach, has that session counted in `peaks` for a `beach` target. Assert `sessions_in_profile` and that the result state is `learned`.
- The learned result's `reason_bullets` contain no `profile peak`. The first bullet matches `^\d+ of your \d+ good sessions were in conditions like this\.$`, and `good_session_count` / `similar_good_session_count` equal hand-computed values.
- The result has no `board_tip` key.
- `board_class` is `shortboard` for a most-used board whose row type is `thruster`, and `fish` for one whose row type is `twin-pin`.
- A learned fixture whose good sessions are all far from the slot yields "0 of your N good sessions …".

**Parity test** (`condition-similarity-parity.test.ts`) holds 6 fixed input cases: identical conditions, a height-only difference, a period-only difference, break-family mismatch versus match, tide-direction mismatch, and null tide. It asserts the TypeScript `similarity()` values; export it from `personal-board.ts` as `conditionSimilarity` for this purpose. The SQL test asserts `session_condition_similarity` on the same 6 cases to 4 decimal places.

- [ ] Write the SQL test fixture and the parity test first. Run `bash scripts/test-match-score-board-model-postgres.sh` and confirm it fails because the functions don't exist yet.
- [ ] Write the migration (full `CREATE OR REPLACE` of `compute_user_match_scores`, plus the three helper functions, inside `BEGIN; … COMMIT;`).
- [ ] Run the harness until it passes, then run `yarn jest __tests__/lib/scoring`.
- [ ] Commit by path: `feat(match-score): break families, similar-sessions reason and board class aligned with picker`.

### Task 3 (web): the match-score API attaches the picker's board

**Files:**
- Modify: `lib/personalization/match-score.ts`
- Modify: `app/api/personalization/match-score/route.ts`
- Test: the existing match-score tests (find them with `git grep -l "getPersonalizationMatchScore\|resolveMatchScoreState" __tests__`), plus a route test if one exists

**Interfaces:**
- Consumes `recommendBoard`, `RecommendedBoard` and `PERSONAL_BOARD_SELECT` from `lib/scoring/personal-board.ts`; `fetchUserBoardContext` from `lib/services/discovery/surf-discovery-orchestrator.ts`; and `getProfileExperienceLevel`.
- Produces a response field `board_pick: { id: string; name: string; type: string; board_class: string; reason: string } | null` in the learned and avoidance_learned states (null elsewhere). `board_tip` equals `board_pick?.name ?? null`. `reason_facts` `board_fit` takes the pick's name.

**Behaviour:**

- `getPersonalizationMatchScore` gains an injected option `loadBoardPick?: () => Promise<RecommendedBoard | null>`. It calls this only for learned or avoidance_learned results.
  - Any rejection becomes `null`. Log with the existing logger and never throw.
  - Ignore any `board_tip` that the RPC might still return (pre-migration databases).
- The route builds `loadBoardPick`:
  1. Load the beach row by `beach_id`.
  2. Load the user's boards through `fetchUserBoardContext(supabase, user.id, true)`, reading `boardsForPicks`.
  3. Resolve skill through `getProfileExperienceLevel`.
  4. Build an `EnhancedForecastEntity` from the request: `wave_height`, `wave_period`, `wind_speed`, `wind_direction_deg` (from `wind_direction`), `tide_height`, and `forecast_at` from an optional `forecast_at` query param (default: now, ISO). Also accept an optional `tide_status` param. Both params are additive and optional.
  5. Call `recommendBoard`.
- `learnedReasons`: when a pick exists, replace the generated sentence `` `${board_tip} has worked for your better sessions in similar surf.` `` with the pick's `reason`.
- Keep `hasDebugCopy` filtering. It stays as a guard for databases that still return "profile peak".

**Tests:**
- A learned result with an injected pick gives `board_pick` equal to the pick and `board_tip` equal to the pick's name. The RPC `board_tip` value is ignored.
- A `loadBoardPick` rejection gives a 200-shaped success with `board_pick: null` and `board_tip: null`.
- The starter and locked states never call `loadBoardPick`.
- The generated learned reason uses the pick's reason.

- [ ] Write failing tests → implement → `yarn jest <match-score tests>` → `npx eslint --max-warnings=0 <changed files>` → `yarn typecheck`.
- [ ] Commit by path: `feat(match-score): board pick comes from the shared board picker`.

### Task 4 (native, runs in parallel with Tasks 1–3): show the pick with Explore's phrasing

**Files:**
- Modify: `src/lib/personalization/match-state.ts` (`UserMatchScore`: add `board_pick?: { id: string; name: string; type: string; board_class: string | null; reason: string | null } | null`)
- Modify: `src/lib/personalization/match-score-client.ts` (`normalizeMatchScore`: parse `board_pick` defensively; drop it unless `name` and `type` are non-empty strings)
- Modify: `src/lib/personal-surf-call-display.ts:405-416`
- Modify comments only: `src/lib/surf-decision.ts:487-488`, `src/components/home/surf-call-card-home.tsx:587` (read that file and keep its behaviour consistent with the new board line)
- Modify: `src/hooks/use-user-match-score.ts` dev override (add a matching `board_pick`)
- Test: `src/__tests__/surf-decision.test.ts` (around :932), `src/__tests__/surf-call-card-home-match.test.tsx` (around :160), plus new cases in the nearest `personal-surf-call-display` test

**Behaviour:**
- **Board line** when the decision has no board line of its own:
  - If `matchScore.board_pick` exists, `` `Bring your ${formatBoardNameWithType(board_pick.name, board_pick.type)}` ``. `formatBoardNameWithType` comes from `src/lib/board-display.ts`; this is the same phrasing Explore uses through `bringBoardLine`.
  - Otherwise, if `board_tip` exists, `` `Bring your ${board_tip}` ``.
  - Never emit "You usually ride".
- `hasBoardPick` also treats `board_pick` as a pick.
- Keep old-server compatibility: a response with only `board_tip` still renders.

**Tests:**
- `board_pick {name:'Twin pin', type:'shortboard'}` renders "Bring your Twin pin shortboard".
- `{name:'Twin pin', type:'twin-pin'}` renders "Bring your Twin pin" (the name already ends with the type label).
- Only `board_tip: "Twin pin 6'4"` renders "Bring your Twin pin 6'4".
- No test expects "You usually ride".

- [ ] Write failing tests → implement → `npm test -- surf-decision surf-call-card-home personal-surf-call match-score-client` → `npm run typecheck`.
- [ ] Commit by path: `feat(match): show the board pick with Explore's phrasing`.

### Task 5: review and verification (separate Codex packets)

1. **Review.** Run `codex exec review --base origin/main` in each worktree.
2. **Verification packet** (read-only on production). Run in both worktrees:
   - web: `yarn jest __tests__/lib/scoring __tests__/lib/personalization <match-score tests>`, `yarn typecheck`, eslint on changed files, `bash scripts/test-match-score-board-model-postgres.sh`, and `bash scripts/test-week-scout-match-postgres.sh` (regression)
   - native: `npm run typecheck`, `npm test -- surf-decision surf-call-card-home personal-surf-call match-score-client`, and a CI-like env check if any test reads env
   - **Offline board replay.** Import the new `recommendBoard` and run it on `boards.json`, `beach.json` and `rows.json` in the scratchpad (runner example: `scratchpad/replay-board-detail.ts`). Report Steven's pick and per-board scores for Scripps 2026-09-28 05:00, 08:00 and 11:00 local, before versus after.
   - **Production shadow comparison** (SELECT-only through `q.sh`). Re-express the new `compute_user_match_scores` logic as a single `SELECT` with the helper expressions inlined; you cannot create functions on a read-only session. Compare old (the deployed function) with new for Steven (profile `73040cff-afe9-4fa0-a874-2016203fc015`, Scripps `4b0cf129-c706-4e24-8210-2219defc5ea7`, Monday 08:00 inputs `3.2 ft, 11s, 5 mph, 315, 4.4 ft`), and for up to 20 other users in the learned state, each at their most recent session's snapshot conditions. Report score deltas, state changes and the new bullet.
