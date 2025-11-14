# ForecastTab E2E Tests - Quick Start Guide

## 🚀 Quick Run Commands

```bash
# Run all forecast tab tests
yarn test:e2e e2e/beach-detail/forecast-tabs.spec.ts

# Run with UI (RECOMMENDED for debugging)
yarn test:e2e:ui e2e/beach-detail/forecast-tabs.spec.ts

# Run specific test suite
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Default Tab Behavior"

# Run in headed mode (see browser)
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --headed

# Run with debug mode
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --debug
```

## 📋 Prerequisites

1. **Authentication State**: Ensure you have valid auth state
   ```bash
   # If tests fail with auth errors, reset auth state
   yarn test:e2e:setup
   ```

2. **Development Server**: Start the dev server (if testing locally)
   ```bash
   yarn dev
   ```

3. **Environment Variables**: Ensure `.env.playwright` is configured
   ```bash
   BASE_URL=http://localhost:3000
   TEST_USER_EMAIL=your-test-user@email.com
   TEST_USER_PASSWORD=your-password
   ```

## 🧪 Test Structure Overview

```
ForecastTab - Tabbed Interface
├── Default Tab Behavior (4 tests)
│   ├── Today tab active on load
│   ├── Today content visible
│   ├── Tides/Conditions inactive
│   └── No Tides/Conditions content visible
│
├── Tab Switching (7 tests)
│   ├── Switch to Tides
│   ├── Tides content visible
│   ├── Today content hidden
│   ├── Switch to Conditions
│   ├── Conditions content visible
│   ├── Return to Today
│   └── Sequential switching
│
├── Today Tab Content (15 tests)
│   ├── Current Conditions section
│   ├── Metric cards (Tide, Wind, Swell)
│   ├── Tide, wind, swell data
│   ├── BestSurfWindow component
│   ├── 5-Day Outlook section
│   ├── Mini forecast cards
│   ├── Collapsible forecast button
│   ├── Expand detailed forecast
│   ├── Forecast transparency
│   └── Live Cam (conditional)
│
├── Tides Tab Content (4 tests)
│   ├── TideChart renders
│   ├── Canvas visualization
│   ├── Tide text/labels
│   └── Interactive elements
│
├── Conditions Tab Content (5 tests)
│   ├── ForecastTable renders
│   ├── Table rows present
│   ├── Table columns
│   ├── Forecast data cells
│   └── Wind information
│
├── Responsive Behavior (5 tests)
│   ├── Mobile viewport
│   ├── Tablet viewport
│   ├── Desktop viewport
│   ├── Mobile tab switching
│   └── Readable text all viewports
│
├── Keyboard Navigation (3 tests)
│   ├── Arrow key navigation
│   ├── Enter key activation
│   └── Space key activation
│
├── Accessibility (3 tests)
│   ├── ARIA attributes on tabs
│   ├── ARIA attributes on panels
│   └── Focus indicators
│
├── Error Handling (3 tests)
│   ├── Missing data handling
│   ├── No console errors
│   └── Rapid tab switching
│
└── Performance (2 tests)
    ├── Today tab load time
    └── Tab switch delay
```

## 🔍 Debugging Failed Tests

### 1. Use UI Mode (Easiest)
```bash
yarn test:e2e:ui e2e/beach-detail/forecast-tabs.spec.ts
```
- Time-travel debugging
- View DOM snapshots
- Inspect network requests
- See screenshots/videos

### 2. View Test Reports
```bash
# After test run, open HTML report
npx playwright show-report
```
- View traces for failed tests
- See screenshots
- Review step-by-step execution

### 3. Run Single Test
```bash
# Run just one test by name
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "should have Today tab active on page load"
```

### 4. Generate Verbose Logs
```bash
DEBUG=pw:api npx playwright test e2e/beach-detail/forecast-tabs.spec.ts
```

### 5. Check Screenshots
Failed tests automatically save screenshots to:
```
test-results/
└── forecast-tab-tabbed-interface-[test-name]/
    ├── test-failed-1.png
    └── trace.zip
```

## 🐛 Common Issues

### Issue: "Authentication timeout"
**Solution**: Reset auth state
```bash
yarn test:e2e:setup
```

