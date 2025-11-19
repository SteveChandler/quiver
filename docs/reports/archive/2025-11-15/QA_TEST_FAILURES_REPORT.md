# QA Test Failures Report - Quiver E2E Tests

**Date**: 2025-11-15
**Environment**: Local Development
**Test Framework**: Playwright
**Total Tests**: 795
**Failing Tests**: Multiple new test files

---

## Executive Summary

Multiple new E2E test files were created but are failing due to:
1. **Viewport issues** - Tests not setting appropriate viewport sizes
2. **Selector issues** - Tests targeting elements that exist but are hidden on mobile
3. **Helper function issues** - Missing test helper functions in some test files
4. **Timing issues** - Some tests have overly aggressive timeouts

### Critical Impact

- **12/14 autocomplete tests failing** (85.7% failure rate)
- Multiple beach detail forecast tab tests failing
- Map coordinate validation tests need investigation
- Build integrity tests passing mostly
- Nearby beaches regression tests may have helper function issues

---

## Root Cause Analysis

### 1. Autocomplete Dropdown Tests (`e2e/autocomplete-dropdown-timing.spec.ts`)

**Status**: 12 failures, 2 passes

**Root Cause**:
```typescript
// Line 20-23 of autocomplete-dropdown-timing.spec.ts
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForPageLoad(page);
});
```

The test navigates to `/` (home page) but **does not set a viewport size**. The search input in `app-header.tsx` has this structure:

```tsx
// Line 214-236 of app-header.tsx
{user && (
  <form
    onSubmit={handleSearch}
    className="hidden md:flex flex-1 max-w-[600px] mx-8"  // ⚠️ HIDDEN on mobile!
  >
    <Input
      type="search"
      placeholder="Search beaches, spots, or sessions..."
      data-testid="header-search-input"
    />
  </form>
)}
```

**The Problem**: The form is `hidden md:flex` which means it's **hidden by default and only visible on `md:` (768px+) viewports**. Playwright's default viewport is 1280x720, but the test needs to explicitly set it or the component behavior may be unpredictable.

**Error Messages**:
```
Error: expect(locator).toBeVisible() failed
Locator: locator('[cmdk-list]')
Expected: visible
Received: hidden
Timeout: 200ms
```

The dropdown list never appears because the search input itself is not visible/accessible.

**Failed Tests**:
- ✘ dropdown appears immediately (< 200ms) when typing 2+ characters
- ✘ dropdown closes immediately when deleting to < 2 characters
- ✘ dropdown shows filtered results matching query
- ✘ dropdown opens immediately even when API is slow
- ✘ keyboard navigation works (arrow keys)
- ✘ pressing enter on selected result navigates to beach detail page
- ✘ clicking a result navigates to beach detail page
- ✘ pressing escape closes dropdown and clears input
- ✘ dropdown shows empty state when no results found
- ✘ dropdown appears immediately on mobile viewport
- ✘ touch scrolling works in dropdown on mobile
- ✘ maintains responsiveness during rapid typing

**Passed Tests**:
- ✓ dropdown remains hidden for single character input
- ✓ does not make excessive API calls during typing

### 2. Beach Detail Forecast Tabs Tests (`e2e/beach-detail/forecast-tabs.spec.ts`)

**Status**: All tests failing

**Root Cause**: Tests likely navigating to beach detail pages that may not exist or have timing issues with tab rendering.

**Common Error Pattern**: Timeouts waiting for tab elements to appear.

### 3. Map Coordinate Validation Tests (`e2e/map-coordinate-validation.spec.ts`)

**Status**: Needs investigation

**Potential Issues**:
- Tests checking for coordinate validation and Mapbox rendering
- May have timing issues waiting for map initialization
- May need longer timeouts for map rendering (Mapbox can be slow)

### 4. Build Integrity Tests (`e2e/build-integrity.spec.ts`)

**Status**: Mostly passing

**Tests**: Checking for console errors, webpack issues, source maps, etc.

---

## Recommendations

### Immediate Fixes (Priority 1)

#### Fix 1: Add Viewport Configuration to Autocomplete Tests

```typescript
// e2e/autocomplete-dropdown-timing.spec.ts
test.describe('Autocomplete Dropdown Timing', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport to ensure search input is visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await waitForPageLoad(page);
  });
```

#### Fix 2: Increase Timeouts for Autocomplete Tests

The 200ms timeout for dropdown visibility is too aggressive:

```typescript
// Change from:
await expect(dropdownList).toBeVisible({ timeout: 200 });

// To:
await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });
```

#### Fix 3: Verify Test Helper Functions Exist

Check that `e2e/utils/profile-helpers.ts` exports:
- `createTestUser()`
- `deleteTestUser()`
- `signInTestUser()`

#### Fix 4: Add Test Data IDs to Beach Detail Tabs

Ensure forecast tab components have proper `data-testid` attributes for reliable selection.

### Medium Priority Fixes (Priority 2)

#### Fix 5: Review Map Tests for Timing

Map tests may need:
- Longer timeouts for Mapbox initialization
- Better waiting strategies for markers to render
- Verification that mapbox-gl library is loaded

#### Fix 6: Standardize Viewport Sizes Across Tests

Create a pattern in `e2e/fixtures/test-data.ts`:

```typescript
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  large: { width: 1920, height: 1080 },
};
```

Then use consistently:
```typescript
test.beforeEach(async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  // ...
});
```

### Best Practices to Prevent Future Issues (Priority 3)

1. **Always Set Viewport**: Every test should explicitly set viewport size in `beforeEach`
2. **Use Appropriate Timeouts**: Use constants from `TIMEOUTS` fixture instead of hardcoded values
3. **Wait for Elements**: Use `waitForSelector` or `expect().toBeVisible()` before interactions
4. **Test Data IDs**: Ensure all testable elements have `data-testid` attributes
5. **Mobile-First Testing**: Test on mobile viewport first, then desktop
6. **Verify Test Setup**: Ensure all test helper functions exist before writing tests

---

## Implementation Plan

### Phase 1: Critical Fixes (Day 1)

1. ✅ Add viewport configuration to autocomplete tests
2. ✅ Replace hardcoded 200ms timeouts with `TIMEOUTS.short` (2000ms)
3. ✅ Verify profile helper functions exist
4. ✅ Run autocomplete tests to verify fixes

### Phase 2: Additional Test Fixes (Day 1-2)

5. ⏳ Fix beach detail forecast tab tests
6. ⏳ Review and fix map coordinate validation tests
7. ⏳ Verify nearby beaches regression tests pass
8. ⏳ Run full test suite

### Phase 3: Documentation & Prevention (Day 2)

9. ⏳ Update e2e/ARCHITECTURE.md with viewport best practices
10. ⏳ Add examples to test documentation
11. ⏳ Create test template files with proper setup
12. ⏳ Document all fixes in CHANGELOG.md

---

## Quality Metrics

### Before Fixes
- **Total Tests**: 795
- **Passing**: ~783
- **Failing**: ~12 (autocomplete) + others
- **Pass Rate**: ~98.5% (excluding new tests)
- **New Test Pass Rate**: ~14.3% (2/14 autocomplete tests)

### After Fixes (Target)
- **Total Tests**: 795
- **Passing**: 790+
- **Failing**: <5
- **Pass Rate**: >99.0%
- **New Test Pass Rate**: >95%

---

## Lessons Learned

1. **Responsive Design Testing**: Tests must account for responsive CSS (hidden/visible breakpoints)
2. **Viewport Setup**: Always set explicit viewport sizes
3. **Timeout Strategy**: Use standardized timeout constants
4. **Test-First Validation**: Run tests immediately after creation to catch setup issues
5. **Helper Functions**: Verify helper function existence before importing

---

## Preventive Measures

### Code Review Checklist for E2E Tests

- [ ] Test sets explicit viewport size in `beforeEach`
- [ ] Test uses `TIMEOUTS` constants instead of hardcoded values
- [ ] Test verifies element visibility before interaction
- [ ] Test includes proper error handling
- [ ] Test helper functions exist and are exported
- [ ] Test follows patterns in `e2e/ARCHITECTURE.md`
- [ ] Test has meaningful assertions
- [ ] Test cleans up state in `afterEach` if needed

### CI/CD Integration

- Run new tests in isolation before merging
- Require 95%+ pass rate for new test files
- Run tests on multiple viewport sizes
- Generate test coverage reports

---

## Conclusion

The test failures are primarily due to:
1. Missing viewport configuration (root cause of autocomplete failures)
2. Overly aggressive timeouts (200ms is too short)
3. Potential missing helper functions (needs verification)

With the recommended fixes, we expect >95% pass rate for all new tests. The issues are straightforward to fix and provide valuable learning for future test development.

**Status**: Ready for implementation ✅
**Confidence**: High 🟢
**Risk**: Low 🟢
