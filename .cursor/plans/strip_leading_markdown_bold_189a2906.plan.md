---
name: Strip leading markdown bold
overview: Remove leaked `**Beach Name**` markers from seeded descriptions by improving the existing sanitizer and applying it at the SurfSpot transformation layer so all city/spot UIs show clean text.
todos:
  - id: update-sanitizer
    content: Broaden `sanitizeBeachDescription()` to handle beach names with parentheticals while remaining conservative.
    status: pending
  - id: apply-sanitizer-transformer
    content: Apply sanitizer in `transformBeachToSurfSpot()` so `SurfSpot.overview` is clean across city UI surfaces.
    status: pending
    dependencies:
      - update-sanitizer
  - id: add-unit-tests
    content: Add/adjust unit tests in `__tests__/lib/utils/text-utils.test.ts` for the new sanitizer behavior.
    status: pending
    dependencies:
      - update-sanitizer
  - id: update-changelog
    content: Add `[Unreleased]` changelog entry for the description formatting fix.
    status: pending
    dependencies:
      - apply-sanitizer-transformer
      - add-unit-tests
---

# Strip leading `**Beach Name**` from descriptions

## Implementation Plan

### Scope
- Ensure seeded descriptions like `**Mission Beach** serves ...` display as `Mission Beach serves ...` (no literal asterisks) across city lists/maps and beach detail “About This Spot”.
- Keep everything **plain text** (no markdown rendering) per your selection.

### Files
- [ ] [`lib/utils/text-utils.ts`](/Users/stevenchandler/Desktop/quiver/quiver/lib/utils/text-utils.ts) – broaden `sanitizeBeachDescription()` to handle common name mismatches (e.g., parenthetical qualifiers) while staying safe.
- [ ] [`lib/utils/beach-to-surfspot-transformer.ts`](/Users/stevenchandler/Desktop/quiver/quiver/lib/utils/beach-to-surfspot-transformer.ts) – apply `sanitizeBeachDescription()` when populating `SurfSpot.overview` (and the `speakableSummary` fallback) so city UIs that render `spot.overview` stop showing `**...**`.
- [ ] [`__tests__/lib/utils/text-utils.test.ts`](/Users/stevenchandler/Desktop/quiver/quiver/__tests__/lib/utils/text-utils.test.ts) – add unit coverage for the new sanitizer cases (e.g., `beachName` containing parentheticals like `"Sunset Cliffs (Garbage)"` but description bold uses `"Sunset Cliffs"`).
- [ ] [`CHANGELOG.md`](/Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md) – add an `[Unreleased]` bullet noting the fix.

### Steps
1. Update `sanitizeBeachDescription()` to treat `beachName` and the bolded segment as matching if they differ only by parenthetical suffixes (and retain the existing conservative behavior).
2. Use that sanitizer in `transformBeachToSurfSpot()` so `SurfSpot.overview` is already clean everywhere `CityMapView` (and any other consumers) render it.
3. Add focused unit tests to prevent regressions.
4. Update `CHANGELOG.md`.

### Testing
- Run unit tests for `text-utils` (and the full unit suite if that’s your norm).
- Quick smoke via Playwright MCP: open a city page (e.g. San Diego) and confirm the featured list no longer shows literal `**...**`; open a spot page and confirm “About This Spot” no longer shows literal `**...**`.