### Issue: "Element not found"
**Cause**: Forecast data may not have loaded
**Solution**:
1. Check if beach has forecast data
2. Increase timeout in test
3. Verify network connectivity

### Issue: "Tab not switching"
**Cause**: Tab transition animation timing
**Solution**: Tests already have 500ms wait after click - may need to increase

### Issue: "Canvas not visible"
**Cause**: TideChart may not have rendered
**Solution**:
1. Check if forecast data includes tide information
2. Verify recharts library loaded
3. Check console for canvas rendering errors

### Issue: "Test flaky on CI"
**Cause**: Network latency or resource constraints
**Solution**:
1. Tests use proper waits (networkidle, visibility)
2. Increase timeout if needed
3. Check CI logs for resource issues

## 📊 Expected Test Results

### Passing Tests
- ✅ All 51 tests should pass with valid forecast data
- ✅ Total execution time: ~2-3 minutes
- ✅ No console errors
- ✅ All assertions pass

### Conditional Tests
- ⚠️ "Live Cam" tests may skip if beach has no camera
- ⚠️ Some content tests depend on forecast data availability

### Performance Benchmarks
- ✅ Today tab content loads in <3 seconds
- ✅ Tab switching completes in <1 second
- ✅ No visible lag or stutter

## 🎯 Test Focus Areas

### Critical Paths (Must Pass)
1. Default tab behavior (Today active on load)
2. Tab switching functionality
3. Current conditions display
4. 5-Day outlook rendering

### Important Paths (Should Pass)
1. Tides tab rendering
2. Conditions table display
3. Responsive behavior
4. Keyboard navigation

### Nice-to-Have (May Vary)
1. Live Cam display (conditional)
2. Specific forecast data values
3. Performance benchmarks (may vary by hardware)

## 📝 Test Data

### Beach Used
- **Primary**: Blacks Beach (La Jolla, CA)
- **ID**: `TEST_BEACH_IDS.blacks` from fixtures
- **Why**: Well-known beach with consistent forecast data

### Alternative Beaches
If Blacks Beach tests fail, try:
```typescript
// In test file, change:
await navigateToBeach(page, TEST_BEACH_IDS.birdrock);
// or
await navigateToBeach(page, TEST_BEACH_IDS.beacons);
```

## 🚦 CI/CD Integration

### Running in CI
Tests automatically run in GitHub Actions as part of the `auth` project:
```yaml
- name: Run Playwright tests
  run: npx playwright test --project=auth
```

### CI Test Retries
- Tests retry once on failure in CI
- Traces saved for failed tests
- HTML report uploaded as artifact

### Viewing CI Results
1. Go to GitHub Actions tab
2. Find your workflow run
3. Download `playwright-report` artifact
4. Unzip and open `index.html`

## 📚 Additional Resources

- **E2E Architecture**: `/e2e/ARCHITECTURE.md`
- **Component Source**: `/components/beach-detail/tabs/forecast-tab.tsx`
- **Test Helpers**: `/e2e/utils/test-helpers.ts`
- **Playwright Docs**: https://playwright.dev/docs/intro
- **Detailed README**: `/e2e/beach-detail/README.md`

## 💡 Tips for Success

1. **Always use UI mode for debugging** - saves tons of time
2. **Run tests frequently during development** - catch regressions early
3. **Check test traces** - they show exactly what happened
4. **Update tests when component changes** - keep tests in sync
5. **Write atomic tests** - one test, one assertion concept
6. **Use semantic selectors** - getByRole > getByTestId > CSS selectors
7. **Avoid hard delays** - use proper waits (networkidle, visibility)
8. **Test across viewports** - mobile users are 60% of traffic

## 🎓 Learning Resources

### Playwright Best Practices
- Use `getByRole()` for accessibility
- Wait for `networkidle` instead of `setTimeout()`
- Take screenshots on failure automatically
- Use trace viewer for debugging

### Test Architecture
- BeforeEach for setup (navigate, click tab)
- Describe blocks for grouping related tests
- Expect blocks with clear assertions
- Cleanup in afterEach if needed (usually automatic)

### Debugging Workflow
1. Run test in UI mode
2. Pause at failing step
3. Inspect DOM state
4. Check network requests
5. Verify element selectors
6. Fix and re-run

---

**Questions?** Check the main README or contact the test automation team.
