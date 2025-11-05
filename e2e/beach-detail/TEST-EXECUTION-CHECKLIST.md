# ForecastTab E2E Test Execution Checklist

Use this checklist to manually verify test coverage and validate test execution.

## Pre-Execution Checklist

### Environment Setup
- [ ] Development server running (`yarn dev`)
- [ ] Authentication state valid (`e2e/.auth/state.json` exists)
- [ ] Environment variables configured (`.env.playwright`)
- [ ] Dependencies installed (`yarn install`)
- [ ] Playwright browsers installed (`npx playwright install`)

### Test Data Verification
- [ ] Blacks Beach exists in database
- [ ] Beach has forecast data available
- [ ] Forecast data is recent (<24 hours old)
- [ ] Beach detail page loads successfully
- [ ] Forecast tab is clickable and functional

## Test Execution

### Quick Smoke Test (5 minutes)
```bash
# Run a few key tests to verify setup
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Default Tab Behavior"
```

**Expected Result**: All 4 tests pass
- [ ] Today tab active on load ✅
- [ ] Today content visible ✅
- [ ] Tides/Conditions inactive ✅
- [ ] Other tab content hidden ✅

### Full Suite Execution (2-3 minutes)
```bash
# Run all 48 tests
yarn test:e2e e2e/beach-detail/forecast-tabs.spec.ts
```

**Expected Results**: All tests pass
- [ ] Default Tab Behavior: 4/4 ✅
- [ ] Tab Switching: 7/7 ✅
- [ ] Today Tab Content: 15/15 ✅
- [ ] Tides Tab Content: 4/4 ✅
- [ ] Conditions Tab Content: 5/5 ✅
- [ ] Responsive Behavior: 5/5 ✅
- [ ] Keyboard Navigation: 3/3 ✅
- [ ] Accessibility: 3/3 ✅
- [ ] Error Handling: 3/3 ✅
- [ ] Performance: 2/2 ✅

## Manual Verification

### Tab Functionality
Navigate to Blacks Beach → Click Forecast tab

#### Today Tab (Default)
- [ ] Tab is active (highlighted/selected state)
- [ ] Current Conditions section visible
- [ ] Metric cards display: Tide, Wind, Swell
- [ ] Tide card shows: type (High/Low), height, time
- [ ] Wind card shows: speed, direction
- [ ] Swell card shows: height, period, direction
- [ ] Live Cam section (if beach has camera)
- [ ] BestSurfWindow component visible
- [ ] 5-Day Outlook heading visible
- [ ] Mini forecast cards (3-5 days)
- [ ] "View Detailed 5-Day Forecast" button visible
- [ ] Clicking button expands forecast table
- [ ] Forecast transparency section at top
- [ ] Data source indicator visible
- [ ] Freshness badge visible

#### Tides Tab
- [ ] Click "Tides" tab
- [ ] Tab becomes active
- [ ] Today tab becomes inactive
- [ ] TideChart canvas renders
- [ ] Chart shows tide curve
- [ ] Tide labels/times visible
- [ ] Chart is interactive (hover shows values)
- [ ] Today content is hidden

#### Conditions Tab
- [ ] Click "Conditions" tab
- [ ] Tab becomes active
- [ ] SimplifiedForecastTable renders
- [ ] Table has header row
- [ ] Table has data rows
- [ ] Columns visible: Time, Wave, Wind, etc.
- [ ] Wave heights display (e.g., "3.5 ft")
- [ ] Wind data displays (e.g., "10 mph W")
- [ ] Tides content is hidden

#### Return to Today
- [ ] Click "Today" tab
- [ ] Tab becomes active again
- [ ] Today content visible again
- [ ] Conditions content hidden

### Responsive Behavior

#### Mobile (375x667)
- [ ] Set viewport to mobile
- [ ] All three tabs visible
- [ ] Tabs stack or wrap appropriately
- [ ] Tab switching works
- [ ] Content is readable (no overflow)
- [ ] Metric cards stack vertically
- [ ] Mini forecast cards scroll horizontally
- [ ] Forecast table scrolls horizontally

#### Tablet (768x1024)
- [ ] Set viewport to tablet
- [ ] Tabs display in single row
- [ ] Content uses medium grid layout
- [ ] Metric cards in row (may wrap)
- [ ] Mini forecast cards in grid
- [ ] All content readable

