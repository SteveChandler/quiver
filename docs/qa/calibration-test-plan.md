# Calibration Honesty Layer — Day 2 Test Extension Plan

**Owner:** QA
**Author date:** 2026-04-08 (Day 1)
**Execution day:** Day 2
**Spec:** `/Users/stevenchandler/Desktop/dev/quiver/docs/design/calibration-honesty-spec.md`
**Backend envelope PR:** commit `b3b4628c` (31/31 passing on `__tests__/app/api/forecasts/bulk/route.test.ts`)
**Scope:** Extension of existing test surfaces for the `isCalibrated` / `isShoalingCalibrated` display prop across `quiver` (web) and `quiver-native` (mobile). Does NOT touch `seaside/`.

This is a planning document. Do not treat any snippet here as final test code — shapes and assertions are intentionally written as pseudo-code so the engineer can adapt names to the exact prop the merged backend ships with.

> **Prop name note:** the backend envelope uses `isCalibrated` (see `__tests__/app/api/forecasts/bulk/route.test.ts` line 17 — `isCalibrated: Record<string, boolean>`). The designer's spec uses `isShoalingCalibrated` as the display-component prop placeholder. The engineer must confirm the final prop name on Day 2; this plan uses `isCalibrated` throughout for consistency with the shipped envelope, but the test names are identical either way — just swap the identifier.

---

## Section 1 — Test Fixture Requirements

### 1.1 E2E anchor beaches (real production rows)

These are the beaches Playwright specs will navigate to. They must exist in the dev database at E2E run time — do not seed them inside the E2E spec; rely on prod-equivalent data already in `dev.quiversurf.app` / local Supabase.

**Calibrated anchors (Phase 1 migration, `shoaling_factors IS NOT NULL`):**

| Name | Source | Why |
|---|---|---|
| Blacks (San Diego) | `supabase/migrations/20260407134519_add_shoaling_factors_to_beaches.sql` line 242 (CDIP 201, n=8757) | Gold-standard calibrated beach. Largest paired-sample bucket in the migration; the original "1.7 ft Hs → 3.6 ft face" bug repro lives against this row. |
| La Jolla Shores (San Diego) | Same migration, line 872 (CDIP 201, n=3840) | Second sanity anchor. Same CDIP station as Blacks, different break, different factors. Gives us a second calibrated data point so a Blacks-specific bug can't pass the spec. |

Both are in the `san-diego` region, which already has full E2E coverage (`e2e/forecast-regional.spec.ts` uses `san-diego` as its `testRegion`). Navigating from `/forecast/san-diego` → beach detail is the shortest path to a calibrated render.

**ML-only anchors (no `shoaling_factors`, rendered via the honesty layer):**

The engineer sampled these ten ML-only beach names from production on Day 1. QA picks **two** for E2E anchors — one coastal California (easy to verify locally), one non-California (guards against "works on the home region, breaks elsewhere"):

| E2E anchor pick | Why |
|---|---|
| **Bolinas** (Northern California) | Well-known NorCal break, unlikely to be calibrated mid-sprint. In `northern-california` region. |
| **Cocoa Beach Pier** (Florida) | Cross-coast sanity check. Different ML feature distribution than CA beaches — catches region-specific rendering bugs. |

Full list the engineer sampled (**reference only — do not hardcode into tests**):
`72nd Place`, `Ala Moana Bowls`, `Avalon Pier`, `Bay Street`, `Bodega Bay / Doran Beach`, `Bolinas`, `Brookings (Harris Beach)`, `Campus Point (UCSB)`, `Carmel River State Beach`, `Cocoa Beach Pier`

**Slug resolution (engineer must provide):** the E2E spec needs URL slugs, not display names. For each of the four anchors above, the engineer owes QA the canonical slug that resolves under `/beach/...`. Placeholder slugs assumed in this plan:

- `/beach/ca/san-diego/blacks` (Blacks)
- `/beach/ca/san-diego/la-jolla-shores` (La Jolla Shores)
- `/beach/ca/marin/bolinas` (Bolinas)
- `/beach/fl/brevard/cocoa-beach-pier` (Cocoa Beach Pier)

> **Blocker:** see §6 — these slugs are not confirmed. If the routing pattern is different (`/beach/[city]/[slug]` vs `/beach/[state]/[city]/[slug]`), the spec needs the engineer's canonical slug map before Day 2 starts.

### 1.2 Unit test mock fixtures

**Existing helpers (do NOT break):** `/Users/stevenchandler/Desktop/dev/quiver/__tests__/lib/utils/test-helpers/wave-height-test-utils.ts` already exports:

- `createMockBeach(accessValue)` → `BeachTerrainConfig` (no `shoaling_factors`, terrain enabled)
- `createMockBeachDisabled(accessValue)` → terrain disabled
- `createAccessArray(defaultValue)` → 72-bin array
- `createAccessArrayWithBin(bin, value, defaultValue)`
- `createMockBeachWithBin(bin, value, defaultValue)`
- Constants: `TEST_WAVE_HEIGHTS`, `TEST_PERIODS`, `DIRECTION_BINS`

