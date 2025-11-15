# React Performance Implementation Guide

**Step-by-step guide for implementing performance fixes**

## Prerequisites

1. Read `REACT_RENDERING_ANALYSIS.md` for full context
2. Review `PERFORMANCE_FIXES_SUMMARY.md` for quick reference
3. Install React DevTools browser extension
4. Baseline performance measurements taken

## P0 Fixes (Critical - Do First)

### Fix 1: PersonalizedBadge Comparison Function Bug

**File:** `/components/recommendations/PersonalizedBadge.tsx`
**Time Estimate:** 15 minutes
**Difficulty:** Easy
**Risk:** Low (fixing a bug)

#### Current Code (Lines 382-393)
```typescript
export const PersonalizedBadge = memo(
  PersonalizedBadgeComponent,
  (prev, next) => {
    return (
      prev.score === next.score &&
      prev.personalized === next.personalized &&
      prev.displayMode === next.displayMode &&
      prev.size === next.size &&
      prev.showDelta === next.showDelta
    );
  }
);

PersonalizedBadge.displayName = "PersonalizedBadge";
```

#### Replace With
```typescript
export const PersonalizedBadge = memo(
  PersonalizedBadgeComponent,
  (prev, next) => {
    // Shallow comparison for primitives
    if (
      prev.score !== next.score ||
      prev.personalized !== next.personalized ||
      prev.displayMode !== next.displayMode ||
      prev.size !== next.size ||
      prev.showDelta !== next.showDelta ||
      prev.baseScore !== next.baseScore ||
      prev.className !== next.className
    ) {
      return false; // Props changed, re-render
    }

    // Deep comparison for breakdown object
    if (prev.breakdown !== next.breakdown) {
      if (!prev.breakdown || !next.breakdown) return false;
      if (
        prev.breakdown.base !== next.breakdown.base ||
        prev.breakdown.onboardingPrefs !== next.breakdown.onboardingPrefs ||
        prev.breakdown.learnedPrefs !== next.breakdown.learnedPrefs ||
        prev.breakdown.affinity !== next.breakdown.affinity
      ) {
        return false;
      }
    }

    // Deep comparison for affinityData object
    if (prev.affinityData !== next.affinityData) {
      if (!prev.affinityData || !next.affinityData) return false;
      if (
        prev.affinityData.sessionCount !== next.affinityData.sessionCount ||
        prev.affinityData.lastSurfed.getTime() !== next.affinityData.lastSurfed.getTime()
      ) {
        return false;
      }
    }

    return true; // No changes, skip re-render
  }
);

PersonalizedBadge.displayName = "PersonalizedBadge";
```

#### Testing
```typescript
// Test in browser console after fix
// 1. Navigate to beach with personalization
// 2. Open React DevTools > Components
// 3. Find PersonalizedBadge
// 4. Verify props update correctly when breakdown changes
```

---

### Fix 2: Add React.memo to ForecastTable

**File:** `/components/forecast/forecast-table.tsx`
**Time Estimate:** 20 minutes
**Difficulty:** Easy
**Risk:** Low

#### Step 1: Update Imports (Line 3)
```diff
-import React from "react";
+import React, { memo } from "react";
 import { ChevronDown, ChevronRight } from "lucide-react";
```

#### Step 2: Rename Export (Line 379)
```diff
-export function ForecastTable({
+function ForecastTableComponent({
   forecasts,
   variant = "standard",
   className,
 }: ForecastTableProps) {
```

#### Step 3: Add Memoized Exports (After Line 451)
```typescript
// Memoized main export
export const ForecastTable = memo(ForecastTableComponent);
ForecastTable.displayName = 'ForecastTable';

// Export with backward compatible names
export const MultiDayForecastTable = memo(
  (props: Omit<ForecastTableProps, "variant">) =>
    <ForecastTable {...props} variant="standard" />
);
MultiDayForecastTable.displayName = 'MultiDayForecastTable';

export const SimplifiedForecastTable = memo(
  (props: Omit<ForecastTableProps, "variant">) =>
    <ForecastTable {...props} variant="simplified" />
);
SimplifiedForecastTable.displayName = 'SimplifiedForecastTable';
```