#### Desktop (1920x1080)
- [ ] Set viewport to large desktop
- [ ] Tabs display in single row
- [ ] Content uses wide layout
- [ ] Metric cards in single row
- [ ] Mini forecast cards in single row
- [ ] Optimal spacing and padding

### Keyboard Navigation
- [ ] Tab key focuses tabs
- [ ] Arrow Right moves to next tab
- [ ] Arrow Left moves to previous tab
- [ ] Enter activates focused tab
- [ ] Space activates focused tab
- [ ] Focus indicators visible
- [ ] Tab order is logical

### Accessibility
- [ ] Screen reader announces tab role
- [ ] Active tab has aria-selected="true"
- [ ] Tab panels have correct ARIA labels
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Semantic HTML structure

### Performance
- [ ] Today tab content loads <3 seconds
- [ ] Tab switching feels instant (<1 second)
- [ ] No visible lag or stutter
- [ ] No console errors
- [ ] No memory leaks (check DevTools)
- [ ] Smooth animations

### Error Handling
- [ ] Rapid clicking tabs doesn't break UI
- [ ] Missing forecast data handled gracefully
- [ ] Network errors display user-friendly message
- [ ] No JavaScript errors in console
- [ ] State remains consistent after errors

## Post-Execution Verification

### Test Results
- [ ] All tests passed (51/51)
- [ ] No flaky tests observed
- [ ] Test execution time: ~2-3 minutes
- [ ] HTML report generated
- [ ] Screenshots saved (if failures)
- [ ] Traces available (if failures)

### Quality Checks
- [ ] No console errors during tests
- [ ] No warnings in test output
- [ ] Test coverage report generated
- [ ] Performance benchmarks met
- [ ] Accessibility tests passed

### CI/CD Integration
- [ ] Tests run successfully in CI
- [ ] Test reports uploaded as artifacts
- [ ] No timeouts or hanging tests
- [ ] Retry mechanism works correctly
- [ ] GitHub Actions workflow passes

## Known Conditional Tests

### Live Cam Tests
**May skip if beach has no camera**
- This is expected behavior
- Test validates conditional rendering
- Passes if camera section not shown

### Forecast Data Tests
**May fail if no forecast data**
- Check if forecast data exists in database
- Verify forecast freshness (<24 hours)
- Re-run forecast generation if needed

## Troubleshooting

### If Tests Fail

#### Authentication Issues
```bash
# Reset auth state
yarn test:e2e:setup
```

#### Network Issues
- Check internet connection
- Verify BASE_URL is accessible
- Check if Supabase is responding

#### Data Issues
- Verify beach exists in database
- Check forecast data is available
- Ensure forecast is recent

#### Element Not Found
- Check if component structure changed
- Verify selectors are still valid
- Update test if component updated

#### Timing Issues
- Check network latency
- Increase timeouts if needed
- Verify waits are appropriate

## Success Criteria

### All Tests Pass
- ✅ 51/51 tests passing
- ✅ <1% flake rate observed
- ✅ No console errors
- ✅ Performance benchmarks met
- ✅ Accessibility standards met

### Documentation Complete
- ✅ README.md covers all tests
- ✅ QUICKSTART.md helps new users
- ✅ TEST-SUMMARY.md documents implementation
- ✅ CHANGELOG.md updated

### Production Ready
- ✅ Can run in CI/CD
- ✅ Reliable and maintainable
- ✅ Well documented
- ✅ Follows best practices

## Sign-Off

**Test Suite**: ForecastTab E2E Tests
**Total Tests**: 48 test cases + 3 beforeEach setups
**Coverage**: >80% of component functionality
**Status**: ☐ Ready for Review | ☐ Approved | ☐ Deployed

**Tested By**: _________________
**Date**: _________________
**Test Environment**: ☐ Local | ☐ Dev | ☐ Staging | ☐ CI
**All Tests Passed**: ☐ Yes | ☐ No (see notes)

**Notes**:
```
[Add any observations, issues, or recommendations here]
```

**Reviewer**: _________________
**Review Date**: _________________
**Approved for CI/CD**: ☐ Yes | ☐ No

---

**Quick Reference Commands**:
```bash
# Smoke test (quick)
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Default Tab Behavior"

# Full suite
yarn test:e2e e2e/beach-detail/forecast-tabs.spec.ts

# UI mode (debugging)
yarn test:e2e:ui e2e/beach-detail/forecast-tabs.spec.ts

# Headed mode (watch)
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --headed

# Debug mode
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --debug
```
