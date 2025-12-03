# React Performance Quick Fix Reference

Fast reference for implementing performance fixes with exact file paths and line numbers.

## P0 Fixes (Critical - Do First)

### 1. Fix PersonalizedBadge Comparison Bug

**File:** `/components/recommendations/PersonalizedBadge.tsx`
**Lines:** 382-393
**Time:** 15 minutes
**Issue:** Incomplete memo comparison causing STALE UI (BUG)

**What to change:**
Replace the incomplete comparison function with a complete one that includes all props (breakdown, affinityData, baseScore, className).

**See:** IMPLEMENTATION_GUIDE.md > Fix 1 for detailed code diff

---

### 2. Add React.memo to ForecastTable

**File:** `/components/forecast/forecast-table.tsx`
**Lines:** 3 (imports), 379 (rename), 451+ (add exports)
**Time:** 20 minutes
**Impact:** 40-60% reduction in re-renders

**Changes:**

1. Add `memo` to imports (line 3)
2. Rename `export function ForecastTable` to `function ForecastTableComponent` (line 379)
3. Add memoized exports after line 451
4. Remove old exports (lines 454-460)

**See:** IMPLEMENTATION_GUIDE.md > Fix 2 for code diffs

---

### 3. Add React.memo to TideChart

**File:** `/components/forecast/tide-chart-recharts.tsx`
**Lines:** 3 (imports), 363 (rename), 697+ (add export)
**Time:** 25 minutes
**Impact:** 60-80% reduction in re-renders

**Changes:**

1. Add `{ memo }` to imports (line 3)
2. Rename `export function TideChart` to `function TideChartComponent` (line 363)
3. Add memoized export with custom comparison after line 697

**See:** IMPLEMENTATION_GUIDE.md > Fix 3 for complete custom comparison

---

## P1 Fixes (High Priority - This Sprint)

### 4. Add React.memo to ForecastDisplayWithTransparency

**File:** `/components/forecast/forecast-display-with-transparency.tsx`
**Lines:** 3 (imports), 52 (rename), 464+ (add export)
**Time:** 25 minutes
**Impact:** 50-70% reduction in re-renders

**Changes:**

1. Add `memo` to imports
2. Rename function to Component variant
3. Add memoized export with custom comparison

**See:** IMPLEMENTATION_GUIDE.md > Fix 4

---

### 5. Add React.memo to ForecastDayTable

**File:** `/components/forecast/forecast-table.tsx`
**Line:** 78
**Time:** 15 minutes
**Impact:** 80-90% reduction (rendered 10+ times)

**Changes:**
Wrap function declaration with memo

**See:** IMPLEMENTATION_GUIDE.md > Fix 5

---

### 6. Add useCallback to BeachCard Event Handlers

**File:** `/components/beach-card.tsx`
**Lines:** 3 (imports), 90-110 (handlers)
**Time:** 20 minutes
**Impact:** 20-30% reduction in child re-renders

**Changes:**

1. Add `useCallback` to imports
2. Wrap handleMapClick (lines 90-97)
3. Wrap handleReviewsClick (lines 99-106)
4. Wrap toggleExpanded (lines 108-110)

**See:** IMPLEMENTATION_GUIDE.md > Fix 6

---

### 7. Memoize WaveHeightDisplay

**File:** `/components/ui/wave-height-display.tsx`
**Lines:** 3 (imports), 19 (rename), 37-73 (useMemo), 134+ (export)
**Time:** 25 minutes
**Impact:** 10-20% reduction

**Changes:**

1. Add `{ memo, useMemo }` to imports
2. Rename function
3. Replace getDataSourceInfo with useMemo
4. Add memoized export

**See:** IMPLEMENTATION_GUIDE.md > Fix 7

---

### 8. Add useCallback to ForecastTable handleToggle

**File:** `/components/forecast/forecast-table.tsx`
**Lines:** 3 (imports), 414-424 (handleToggle)
**Time:** 10 minutes
**Impact:** Prevents child re-renders

**Changes:**

1. Add `useCallback` to imports
2. Wrap handleToggle function

**See:** IMPLEMENTATION_GUIDE.md > Fix 8

---

## Testing After Each Fix