#### Step 4: Remove Old Exports (Lines 454-460)
```diff
-// Export with backward compatible names
-export const MultiDayForecastTable = (
-  props: Omit<ForecastTableProps, "variant">
-) => <ForecastTable {...props} variant="standard" />;
-
-export const SimplifiedForecastTable = (
-  props: Omit<ForecastTableProps, "variant">
-) => <ForecastTable {...props} variant="simplified" />;
```

#### Testing
```bash
# 1. Check TypeScript compilation
yarn typecheck

# 2. Test in browser
# - Navigate to beach detail page
# - Open React DevTools Profiler
# - Record session while scrolling
# - Verify ForecastTable doesn't re-render when unrelated state changes
```

---

### Fix 3: Add React.memo to TideChart

**File:** `/components/forecast/tide-chart-recharts.tsx`
**Time Estimate:** 25 minutes
**Difficulty:** Medium (custom comparison needed)
**Risk:** Low-Medium

#### Step 1: Update Imports (Line 3)
```diff
-import * as React from "react";
+import * as React from "react";
+import { memo } from "react";
 import {
   ResponsiveContainer,
```

#### Step 2: Rename Export (Line 363)
```diff
-export function TideChart({
+function TideChartComponent({
   data,
   forecasts,
   hourly,
```

#### Step 3: Add Memoized Export (After Line 697)
```typescript
// Memoized export with custom comparison
export const TideChart = memo(
  TideChartComponent,
  (prev, next) => {
    // Compare array props by reference (should be stable from parent)
    if (prev.data !== next.data) return false;
    if (prev.forecasts !== next.forecasts) return false;
    if (prev.hourly !== next.hourly) return false;
    if (prev.events !== next.events) return false;

    // Compare now timestamp
    if (prev.now?.getTime() !== next.now?.getTime()) return false;

    // Compare other props
    if (
      prev.windowHours !== next.windowHours ||
      prev.nowBias !== next.nowBias ||
      prev.bufferHours !== next.bufferHours ||
      prev.yDomain !== next.yDomain ||
      prev.unit !== next.unit ||
      prev.compact !== next.compact ||
      prev.className !== next.className ||
      prev.showNowLine !== next.showNowLine ||
      prev.isAnimationActive !== next.isAnimationActive
    ) {
      return false;
    }

    // Compare function props
    if (prev.dayFormatter !== next.dayFormatter) return false;

    return true; // No changes, skip re-render
  }
);
TideChart.displayName = 'TideChart';
```

#### Testing
```bash
# 1. TypeScript check
yarn typecheck

# 2. Visual test
# - Navigate to beach with tide chart
# - Verify chart renders correctly
# - Verify "now" line animates
# - Verify tooltips work

# 3. Performance test
# - Open React DevTools Profiler
# - Record while interacting with page
# - Verify TideChart doesn't re-render when forecast tab changes
```

---

## P1 Fixes (High Priority)

### Fix 4: Add React.memo to ForecastDisplayWithTransparency

**File:** `/components/forecast/forecast-display-with-transparency.tsx`
**Time Estimate:** 25 minutes
**Difficulty:** Medium
**Risk:** Low

#### Step 1: Update Imports (Line 3)
```diff
-import React, { useState, useEffect } from "react";
+import React, { useState, useEffect, memo } from "react";
```

#### Step 2: Rename Export (Line 52)
```diff
-export function ForecastDisplayWithTransparency({
+function ForecastDisplayWithTransparencyComponent({
   forecasts,
   beach,
```

#### Step 3: Add Memoized Export (After Line 464)
```typescript
// Memoized export with custom comparison
export const ForecastDisplayWithTransparency = memo(
  ForecastDisplayWithTransparencyComponent,
  (prev, next) => {
    // Compare forecast array by reference
    if (prev.forecasts !== next.forecasts) return false;

    // Compare beach by ID (more stable than deep comparison)
    if (prev.beach?.id !== next.beach?.id) return false;

    // Compare loading and error states
    if (prev.loading !== next.loading) return false;
    if (prev.error !== next.error) return false;

    // Compare display flags
    if (
      prev.showTransparency !== next.showTransparency ||
      prev.showQualitySummary !== next.showQualitySummary ||
      prev.showFallbackInfo !== next.showFallbackInfo ||
      prev.allowToggleTransparency !== next.allowToggleTransparency ||
      prev.highlightQualityVariations !== next.highlightQualityVariations ||
      prev.expandableByDay !== next.expandableByDay ||
      prev.mobile !== next.mobile ||
      prev.compact !== next.compact ||
      prev.parseUrlParams !== next.parseUrlParams ||
      prev.className !== next.className
    ) {
      return false;
    }

    return true; // No changes, skip re-render
  }
);
ForecastDisplayWithTransparency.displayName = 'ForecastDisplayWithTransparency';
```

