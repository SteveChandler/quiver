# QA Test Report: dev.quiversurf.app
**Test Date:** 2026-02-12
**Environment:** https://dev.quiversurf.app
**Tester:** QA Expert Agent
**Test Duration:** Phase 1 (Smoke Tests) completed

---

## Executive Summary

**DEPLOYMENT BLOCKING ISSUE DETECTED**

The dev environment has a critical configuration error preventing proper operation. While 23 smoke tests passed, 20 tests failed due to missing environment configuration, and forecast functionality shows regressions.

### Overall Status
- **Status:** FAIL - Deployment Blocking Issues Found
- **Tests Run:** 45 smoke tests
- **Tests Passed:** 23 (51%)
- **Tests Failed:** 20 (44%)
- **Tests Skipped:** 2 (4%)

### Critical Issues
1. **BLOCKER:** Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable in dev deployment
2. **REGRESSION:** Forecast "Current Conditions" heading missing on beach detail pages
3. **IMPACT:** Homepage functionality severely degraded (all authenticated home tests failing)

---

## Test Results by Phase

### Phase 1: Smoke Tests - FAILED

**Command:** `yarn test:e2e:smoke:dev`
**Result:** 23 passed, 20 failed, 2 skipped

#### Passed Tests (23)
**Guest/Unauthenticated Tests (7):**
- ✅ Features page loads without errors
- ✅ Beach detail page loads without errors
- ✅ Map page loads without errors
- ✅ 404 page renders gracefully
- ✅ Sitemap returns valid XML response
- ✅ OG image endpoint returns valid image
- ✅ Intent state page renders with heading and structured data

**Authenticated Tests (16):**
- ✅ Complete session planning flow with validation
- ✅ Error recovery during session planning
- ✅ Beach discovery flow with error handling
- ✅ Profile management with validation
- ✅ Concurrent operations stress test
- ✅ Multiple simultaneous errors recovery
- ✅ End-to-end performance validation
- ✅ Hub region guides load successfully
- ✅ Interactive map loads
- ✅ Sessions page loads
- ✅ Session wizard forecast rendering (no NaN values)
- ✅ SEO infrastructure (sitemap, OG images, metadata)
- ✅ Thin-content pages have proper noindex meta

#### Failed Tests (20)

**Root Cause:** Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable

All failures show the same error pattern:
```
[getBatchFreshForecastsFromCache] Unexpected error: Error: Supabase service role configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
```

**Failed Test Categories:**
1. **Guest Landing Page (1)**
   - Guest landing page display

2. **Coast Pulse Features (2)**
   - Coast Pulse infinite scroll initial load
   - Coast Pulse section with add button

3. **Home Page Tests (17)**
   - Layout and mobile responsiveness
   - Header animations (time slot icons, selection, buttons)
   - Hero recommendation display
   - Greeting section (time-appropriate greeting, action buttons)
   - Time slot filter (visibility, default selection)
   - Top spots carousel
   - 7-Day Outlook card
   - Section ordering

**Error Context:**
- Service role client cannot be created
- Forecast cache batch operations failing
- Homepage components dependent on forecast data cannot render properly

---

### Phase 2: Forecast Data Quality - FAILED

**Test File:** `e2e/beach-detail/forecast-tabs.spec.ts`
**Result:** 3 failed, 2 interrupted, 41 did not run

#### Failed Tests
1. ❌ "Today" tab active on page load - "Current Conditions" heading not visible
2. ❌ "Today" tab content displays immediately - "Current Conditions" heading not visible
3. ❌ "Tides" and "Conditions" tabs inactive on load - "Current Conditions" heading not visible

**Root Cause:** The forecast tab UI is missing the "Current Conditions" heading (h2 element). This is likely a regression from the recent "hybrid NOAA + Open-Meteo forecast merge" commit.

**Page Snapshot Analysis:**
- Beach detail page renders correctly (header, breadcrumbs, surf call)
- Forecast tab is visible and selectable
- "Today" tab is default selected
- Live cam section renders
- "Best Time to Surf Today" section renders
- **MISSING:** "Current Conditions" heading (h2) that tests expect
- Forecast data appears to be loading (surf call shows 3.2 ft, wind, tide info)

**Impact:** Forecast UI functionality regression. Tests are correctly failing due to missing UI element.

---

### Phase 3: Live Cam Embeds - NOT TESTED

**Reason:** No cam-specific tests found in `e2e/beach-detail.spec.ts` file

**Recommendation:** Manual visual inspection needed to validate the "skip embed preflight for known embeddable cam sources" fix for HDOnTap and YouTube cams.

---

### Phase 4: Coast Pulse & Intel - BLOCKED

**Status:** Cannot test due to environment configuration issues

**Failed Tests:**
- Coast Pulse infinite scroll initial load
- Coast Pulse section display

**Root Cause:** Same SUPABASE_SERVICE_ROLE_KEY missing error blocking Coast Pulse functionality

---

### Phase 5: Security (Bearer Token) - NOT TESTED

**Reason:** Environment configuration issues prevented security test execution

**Recommendation:** Run security tests after environment config is fixed

---

### Phase 6: Error Boundaries - NOT TESTED

**Reason:** Prioritized critical blocker investigation

**Recommendation:** Test error boundaries and ChunkLoadError handler after deployment fixes

---

### Phase 7: Visual Validation (Playwright MCP) - BLOCKED

**Status:** Playwright MCP browser failed to launch (conflict with existing Chrome session)

**Error:**
```
browserType.launchPersistentContext: Failed to launch the browser process.
Opening in existing browser session.
```

**Recommendation:** Manual browser inspection or use headed Playwright tests for visual validation

---

## Deployment-Blocking Issues

### 1. Missing SUPABASE_SERVICE_ROLE_KEY (CRITICAL)

