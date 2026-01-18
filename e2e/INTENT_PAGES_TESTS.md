# Intent Pages E2E Tests - Quick Reference

## Running Tests

### All Intent Page Tests
```bash
npx playwright test e2e/intent-pages-database.spec.ts
```

### Specific Test Suites
```bash
# City-level pages
npx playwright test e2e/intent-pages-database.spec.ts --grep "City level"

# State-level pages
npx playwright test e2e/intent-pages-database.spec.ts --grep "State level"

# 404 handling
npx playwright test e2e/intent-pages-database.spec.ts --grep "404 handling"

# Legacy redirects
npx playwright test e2e/intent-pages-database.spec.ts --grep "Legacy redirects"

# Content structure
npx playwright test e2e/intent-pages-database.spec.ts --grep "Content structure"

# SEO tests
npx playwright test e2e/intent-pages-database.spec.ts --grep "SEO"

# Accessibility tests
npx playwright test e2e/intent-pages-database.spec.ts --grep "Accessibility"

# Performance tests
npx playwright test e2e/intent-pages-database.spec.ts --grep "Performance"

# Responsive design
npx playwright test e2e/intent-pages-database.spec.ts --grep "Responsive"
```

### Interactive Modes
```bash
# UI Mode (interactive)
npx playwright test e2e/intent-pages-database.spec.ts --ui

# Headed mode (see browser)
npx playwright test e2e/intent-pages-database.spec.ts --headed

# Debug mode
npx playwright test e2e/intent-pages-database.spec.ts --debug
```

### Specific Browsers
```bash
# Chromium only
npx playwright test e2e/intent-pages-database.spec.ts --project=chromium

# Firefox only
npx playwright test e2e/intent-pages-database.spec.ts --project=firefox

# WebKit only
npx playwright test e2e/intent-pages-database.spec.ts --project=webkit
```

## Test Cities Used

The tests use these example cities (must exist in database):

| City | State | Slug | Example URL |
|------|-------|------|-------------|
| Santa Cruz | CA | `santa-cruz` | `/beginner/santa-cruz` |
| Honolulu | HI | `honolulu` | `/tide/honolulu` |
| Encinitas | CA | `encinitas` | `/least-crowded/encinitas` |
| Newport Beach | CA | `newport-beach` | `/water-temp/newport-beach` |

## Test Intents Covered

All supported intents are tested:

- `beginner` - Beginner-friendly spots
- `least-crowded` - Less crowded spots
- `tide` - Tide-dependent spots
- `water-temp` - Water temperature info
- `longboard` - Longboard-friendly spots
- `dawn-patrol` - Early morning sessions
- `sunset` - Sunset sessions

## Seeding Test Data

If tests fail due to missing cities, seed the database:

```sql
-- Add Santa Cruz
INSERT INTO city_metadata (slug, city, state, country, latitude, longitude)
VALUES ('santa-cruz', 'Santa Cruz', 'CA', 'USA', 36.9741, -122.0308);

-- Add Honolulu
INSERT INTO city_metadata (slug, city, state, country, latitude, longitude)
VALUES ('honolulu', 'Honolulu', 'HI', 'USA', 21.3099, -157.8581);

-- Add Encinitas
INSERT INTO city_metadata (slug, city, state, country, latitude, longitude)
VALUES ('encinitas', 'Encinitas', 'CA', 'USA', 33.0369, -117.2920);

-- Add Newport Beach
INSERT INTO city_metadata (slug, city, state, country, latitude, longitude)
VALUES ('newport-beach', 'Newport Beach', 'CA', 'USA', 33.6189, -117.9289);
```

## Expected Outcomes

### Passing Tests
- All city pages load without 404
- State pages load and show spot counts
- Maps render with beach markers
- SEO metadata is present and correct
- No console errors (except known/filtered ones)
- Accessibility tests pass

### Known Potential Issues

1. **Missing City Data**
   - Symptom: 404 errors for city pages
   - Solution: Seed city_metadata table with test cities

2. **Slow Map Loading**
   - Symptom: Map tests timeout
   - Solution: Increase MAP_LOAD_TIMEOUT (currently 5s)

3. **Console Errors**
   - Symptom: Performance tests fail
   - Solution: Add error patterns to filter in test file

4. **State Page No Data**
   - Symptom: State-level tests fail
   - Solution: Ensure beaches exist in database for that state

## Debugging Failed Tests

### View Test Report
```bash
npx playwright show-report
```

### Run Single Test
```bash
npx playwright test e2e/intent-pages-database.spec.ts --grep "should load Santa Cruz"
```

### View Screenshots/Videos
After test failures, check:
- `test-results/` directory for screenshots
- HTML report for video recordings

### Check Trace
```bash
# Run with trace
npx playwright test e2e/intent-pages-database.spec.ts --trace on

# View trace
npx playwright show-trace test-results/.../trace.zip
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Intent Pages E2E Tests
  run: npx playwright test e2e/intent-pages-database.spec.ts
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
```

### Expected CI Results
- **Duration**: ~3-5 minutes (40+ tests)
- **Browsers**: Chromium, Firefox, WebKit
- **Retries**: 1 (in CI mode)
- **Artifacts**: Screenshots, videos, traces on failure

## Test Maintenance

### When to Update Tests

1. **New Intent Added** - Add to test list in "Multiple intents" suite
2. **New City Added** - Consider adding to test cities
3. **Content Changes** - Update text assertions if headings change
4. **SEO Changes** - Update meta description patterns if format changes
5. **Component Changes** - Update selectors if component structure changes

### Regular Checks

- Run tests weekly to catch regressions
- Monitor flakiness in CI (should be <5% flaky)
- Update timeouts if infrastructure changes
- Review and update filtered error patterns

## Related Documentation

- `/e2e/ARCHITECTURE.md` - E2E testing patterns
- `/e2e/README.md` - General E2E test guide
- `/playwright.config.ts` - Playwright configuration
- `/docs/quiver_intent_pages.md` - Intent pages feature spec

## Questions?

Contact the team or check:
- Slack: #eng-testing channel
- Wiki: Quiver E2E Testing Guide
- Code: Review existing tests in `/e2e/` directory