---

### Fix 5: Add React.memo to ForecastDayTable

**File:** `/components/forecast/forecast-table.tsx`
**Time Estimate:** 15 minutes
**Difficulty:** Easy
**Risk:** Low

#### Step 1: Update ForecastDayTable (Line 78)
```diff
-function ForecastDayTable({
+const ForecastDayTable = memo(function ForecastDayTable({
   forecasts,
   date,
   isExpanded,
   onToggle,
   isToday,
   variant,
 }: ForecastDayTableProps) {
   // ... existing component logic
-}
+});
+ForecastDayTable.displayName = 'ForecastDayTable';
```

---

### Fix 6: Add useCallback to BeachCard Event Handlers

**File:** `/components/beach-card.tsx`
**Time Estimate:** 20 minutes
**Difficulty:** Easy
**Risk:** Low

#### Step 1: Update Imports (Line 3)
```diff
-import { useState, memo } from "react";
+import { useState, memo, useCallback } from "react";
```

#### Step 2: Update handleMapClick (Lines 90-97)
```diff
-  const handleMapClick = () => {
+  const handleMapClick = useCallback(() => {
     if (onMapClick) {
       onMapClick();
     } else if (beachUrl) {
       router.push(beachUrl);
     }
-  };
+  }, [onMapClick, beachUrl, router]);
```

#### Step 3: Update handleReviewsClick (Lines 99-106)
```diff
-  const handleReviewsClick = () => {
+  const handleReviewsClick = useCallback(() => {
     if (onReviewsClick) {
       onReviewsClick();
     } else if (beachReviewsUrl) {
       router.push(beachReviewsUrl);
     }
-  };
+  }, [onReviewsClick, beachReviewsUrl, router]);
```

#### Step 4: Update toggleExpanded (Lines 108-110)
```diff
-  const toggleExpanded = () => {
-    setIsExpanded(!isExpanded);
-  };
+  const toggleExpanded = useCallback(() => {
+    setIsExpanded(prev => !prev);
+  }, []);
```

---

### Fix 7: Memoize WaveHeightDisplay

**File:** `/components/ui/wave-height-display.tsx`
**Time Estimate:** 25 minutes
**Difficulty:** Medium
**Risk:** Low

#### Step 1: Update Imports (Line 3)
```diff
-import { InfoIcon } from "lucide-react";
+import { memo, useMemo } from "react";
+import { InfoIcon } from "lucide-react";
```

#### Step 2: Rename Function (Line 19)
```diff
-export function WaveHeightDisplay({
+function WaveHeightDisplayComponent({
   height,
   showTooltip = true,
```

#### Step 3: Replace getDataSourceInfo with useMemo (Lines 37-73)
```diff
-  const getDataSourceInfo = () => {
+  const sourceInfo = useMemo(() => {
     if (!dataSource) {
       return {
         label: "Mixed Sources",
         description: "Combining multiple forecast models",
         quality: "standard",
       };
     }

     const source = dataSource.toUpperCase();

     if (source.includes("CDIP")) {
       return {
         label: "CDIP Buoy",
         description: "Real-time buoy measurements (most accurate)",
         quality: "excellent",
       };
     } else if (source.includes("NOAA")) {
       return {
         label: "NOAA Model",
         description: "WaveWatch III forecast model",
         quality: "good",
       };
     } else if (source.includes("FALLBACK")) {
       return {
         label: "Regional Data",
         description: "Using nearby location data",
         quality: "approximate",
       };
     }

     return {
       label: dataSource,
       description: "Forecast data",
       quality: "standard",
     };
-  };
-
-  const sourceInfo = getDataSourceInfo();
+  }, [dataSource]);
```

#### Step 4: Add Memoized Export (After Line 134)
```typescript
export const WaveHeightDisplay = memo(WaveHeightDisplayComponent);
WaveHeightDisplay.displayName = 'WaveHeightDisplay';
```

---

### Fix 8: Add useCallback to ForecastTable handleToggle