**New helpers to add in Day 2** (add to the same file — don't fork):

```ts
// Pseudo-code — engineer adapts
export const BLACKS_SHOALING_FACTORS: ShoalingFactors = {
  version: 1,
  type: 'period_lookup',
  buckets: [
    { tp_min_s: 0, tp_max_s: 8, factor: 1.6 },
    { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
    { tp_min_s: 12, tp_max_s: 16, factor: 2.1 },
    { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
  ],
};

export function createCalibratedBeach(
  accessValue = 1.0,
  factors = BLACKS_SHOALING_FACTORS,
): BeachTerrainConfig {
  return {
    ...createMockBeach(accessValue),
    shoaling_factors: factors,
  };
}

export function createMlOnlyBeach(accessValue = 1.0): BeachTerrainConfig {
  return {
    ...createMockBeach(accessValue),
    shoaling_factors: null,
  };
}
```

**Backward compatibility guarantee:** neither of these new helpers mutates the existing helpers' return shape. Existing tests that call `createMockBeach(...)` continue to get a beach with `shoaling_factors === undefined`, which the transformer already treats identically to `null` (see `wave-height-transformer.ts:249-269` — `lookupShoalingBucket` returns `null` for both). **Verified safe.**

**`WaveHeightDisplay` component mock props:** there is no shared mock-prop builder for this component today (see §2 — the test file doesn't exist yet). Day 2 engineer should create a minimal `makeWaveHeightDisplayProps(overrides)` helper inside the new test file; it does NOT need to live in the shared `test-helpers/` directory.

### 1.3 Bulk-route test mock pattern (reuse this)

The engineer's 4 new tests in `__tests__/app/api/forecasts/bulk/route.test.ts` (lines 240-349) use a `stubBeachesQuery(rows, error?)` helper that overrides `mockSupabaseClient.from("beaches")` with a chained mock. **Day 2 display tests do NOT need this helper** — they render the component directly with props, so they bypass the API surface entirely. Document the pattern here as a reference so the engineer does not accidentally re-derive it.

---

## Section 2 — Web Unit Test Extensions

### 2.1 `__tests__/lib/utils/wave-height-transformer.test.ts`

**Current state:** ~620 lines, covers `transformToFaceHeight`, `transformToFaceHeightRange`, factor helpers, and the `shoaling_factors` short-circuit with source gating.

**New function being added in Day 2:** `transformToFaceHeightWithMetadata(params): { faceHeight: number; isCalibrated: boolean }` — returns the same face-height number as `transformToFaceHeight` plus a boolean indicating whether the shoaling short-circuit fired.

**Existing function unchanged:** `transformToFaceHeight` must be byte-identical after Day 2. The new function is a sibling, not a replacement. (This is how we keep the 40+ existing transformer tests green without edits.)

**Add a new `describe` block** — `describe('transformToFaceHeightWithMetadata', ...)`:

| Test name | Input | Expected output | Why |
|---|---|---|---|
| `returns_isCalibrated_true_for_cdip_sig_with_shoaling_factors` | `{ rawHeightFt: 1.7, periodS: 14, swellDirectionDeg: 270, beach: createCalibratedBeach(), source: 'cdip_sig' }` | `{ faceHeight: 3.6, isCalibrated: true }` | Happy path — Blacks repro. The face-height number must match the existing `transformToFaceHeight` result for the same params (regression anchor). |
| `returns_isCalibrated_false_for_cdip_sig_without_shoaling_factors` | Same as above but `beach: createMlOnlyBeach()` | `{ faceHeight: 2.0, isCalibrated: false }` | Beach has no factors → legacy pipeline runs → ML-only state. |
| `returns_isCalibrated_false_for_model_swell_even_with_factors` | Same params as test 1 but `source: 'model_swell'` | `{ faceHeight: 2.0, isCalibrated: false }` | **Critical source-gating test.** The spec's "calibrated" label is a promise that the face-height number is derived from the calibration pipeline. If CDIP was rejected and we fell back to model swell, the short-circuit does NOT fire (legacy pipeline runs), so the number is a generic buoy Hs → `isCalibrated` must be false even though the beach row has factors. |
| `returns_isCalibrated_false_for_cdip_swell_with_factors` | Source `cdip_swell` + factors | `isCalibrated: false` | Same reason as above — calibration is measured against `cdip_sig`, not `cdip_swell`. |
| `returns_isCalibrated_false_for_model_hs_with_factors` | Source `model_hs` + factors | `isCalibrated: false` | Same reason. |
| `returns_isCalibrated_false_for_ndbc_buoy_with_factors` | Source `ndbc_buoy` + factors | `isCalibrated: false` | Same reason. |
| `returns_isCalibrated_false_for_noaa_source` | `source` omitted (legacy caller path) + factors present | `isCalibrated: false` | Safe default — undefined source must not light up the calibration label. |
| `returns_isCalibrated_false_when_period_out_of_bucket_range` | `{ rawHeightFt: 2.0, periodS: 25, source: 'cdip_sig', beach: { shoaling_factors: { ... buckets ending at 20 } } }` | `{ faceHeight: 2.4, isCalibrated: false }` | Period falls through the bucket table → legacy pipeline runs → NOT calibrated for this render. This is subtle but important: a beach can be "calibrated in the database" but uncalibrated for a specific period reading. The display must reflect the per-render truth, not the database row existence. |
| `returns_isCalibrated_false_when_period_is_null` | `periodS: null`, factors present, source `cdip_sig` | `{ faceHeight: 2.0, isCalibrated: false }` | `lookupShoalingBucket` rejects null period (transformer.ts:260) → legacy runs → not calibrated. |
| `returns_isCalibrated_false_when_period_is_zero` | `periodS: 0` (CDIP NaN sentinel), factors present, source `cdip_sig` | `isCalibrated: false` | Same reason — see transformer.ts line 256-262. |
| `returns_isCalibrated_false_for_invalid_rawHeightFt` | `rawHeightFt: -1` or `NaN` | `{ faceHeight: 0, isCalibrated: false }` | Invalid input → short-circuit returns 0, meta must not claim calibrated. |
| `faceHeight_matches_transformToFaceHeight_for_all_source_gates` | Loop over all 5 source tags with factors + period 14 + rawHeightFt 1.7 | For each source, `faceHeight === transformToFaceHeight({ same params })` | **Regression anchor** — the metadata variant must never diverge from the canonical face-height output. If this fails, the Day 2 engineer introduced a bug by recomputing the face height inside the new function instead of delegating. |

**Existing transformer tests — add exactly one guard:**

Add a single test at the top of the existing `describe('transformToFaceHeight', ...)` block:

- `test_existing_transformToFaceHeight_signature_unchanged` — import `transformToFaceHeight` and assert its length/arity matches what the codebase expected before Day 2. Low-value but cheap and catches an engineer accidentally adding a required `isCalibrated` parameter to the legacy function.

**Count:** 12 new tests in this file.

### 2.2 `__tests__/components/ui/wave-height-display.test.tsx` (NEW FILE)

**File does not exist yet** — verified via `ls __tests__/components/ui/` (see §7 output). The directory does contain `wave-period-display.test.tsx` and `wave-type-selector.test.tsx` — follow their import style for consistency (React Testing Library + jest-dom).

**Top-of-file setup:**

```ts
// Pseudo-code
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaveHeightDisplay } from '@/components/ui/wave-height-display';

function renderDisplay(overrides: Partial<React.ComponentProps<typeof WaveHeightDisplay>> = {}) {
  return render(
    <WaveHeightDisplay
      height="3.0"
      showTooltip={true}
      {...overrides}
    />,
  );
}
```

**Tests to add:**

| Test name | Setup | Assertion | Notes |
|---|---|---|---|
| `renders_displayHeight_when_height_provided` | default props | `screen.getByText(/3-4\s*ft/i)` is in document | Baseline — guards against breaking existing render path. Re-verifies the existing `SET_WAVE_VARIANCE` math at component level since today there's no component-level test. |
| `renders_em_dash_placeholder_when_height_null` | `height: null` | `screen.getByText('--')` is in document | Backward-compat snapshot of current behavior. |
| `isCalibrated_true_does_not_prepend_tilde` | `isCalibrated: true` | `screen.queryByText('~')` is null; displayed text does NOT start with `~` | State A rendering — default happy path. |
| `isCalibrated_false_prepends_tilde` | `isCalibrated: false` | Tilde is rendered as a separate node adjacent to the digits; use `container.querySelector('[aria-hidden="true"]')` and assert its `textContent === '~'` | The spec mandates `aria-hidden` on the tilde (spec §4.2, §9). If the engineer forgets the attribute, this test fails and catches the screen-reader regression. |
| `isCalibrated_false_applies_dotted_underline_class` | `isCalibrated: false` | The span wrapping `displayHeight` has class `border-b`, `border-dotted`, and `border-muted-foreground/60` | Assert on class names, not computed style. Tailwind classes are the contract between design spec and implementation (spec §4.2). Use `toHaveClass('border-b', 'border-dotted')`; the exact alpha suffix can be looser if the engineer picks a different muted token, but the dotted-border contract is non-negotiable. |
| `isCalibrated_true_does_not_apply_dotted_underline_class` | `isCalibrated: true` | No descendant has class `border-dotted` | State A must be visually identical to today. |
| `isCalibrated_undefined_behaves_as_calibrated_backward_compat` | Omit the prop entirely | Same assertions as `isCalibrated_true_does_not_prepend_tilde` and `isCalibrated_true_does_not_apply_dotted_underline_class` | **Critical backward-compat test.** The spec defaults `isShoalingCalibrated` to `true` (§4.1, §4.2) so existing call sites that don't pass the prop render unchanged. This test is the contract enforcement. |
| `isCalibrated_false_tooltip_shows_microcopy_on_hover` | `isCalibrated: false, showTooltip: true`; `await userEvent.hover(trigger)` | Tooltip content contains the microcopy string (hardcode the Day 1 marketer pick once chosen — see §6) | Radix Tooltip opens on hover. Use `screen.findByRole('tooltip')` to await the async portal mount. |
| `isCalibrated_false_tooltip_hides_rich_content` | `isCalibrated: false`; hover to open tooltip | Tooltip does NOT contain "Data Priority", "Confidence Score", "ML Bias Correction", or "Data Source" section labels | Spec §4.5 explicitly removes the rich content for State B. This test is the anti-regression against an engineer "being helpful" and leaving the old rich content in place. |
| `isCalibrated_true_tooltip_shows_existing_rich_content` | `isCalibrated: true`; hover to open tooltip | Tooltip contains "Data Priority" text (unchanged from current behavior) | State A rich tooltip must be byte-identical to today. |
| `isCalibrated_false_tooltip_content_differs_from_calibrated` | Render two instances side-by-side (one with `isCalibrated: true`, one with `false`); hover each | Their tooltip bodies are not equal strings | Meta-check — catches "both states render identical tooltip" regressions. |
| `isCalibrated_false_tooltip_trigger_is_keyboard_focusable` | `isCalibrated: false, showTooltip: true`; `userEvent.tab()` to the trigger | The trigger receives focus; `findByRole('tooltip')` resolves | Spec §4.5 keyboard accessibility requirement. |
| `isCalibrated_false_with_showTooltip_false_suppresses_tooltip` | `isCalibrated: false, showTooltip: false`; hover would-be trigger | `screen.queryByRole('tooltip')` is null even after hover | Spec §4.5 and §11 Q3 — dense list views keep the `~`/underline but skip the tooltip. |
| `isCalibrated_false_with_showTooltip_false_still_renders_tilde_and_underline` | same as above | `~` and `border-dotted` are still present | The three-signal honesty layer (tilde + underline + label swap) must survive tooltip suppression. |

**Count:** 14 new tests in this new file.

**Query patterns mandated:**

- Use `getByText` / `findByText` for visible user-facing strings.
- Use `queryByText` for absence assertions (does NOT throw on null).
- Use `findByRole('tooltip')` for the Radix portal — it mounts asynchronously.
- Use `toHaveClass` for Tailwind contract assertions.
- Do NOT use `container.innerHTML` string matching — brittle and obscures intent.
- Do NOT snapshot-test the whole component — the layout is too close to design and snapshots will churn on every polish pass.

### 2.3 Affected existing tests to check (blast radius)

Before committing Day 2, the engineer must run:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver && npx jest wave-height wave-height-display forecasts/bulk forecasts/scored
```

If any test file imports `WaveHeightDisplay` directly, adding a required prop would break them. The default `isCalibrated = true` safeguards this, but verify by running. Search `grep -r "WaveHeightDisplay" components/ app/` for every call site and eyeball each one in the PR.

---

## Section 3 — Web E2E Test Extensions

### 3.1 Target file

`/Users/stevenchandler/Desktop/dev/quiver/e2e/forecast-regional.spec.ts`

**Existing pattern to match:**
- `setupErrorDetection(page)` in `beforeEach` (line 26)
- `assertNoErrors(...)` in `afterEach` (line ~357 — used in the multi-region loop)
- `dismissOnboardingWizard(page)` after `waitForPageLoad` (line 29)
- Mobile viewport pattern: `page.setViewportSize({ width: 375, height: 667 })` followed by `page.reload()` and `waitForPageLoad` (line 300-304)
- Desktop is the default viewport — no explicit set needed.

### 3.2 New `describe` block

Append to the existing file (don't create a new spec file — beach-detail + regional navigation already live here):

```ts
// Pseudo-code
test.describe('Calibration Honesty Layer', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'calibration honesty layer' });
  });

  // ... tests below
});
```

### 3.3 Tests to add

| Test name | Target beach | Steps | Assertions |
|---|---|---|---|
| `calibrated_beach_renders_face_height_label_no_tilde_desktop` | Blacks | Navigate to `/beach/ca/san-diego/blacks` (slug TBD); `waitForPageLoad`; `dismissOnboardingWizard` | (1) `page.getByText(/Face height/i)` visible; (2) `page.getByText(/Forecast height/i)` NOT visible; (3) the wave-height element's textContent does NOT start with `~`; (4) no element with class containing `border-dotted` inside the wave-height display container |
| `calibrated_beach_renders_face_height_label_no_tilde_mobile` | Blacks | Same as above but `page.setViewportSize({ width: 375, height: 667 })` before navigation; reload | Same assertions. Mobile card layout must match desktop label copy. |
| `ml_only_beach_renders_forecast_height_label_with_tilde_desktop` | Bolinas | Navigate to Bolinas detail; wait + dismiss | (1) `page.getByText(/Forecast height/i)` visible; (2) `page.getByText(/Face height/i)` NOT visible on the wave-height surface (scope by locator); (3) the wave-height container has a descendant span with `textContent === '~'`; (4) a descendant has class `border-dotted`; (5) `aria-hidden="true"` is set on the `~` span |
| `ml_only_beach_renders_forecast_height_label_with_tilde_mobile` | Bolinas | Mobile viewport, same target | Same assertions. Mobile must still show the tilde even though the tooltip is not available. |
| `ml_only_beach_cross_region_renders_honesty_layer` | Cocoa Beach Pier | Desktop viewport, navigate to Cocoa Beach Pier detail | Same as Bolinas desktop test. Guards against region-specific regressions. |
| `ml_only_beach_tooltip_reveals_microcopy_on_hover_desktop` | Bolinas | Desktop; hover the wave-height container using `locator.hover()` | `page.getByRole('tooltip')` becomes visible; tooltip text contains the Day 1 microcopy string (to be locked in by marketer — see §6) |
| `ml_only_beach_tooltip_reveals_microcopy_on_focus_desktop` | Bolinas | Desktop; focus the wave-height container via `locator.focus()` | `page.getByRole('tooltip')` becomes visible | Keyboard-only users must get the same signal as mouse hover. Spec §4.5. |
| `calibrated_beach_tooltip_shows_rich_content_on_hover_desktop` | Blacks | Desktop; hover the wave-height container | Tooltip contains the existing rich text ("Data Priority" section) | State A must be unchanged. Regression anchor. |
| `ml_only_beach_second_anchor_la_jolla_is_calibrated_not_honesty_layer` | La Jolla Shores | Desktop; navigate and verify | Same assertions as the Blacks calibrated test | Negative assertion — confirms the honesty layer does NOT leak to calibrated beaches. Two calibrated anchors catch a "ship it to everything" regression that a Blacks-only test would miss. |

**Count:** 9 new E2E tests.

### 3.4 Dotted-underline assertion strategy

**Chosen approach:** assert on Tailwind class names via `await expect(locator).toHaveClass(/border-dotted/)`. Rationale:

- Tailwind class names are the contract between design spec and implementation. The spec explicitly lists them in §4.2.
- Computed-style assertions (`toHaveCSS('border-bottom-style', 'dotted')`) are more brittle: jsdom and headless Chromium resolve `border-b border-dotted` in ways that can differ from production builds, and a dev-mode CSS purge miss would show `dotted` via the class even when the resolved style is absent.
- Class-name assertions fail loud and early when the engineer uses the `underline` utility by mistake (see spec §4.2 — `underline` is solid and reads as a link; must use `border-b border-dotted`).

**Fallback if class assertions fail flakily:** use `await expect(locator).toHaveCSS('border-bottom-style', 'dotted')` as a second assertion (additive, not replacement). Both should pass if the implementation is correct; divergence is a signal worth investigating, not a test to loosen.

### 3.5 Label-locator scoping

The spec §4.4 notes that "Face height" / "Forecast height" labels are rendered by parent surfaces, not by `WaveHeightDisplay` itself. E2E assertions must scope to the beach-detail page's primary wave-height surface, not match the label anywhere on the page (a side card could render a different beach and pollute the assertion).

```ts
// Pseudo-code
const primaryWaveHeight = page.locator('[data-testid="primary-wave-height"]');
await expect(primaryWaveHeight.getByText(/Face height/i)).toBeVisible();
```

> **Engineer action item:** Day 2 must add `data-testid="primary-wave-height"` (or an equivalent stable anchor) to the main beach-detail wave-height container. Without this, the label locators are unscoped and tests become flaky when related content renders nearby.

### 3.6 Onboarding and auth

All E2E tests call `dismissOnboardingWizard(page)` after `waitForPageLoad` — existing helper from `e2e/utils/test-helpers`. Use it verbatim. Do not invent a new dismissal path.

Tests in this describe block are anonymous-user only (beach detail is public). Do not add auth setup.

---

## Section 4 — Native Unit Test Extensions

### 4.1 `quiver-native/src/__tests__/format-wave-height.test.ts`

**Current state:** 10 tests covering `formatWaveRange` string parsing for numeric and already-ranged inputs.

**Day 2 change to the source:** `formatWaveRange(raw, options?: { isCalibrated?: boolean })` — the function gains an optional options object. When `isCalibrated === false`, prepend a `~ ` to the returned string.

> **Alternate API the engineer may pick:** a sibling function `formatWaveRangeWithCalibration(raw, isCalibrated)` that delegates to `formatWaveRange` and wraps the result. Either shape is acceptable; the test names below assume the options-object shape. If the engineer picks the sibling shape, the tests rename trivially.

**Tests to add:**

| Test name | Input | Expected output |
|---|---|---|
| `formatWaveRange_with_isCalibrated_true_returns_unprefixed_string` | `formatWaveRange('2.6 ft', { isCalibrated: true })` | `'2-3 ft'` (identical to today) |
| `formatWaveRange_with_isCalibrated_undefined_returns_unprefixed_string` | `formatWaveRange('2.6 ft')` (or `formatWaveRange('2.6 ft', {})`) | `'2-3 ft'` — backward compat |
| `formatWaveRange_with_isCalibrated_false_prepends_tilde` | `formatWaveRange('2.6 ft', { isCalibrated: false })` | `'~ 2-3 ft'` |
| `formatWaveRange_with_isCalibrated_false_prepends_tilde_on_whole_number` | `formatWaveRange('3 ft', { isCalibrated: false })` | `'~ 2-3 ft'` |
| `formatWaveRange_with_isCalibrated_false_prepends_tilde_on_existing_range` | `formatWaveRange('4-6 ft', { isCalibrated: false })` | `'~ 4-6 ft'` — pass-through with prefix |
| `formatWaveRange_with_isCalibrated_false_returns_null_for_null_input` | `formatWaveRange(null, { isCalibrated: false })` | `null` — do NOT prepend `~` to nothing |
| `formatWaveRange_with_isCalibrated_false_passes_unparseable_unchanged_with_tilde` | `formatWaveRange('flat', { isCalibrated: false })` | `'~ flat'` (or `'flat'` if engineer decides unparseable strings skip the prefix — specify in the test's comment which choice was made; consistency with the native spec §5.2 suggests prefixing everything) |
| `formatWaveRange_with_isCalibrated_false_handles_metric` | `formatWaveRange('1.5 m', { isCalibrated: false })` | `'~ 1-2 m'` |
| `formatWaveRange_with_isCalibrated_true_does_not_touch_existing_passthrough_cases` | All 10 existing positive-assertion inputs from the current test file, wrapped with `{ isCalibrated: true }` | Same return value as current | **Regression anchor** — guarantees `isCalibrated: true` is a zero-delta code path relative to today. |

**Count:** 9 new tests. **No existing tests are modified** (the options argument is optional; all current positional-arg calls still compile and behave identically).

### 4.2 Native beach-card component tests

**Target test file:** no `beach-card.test.tsx` exists today in `quiver-native/src/__tests__/`. Verified: the closest component test is `wave-height-selector.test.tsx`, which is a session-form component unrelated to the beach card's wave-height render.

**Recommendation:** create a new `quiver-native/src/__tests__/beach-card.test.tsx` file. Follow the existing `wave-height-selector.test.tsx` import style (React Testing Library React Native, `@/components/...` alias).

**Mocking requirements:** `BeachCard` imports `expo-image`, `expo-linear-gradient`, `@expo/vector-icons`, `react-native-reanimated`, `@/lib/haptics`, and `@/lib/animations`. The repo's `src/test/setup.ts` already mocks Reanimated, Haptics, and most Expo modules (per `quiver-native/CLAUDE.md` Testing section). Verify at top of the new file; add any missing mocks using `jest.mock(...)` as close to the existing pattern as possible.

**Tests to add:**

| Test name | Setup | Assertion |
|---|---|---|
| `beach_card_calibrated_does_not_apply_opacity_to_wave_height` | Render `<BeachCard beach={fixtureCalibrated} ... />` where `fixtureCalibrated.conditions.isCalibrated === true` | The wave-height `Text` node (conditions overlay) does NOT have a style with `opacity: 0.7`; no `~` prefix in its textContent |
| `beach_card_uncalibrated_applies_opacity_0_7_to_wave_height` | Render with `fixtureUncalibrated.conditions.isCalibrated === false` | The wave-height `Text` has style including `opacity: 0.7` (assert via `style` prop on the `Text` element; use `toHaveStyle({ opacity: 0.7 })`) |
| `beach_card_uncalibrated_prepends_tilde_in_wave_height_text` | Same as above | The conditions overlay's rendered text matches `/^~\s*\d/` or contains a `~` `Text` node with `accessibilityElementsHidden: true` |
| `beach_card_uncalibrated_tilde_is_hidden_from_accessibility` | Same | The `~` `Text` node has `accessibilityElementsHidden={true}` prop set (iOS) and/or `importantForAccessibility="no"` (Android). Use `getByText('~')` then assert on its props. This catches the "VoiceOver reads tilde three to four feet" regression. |
| `beach_card_calibrated_wave_height_is_readable_by_accessibility` | calibrated beach | The wave-height `Text` node does not have `accessibilityElementsHidden` set (or set to false) |
| `beach_card_isCalibrated_undefined_backward_compat` | `fixtureWithoutProp.conditions.isCalibrated === undefined` | No `~` prefix, no `0.7` opacity — treated as calibrated | Mirrors the web backward-compat guarantee. |

**Count:** 6 new tests in a new file.

> **Engineer action item:** the `BeachWithConditions` type in `quiver-native/src/types/beach.ts` needs to carry `conditions.isCalibrated?: boolean`. Without this, the beach-card Day 2 work won't typecheck. Add the prop in the same commit as the component change. Note: spec §5.4 explicitly says the beach-card conditions overlay does NOT need a "Face height" label swap, so this test block only covers the opacity + tilde changes, not label assertions.

### 4.3 Additional native label-swap tests (conditional)

The spec §5.4 says "wherever a surface renders a 'Face height' label today" gets the label swap. If Day 2 engineer finds such a surface (beach detail header, forecast list row, etc.) and modifies it, the same label-swap tests from §2.2 apply in the native test harness. Since this plan can't predict which surfaces exist without grepping the whole native codebase, mark this as:

> **Open action item:** Day 2 engineer runs `grep -rn "Face height" quiver-native/src/` before implementation. For each surface found, add a label-swap test (`test_<surface>_uncalibrated_shows_forecast_height_label` and `test_<surface>_calibrated_shows_face_height_label`). If zero surfaces are found, no action needed — the beach card already doesn't render a label per spec §5.4.

---

## Section 5 — Launch-Day Smoke Test Checklist

Manual steps QA runs on launch day (before flipping the feature flag / merging to main). Do these in order; do not skip.

### 5.1 Backend sanity (Supabase MCP)

Run via the Supabase MCP (`mcp__plugin_supabase_supabase__execute_sql`):

```sql
-- Sanity check 1: calibrated beach count matches the spec's expected number
SELECT COUNT(*) AS calibrated_count
FROM beaches
WHERE shoaling_factors IS NOT NULL;
-- Expected: 117 (per calibration-honesty-spec.md §1)

