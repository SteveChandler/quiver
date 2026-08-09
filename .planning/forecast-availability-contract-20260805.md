# Step 3 — `/api/forecasts/current`: stop collapsing stale into missing

Date: 2026-08-05
Status: **SPEC — not implemented**
Parent: `quiver/.planning/embed-freshness-fix-and-refactor-20260805.md` (§3, step 3)
Scope: web API contract change + native adoption. **Not** the embed fix (step 1, separate branch).

## 1. The defect

`app/api/forecasts/current/route.ts:156`:

```ts
const unavailable = args.current == null || args.freshness.missing || args.freshness.stale;
return {
  stale:   args.freshness.stale,   // correct
  missing: unavailable,            // WRONG — folds `stale` into `missing`
  ...
};
```

A beach with a real but aging forecast returns `stale: true, missing: true` at the same time. `missing`
therefore does not mean "there is no data" — it means "do not show data", and its name lies.

**`CurrentMetadata` already has the two fields it needs.** Nothing new is required to model the states;
one of them is simply being overwritten.

## 2. Why it matters

`/api/forecasts/current` is consumed by native:
`quiver-native/src/hooks/use-source-backed-current-conditions.ts:59`
(`?beachId=…&refresh=if-stale`).

Blast radius is **one line** — `quiver-native/src/screens/beach-detail.tsx:738`:

```ts
const currentConditionsUnavailable =
  Boolean(currentConditionsError) ||
  currentConditionsMetadata?.missing === true ||
  (!currentConditionsPending && currentForecastRow == null);
```

So aging-but-real conditions are **hidden entirely on native beach detail**. The user sees nothing
rather than a slightly old reading — the same failure as the web embeds, reached through this contract.

This is also why fixing `missing` **in place is not safe**: it would immediately start surfacing stale
data on every already-installed native build, with no "as of" label, silently presenting old numbers as
current. Correct data, dishonest presentation.

Per `quiver/AGENTS.md` §Native ↔ web boundary, mobile-consumed routes are **versioned contracts**:
additive first, native adopts, only then retire.

## 3. The change

Add one unambiguous field. Do not alter the meaning of any existing field in phase A.

```ts
type CurrentMetadata = {
  // ... existing fields unchanged ...

  /**
   * Authoritative freshness state. Prefer this over `stale`/`missing`.
   *
   * fresh       — usable data, within the staleness threshold
   * stale       — usable data, past the threshold. Render it WITH `lastUpdated`.
   * unavailable — no usable data. Render an explicit empty state.
   *
   * `missing` is retained for pre-adoption native builds and currently also
   * returns true for `stale`. It will be corrected once the minimum supported
   * native version reads `availability` (see §4 phase C).
   */
  availability: "fresh" | "stale" | "unavailable";
};
```

Derivation — the only branch that matters:

```ts
const availability =
  args.current == null || args.freshness.missing ? "unavailable"
  : args.freshness.stale                          ? "stale"
  : "fresh";
```

`lastUpdated` already carries the timestamp and needs no change. `reason` stays populated for
`unavailable`, and should also be populated for `stale` (it already computes
`Data is Xh old (threshold: Yh)`).

### Also fold in the duplicate implementation

The route's local `readLatestMetadata` re-implements `getFreshForecastFromCache`'s staleness logic —
both query `v_enhanced_forecast_latest` for `updated_at, data_source` and call `getStalenessDetails()`.
Two implementations of one rule will drift. Collapse them onto one shared helper as part of this change,
or explicitly defer it to step 2 and say so — but do not add a third.

## 4. Rollout

**Phase A — web, additive.** Add `availability`. Leave `stale` and `missing` byte-identical. Zero native
impact by construction: no existing field changes value, so every installed build behaves exactly as it
does today. Independently shippable.

**Phase B — native adopts.** `beach-detail.tsx:738` switches from `metadata?.missing === true` to
`metadata?.availability === 'unavailable'`, and renders the `stale` case as conditions **plus an
"as of {lastUpdated}" line** — matching the treatment step 1 ships on web embeds, so the two platforms
agree. JS-only, so it ships OTA. Also update `CurrentConditionsMetadata` in
`use-source-backed-current-conditions.ts` and the `e2e` stub at line ~46 (add `availability: 'fresh'`).

**Phase C — web, corrective.** Once the minimum supported native version reads `availability`, change
`missing` to mean genuinely missing (`args.current == null || args.freshness.missing`) and mark the old
semantics deprecated. **Gate C on evidence** that pre-adoption builds are drained — not on a date.

Do not merge B into A. Phase A must be able to sit in production alone indefinitely.

## 5. Verification

- **Phase A:** unit coverage for all three `availability` values, plus an explicit regression test that
  `stale` and `missing` still return their **current** values for a stale beach — that test is what
  proves phase A is non-breaking, and it should be deleted in phase C.
- **Phase B:** native unit test that `availability: 'stale'` renders conditions **and** the timestamp,
  and that `'unavailable'` renders the empty state. Simulator check on a beach that is actually stale
  (they rotate — pick one empirically at run time rather than hardcoding a slug).
- Contract: if there is an API contract doc or generated type shared with native, update it in the same
  change. Search before assuming there isn't one.

## 6. Out of scope

- The embed fix (step 1) — separate branch, already in flight.
- `surf-terminal`'s 288-hour window, the named-policy module, and the derived-window regression test
  (step 6).
- `/api/surf`'s nearby-beach fallback. It is a better degradation for map/discovery and is worth
  considering for `unavailable` there, but it is not part of this contract.
- The `forecast_at` migration.