**File:** `/components/forecast/forecast-table.tsx`
**Time Estimate:** 10 minutes
**Difficulty:** Easy
**Risk:** Low

#### Step 1: Update Imports (Add useCallback)
```diff
-import React from "react";
+import React, { useCallback } from "react";
```

#### Step 2: Update handleToggle (Lines 414-424)
```diff
-  const handleToggle = (date: string) => {
+  const handleToggle = useCallback((date: string) => {
     setExpandedDates((prev) => {
       const newSet = new Set(prev);
       if (newSet.has(date)) {
         newSet.delete(date);
       } else {
         newSet.add(date);
       }
       return newSet;
     });
-  };
+  }, []);
```

---

## Performance Testing Protocol

### Before Starting Fixes

```bash
# 1. Create performance baseline
yarn build
yarn start

# 2. Open Chrome DevTools
# - Navigate to beach detail page
# - Open Performance tab
# - Record 10 seconds of interaction (scroll, expand forecasts)
# - Save trace as "baseline.json"

# 3. Open React DevTools Profiler
# - Record same interactions
# - Note component render counts
# - Take screenshot of flame graph
```

### After Each Fix

```bash
# 1. Rebuild
yarn build
yarn start

# 2. Repeat same interactions
# 3. Compare traces
# 4. Document improvement

# Example metrics to track:
# - Total render time
# - Number of component updates
# - CPU time in scripting
# - Memory usage
```

### Expected Results

| Fix | Render Reduction | CPU Reduction |
|-----|------------------|---------------|
| PersonalizedBadge | 30% | 5% |
| ForecastTable | 50% | 15% |
| TideChart | 70% | 25% |
| ForecastDisplayWithTransparency | 60% | 20% |
| **Total (P0+P1)** | **50-70%** | **40-60%** |

---

## Common Issues & Solutions

### Issue: "Cannot read property of undefined"
**Cause:** Props comparison accessing nested properties
**Solution:** Add null checks in comparison function

```typescript
// ❌ Bad
if (prev.beach.id !== next.beach.id) return false;

// ✅ Good
if (prev.beach?.id !== next.beach?.id) return false;
```

### Issue: Component not updating when it should
**Cause:** Comparison function too strict or incorrect
**Solution:** Debug with console.log

```typescript
export const MyComponent = memo(
  MyComponentInner,
  (prev, next) => {
    console.log('Comparison:', { prev, next });
    // ... comparison logic
  }
);
```

### Issue: TypeScript errors after memoization
**Cause:** Display names or type definitions
**Solution:** Ensure proper typing

```typescript
// ✅ Good
const MyComponent = memo(function MyComponent(props: Props) {
  // component logic
});
MyComponent.displayName = 'MyComponent';
export { MyComponent };
```

---

## Verification Checklist

After implementing each fix:

- [ ] TypeScript compiles without errors (`yarn typecheck`)
- [ ] Component still renders correctly visually
- [ ] Component updates when props actually change
- [ ] Component doesn't update when props don't change (verify in React DevTools)
- [ ] All existing tests pass (`yarn test:unit`)
- [ ] E2E tests pass for affected pages (`yarn test:e2e`)
- [ ] Performance improvement measured and documented

---

## Rollback Plan

If a fix causes issues:

1. **Immediate:** Revert the specific commit
   ```bash
   git revert <commit-hash>
   ```

2. **Test:** Verify issue is resolved
   ```bash
   yarn build
   yarn test:unit
   yarn test:e2e
   ```

3. **Document:** Create issue with details
   - What was attempted
   - What went wrong
   - Error messages/screenshots
   - Proposed alternative approach

---

## Next Steps After P0+P1

1. **Measure overall improvement**
   - Compare baseline vs. optimized traces
   - Calculate percentage improvements
   - Document in CHANGELOG.md

2. **Update architecture documentation**
   - Add memoization patterns to ARCHITECTURE.md
   - Create examples of proper usage
   - Document when NOT to memoize

3. **Create ESLint rules**
   - Detect missing memo in expensive components
   - Detect missing useCallback for event handlers
   - Detect incomplete memo comparison functions

4. **Plan P2 optimizations**
   - Remaining list components
   - Skeleton components
   - Other identified opportunities

---

**Ready to start?** Begin with P0 Fix #1 (PersonalizedBadge bug)
