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

### 📅 Session Planning Tests (`session-planning.spec.ts`) ✅ **RE-ENABLED**

- **Comprehensive Error Detection**: Tests now include infinite loop detection and React error tracking
- **API Failure Testing**: Verifies graceful handling of API endpoint failures
- **Component Interaction Testing**: Specifically tests GroupInvitationsSection for infinite loops
- Future session planning workflow
- Forecast data integration
- Condition preference settings
- Session reminder functionality
- Beach comparison features
- Planning form validation

### 🚨 Error Detection & Prevention Tests (`error-detection.spec.ts`) ✨ **NEW**

#### React Infinite Loop Detection

- Tests all critical pages (`/plan-session`, `/log-session`, `/profile`, `/`, `/map`) for infinite render loops
- Detects "Maximum update depth exceeded" errors
- Catches "Too many re-renders" issues
- Identifies hook dependency problems

#### API Failure Resilience

- Tests graceful handling of session planner API failures
- Verifies forecast API failure resilience
- Ensures beach search API failures don't crash the app
- Validates no infinite loops occur during network errors

#### Memory Leak Detection

- Monitors for memory leaks during navigation
- Detects unmounted component state updates
- Validates proper cleanup of subscriptions and effects

#### Component Error Boundaries

- Tests error boundary functionality
- Simulates component errors to verify graceful degradation
- Ensures unhandled errors don't crash the application

#### Hook Dependency Issues

- Detects useEffect dependency warnings
- Identifies critical hook errors that cause infinite loops
- Validates proper memoization patterns

#### Network Error Handling

- Tests timeout handling
- Validates network error recovery
- Ensures no render loops during slow API responses

### 🌊 Forecast Consistency Tests (`forecast-consistency.spec.ts`)

- **Cross-page forecast consistency**: Verifies home page and beach detail page show identical forecast data
- **Wave height consistency**: Ensures same wave height values across pages (critical regression test)
- **Search result consistency**: Validates forecast data remains consistent through search navigation
- **Multi-metric validation**: Tests wave height, wind speed, water temperature, and confidence scores
- **Time-aware selection**: Verifies both pages use the same forecast time selection logic

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

### 🎯 Beach Card Interaction Tests (`beach-card-interactions.spec.ts`)

- **Nearby Tab Interactions**: Review clicks, map clicks, navigation validation
- **Maps Page Interactions**: List view and nearby scroll review clicks

## 🛡️ Error Prevention Strategy

### How The Infinite Loop Bug Was Missed

The session planning tests were **completely skipped** (`.skip()`), meaning this critical user flow was never tested in CI/CD. The new error detection suite prevents this by:

1. **Always Running**: No `.skip()` allowed on critical user flows
2. **Comprehensive Error Tracking**: Catches React errors, infinite loops, and API failures
3. **Component-Level Testing**: Tests specific components that caused issues
4. **API Mocking**: Simulates failures to ensure graceful degradation

### New Error Detection Features

#### Automatic Infinite Loop Detection

```typescript
// Automatically detects these error patterns:
-"Maximum update depth exceeded" -
  "Too many re-renders" -
  "Rendered more hooks than during the previous render" -
  "Cannot update a component while rendering a different component";
```

#### API Failure Simulation

```typescript
// Tests API failures for critical endpoints:
- /api/session-planner/** (500 errors)
- /api/forecasts/** (timeout/failures)
- /api/beaches/** (search failures)
```

#### React Error Boundary Testing

```typescript
// Comprehensive error tracking:
- Page errors (JavaScript exceptions)
- Console errors (React warnings/errors)
- Unhandled promise rejections
- Component state errors
```

## 🚀 Running Tests

### Run All Tests

```bash
npx playwright test
```

### Run Specific Test Suites

```bash
# Error detection only
npx playwright test error-detection

# Session planning only (now enabled!)
npx playwright test session-planning

# Comprehensive error checking across all pages
npx playwright test error-detection --grep "infinite loops"
```

### Run Tests with Error Reporting

```bash
# Verbose error reporting
npx playwright test --reporter=html error-detection

# Debug mode with console output
npx playwright test --debug error-detection
```

## 🔧 Test Configuration

### Error Detection Setup

- **Timeout**: 5 seconds per page to catch infinite loops
- **Error Tracking**: Comprehensive console and page error monitoring
- **API Mocking**: Simulates real-world failure scenarios
- **Memory Monitoring**: Tracks component cleanup and memory usage

### Critical Page Coverage

All major user flows are tested for stability:

- Home page (`/`)
- Plan Session (`/plan-session`) 🎯 **Previously broken**
- Log Session (`/log-session`)
- Profile (`/profile`)
- Map/Beach Discovery (`/map`)

## 📊 Test Results

The enhanced test suite now provides:

- ✅ **Zero tolerance** for infinite loops
- ✅ **API failure resilience** verification
- ✅ **Component error boundary** validation
- ✅ **Memory leak** detection
- ✅ **Hook dependency** issue identification

This ensures that critical bugs like the Plan Session infinite loop will be caught **before** they reach production.

## 🎯 Continuous Improvement

### Future Enhancements

- Performance regression testing
- Accessibility compliance verification
- Cross-browser compatibility checks
- Mobile device testing expansion
- Load testing for high-traffic scenarios

### Monitoring & Alerts

- CI/CD integration with error detection
- Automated reporting of test failures
- Performance benchmark tracking
- Error trend analysis
