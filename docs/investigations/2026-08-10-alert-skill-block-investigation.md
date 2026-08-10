# Task C report

## Answer

**Primarily a policy/taxonomy problem, compounded by weak beach-rating provenance. User skill is not the culprit. Home-beach assignment errors exist, but they are secondary.**

The system:

1. Lets a user select a home beach and skill.
2. Automatically creates a “mellow session at your home break” rule.
3. Interprets `beginner-intermediate` as requiring `intermediate`.
4. Rejects every beginner window at that beach, regardless of how mellow the forecast window is.

That is an internally contradictory product policy. At least **20 of 50 currently mismatched rules (40%)** depend directly on mapping a range label to its upper endpoint. **45 of 50 mismatched rules (90%) were auto-created or backfilled.**

Evidence completeness is `FAIL` for the requested exact 104-row appendix: the original harness retained the 104 aggregate but not `FULL_HORIZON_RECORDS`, and `enhanced_forecasts` was overwritten afterward with no history table. I have not represented a later rerun as the original snapshot.

## Original measurement

At `2026-08-10T17:55:28.139Z`:

| Metric | Result |
|---|---:|
| Active evaluator rules | 141 |
| Real users in evaluator | 94 |
| Matched windows | 279 |
| Skill-blocked windows | 104 / 279, 37.3% |
| Preset skill blocks | 101 |
| Custom skill blocks | 3 |
| `mellow_session` skill blocks | 88 / 150, 58.7% |
| Other safety reason codes | 0 |

Profiles, rules, and beaches did not change after this snapshot. Forecast rows did.

## Comparison implementation

The comparison is implemented in [engine.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/lib/recommendations/canonical-decision/engine.ts:29):

```text
beginner     0
intermediate 1
advanced     2
expert       3
```

The beach is rejected only when:

```text
beach rank > user rank
```

Equality passes. Therefore, **there is no numeric off-by-one.**

The semantic problem is in [skill-level.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/lib/domains/user-preferences/skill-level.ts:68):

| Stored beach value | Compared as |
|---|---|
| `all` | beginner |
| `beginner-intermediate` | intermediate |
| `lower-intermediate` | intermediate |
| `upper-intermediate` | intermediate |
| `intermediate-advanced` | advanced |

If hyphenated labels describe inclusive suitability, the first and last mappings use the wrong endpoint. Tests explicitly ratify the present behavior in [engine.test.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/__tests__/lib/recommendations/canonical-decision/engine.test.ts:594).

`DEFAULT_SKILL_LEVEL = beginner` exists for other scoring paths, but the canonical alert gate does not use it. Null/invalid skill becomes `unknown_skill`, not `beach_skill_exceeds_user`.

## User skill

Skill is explicitly selected during onboarding in [experience-level-step.tsx](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/components/onboarding/steps/experience-level-step.tsx:40), saved only when present in [onboarding-actions.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/actions/onboarding-actions.ts:238), and can later be edited through profile actions.

There is:

- No database default for `profiles.experience_level`.
- No production inference from behavior or sessions.
- No conversion of skipped onboarding to `beginner`.
- A valid path to finish onboarding with skill still null.

Real-profile distribution, using the application analytics exclusion filter:

| Skill | 231 profiles | Share |
|---|---:|---:|
| Null | 81 | 35.1% |
| Intermediate | 60 | 26.0% |
| Beginner | 46 | 19.9% |
| Advanced | 36 | 15.6% |
| Expert | 8 | 3.5% |

That includes one founder and one null-skill system account. Excluding both leaves 229 behavior users:

| Skill | Users | Share |
|---|---:|---:|
| Null | 80 | 34.9% |
| Intermediate | 60 | 26.2% |
| Beginner | 46 | 20.1% |
| Advanced | 35 | 15.3% |
| Expert | 8 | 3.5% |

Original 94-user alert cohort:

| Skill | Users | Share |
|---|---:|---:|
| Intermediate | 38 | 40.4% |
| Beginner | 27 | 28.7% |
| Advanced | 19 | 20.2% |
| Expert | 8 | 8.5% |
| Null | 2 | 2.1% |

All 94 had completed onboarding and had a home beach. The two null skills cannot generate this rejection reason.

**Conclusion:** there is no evidence of a default over-assigning beginners.

## Beach ratings

All 346 beaches have a skill rating. Only **7 have editorial review/source metadata**; 339, or 98.0%, do not. The ratings are primarily hand-seeded migration data, not dynamically derived or confidence-scored.

