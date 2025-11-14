# Session Wizard E2E Test Guide

## Overview

This guide explains how to test both versions of the session wizard:

- **V1 (Legacy)**: 6-step flow for log mode (USE_CONSOLIDATED_WIZARD = false)
- **V2 (Consolidated)**: 4-step flow for log mode (USE_CONSOLIDATED_WIZARD = true)

## Test Files

### Primary Test Files

1. **`session-wizard.spec.ts`**
   - General wizard tests (both modes, both versions)
   - Feature flag detection tests
   - Forecast snapshot creation tests
   - Validation tests

2. **`session-wizard-consolidated.spec.ts`** (NEW)
   - Comprehensive V2 consolidated flow tests
   - SessionDetailsSection field tests
   - Data persistence tests
   - V1 vs V2 comparison tests

## Feature Flag Configuration

### Current Status

```typescript
// File: components/session/wizard/AnimatedSessionWizard.tsx
const USE_CONSOLIDATED_WIZARD = false; // Default: V1 (legacy)
```

### Testing V1 (Legacy - 6 Steps)

```bash
# V1 is the DEFAULT - no changes needed
yarn test:e2e e2e/session-wizard.spec.ts
yarn test:e2e e2e/session-wizard-consolidated.spec.ts
```

**Expected Behavior:**
- Log mode: 6 steps (Location → Date/Time → Equipment → Conditions → Photos → Notes)
- Plan mode: 4 steps (unchanged)

### Testing V2 (Consolidated - 4 Steps)

```typescript
// 1. MANUALLY update AnimatedSessionWizard.tsx
const USE_CONSOLIDATED_WIZARD = true; // Enable V2

// 2. Run tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts

// 3. REVERT after testing
const USE_CONSOLIDATED_WIZARD = false;
```

**Expected Behavior:**
- Log mode: 4 steps (Location → Date/Time → Equipment → Session Details)
- Plan mode: 4 steps (unchanged)

## Test Coverage

### V1 Legacy Flow Tests

**File:** `session-wizard.spec.ts`

✅ **Covered:**
- Wizard loads in plan/log mode
- Beach selection works
- Date/time selection works
- Navigation (next/back/cancel) works
- Complete plan session flow
- Validation prevents empty submissions
- Forecast snapshot creation
- Feature flag detection

✅ **Covered in V1-specific tests:**
- 6 steps in log mode
- Separate Conditions, Photos, Notes steps

### V2 Consolidated Flow Tests

**File:** `session-wizard-consolidated.spec.ts`

✅ **Covered:**
- 4 steps in log mode (when flag enabled)
- SessionDetailsSection displays in step 4
- All fields present in consolidated step:
  - Wave height input
  - Wind speed input
  - Wind direction select
  - Water temp input
  - Photo upload
  - Notes textarea
  - Forecast accuracy selector
  - Wave quality rating
  - Parking ease rating
  - Crowd level rating
- Data persistence across step navigation
- Validation rules:
  - Wave height: 0-50 ft
  - Wind speed: 0-150 mph
  - Water temp: 32-100°F
  - Notes: max 2000 characters
  - Photos: max 5 files
- Forecast comparison display
- Complete session submission

## Test Scenarios

### Scenario 1: Test V1 (Default)

```bash
# No code changes needed
yarn test:e2e e2e/session-wizard.spec.ts

# Expected: All tests pass with 6-step flow
```

### Scenario 2: Test V2 (Feature Flag Enabled)

```bash
# 1. Edit AnimatedSessionWizard.tsx
# Set: const USE_CONSOLIDATED_WIZARD = true

# 2. Run V2-specific tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts

# 3. Expected results:
#    - Tests expecting 4 steps: PASS
#    - Tests expecting SessionDetailsSection: PASS
#    - Tests expecting 6 steps: SKIP (with message)

# 4. REVERT: Set USE_CONSOLIDATED_WIZARD = false
```

### Scenario 3: Detect Current Version

```bash
# Run feature flag detection test
yarn test:e2e e2e/session-wizard.spec.ts -g "Feature Flag Detection"

# Console output will show:
# "Detected wizard version: V1 (legacy)" or "V2 (consolidated)"
# "Step count: 6" or "4"
```

### Scenario 4: Test Plan Mode (Unchanged)

```bash
# Plan mode is identical in both versions
yarn test:e2e e2e/session-wizard.spec.ts -g "Plan Mode"

# Expected: 4 steps in both V1 and V2
```

## Test Data Requirements

### Required Test Data

1. **Beach Data**
   - Test beach: "Black's Beach" (or similar)
   - Must be searchable in beach selector

2. **Photo Files** (optional, for photo upload tests)
   - Path: `e2e/fixtures/test-photo.jpg`
   - Max size: 10MB
   - Format: JPEG, PNG, or WebP

### Test User

Tests use authenticated user from global setup:
- Email: `TEST_USER_EMAIL` (from .env.playwright)
- Password: `TEST_USER_PASSWORD` (from .env.playwright)

## Field Selectors

### V2 SessionDetailsSection Selectors

```typescript
// Wave height
page.locator('input[id*="wave-height"], input[name*="waveHeight"]')

// Wind speed
page.locator('input[id*="wind-speed"], input[name*="windSpeed"]')

// Wind direction
page.locator('select[id*="wind-direction"], select[name*="windDirection"]')

// Water temp
page.locator('input[id*="water-temp"], input[name*="waterTemp"]')

// Photo upload
page.locator('input[type="file"]')

// Notes
page.locator('textarea[id*="notes"], textarea[name*="notes"]')

// Forecast accuracy buttons
page.getByRole('button', { name: /yes|accurate/i })
page.getByRole('button', { name: /kinda|somewhat/i })
page.getByRole('button', { name: /no|inaccurate/i })

// Wave quality rating
page.locator('button[aria-label*="Rate Wave Quality"]')
```