```bash
# 1. TypeScript check
yarn typecheck

# 2. Component still works
yarn dev
# Navigate to affected page
# Verify visual rendering

# 3. Performance check
# Open React DevTools > Profiler
# Record interaction
# Verify reduced re-renders

# 4. Unit tests
yarn test:unit

# 5. E2E tests
yarn test:e2e
```

---

## Files Summary

| File                                                         | Fixes   | Priority | Time | Impact  |
| ------------------------------------------------------------ | ------- | -------- | ---- | ------- |
| `components/recommendations/PersonalizedBadge.tsx`           | 1 (Bug) | P0       | 15m  | Bug fix |
| `components/forecast/forecast-table.tsx`                     | 2, 5, 8 | P0+P1    | 45m  | 50-80%  |
| `components/forecast/tide-chart-recharts.tsx`                | 3       | P0       | 25m  | 60-80%  |
| `components/forecast/forecast-display-with-transparency.tsx` | 4       | P1       | 25m  | 50-70%  |
| `components/beach-card.tsx`                                  | 6       | P1       | 20m  | 20-30%  |
| `components/ui/wave-height-display.tsx`                      | 7       | P1       | 25m  | 10-20%  |

**Total Time:** ~2.5 hours for all P0+P1 fixes

---

## Component Impact Analysis

### High-Frequency Components (Re-render Often)

| Component                       | Current             | After Fix        | Improvement |
| ------------------------------- | ------------------- | ---------------- | ----------- |
| ForecastTable                   | Every parent update | Only data change | 40-60%      |
| TideChart                       | Every parent update | Only data change | 60-80%      |
| ForecastDayTable (×10)          | Every parent update | Only data change | 80-90%      |
| ForecastDisplayWithTransparency | Every parent update | Only data change | 50-70%      |

### Event Handler Components (Cause Child Re-renders)

| Component     | Issue             | Fix         | Improvement |
| ------------- | ----------------- | ----------- | ----------- |
| BeachCard     | Recreate handlers | useCallback | 20-30%      |
| ForecastTable | Recreate toggle   | useCallback | 20-30%      |

### Calculation-Heavy Components

| Component         | Issue                 | Fix            | Improvement   |
| ----------------- | --------------------- | -------------- | ------------- |
| WaveHeightDisplay | Recreate sourceInfo   | useMemo        | 10-20%        |
| PersonalizedBadge | Incomplete comparison | Fix comparison | Bug fix + 30% |

---

## Detailed Documentation

**Full Analysis:** `REACT_RENDERING_ANALYSIS.md`

- 18 critical issues with detailed explanations
- 45+ optimization opportunities
- Performance patterns and anti-patterns

**Quick Reference:** `../archive/performance/PERFORMANCE_FIXES_SUMMARY.md`

- Priority classification
- Impact summary
- Timeline

**Implementation:** `IMPLEMENTATION_GUIDE.md`

- Step-by-step instructions
- Complete code diffs
- Testing protocols

---

## Common Issues & Solutions

### Issue: TypeScript errors after adding memo

```typescript
// ❌ Wrong
const MyComponent = memo((props: Props) => { ... });

// ✅ Correct
const MyComponent = memo(function MyComponent(props: Props) { ... });
MyComponent.displayName = 'MyComponent';
```

### Issue: Component not updating

Check comparison function includes all relevant props:

```typescript
// ❌ Missing props
(prev, next) => prev.id === next.id

// ✅ Complete comparison
(prev, next) => (
  prev.id === next.id &&
  prev.data === next.data &&
  prev.loading === next.loading
)
```

### Issue: useCallback dependency warnings

```typescript
// ❌ Missing dependencies
const handler = useCallback(() => {
  doSomething(prop1, prop2);
}, []); // ESLint warning

// ✅ Complete dependencies
const handler = useCallback(() => {
  doSomething(prop1, prop2);
}, [prop1, prop2]);
```

---

## Next Actions

1. **Immediate:** Fix PersonalizedBadge bug (P0 #1)
2. **Today:** Add memo to ForecastTable (P0 #2)
3. **This Week:** Add memo to TideChart (P0 #3)
4. **Next Week:** Complete P1 fixes (#4-8)
5. **Week 3:** Measure and document improvements
6. **Week 4:** Create ESLint rules

---

**Last Updated:** 2025-11-14
**Ready to implement** - Start with P0 Fix #1