| Raw rating | All 346 | Alerted 76 |
|---|---:|---:|
| Beginner | 44, 12.7% | 9, 11.8% |
| Beginner-intermediate | 84, 24.3% | 19, 25.0% |
| Lower-intermediate | 37, 10.7% | 7, 9.2% |
| Intermediate | 88, 25.4% | 24, 31.6% |
| Upper-intermediate | 23, 6.6% | 1, 1.3% |
| Intermediate-advanced | 22, 6.4% | 4, 5.3% |
| Advanced | 40, 11.6% | 11, 14.5% |
| Expert | 8, 2.3% | 1, 1.3% |

After applying the production normalization:

- Advanced/expert: **20.2% catalogue vs 21.0% alerted**, only +0.8 percentage points.
- Intermediate-or-harder: **87.3% vs 88.2%**, +0.9 points.

Alert users are therefore **not disproportionately selecting harder beaches** relative to the catalogue.

## Static rule join

The stable profile/rule/beach join finds 50 active rules where the normalized beach rank exceeds the user rank:

| Rule type | Active rules | Mismatched |
|---|---:|---:|
| `clean_groundswell` | 25 | 0 |
| Custom | 15 | 4 |
| `epic_conditions` | 1 | 0 |
| `mellow_session` | 65 | 34 |
| `weekend_warrior` | 35 | 12 |
| **Total** | **141** | **50** |

These span 35 users.

| Relation to current home | Rules | Mismatched |
|---|---:|---:|
| Current home beach | 126 | 44, 34.9% |
| Non-home beach | 15 | 6, 40.0% |

The non-home rate is not lower, but 88% of mismatches are home rules because most active rules target home beaches.

Mismatch pairs:

| User skill → stored beach skill | Rules |
|---|---:|
| Beginner → intermediate | 13 |
| Beginner → beginner-intermediate | 17 |
| Beginner → advanced | 5 |
| Beginner → lower-intermediate | 2 |
| Beginner → upper-intermediate | 1 |
| Intermediate → advanced | 8 |
| Intermediate → intermediate-advanced | 3 |
| Intermediate → expert | 1 |

Rule provenance:

| Determinable origin | Rules |
|---|---:|
| Created within ten seconds of onboarding completion | 41 |
| April 17 default-rule backfill | 4 |
| Custom/manual | 4 |
| Unknown | 1 |

Thus **45/50 were auto-created or backfilled**.

The seeding policy is visible in [seed-default-rule.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/lib/alerts/seed-default-rule.ts:52): beginner, intermediate, and null users receive `mellow_session`, without first checking whether the canonical safety gate permits their chosen beach.

## Concentration

Because the original 104 detail was not retained, exact original per-user counts cannot be reconstructed. A later proxy rerun at `2026-08-10T18:41:54Z` produced 111 blocks across 22 users and 31 rules:

| User | Skill | Windows | Beach / stored skill | Rule type | Current home? |
|---|---|---:|---|---|---|
| `907f4e58` | Beginner | 11 | Waddell / upper-intermediate | Mellow | Yes |
| `64fef932` | Beginner | 10 | Linda Mar / lower-intermediate | Mellow | Yes |
| `3621ef4d` | Intermediate | 8 | Steamer Lane / advanced | Mellow, weekend | Yes |
| `9a13611b` | Beginner | 8 | Riviera / intermediate | Mellow, weekend | Yes |
| `7a86540a` | Intermediate | 7 | Windansea / advanced | Mellow, weekend | Yes |
| `beb63e14` | Beginner | 7 | Garrapata / intermediate | Mellow | Yes |
| `e55418f1` | Intermediate | 7 | Oceanside Harbor / intermediate-advanced | Mellow | Yes |
| `7c229759` | Beginner | 6 | Torrey Pines / beginner-intermediate | Mellow, weekend | Yes |
| `262b7b5c` | Beginner | 5 | Ponto / beginner-intermediate | Mellow, weekend | No |
| `8804c524` | Beginner | 5 | Venice Breakwater / intermediate | Mellow, weekend | Yes |
| `a90e5681` | Beginner | 5 | Carolina Beach / beginner-intermediate | Mellow, weekend | Yes |
| `d0c843dd` | Intermediate | 5 | Windansea / advanced | Mellow | Yes |
| `08ee9c13` | Beginner | 4 | Newport Lower Jetties / beginner-intermediate | Mellow | Yes |
| `7b965da6` | Intermediate | 4 | Huntington Pier / intermediate-advanced | Mellow | Yes |
| `be131b89` | Beginner | 4 | El Segundo Jetty / intermediate | Mellow | Yes |
| `1a6305aa` | Beginner | 3 | Boynton Inlet / intermediate | Mellow, weekend | Yes |
| `4966828b` | Beginner | 3 | Westport Beach/Jetty / beginner-intermediate–intermediate | Custom | Mixed |
| `60c20753` | Beginner | 3 | Birdrock / intermediate | Mellow | Yes |
| `8fe781c1` | Intermediate | 3 | Ocean Beach / advanced | Mellow | Yes |
| `435f726b` | Beginner | 1 | Seal Beach Pier / beginner-intermediate | Mellow | Yes |
| `b28b2849` | Intermediate | 1 | Crystal Pier / intermediate-advanced | Mellow | Yes |
| `bcacdc51` | Beginner | 1 | Pacific Beach / beginner-intermediate | Mellow | No |

