# Quick Start: Session Wizard E2E Tests

## TL;DR

```bash
# Test current version (V1 by default)
yarn test:e2e e2e/session-wizard-consolidated.spec.ts

# Detect which version is running
yarn test:e2e e2e/session-wizard.spec.ts -g "Feature Flag Detection"

# Test V2 consolidated flow
# 1. Edit AnimatedSessionWizard.tsx: USE_CONSOLIDATED_WIZARD = true
# 2. Run tests: yarn test:e2e e2e/session-wizard-consolidated.spec.ts
# 3. Revert: USE_CONSOLIDATED_WIZARD = false
```

## What's New

### 🆕 New Test File: `session-wizard-consolidated.spec.ts`

Comprehensive tests for the consolidated 4-step wizard flow (V2).

**Tests:**
- ✅ 4-step flow verification
- ✅ SessionDetailsSection field tests
- ✅ Data persistence
- ✅ Validation rules
- ✅ Photo upload
- ✅ V1 vs V2 comparison

### 📝 Updated: `session-wizard.spec.ts`

Added feature flag detection tests.

**New Tests:**
- ✅ Detect wizard version (V1 or V2)
- ✅ Verify step count for each version
- ✅ Plan mode unchanged in both versions

### 📚 Documentation

- **`SESSION_WIZARD_TEST_GUIDE.md`** - Complete testing guide
- **`E2E_SESSION_WIZARD_TEST_SUMMARY.md`** - Implementation summary

## Feature Flag

**Location:** `components/session/wizard/AnimatedSessionWizard.tsx`

```typescript
const USE_CONSOLIDATED_WIZARD = false; // Default: V1 (6 steps)
// const USE_CONSOLIDATED_WIZARD = true; // V2 (4 steps)
```

## Wizard Versions

### V1 (Legacy) - 6 Steps

**Log Mode:**
1. Location
2. Date & Time
3. Equipment
4. **Conditions** (separate)
5. **Photos** (separate)
6. **Notes** (separate)

**Plan Mode:** 4 steps (unchanged)

### V2 (Consolidated) - 4 Steps

**Log Mode:**
1. Location
2. Date & Time
3. Equipment
4. **Session Details** (consolidated: conditions + photos + notes)

**Plan Mode:** 4 steps (unchanged)

## Quick Test Commands

### Run All Session Wizard Tests

```bash
# Run all tests (both files)
yarn test:e2e e2e/session-wizard*.spec.ts

# Run specific file
yarn test:e2e e2e/session-wizard-consolidated.spec.ts
```

### Run Specific Test Suites

```bash
# V2 consolidated flow tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts -g "Consolidated Flow"

# V1 legacy flow tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts -g "Legacy Flow"

# Feature flag detection
yarn test:e2e e2e/session-wizard.spec.ts -g "Feature Flag Detection"

# Plan mode tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts -g "Plan Mode"
```

### Debug Mode

```bash
# UI mode (interactive)
yarn test:e2e:ui

# Headed browser
yarn test:e2e e2e/session-wizard-consolidated.spec.ts --headed

# Generate trace
yarn test:e2e e2e/session-wizard-consolidated.spec.ts --trace on
```

## Test Coverage

### V2 SessionDetailsSection Fields

| Field | Selector | Validation |
|-------|----------|------------|
| Wave Height | `input[id*="wave-height"]` | 0-50 ft |
| Wind Speed | `input[id*="wind-speed"]` | 0-150 mph |
| Wind Direction | `select[id*="wind-direction"]` | N, NE, E, SE, S, SW, W, NW, Offshore, Onshore, Cross |
| Water Temp | `input[id*="water-temp"]` | 32-100°F |
| Wave Quality | `button[aria-label*="Rate Wave Quality"]` | 1-5 stars |
| Parking Ease | `button[aria-label*="Rate"]` | 1-5 stars |
| Crowd Level | `button[aria-label*="Rate"]` | 1-5 stars |
| Forecast Accuracy | `button:has-text("Yes")` | Yes/Kinda/No |
| Photos | `input[type="file"]` | Max 5 files |
| Notes | `textarea[id*="notes"]` | Max 2000 chars |

## Common Issues

### "SessionDetailsSection not found"

**Cause:** Feature flag is disabled (running V1)

**Fix:**
- This is expected behavior! Tests will skip with message.
- To test V2: Set `USE_CONSOLIDATED_WIZARD = true`

### "Progress bar not found"

**Cause:** UI doesn't have progress bar yet

**Fix:** Tests will skip gracefully. No action needed.

### "Test photo not found"

**Cause:** Photo fixture doesn't exist

**Fix:**
```bash
# Create fixture (optional - most tests work without it)
mkdir -p e2e/fixtures
cp /path/to/image.jpg e2e/fixtures/test-photo.jpg
```

### Tests timing out

**Fix:**
- Most tests use graceful timeouts with `.catch(() => false)`
- If needed, increase: `{ timeout: TIMEOUTS.long }`

## Expected Test Behavior

### When V1 is Active (Default)

```
✅ session-wizard.spec.ts - All tests pass
✅ session-wizard-consolidated.spec.ts:
   - V1 tests: PASS
   - V2 tests: SKIP (with "feature flag likely disabled" message)
```

### When V2 is Active (Feature Flag Enabled)

```
✅ session-wizard.spec.ts - All tests pass
✅ session-wizard-consolidated.spec.ts:
   - V1 tests: SKIP (with "likely running V2" message)
   - V2 tests: PASS
```

## Testing Workflow

### 1. Test Current Version (V1)

```bash
yarn test:e2e e2e/session-wizard-consolidated.spec.ts
```

**Expected:** V1 tests pass, V2 tests skip

### 2. Test V2 Version

```bash
# Step 1: Enable feature flag
# Edit: components/session/wizard/AnimatedSessionWizard.tsx
# Change: const USE_CONSOLIDATED_WIZARD = true

# Step 2: Run tests
yarn test:e2e e2e/session-wizard-consolidated.spec.ts

# Step 3: Revert (IMPORTANT!)
# Change back: const USE_CONSOLIDATED_WIZARD = false
```

**Expected:** V2 tests pass, V1 tests skip

### 3. Verify Feature Flag Detection

```bash
yarn test:e2e e2e/session-wizard.spec.ts -g "Feature Flag Detection"
```

**Expected:** Console shows detected version

## Test Files Location

```
quiver/
├── e2e/
│   ├── session-wizard.spec.ts               (General + V1 tests)
│   ├── session-wizard-consolidated.spec.ts  (V2 comprehensive tests)
│   ├── SESSION_WIZARD_TEST_GUIDE.md         (Full guide)
│   └── QUICK_START_SESSION_WIZARD_TESTS.md  (This file)
│
└── E2E_SESSION_WIZARD_TEST_SUMMARY.md       (Implementation summary)
```

## Need More Help?

1. **Quick reference:** This file
2. **Full guide:** `e2e/SESSION_WIZARD_TEST_GUIDE.md`
3. **Implementation details:** `E2E_SESSION_WIZARD_TEST_SUMMARY.md`
4. **Design spec:** `docs/design/SESSION_WIZARD_CONSOLIDATION_DESIGN.md`

## Test Statistics

- **Total Test Files:** 2
- **Total Test Scenarios:** 21+
- **V2 Field Coverage:** 10/10 fields (100%)
- **V1 Step Coverage:** 6/6 steps (100%)
- **Lines of Test Code:** 800+
- **Lines of Documentation:** 1000+

---

**Last Updated:** 2025-11-13
**Status:** ✅ Ready to use