-- Sanity check 2: ML-only beach count
SELECT COUNT(*) AS ml_only_count
FROM beaches
WHERE shoaling_factors IS NULL;
-- Expected: 63 per the spec (the spec claims 63 ML-only + 117 calibrated = 180; actual total may differ — if the ML-only count doesn't match, the spec may have drifted since Day 1 and the marketer must be notified)

-- Sanity check 3: pull 5 calibrated beach names for manual checking
SELECT id, name, city, state
FROM beaches
WHERE shoaling_factors IS NOT NULL
ORDER BY name
LIMIT 5;

-- Sanity check 4: pull 5 ML-only beach names for manual checking
SELECT id, name, city, state
FROM beaches
WHERE shoaling_factors IS NULL
ORDER BY name
LIMIT 5;
```

Record the 10 names (5 + 5) in a scratch buffer. These are the manual walkthrough targets.

### 5.2 Web desktop walkthrough (Playwright MCP or real browser)

Open each of the 5 calibrated beaches. For each:

- [ ] Wave height renders without a `~` prefix
- [ ] No dotted underline under the digits
- [ ] Label reads "Face height"
- [ ] Hover the wave-height — existing rich tooltip appears (data source, confidence, ML badge)
- [ ] Page console has no errors (check DevTools / Playwright MCP `browser_console_messages`)

Open each of the 5 ML-only beaches. For each:

- [ ] Wave height renders with a `~ ` prefix
- [ ] Dotted underline visible under the digits (not under the `~`)
- [ ] Label reads "Forecast height" (if a label is rendered on this surface)
- [ ] Hover the wave-height — tooltip appears with the single-line microcopy
- [ ] Tooltip does NOT show rich data source / confidence / ML content (spec §4.5)
- [ ] Tab to the wave-height — tooltip opens on keyboard focus
- [ ] Page console has no errors

### 5.3 Web mobile walkthrough (375x667 viewport)

Same 10 beaches as above. For each:

- [ ] Calibrated: no tilde, no dotted underline, "Face height" label (if rendered)
- [ ] ML-only: `~` prefix, dotted underline, "Forecast height" label (if rendered)
- [ ] Tooltip behavior on mobile — note that mobile hover is tap-based; document behavior in the test log if it deviates from desktop

### 5.4 Native walkthrough (iOS simulator + Android emulator)

Install the latest dev build. For each of the 10 beaches (find them via the beach list or search):

- [ ] Calibrated: no `~`, no 70% opacity on the wave-height text in the card overlay
- [ ] ML-only: `~` prefix, 70% opacity on the wave-height text
- [ ] VoiceOver (iOS): navigate to the wave-height element. Listen for "Forecast height three to four feet" on ML-only beaches. Do NOT hear "tilde three to four feet" — if you do, `accessibilityElementsHidden` is missing (spec §5.5).
- [ ] TalkBack (Android): same check
- [ ] No native console errors (Metro bundler output clean)

### 5.5 Visual regression cross-check

- [ ] Screenshot 2 calibrated beaches on web (Blacks + La Jolla Shores) and compare to a pre-change screenshot from the `main` branch (capture one before merging). The wave-height surface should be pixel-identical.
- [ ] Screenshot the same 2 beaches on native and compare.
- [ ] If anything drifts on calibrated beaches, that is a regression — State A must be unchanged (spec §3 "State A").

### 5.6 Backend spot-check loop

Close the loop: for each of the 5 calibrated beaches pulled in §5.1, confirm they render as "Face height" in the app. Cross-reference beach id ↔ rendered label. One mismatch = bug.

Same for ML-only beaches and "Forecast height".

---

## Section 6 — Blockers and Dependencies

### 6.1 From the engineer

| Blocker | Why it matters | Action |
|---|---|---|
| **Canonical beach slugs** for the 4 E2E anchors (Blacks, La Jolla Shores, Bolinas, Cocoa Beach Pier) | E2E spec can't navigate without them | Engineer provides a slug map in the Day 2 kickoff; QA updates §1.1 placeholder slugs |
| **Final prop name** — `isCalibrated` vs `isShoalingCalibrated` vs something else | Test names and import statements depend on it; the envelope ships as `isCalibrated` but the spec uses `isShoalingCalibrated` | Engineer locks this in before Day 2 code; this plan uses `isCalibrated` as placeholder and will rename in a Day 2 sweep if needed |
| **`data-testid="primary-wave-height"`** (or equivalent) on the beach-detail page's main wave-height container | E2E label scoping is flaky without a stable anchor | Engineer adds the testid in the same PR as the component change |
| **New function signature** for `transformToFaceHeightWithMetadata` | Unit tests in §2.1 assume `{ faceHeight, isCalibrated }` return shape | Engineer confirms the shape in Day 2 kickoff; if different, §2.1 test names are still valid but the assertions adjust |
| **Native `BeachWithConditions.conditions.isCalibrated` type field** | Native beach-card tests won't typecheck without it | Engineer adds to `quiver-native/src/types/beach.ts` |

### 6.2 From the designer

| Blocker | Why | Status |
|---|---|---|
| **Dotted underline Tailwind class stack** locked (`border-b border-dotted border-muted-foreground/60`) | Web unit tests assert on class names; a class drift breaks every State B unit test | **Already locked in spec §4.2.** No blocker. |
| **Label text** ("Face height" / "Forecast height") locked | E2E tests assert exact strings | **Locked in spec §4.4.** No blocker. |
| **Native opacity value** (0.7) locked | Native tests assert exact opacity | **Locked in spec §5.2.** No blocker. |

### 6.3 From the marketer

| Blocker | Why | Action |
|---|---|---|
| **Final tooltip microcopy pick** — one of four options in spec §7 | Web unit test `isCalibrated_false_tooltip_shows_microcopy_on_hover` asserts the exact string; so does the E2E tooltip hover test | **Blocking.** Marketer must pick before Day 2 engineer hardcodes the constant. Until picked, tests assert `/buoy forecast/i` as a loose regex — but this must tighten to the exact string before shipping. |

### 6.4 From the PM / product

| Blocker | Why | Action |
|---|---|---|
| **Label migration scope** — spec §11 Q2 asks whether existing surfaces that render "Wave height" (not "Face height") should be migrated to "Face height" in the same PR | Every surface needing migration is a separate E2E assertion; scope creep risk | PM confirms scope. QA recommends narrow scope: only surfaces that already render "Face height" today get the label swap on State B; surfaces rendering "Wave height" stay as-is and get a follow-up PR. This keeps Day 2 blast radius minimal. |

---

## Section 7 — Pre-Existing Test Health Report

### 7.1 Jest test-file enumeration (read-only)

Ran: `cd /Users/stevenchandler/Desktop/dev/quiver && npx jest wave-height --listTests`

**Discovered wave-height test files:**

```
/Users/stevenchandler/Desktop/dev/quiver/__tests__/lib/services/surf-discovery-wave-height-badge.test.ts
/Users/stevenchandler/Desktop/dev/quiver/__tests__/lib/utils/test-helpers/wave-height-test-utils.ts
/Users/stevenchandler/Desktop/dev/quiver/__tests__/lib/utils/wave-height-transformer.test.ts
```

Notes:

- `wave-height-test-utils.ts` is flagged as a "test file" because it has a placeholder `describe()` at the bottom (line 118-129) to satisfy Jest. Not a real test file; it's helpers. Safe to leave as-is.
- `surf-discovery-wave-height-badge.test.ts` is unrelated to the honesty layer (surf-discovery is a different subsystem). Day 2 should NOT touch it. If a test fails there during Day 2, treat as pre-existing and out of scope.
- `wave-height-transformer.test.ts` is the file targeted in §2.1.
- Note: there is no `wave-height-display.test.tsx` — confirmed via `ls __tests__/components/ui/` which lists only `wave-period-display.test.tsx` and `wave-type-selector.test.tsx` (no `wave-height-display`). §2.2 will create this file.

### 7.2 Jest haste-map warnings (pre-existing)

Jest also emitted duplicate-manual-mock warnings from `.worktrees/` and `.claude/worktrees/` directories:

```
jest-haste-map: duplicate manual mock found: cdip-service
jest-haste-map: duplicate manual mock found: noaa-coops-service
jest-haste-map: duplicate manual mock found: noaa-wavewatch-service
jest-haste-map: duplicate manual mock found: @/actions/profile-actions
jest-haste-map: duplicate manual mock found: @/app/actions/profile
```

**Assessment:** not a blocker for Day 2. These are warnings, not failures, and they're caused by orphan worktree directories still containing mock files. The noise is ignorable for the calibration honesty work. Recommend a separate cleanup task for the infrastructure team — do not mix into Day 2 PR.

### 7.3 Pre-existing TypeScript error in `__tests__/setup/typed-mocks.ts`

The engineer flagged an existing TS error in `__tests__/setup/typed-mocks.ts` related to `deleted_at` on `createMockProfile`. Unrelated to the calibration honesty layer.

**Assessment: fine, NOT a blocker for Day 2.**

Reasoning:
- The error is in a test-setup helper, not in product code.
- It pre-dates this sprint.
- It does not impact Jest test discovery or execution for the wave-height transformer / display tests (those tests don't import `typed-mocks.ts` — verified from `wave-height-transformer.test.ts` imports which only reference `@/lib/utils/wave-height-transformer` and `./test-helpers/wave-height-test-utils`).
- The new `wave-height-display.test.tsx` file in §2.2 should similarly avoid importing `typed-mocks.ts` — build the component props inline or via a local `makeWaveHeightDisplayProps(overrides)` helper. Do NOT add a new dependency on the broken shared mock.

**Coordination action:** QA files a lightweight follow-up ticket for whoever owns `__tests__/setup/typed-mocks.ts` (likely the profile/onboarding team) to fix the `deleted_at` type mismatch on their own schedule. Mention it in the Day 2 PR description as "pre-existing, not addressed here" so the reviewer doesn't chase it.

### 7.4 E2E test-runner sanity

The repo's `yarn test` script maps to `playwright test`, not Jest. Running `yarn test wave-height --listTests` fails with `unknown option '--listTests'` (Playwright doesn't support that flag). Jest test discovery must be invoked via `npx jest ... --listTests` directly. The Day 2 engineer should use:

- **Unit tests:** `npx jest <pattern>` (NOT `yarn test <pattern>`)
- **E2E tests:** `npx playwright test <path>` (matches Quiver CLAUDE.md guidance to run subset specs, not the full suite)

This is important because the standard Jest-on-Yarn muscle memory will silently invoke the wrong runner.

---

## Section 8 — Test Count Summary

| Surface | New tests | File path |
|---|---|---|
| Web unit — transformer metadata | 12 | `__tests__/lib/utils/wave-height-transformer.test.ts` (append) |
| Web unit — display component | 14 | `__tests__/components/ui/wave-height-display.test.tsx` (**new file**) |
| Web E2E — calibration honesty layer | 9 | `e2e/forecast-regional.spec.ts` (append) |
| Native unit — formatter | 9 | `quiver-native/src/__tests__/format-wave-height.test.ts` (append) |
| Native unit — beach-card | 6 | `quiver-native/src/__tests__/beach-card.test.tsx` (**new file**) |
| **Total** | **50** | |

Plus the conditional native label-swap tests in §4.3 (0-N depending on `grep "Face height" quiver-native/src/` results).

---

## Section 9 — Day 2 Execution Order (Recommended)

1. Engineer confirms blockers in §6.1 (slug map, prop name, testid, function signature, native type).
2. Engineer writes `transformToFaceHeightWithMetadata` in `wave-height-transformer.ts`.
3. Engineer writes §2.1 unit tests → green.
4. Engineer writes `WaveHeightDisplay` `isCalibrated` branch in `wave-height-display.tsx`.
5. Engineer writes §2.2 unit tests → green.
6. Engineer adds `data-testid="primary-wave-height"` to the beach-detail surface.
7. Engineer writes §3 E2E tests → green (run against local dev or `dev.quiversurf.app` per `run-e2e-dev` skill).
8. Native engineer extends `formatWaveRange` → writes §4.1 tests → green.
9. Native engineer extends `BeachCard` → writes §4.2 tests → green.
10. QA runs §5 manual smoke checklist against dev deploy.
11. Engineer opens PR; reviewer confirms §7.3 pre-existing TS error is not addressed (expected).
12. Merge, feature flag flip, monitor Sentry for 24h.

---

**End of plan.**
