# Component Testing with Playwright

## Overview

We've converted problematic Jest tests to Playwright tests for better reliability with complex UI components, especially those using Radix UI. Playwright tests run in a real browser environment, eliminating mocking issues and providing more realistic testing.

## Converted Tests

### From Jest to Playwright

1. **ForecastFeedbackForm** → `e2e/forecast-components.spec.ts`

   - **Issues Fixed**: Radix UI slider interactions, multiple element selection errors
   - **Benefits**: Real slider interactions, proper dropdown selections, no mocking required

2. **ForecastTab** → `e2e/forecast-components.spec.ts`

   - **Issues Fixed**: useRouter mocking problems, navigation issues
   - **Benefits**: Real navigation testing, actual router behavior

3. **Component Interactions** → `e2e/component-interactions.spec.ts`
   - **Issues Fixed**: Form validation, modal interactions, state management
   - **Benefits**: Real user interactions, proper async handling

## Running Playwright Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Component Tests

```bash
# Forecast components only
npx playwright test forecast-components.spec.ts

# Component interactions only
npx playwright test component-interactions.spec.ts

# Run with UI mode for debugging
npx playwright test --ui
```

### Debug Mode

```bash
npm run test:e2e:debug
```

## Test Structure

### forecast-components.spec.ts

- **ForecastTab Component**: Display, confidence levels, navigation
- **ForecastFeedbackForm Component**: Form interactions, sliders, dropdowns
- **Adjusted Forecast Display**: Tooltips, forecast adjustments
- **Forecast Navigation**: Date navigation, tab switching

### component-interactions.spec.ts

- **Router and Navigation**: Page navigation, browser back/forward
- **Form Component Interactions**: Complex forms, validation, async operations
- **UI State Management**: Modals, loading states, error handling
- **Accessibility**: Keyboard navigation, ARIA compliance

## Advantages Over Jest Tests

### 1. **Real Browser Environment**

- No synthetic events or mocking required
- Actual DOM interactions
- True async behavior

### 2. **Radix UI Compatibility**

- Real focus management
- Proper keyboard navigation
- No "multiple elements found" errors

### 3. **Better User Simulation**

- Real mouse and keyboard events
- Actual network requests (can be intercepted if needed)
- True responsive behavior

### 4. **Debugging Features**

- Visual test runner
- Screenshots on failure
- Step-by-step execution
- Network monitoring

## Disabled Jest Tests

The following Jest tests have been disabled (renamed to `.disabled`) because they had issues with Radix UI components:

- `__tests__/components/forecast/forecast-feedback-form.test.tsx.disabled`
- `__tests__/components/home-screen/forecast-tab.test.tsx.disabled`

## Best Practices

### 1. **Wait for Elements**

```typescript
await waitForElementReady(element);
```

### 2. **Use Specific Selectors**

```typescript
// Good - specific and reliable
page.locator('[data-testid="forecast-card"]');
page.locator('button:has-text("Save Session")');

// Avoid - too generic
page.locator("button").first();
```

### 3. **Handle Async Operations**

```typescript
await page.waitForTimeout(500); // For animations
await page.waitForLoadState("load"); // For page loads
```

### 4. **Test Real User Flows**

```typescript
// Fill form like a real user
await beachInput.fill("La Jolla Shores");
await page.waitForTimeout(500);
await suggestionList.first().click();
```

## Configuration

Tests are configured in `playwright.config.ts`:

- **Timeout**: 2 minutes per test
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Authentication**: Uses stored auth state

## CI/CD Integration

Playwright tests run in CI alongside Jest tests:

- Jest tests: Unit tests, simple component tests
- Playwright tests: Complex component interactions, E2E flows

## Troubleshooting

### Common Issues

1. **Test Timeouts**

   - Increase timeout in test or config
   - Add more specific waits

2. **Element Not Found**

   - Use `waitForElementReady()`
   - Check if element is conditionally rendered

3. **Flaky Tests**
   - Add appropriate waits
   - Use more specific selectors
   - Check for race conditions

### Debug Commands

```bash
# Run with verbose output
npx playwright test --reporter=line

# Run headed (visible browser)
npx playwright test --headed

# Run specific test with debug
npx playwright test forecast-components.spec.ts:10 --debug
```

## Future Additions

When adding new component tests:

1. **Consider Playwright first** for:

   - Complex UI interactions
   - Forms with multiple inputs
   - Components using Radix UI
   - Navigation testing

2. **Use Jest for**:
   - Pure function testing
   - Simple component rendering
   - Mocked API responses
   - Unit tests

This hybrid approach gives us the best of both worlds: fast unit tests with Jest and reliable integration tests with Playwright.
