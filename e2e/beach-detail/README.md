# Beach Detail E2E Tests

This directory contains end-to-end tests for the Beach Detail page functionality, specifically focusing on the ForecastTab component with its tabbed interface.

## Test Files

### `forecast-tabs.spec.ts`

Comprehensive test suite for the ForecastTab component's tabbed interface, covering:

1. **Default Tab Behavior**
   - Verifies "Today" tab is active on page load
   - Ensures other tabs are inactive initially
   - Validates content visibility

2. **Tab Switching**
   - Tests switching between Today, Tides, and Conditions tabs
   - Verifies content changes appropriately
   - Validates tab active/inactive states

3. **Today Tab Content**
   - Current Conditions section (Tide, Wind, Swell metrics)
   - Live Cam section (conditional)
   - BestSurfWindow component
   - 5-Day Outlook with mini forecast cards
   - Collapsible detailed forecast table
   - Forecast transparency indicators

4. **Tides Tab Content**
   - TideChart component rendering
   - Canvas visualization
   - Interactive chart elements

5. **Conditions Tab Content**
   - SimplifiedForecastTable rendering
   - Table data validation
   - Column verification

6. **Responsive Behavior**
   - Mobile viewport (375x667)
   - Tablet viewport (768x1024)
   - Desktop viewport (1920x1080)
   - Layout adaptation verification

7. **Keyboard Navigation**
   - Arrow key navigation between tabs
   - Enter/Space key activation
   - Focus management

8. **Accessibility**
   - ARIA attributes validation
   - Tab roles verification
   - Focus indicators

9. **Error Handling**
   - Missing data gracefully handled
   - No console errors during tab switching
   - Rapid tab switching stability

10. **Performance**
    - Tab loading speed
    - Tab switching responsiveness

## Running the Tests

### Run All Beach Detail Tests

```bash
# Run all tests in the beach-detail directory
yarn test:e2e e2e/beach-detail/

# Or with Playwright CLI
npx playwright test e2e/beach-detail/
```

### Run Forecast Tab Tests Only

```bash
# Run only the forecast-tabs spec
yarn test:e2e e2e/beach-detail/forecast-tabs.spec.ts

# Or with Playwright CLI
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts
```

### Run Specific Test Suites

```bash
# Run only Default Tab Behavior tests
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Default Tab Behavior"

# Run only Tab Switching tests
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Tab Switching"

# Run only Responsive tests
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts -g "Responsive Behavior"
```

### Run with UI Mode (Recommended for Debugging)

```bash
# Open Playwright UI mode
yarn test:e2e:ui e2e/beach-detail/forecast-tabs.spec.ts

# Or
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --ui
```

### Run in Headed Mode

```bash
# See the tests run in a browser
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --headed
```

## Test Architecture

The forecast-tabs tests follow the established patterns from `/e2e/ARCHITECTURE.md`:

- **Authentication**: Uses authenticated state from `e2e/.auth/state.json`
- **Test Data**: Uses fixtures from `e2e/fixtures/test-data.ts`
- **Helper Functions**: Imports from `e2e/utils/test-helpers.ts` and `e2e/utils/auth-helpers.ts`
- **Waits**: Uses proper wait conditions (networkidle, visibility) instead of hard delays
- **Selectors**: Prioritizes semantic selectors (roles, labels) over CSS selectors

## Key Patterns

### beforeEach Setup

Each test navigates to a known beach (Blacks Beach) and switches to the Forecast tab:

```typescript
test.beforeEach(async ({ page }) => {
  await navigateToBeach(page, TEST_BEACH_IDS.blacks);

  const forecastTab = page.getByRole('tab', { name: /forecast/i });
  await forecastTab.click();

  await page.waitForLoadState('networkidle');
});
```

### Tab State Verification

Tests verify tab states using data attributes:

```typescript
// Active tab
await expect(todayTab).toHaveAttribute('data-state', 'active');

// Inactive tab
await expect(tidesTab).toHaveAttribute('data-state', 'inactive');
```

### Content Visibility

Tests ensure content switches properly:

```typescript
// Content should be visible
await expect(currentConditionsHeading).toBeVisible();

// Content should be hidden
await expect(currentConditionsHeading).not.toBeVisible();
```

### Responsive Testing

Tests validate behavior across viewports:

```typescript
await page.setViewportSize(VIEWPORTS.mobile);
await expect(todayTab).toBeVisible();
```

## Debugging Failed Tests

### View Test Traces

```bash
# Generate trace on failure
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --trace on

# Open trace viewer
npx playwright show-report
```

### Generate Screenshots

Tests automatically capture screenshots on failure. View them in:
```
test-results/
```

### Debug Mode

```bash
# Run tests in debug mode
npx playwright test e2e/beach-detail/forecast-tabs.spec.ts --debug
```

### Verbose Output

```bash
# Show detailed logs
DEBUG=pw:api npx playwright test e2e/beach-detail/forecast-tabs.spec.ts
```

## CI/CD Integration

These tests run automatically in the CI pipeline as part of the `auth` project:

```yaml
# In playwright.config.ts
{
  name: 'auth',
  testIgnore: ['e2e/guest-*.spec.ts'],
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'e2e/.auth/state.json'
  },
}
```

## Test Coverage Metrics

The forecast-tabs test suite provides:

- **Default Behavior**: 4 tests
- **Tab Switching**: 7 tests
- **Today Tab Content**: 15 tests
- **Tides Tab Content**: 4 tests
- **Conditions Tab Content**: 5 tests
- **Responsive Behavior**: 5 tests
- **Keyboard Navigation**: 3 tests
- **Accessibility**: 3 tests
- **Error Handling**: 3 tests
- **Performance**: 2 tests

**Total: 51 comprehensive tests**

## Known Limitations

1. **Live Cam Tests**: Conditional on beach having a camera - some tests may skip
2. **Forecast Data**: Tests assume forecast data is available - may fail on empty data
3. **Network Dependency**: Tests require active network connection for forecast loading
4. **Browser Compatibility**: Primarily tested on Chromium, may need adjustments for Firefox/Safari

## Future Enhancements

- [ ] Add tests for forecast modal interactions
- [ ] Add tests for buoy station link clicks
- [ ] Add tests for forecast data refresh button
- [ ] Add visual regression tests for chart rendering
- [ ] Add tests for forecast data source switching
- [ ] Add tests for tide prediction accuracy
- [ ] Add performance benchmarks for chart rendering

## Contributing

When adding new tests to this suite:

1. Follow the established test structure (describe blocks)
2. Use semantic selectors (getByRole, getByText) over CSS selectors
3. Add appropriate timeouts using TIMEOUTS constants
4. Include both positive and negative test cases
5. Ensure tests are atomic and independent
6. Document any conditional behavior
7. Update this README with new test descriptions

## Support

For questions or issues with these tests:

1. Check `/e2e/ARCHITECTURE.md` for general E2E patterns
2. Review `/components/beach-detail/tabs/forecast-tab.tsx` for component structure
3. Consult Playwright documentation: https://playwright.dev/docs/intro
4. Contact the QA team or test automation engineer