**Severity:** BLOCKER
**Impact:** 20 smoke tests failing, homepage and forecast features broken
**Affected Areas:**
- Homepage (all authenticated user tests)
- Guest landing page
- Coast Pulse features
- Forecast data caching

**Evidence:**
```
[createServiceRoleClient] Supabase service role configuration missing.
Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
```

**Resolution Required:**
1. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel dev environment variables
2. Redeploy dev environment
3. Re-run smoke tests to validate fix

**Root Cause Analysis:**
The service role key is used by server-side forecast caching functions (`getBatchFreshForecastsFromCache`). This key is required for admin-level database operations that bypass RLS policies. The key is present in `.env.playwright` for testing but missing from the actual deployed dev environment.

---

### 2. Forecast UI Regression - Missing "Current Conditions" Heading (HIGH)

**Severity:** HIGH
**Impact:** 3 forecast tab tests failing, UI component missing
**Affected Areas:**
- Beach detail page forecast tabs
- "Today" tab content display

**Evidence:**
- Test expects: `getByRole('heading', { name: 'Current Conditions', exact: true, level: 2 })`
- Page snapshot shows: Live Cam section, Best Time to Surf section, but NO "Current Conditions" h2 heading

**Related Commit:** "fix: hybrid NOAA + Open-Meteo forecast merge for accurate extended swell data"

**Hypothesis:** The forecast data merge refactor may have removed or renamed the "Current Conditions" section heading component.

**Resolution Required:**
1. Code review: Check `/components` and `/app/[intent]/[city]/[beachSlug]` for forecast tab rendering
2. Identify if "Current Conditions" heading was intentionally removed or accidentally deleted
3. If removed: Update E2E tests to match new UI
4. If accidental: Restore heading component
5. Validate forecast data is still rendering correctly

---

## Non-Blocking Issues

### Minor Issues Observed
1. **Test Cleanup Performance:** Global teardown cleaned 31 test items (19 intel posts, 12 sessions) - cleanup is working correctly
2. **Mock Users Proliferation:** 24 mock/test users found in database - normal for test environment

---

## Recommendations

### Immediate Actions (Pre-Merge)
1. **FIX BLOCKER:** Add SUPABASE_SERVICE_ROLE_KEY to dev environment (Vercel dashboard)
2. **INVESTIGATE REGRESSION:** Review forecast tab UI changes and restore "Current Conditions" heading
3. **RE-RUN SMOKE TESTS:** After environment fix, re-run full smoke test suite
4. **MANUAL CAM TEST:** Visually inspect HDOnTap and YouTube cam embeds on beach detail pages

### Follow-Up Actions (Post-Fix)
1. Run targeted forecast quality tests (`e2e/beach-detail/forecast-tabs.spec.ts`)
2. Run Coast Pulse tests (`e2e/coast-pulse-*.spec.ts`)
3. Run security tests (`e2e/rate-limiting.spec.ts`, `e2e/error-boundaries.spec.ts`)
4. Visual validation of key pages (homepage, beach detail, forecast hub, coast pulse)
5. Performance audit (Lighthouse scores)

### Process Improvements
1. **Environment Parity Check:** Add pre-deployment verification that dev environment has all required secrets
2. **UI Component Testing:** Consider snapshot testing for critical UI components to catch regressions
3. **Forecast Data Validation:** Add integration tests for forecast data merge logic

---

## Test Environment Details

**Configuration:**
- Base URL: https://dev.quiversurf.app
- Supabase: Production instance (vawdnbbgawichorsjiwe.supabase.co)
- Test User: stcha0004@gmail.com
- Vercel Bypass: Enabled (VERCEL_AUTOMATION_BYPASS_SECRET present)
- Test Framework: Playwright 1.52.0
- Workers: 3 parallel workers

**Authentication:**
- ✅ Global setup authentication successful
- ✅ Auth state saved to `e2e/.auth/state.json`
- ✅ 2 Supabase auth cookies present
- ✅ Auth persistence working correctly

---

## Conclusion

**RECOMMENDATION: DO NOT MERGE TO PRODUCTION**

The dev environment has critical configuration issues that must be resolved before deployment. The missing SUPABASE_SERVICE_ROLE_KEY is causing widespread test failures and would break production functionality.

**Pass/Fail Criteria:**
- ❌ Smoke tests: 51% pass rate (target: >95%)
- ❌ Environment configuration: Missing critical secret
- ❌ Forecast functionality: UI regression detected
- ✅ SEO infrastructure: Working correctly
- ✅ Authentication: Working correctly
- ✅ Critical flows: Session planning, beach discovery functional

**Next Steps:**
1. Fix environment configuration (add SUPABASE_SERVICE_ROLE_KEY)
2. Investigate and fix forecast UI regression
3. Re-run full test suite
4. Generate updated QA report with all-clear status

**Estimated Time to Fix:** 30-60 minutes (environment config + UI fix)

---

## Appendix: Test Execution Logs

**Smoke Test Summary:**
```
45 tests total
23 passed (51%)
20 failed (44%)
2 skipped (4%)
Test duration: 1.9 minutes
```

**Forecast Test Summary:**
```
46 tests total
0 passed
3 failed
2 interrupted
41 did not run (stopped after 3 failures)
Test duration: 39.4 seconds (first failure)
```

**Failed Test Pattern (Example):**
```
Error: [getBatchFreshForecastsFromCache] Unexpected error:
Error: Supabase service role configuration missing.
Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.

at utils/error-detection.ts:222
at assertNoErrors
```

---

**Report Generated:** 2026-02-12
**QA Agent:** qa-expert (Claude Sonnet 4.5)
**Test Artifacts:** `/Users/stevenchandler/Desktop/quiver/test-results/`
