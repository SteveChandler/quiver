# Test Suite Documentation

This directory contains comprehensive unit tests for the Quiver surf app, focusing on the refactored components and server actions.

## Testing Strategy

### 1. Component Tests

We've broken down large components into smaller, focused pieces and created comprehensive tests for each:

#### Beach Detail Components

- `beach-header.test.tsx` - Tests the beach detail header component
- `beach-hero.test.tsx` - Tests the hero section with beach image and info
- `beach-quick-actions.test.tsx` - Tests the action buttons (Plan/Log Session)
- `todays-forecast.test.tsx` - Tests the forecast display component
- `beach-community.test.tsx` - Tests the community sessions section

#### Map Components

- `map-search-header.test.tsx` - Tests the search and view toggle functionality
- `map-display.test.tsx` - Tests the map display with overlays
- `map-image.test.tsx` - Tests the map image component

### 2. Server Action Tests

We've split large action files into focused modules and tested each:

#### Beach Actions

- `beach-query-actions.test.ts` - Tests basic beach CRUD operations
- `beach-location-actions.test.ts` - Tests distance calculations and nearby beach finding
- `beach-favorite-actions.test.ts` - Tests favorite beach management

#### System Tests

- `beach-cluster-cache.test.ts` - Comprehensive tests for the 4-hour caching system

### 3. Key Testing Features

#### Caching System Tests

The beach cluster cache tests ensure:

- ✅ 4-hour cache duration works correctly
- ✅ Cache invalidation functions properly
- ✅ Pacific Beach cluster identification is accurate
- ✅ Cache status reporting is correct
- ✅ Time-based expiration works as expected

#### Distance Calculation Tests

The location action tests verify:

- ✅ Haversine formula calculations are accurate
- ✅ Distance sorting works correctly
- ✅ Radius filtering functions properly
- ✅ Edge cases (poles, equator) are handled

#### Component Integration Tests

The component tests ensure:

- ✅ Props are handled correctly
- ✅ User interactions work as expected
- ✅ Accessibility standards are met
- ✅ Error states are handled gracefully
- ✅ Loading states display properly

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Suites

```bash
# Run only cache tests
npm test beach-cluster-cache

# Run only component tests
npm test components

# Run only action tests
npm test actions
```

## Test Structure

### Setup Files

- `setup/test-utils.tsx` - Common test utilities and mocks
- `jest.setup.js` - Jest configuration and global setup

### Mock Strategy

- **Supabase Client**: Fully mocked with configurable responses
- **Next.js Components**: Mocked Link, Image, and Router
- **Auth Context**: Mocked authentication state
- **Geolocation**: Mocked for location-based tests
- **Browser APIs**: Mocked matchMedia, IntersectionObserver

### Test Data

Consistent mock data is used across tests:

- `mockBeach` - Standard beach object
- `mockForecasts` - Sample forecast data
- `mockSession` - Sample session data

## Testing Principles

### 1. Isolation

Each test is isolated and doesn't depend on external services or other tests.

### 2. Realistic Scenarios

Tests cover real-world usage patterns and edge cases.

### 3. Error Handling

All error conditions and edge cases are tested.

### 4. Accessibility

Component tests include accessibility checks.

### 5. Performance

Tests ensure functions complete within reasonable time limits.

## Coverage Goals

We aim for:

- **90%+ statement coverage** for business logic
- **85%+ branch coverage** for conditional logic
- **80%+ function coverage** overall
- **100% coverage** for critical systems (caching, distance calculations)

## Best Practices

### Writing New Tests

1. Use descriptive test names that explain the scenario
2. Follow the Arrange-Act-Assert pattern
3. Test both success and failure cases
4. Include edge cases and boundary conditions
5. Mock external dependencies completely

### Component Testing

1. Test user interactions, not implementation details
2. Use semantic queries (getByRole, getByLabelText)
3. Test accessibility attributes
4. Verify proper error handling

### Action Testing

1. Mock Supabase responses appropriately
2. Test both success and error scenarios
3. Verify correct database queries are made
4. Test data transformation and validation

## Continuous Integration

These tests are designed to run in CI/CD pipelines and will:

- Run on every pull request
- Block merges if tests fail
- Generate coverage reports
- Run in parallel for speed

## Debugging Tests

### Common Issues

1. **Async operations**: Use proper async/await patterns
2. **DOM updates**: Use `waitFor` for async DOM changes
3. **Mock timing**: Ensure mocks are reset between tests
4. **Memory leaks**: Clean up event listeners and timers

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run single test file
npm test beach-cluster-cache.test.ts

# Debug specific test
npm test -- --testNamePattern="should cache data correctly"
```

This test suite provides comprehensive coverage of the refactored codebase and ensures the reliability of both the component architecture and the critical caching system.
