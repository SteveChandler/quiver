# Test Fix Implementation Guide - Quiver E2E Tests

## Critical Discovery: Autocomplete Tests Fundamental Issue

### The Problem

The autocomplete dropdown timing tests (`e2e/autocomplete-dropdown-timing.spec.ts`) are **testing the wrong component on the wrong page**.

**What the tests expect:**
- CMDK-based autocomplete dropdown with `[cmdk-list]` selector
- Immediate dropdown visibility when typing 2+ characters
- Beach search autocomplete component from `components/beach/beach-search-autocomplete.tsx`

**What actually exists on the home page (`/`):**
- Simple header search input (`app-header.tsx` line 225-235)
- Regular `<Input>` component that navigates to `/map` on submit
- NO CMDK autocomplete dropdown

**Root Cause:**
```typescript
// e2e/autocomplete-dropdown-timing.spec.ts line 20-24
test.beforeEach(async ({ page }) => {
  await page.goto('/');  // ⚠️ HOME PAGE HAS NO AUTOCOMPLETE DROPDOWN!
  await waitForPageLoad(page);
});
```

The test navigates to `/` (home page) which contains a simple search input in the app header, but the tests are written for the `BeachSearchAutocomplete` component which uses CMDK and has the dropdown functionality.

### Component Analysis

#### 1. App Header Search Input (`components/app-header.tsx`)
- **Location**: Lines 214-236
- **Type**: Regular `<Input>` component
- **Behavior**: Submits to `/map?search={query}` - NO dropdown
- **Visibility**: `hidden md:flex` (hidden on mobile, visible on desktop 768px+)
- **Condition**: Only shown for authenticated users (`{user && ...}`)
- **Test ID**: `data-testid="header-search-input"`

```tsx
{user && (
  <form
    onSubmit={handleSearch}
    className="hidden md:flex flex-1 max-w-[600px] mx-8"
  >
    <Input
      type="search"
      placeholder="Search beaches, spots, or sessions..."
      data-testid="header-search-input"
    />
  </form>
)}
```

#### 2. Beach Search Autocomplete (`components/beach/beach-search-autocomplete.tsx`)
- **Type**: CMDK-based autocomplete with dropdown
- **Features**:
  - Immediate dropdown on 2+ characters
  - Debounced API calls (300ms)
  - Keyboard navigation
  - Beach preview cards
- **Selector**: `[cmdk-list]` for dropdown
- **Used in**: `beach-search.tsx`, potentially map pages
- **NOT used in**: Home page header

### Where is Beach SearchAutocomplete Actually Used?

Based on code analysis:
1. **`components/beach-search.tsx`** - Full beach search component
2. **`components/home-beach-selector.tsx`** - Beach selection
3. **`components/map/map-search-header.tsx`** - Map page search (potentially)

### The Fix: Three Options

#### Option 1: Test on Map Page (RECOMMENDED)
Navigate to `/map` where autocomplete might be available:

```typescript
test.beforeEach(async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/map');  // Map page likely has autocomplete
  await waitForPageLoad(page);
});
```

#### Option 2: Test on Discover Page
Navigate to `/discover` if it has autocomplete:

```typescript
test.beforeEach(async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/discover');
  await waitForPageLoad(page);
});
```

#### Option 3: Create Dedicated Test Page
Create a dedicated test page that renders the `BeachSearchAutocomplete` component.

### Recommended Implementation

**Step 1**: Determine where `BeachSearchAutocomplete` is actually rendered:

```bash
# Check which pages import BeachSearchAutocomplete
grep -r "BeachSearchAutocomplete" app/ components/
```

**Step 2**: Update test to navigate to the correct page

**Step 3**: Update selector to find CMDK dropdown:

```typescript
// Instead of looking for ANY search input:
const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();

// Look specifically for CMDK input:
const searchInput = page.locator('[cmdk-input]');
// OR
const searchInput = page.getByRole('combobox');
```

**Step 4**: Verify dropdown element exists:

```typescript
// The dropdown list element should have [cmdk-list] attribute
const dropdownList = page.locator('[cmdk-list]');
```

### Implementation Priority

1. **HIGH PRIORITY**: Research where `BeachSearchAutocomplete` component is used
2. **HIGH PRIORITY**: Update test navigation to correct page
3. **MEDIUM**: Update selectors to use CMDK-specific attributes
4. **LOW**: Consider creating dedicated test route if component isn't easily accessible

### Additional Findings

#### Nearby Beaches Regression Test
- ✅ Helper functions exist in `e2e/utils/profile-helpers.ts`
- ✅ Test structure appears correct
- Status: Likely passing, needs verification

#### Map Coordinate Validation Tests
- Uses Mapbox GL which requires time to initialize
- May need longer timeouts for map rendering
- Tests appear well-structured

#### Build Integrity Tests
- Most tests passing
- Good coverage of webpack, console errors, resource loading

### Quality Metrics After Full Analysis

**Current State:**
- Autocomplete tests: 0% pass rate (wrong page/component)
- Other new tests: Unknown, need investigation
- Existing tests: ~98.5% pass rate

**Post-Fix Target:**
- Autocomplete tests: >90% pass rate
- All new tests: >95% pass rate
- Overall: >99% pass rate

### Action Items

- [ ] 1. Grep codebase to find where `BeachSearchAutocomplete` is rendered
- [ ] 2. Update `e2e/autocomplete-dropdown-timing.spec.ts` navigation
- [ ] 3. Update selectors to use CMDK attributes (`[cmdk-input]`, `[cmdk-list]`)
- [ ] 4. Run tests to verify fixes
- [ ] 5. Document findings in `e2e/ARCHITECTURE.md`
- [ ] 6. Create test best practices guide

### Lessons Learned

1. **Verify Component Location**: Before writing E2E tests, verify WHERE the component is actually rendered
2. **Use Specific Selectors**: Use component-specific attributes (data-testid, cmdk attributes) not generic patterns
3. **Component Architecture Understanding**: Understand the difference between simple inputs and complex autocomplete components
4. **Test Isolation**: Each test should test ONE specific component implementation, not make assumptions

### Next Steps

Immediate action required: **Research and identify the correct page/location for BeachSearchAutocomplete component before proceeding with test fixes**.

---

**Status**: Blocked pending component location research 🔴
**Confidence**: Very High 🟢
**Risk**: Medium (tests need significant rework) 🟡