The top two produced 18.9% of proxy blocks; the top ten produced 66.7%. This is concentrated but not a one- or two-user artifact.

## Home-beach assignment

Home beach can be set through:

- Explicit onboarding selection.
- Profile editing.
- Pending alert capture.
- Lazy inference from the first beach viewed for users who skipped onboarding, documented in [onboarding-actions.ts](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/actions/onboarding-actions.ts:65).

Only one of the 35 mismatch users has a retained `home_break_inferred` event. Event retention and the absence of profile history prevent determining the original setter for the others.

Two preset rules are demonstrably stale:

- `bcacdc51`: rule says home break and targets Pacific Beach; current home is Tourmaline.
- `6d136c12`: rule says home break and targets South Padre Island–Isla Blanca; current home is Surfside Beach.

These are genuine lifecycle bugs, but only two of 50 mismatched rules. There is no evidence of a global default beach driving the 37%.

## Rating sanity check

Clear taxonomy/data conflicts:

- **Linda Mar** is stored `lower-intermediate`, which becomes an intermediate minimum. Its migration describes it as “peaks for all levels,” “softer for beginners,” and marks it beginner-friendly in [the seed migration](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/supabase/migrations/20251205000001_add_norcal_central_coast_beaches.sql:957). Pacifica tourism also calls Linda Mar ideal for beginners and relatively gentle. [Visit Pacifica](https://www.visitpacifica.com/things-to-do/surfing)
- **Carolina Beach** is `beginner-intermediate`, but the same migration calls it one of North Carolina’s most approachable beginner zones and a “true-beginner” choice. [Migration](/Users/stevenchandler/codex-worktrees/quiver-skillblock-20260810/supabase/migrations/20260511162000_expand_north_carolina_beginner_funnel.sql:60)
- **Tourmaline** is `beginner-intermediate`, yet San Diego tourism describes it as a haven for learners and longboarders. [San Diego Tourism Authority](https://www.sandiego.org/zh/node/62111)
- **Pacific Beach/Crystal Pier** are `beginner-intermediate` and `intermediate-advanced`. Local guidance describes Pacific Beach as suitable for beginners and intermediates, though the exact pier peak may be harder. [Pacific Surf School](https://www.pacificsurf.com/surfing-lessons-pacific-beach/)
- **Oceanside Harbor** is `intermediate-advanced`, while a local school describes its lesson area as a particularly safe learn-to-surf location. This may be peak/location ambiguity rather than a uniformly wrong rating. [North County Surf Academy](https://www.northcountysurfacademy.com/)

Defensible ratings:

- **Steamer Lane: advanced** is defensible; published guidance describes intermediate-to-advanced ability and a consequential crowd. [Surfline](https://www.surfline.com/travel/zones/santa-cruz/surf-guide/steamer-lane/5842041f4e65fad6a7708805)
- **Windansea: advanced** is defensible given its reef, power, crowd, and localism.
- **Waddell: upper-intermediate** is plausible, although a static rating still ignores small, mellow days.

## What could not be determined

- The exact dates and per-user distribution of the original 104 windows.
- Historical home-beach provenance for most users.
- Whether users’ self-selected skill accurately reflects real ability.
- The author, source, or confidence behind 339 beach ratings.
- The reason several beaches changed ratings after their initial migration; there is no beach-history audit.
- Whether a rating describes the whole beach, a named peak, typical conditions, or worst-case conditions.

## Recommendations

1. Define the beach field unambiguously as either a minimum skill or an inclusive `min_skill`/`max_skill` range. Do not keep overloading hyphenated strings.
2. If the current labels are inclusive, map `beginner-intermediate → beginner` and `intermediate-advanced → intermediate`. Treat `lower-intermediate` separately after editorial review.
3. Do not auto-seed a rule that the canonical gate will deterministically reject. Preflight the user/home-beach pair and explain or offer a suitable nearby alternative.
4. Reconsider using a static beach-wide minimum as a hard gate for `mellow_session`; forecast height, hazards, and the specific peak/window should determine safety.
5. Retarget, pause, or rename home-break rules when `home_beach_id` changes.
6. Editorially review mismatch beaches first, especially Linda Mar, Carolina Beach, Tourmaline, Crystal Pier, Oceanside Harbor, and Pacific Beach.
7. Add provenance/confidence and change history for beach ratings and home-beach assignments.
8. Future research harnesses should always persist the redacted per-window record array alongside aggregates.