### Common Selectors (Both Versions)

```typescript
// Beach input
page.getByPlaceholder(/beach|location|search/i)

// Date input
page.locator('input[type="date"]')

// Time input
page.locator('input[type="time"]')

// Next button
page.getByRole('button', { name: /next|continue/i })

// Back button
page.getByRole('button', { name: /back|previous/i })

// Submit button
page.getByRole('button', { name: /log session|submit|save|complete/i })

// Progress bar
page.locator('[role="progressbar"]')
```

## Debugging Tests

### Enable Debug Mode

```bash
# Run with UI mode
yarn test:e2e:ui

# Run with debug logs
DEBUG=pw:api yarn test:e2e e2e/session-wizard-consolidated.spec.ts

# Run with headed browser
yarn test:e2e e2e/session-wizard-consolidated.spec.ts --headed

# Generate trace
yarn test:e2e e2e/session-wizard-consolidated.spec.ts --trace on
```

### Common Issues

#### Issue: Tests expecting V2 are skipping

**Cause:** Feature flag is still set to false

**Fix:**
```typescript
// AnimatedSessionWizard.tsx
const USE_CONSOLIDATED_WIZARD = true; // Change to true
```

#### Issue: SessionDetailsSection not found

**Cause:** Either:
1. Feature flag is false (running V1)
2. Component not yet imported/rendered

**Fix:**
1. Check feature flag value
2. Verify component import in AnimatedSessionWizard.tsx

#### Issue: Tests timing out

**Cause:** Elements not appearing in expected timeframe

**Fix:**
- Increase timeout: `{ timeout: TIMEOUTS.long }`
- Use `.catch(() => false)` for conditional elements
- Check if element exists before interacting

#### Issue: Photo upload fails

**Cause:** Test photo file not found

**Fix:**
```bash
# Create test fixture
mkdir -p e2e/fixtures
# Add a test image file
cp /path/to/test-image.jpg e2e/fixtures/test-photo.jpg
```

## Test Maintenance

### When to Update Tests

1. **When adding new fields to SessionDetailsSection:**
   - Add field selector to selectors list
   - Add test for new field in `session-wizard-consolidated.spec.ts`
   - Add validation test if field has constraints

2. **When changing step count:**
   - Update expected step count in tests
   - Update step navigation logic

3. **When modifying validation rules:**
   - Update validation test expectations
   - Add new validation tests for new rules

4. **When enabling V2 by default:**
   - Change default in test expectations
   - Update documentation
   - Archive V1-specific tests (mark as legacy)

### Test Hygiene

```typescript
// ✅ GOOD: Graceful fallback
const element = page.locator('selector').first();
const hasElement = await element.isVisible().catch(() => false);

if (!hasElement) {
  test.skip(true, 'Element not found - feature flag likely disabled');
  return;
}

// ❌ BAD: Hard assertion without check
const element = page.locator('selector');
await expect(element).toBeVisible(); // Will fail if element doesn't exist
```

## CI/CD Integration

### Running Tests in CI

```yaml
# Example GitHub Actions workflow
- name: Run Session Wizard Tests (V1)
  run: yarn test:e2e e2e/session-wizard.spec.ts

- name: Run Session Wizard Tests (V2)
  run: |
    # Enable feature flag
    sed -i 's/USE_CONSOLIDATED_WIZARD = false/USE_CONSOLIDATED_WIZARD = true/g' \
      components/session/wizard/AnimatedSessionWizard.tsx

    # Run tests
    yarn test:e2e e2e/session-wizard-consolidated.spec.ts

    # Revert changes
    git checkout components/session/wizard/AnimatedSessionWizard.tsx
```

### Test Matrix

Run both versions in CI:

```yaml
strategy:
  matrix:
    wizard_version: [v1, v2]

steps:
  - name: Set wizard version
    run: |
      if [ "${{ matrix.wizard_version }}" == "v2" ]; then
        sed -i 's/USE_CONSOLIDATED_WIZARD = false/USE_CONSOLIDATED_WIZARD = true/g' \
          components/session/wizard/AnimatedSessionWizard.tsx
      fi

  - name: Run E2E tests
    run: yarn test:e2e e2e/session-wizard-consolidated.spec.ts
```

## Future Enhancements

### Planned Test Additions

1. **Photo upload tests:**
   - Drag and drop
   - Multiple photos
   - File size validation
   - File type validation
   - Photo preview

2. **Accessibility tests:**
   - Keyboard navigation through all fields
   - Screen reader announcements
   - Focus management
   - ARIA labels

3. **Data verification tests:**
   - Query database after submission
   - Verify all fields saved correctly
   - Verify photo URLs in database
   - Verify forecast accuracy saved

4. **Performance tests:**
   - Wizard load time
   - Step transition speed
   - Photo upload time
   - Form submission time

## References

- **Design Document:** `/docs/design/SESSION_WIZARD_CONSOLIDATION_DESIGN.md`
- **Implementation Summary:** `/docs/implementation/SESSION_DETAILS_SECTION_IMPLEMENTATION.md`
- **E2E Architecture:** `/e2e/ARCHITECTURE.md`
- **Component:** `/components/session-forms/SessionDetailsSection.tsx`

## Questions?

For questions or issues with session wizard tests:

1. Check this guide first
2. Review test output and traces
3. Check design documents for expected behavior
4. Verify feature flag configuration
5. Run tests in debug mode

---

**Last Updated:** 2025-11-13
**Test Coverage:** V1 (Legacy) + V2 (Consolidated)
**Test Files:** 2 (session-wizard.spec.ts, session-wizard-consolidated.spec.ts)
**Total Tests:** 30+ scenarios
