# Playwright Test Failures Report

**Date**: October 19, 2025
**Tests Run**: 127 total (88 passed, 30 failed, 9 skipped)

## Summary

30 tests failed after landing page redesign. Main issue: beach search normalization tests are running as authenticated users but trying to test landing page features.

---

## Critical Issues

### 1. Beach Search Normalization Tests (23 failures) ❌

**Problem**: Tests run in `[auth]` project but expect landing page features

**Root Cause**:

- Tests navigate to `/` as authenticated users
- Authenticated users see home screen, NOT landing page
- Search input with placeholder `"search by beach, spot, or region"` only exists on guest landing page
- Tests timeout waiting for element that doesn't exist

**Files Affected**:

- `e2e/beach-search-normalization.spec.ts` (ALL 23 tests)

**Fix Options**:

**Option A - Move to Guest Project (RECOMMENDED)**:

```typescript
// Change test project in playwright.config.ts
// OR add @guest tag and update test file

test.use({ storageState: { cookies: [], origins: [] } }); // Force guest mode
```

**Option B - Test Landing Page Explicitly**:

```typescript
// Navigate to a page that actually has the search (like /map with auth gate)
// But this doesn't test the landing page hero search
```

**Recommendation**: Move these tests to `[guest]` project since they're testing landing page functionality.

---

### 2. Guest Landing Page Tests (2 failures) ❌

**Tests**:

1. `featured beaches section displays cards with conditions`
2. `activities section shows surf activity types`

**Investigation Needed**:

- Check if featured beaches API is returning data
- Verify activities section renders correctly
- May need to update selectors

**Files Affected**:

- `e2e/guest-landing-page.spec.ts:140`
- `e2e/guest-landing-page.spec.ts:174`

---

### 3. Accessibility Violations (7 failures) ⚠️ PRE-EXISTING

**Problem**: Primary color `#0b87c1` has insufficient contrast

**Violations**:

1. **Color Contrast**: 3.82:1 ratio (needs 4.5:1 for WCAG AA)
   - Primary button text on primary background
   - Links in muted text
2. **Link Styling**: Links need underline to distinguish from text
   - Sign-in/sign-up links in muted foreground text
   - Contrast ratio with surrounding text only 1.18:1 (needs 3:1)

**Files Affected**:

- Landing page, Map page, Sign-in, Sign-up, Forms
- Primary color in `tailwind.config.ts`

**Fix Required**:

```typescript
// tailwind.config.ts
primary: {
  DEFAULT: "hsl(199 89% 48%)", // Current: #0b87c1 (3.82:1)
  // NEED: Darker shade for 4.5:1 contrast ratio
  DEFAULT: "hsl(199 89% 38%)", // ~#0077B6 (should give 4.5:1+)
}
```

**Impact**: Serious accessibility issue affecting multiple pages

---

### 4. Beach Live Cam Test (1 failure) ❌

**Problem**: Test beach doesn't have camera_url

**Error**:

```
Expected: visible
Received: <element(s) not found>
```

**Files Affected**:

- `e2e/beach-live-cam.spec.ts:3`

**Fix**: Skip test if beach doesn't have camera OR use a beach that has camera_url

---

### 5. Guest Protected Routing Tests (2 failures) ❌

**Tests**:

1. `sessions/new redirects to sign-in when unauthenticated`
2. `after login, sessions/new loads session wizard shell`

**Investigation Needed**: Check routing behavior

**Files Affected**:

- `e2e/guest-protected-routing.spec.ts:6`
- `e2e/guest-protected-routing.spec.ts:11`

---

### 6. Guest Smoke Test (1 failure) ❌

**Test**: `landing page shows primary CTA`

**Investigation Needed**: Verify CTA button selector/text

**Files Affected**:

- `e2e/guest-smoke.spec.ts:4`

---

## Recommended Fix Priority

### High Priority (Blocking) 🔴

1. **Fix Beach Search Tests Project Assignment**

   - Move `e2e/beach-search-normalization.spec.ts` to guest project
   - OR add guest mode to test setup
   - **Time**: 10 minutes
   - **Impact**: Fixes 23 tests

2. **Debug Guest Landing Page Tests**

   - Check featured beaches API data
   - Verify activities section rendering
   - **Time**: 30 minutes
   - **Impact**: Fixes 2 tests

3. **Fix Beach Live Cam Test**
   - Use beach with camera_url OR skip if no camera
   - **Time**: 5 minutes
   - **Impact**: Fixes 1 test

### Medium Priority (Important) 🟡

4. **Fix Accessibility - Color Contrast**

   - Update primary color in tailwind config
   - Verify WCAG AA compliance
   - **Time**: 1 hour (includes testing)
   - **Impact**: Fixes 7 tests + improves UX

5. **Fix Guest Routing Tests**

   - Debug routing behavior
   - **Time**: 20 minutes
   - **Impact**: Fixes 2 tests

6. **Fix Guest Smoke Test**
   - Update CTA selector
   - **Time**: 5 minutes
   - **Impact**: Fixes 1 test

---

## Quick Wins (Can fix immediately)

### 1. Beach Search Tests - Guest Project Assignment

```bash
# Add to e2e/beach-search-normalization.spec.ts at top
test.use({ storageState: { cookies: [], origins: [] } });
```

### 2. Beach Live Cam - Conditional Test

```typescript
test("Beach page shows live cam above forecast", async ({ page }) => {
  await page.goto(`/beach/${TEST_BEACH_ID}`);

  const liveCamItem = page.locator('[data-testid="accordion-item-cams"]');
  const hasCam = (await liveCamItem.count()) > 0;

  if (!hasCam) {
    test.skip(true, "Test beach does not have camera_url");
  }

  // ... rest of test
});
```

---

## Summary Statistics

- **Total Failures**: 30
- **Quick Fixes Available**: 24 (beach search + live cam)
- **Requires Investigation**: 5 (landing page + routing + smoke)
- **Accessibility Issues**: 7 (pre-existing, needs design update)
- **Estimated Fix Time**: 2-3 hours total

---

## Next Steps

1. ✅ Fix beach search tests (guest mode) - 5 min
2. ✅ Fix live cam test (conditional) - 5 min
3. 🔍 Debug landing page tests - 30 min
4. 🔍 Debug routing tests - 20 min
5. 🔍 Debug smoke test - 5 min
6. ⚠️ Fix accessibility (color contrast) - 1 hour
7. ✅ Run full test suite to verify

**Total Time Estimate**: 2.5 hours
