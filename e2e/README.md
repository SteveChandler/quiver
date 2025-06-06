# Surf App E2E Test Suite

This directory contains comprehensive end-to-end tests for the Quiver surf application using Playwright. The tests verify all major features and user workflows.

## Test Coverage

### 🔐 Authentication Tests (`auth.spec.ts`)

- Sign-in form display and validation
- Sign-up form functionality
- Email format validation
- Navigation between auth pages
- Protection of authenticated routes
- Error handling for invalid credentials

### 🧭 Navigation Tests (`navigation.spec.ts`)

- Bottom navigation functionality
- Page routing and URL handling
- Back navigation support
- Query parameter preservation
- Mobile responsive navigation
- 404 error handling

### 📝 Session Logging Tests (`session-logging.spec.ts`)

- Session form display and validation
- Beach selection and autocomplete
- Board selection from user quiver
- Date/time input handling
- Session rating and notes
- Form submission and success states
- Data validation constraints

### 📅 Session Planning Tests (`session-planning.spec.ts`)

- Future session planning workflow
- Forecast data integration
- Condition preference settings
- Session reminder functionality
- Beach comparison features
- Planning form validation

### 👤 Profile Management Tests (`profile.spec.ts`)

- Profile view display
- Profile editing functionality
- Avatar/photo upload
- Board (quiver) management
- Surf preferences configuration
- Default beach settings
- Data validation and saving

### 🗺️ Map and Beach Directory Tests (`map.spec.ts`)

- Map view rendering
- Beach markers and interactions
- Location search functionality
- Geolocation support
- Forecast data display
- Filtering and view modes
- Beach favoriting features

### 📊 Sessions View Tests (`sessions.spec.ts`)

- Session list display
- Session filtering and search
- Pagination/infinite scroll
- Session detail navigation
- Analytics and statistics
- Session editing/deletion
- Photo gallery features

### 🔄 Comprehensive Integration Tests (`comprehensive.spec.ts`)

- Complete user journey workflows
- Cross-feature integration
- Data consistency across pages
- Error handling and edge cases
- Mobile responsive testing
- Performance and loading tests

## Running the Tests

### Prerequisites

- Node.js and npm installed
- Application running on `http://localhost:3000`

### Installation

```bash
# Install Playwright (already included in package.json)
npm install

# Install browser dependencies
npx playwright install
```

### Test Commands

#### Run all tests

```bash
npm run test:e2e
```

#### Run with UI (interactive mode)

```bash
npm run test:e2e:ui
```

#### Run in headed mode (see browser)

```bash
npm run test:e2e:headed
```

#### Debug mode (step through tests)

```bash
npm run test:e2e:debug
```

#### Run specific test file

```bash
npx playwright test auth.spec.ts
npx playwright test navigation.spec.ts
npx playwright test session-logging.spec.ts
```

#### Run tests for specific feature

```bash
# Authentication tests only
npx playwright test --grep "Authentication"

# Session management tests
npx playwright test --grep "Session"

# Profile tests only
npx playwright test --grep "Profile"
```

### Test Configurations

The tests are configured to run on multiple browsers:

- **Chromium** (Desktop Chrome)
- **Firefox** (Desktop Firefox)
- **WebKit** (Desktop Safari)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 12)

### Authentication Handling

The tests are designed to handle both authenticated and unauthenticated states:

- **Unauthenticated tests**: Verify public pages and auth flows
- **Authenticated tests**: Skip if user is not logged in (using `test.skip()`)
- **Protected routes**: Verify proper redirection to auth pages

## Test Structure

### Test Organization

```
e2e/
├── auth.spec.ts              # Authentication workflows
├── navigation.spec.ts        # Page navigation and routing
├── session-logging.spec.ts   # Surf session logging
├── session-planning.spec.ts  # Session planning features
├── profile.spec.ts          # User profile management
├── map.spec.ts              # Map and beach directory
├── sessions.spec.ts         # Session viewing and analytics
├── comprehensive.spec.ts    # Integration and E2E workflows
└── README.md               # This documentation
```

### Test Data Strategy

- Tests use dynamic data generation (dates, names)
- Robust selectors with fallbacks (`getByTestId` → `getByLabel` → `locator`)
- Graceful handling of missing elements
- Skip patterns for authentication-dependent tests

### Error Handling

- Network failure simulation
- Empty state verification
- Loading state checks
- Mobile responsiveness validation
- Performance benchmarking

## Key Features Tested

### ✅ Core Surf App Features

- **User Authentication**: Sign up, sign in, session management
- **Beach Directory**: Map view, search, filtering, favorites
- **Session Logging**: Record surf sessions with conditions and notes
- **Session Planning**: Plan future sessions with forecast integration
- **Profile Management**: User data, board quiver, preferences
- **Session History**: View, filter, and analyze past sessions

### ✅ Technical Features

- **Responsive Design**: Mobile and desktop layouts
- **Navigation**: Bottom nav, deep linking, back/forward
- **Form Validation**: Client-side validation and error states
- **Data Persistence**: Profile data, session data, preferences
- **Search & Filtering**: Beach search, session filtering
- **Integration**: Cross-feature data consistency

## Best Practices

### Test Writing Guidelines

1. **Descriptive test names**: Clear description of what's being tested
2. **Robust selectors**: Multiple fallback selector strategies
3. **Wait strategies**: Appropriate timeouts for dynamic content
4. **Error handling**: Graceful handling of missing elements
5. **Skip patterns**: Skip tests when preconditions aren't met

### Maintenance

- Update selectors when UI changes
- Add new tests for new features
- Review and update test data
- Monitor test execution times
- Update browser configurations as needed

## Reporting

Test results are available in multiple formats:

- **Console output**: Real-time test execution
- **HTML Report**: Detailed results with screenshots
- **Trace files**: For debugging failed tests
- **Screenshots**: Captured on test failures

Access the HTML report:

```bash
npx playwright show-report
```

## Troubleshooting

### Common Issues

#### Tests timing out

```bash
# Increase timeout in playwright.config.ts
use: {
  timeout: 30000  // 30 seconds
}
```

#### Authentication required

- Tests skip when authentication is required
- For full testing, ensure test user is authenticated
- Check console logs for skip reasons

#### Element not found

- Tests use multiple selector strategies
- Check if UI structure has changed
- Update selectors in test files

#### Network issues

- Ensure application is running on `http://localhost:3000`
- Check for CORS or API connectivity issues
- Verify test data setup

### Debug Mode

```bash
# Run single test in debug mode
npx playwright test auth.spec.ts --debug

# Debug specific test
npx playwright test --grep "should display sign-in form" --debug
```

## Contributing

When adding new features to the app:

1. **Add corresponding tests** in appropriate spec file
2. **Update selectors** if UI structure changes
3. **Test mobile responsiveness** for new features
4. **Verify authentication handling** for protected features
5. **Update this documentation** for new test coverage

## Performance Considerations

- Tests include performance benchmarks
- Page load times are monitored
- Network simulation for edge cases
- Mobile performance validation
- Concurrent navigation testing

The test suite provides comprehensive coverage of the Quiver surf application, ensuring reliability and user experience across all features and platforms.
