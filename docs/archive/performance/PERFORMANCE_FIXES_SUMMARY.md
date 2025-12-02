# React Performance Fixes - Quick Reference

> ⚠️ **FEATURE REMOVED (Nov 2025)**
>
> This performance report includes optimization work for the "Best Conditions" home page feature, which was later removed from the product. This document is preserved for historical reference.

**Analysis Date:** 2025-11-14
**Priority:** CRITICAL → HIGH → MEDIUM

## 🚨 Critical Fixes (P0) - Fix Immediately

### 1. Fix PersonalizedBadge Comparison Bug
**File:** `components/recommendations/PersonalizedBadge.tsx:382-393`
**Issue:** Incomplete memo comparison causing stale UI
**Status:** 🔴 BUG - UI shows stale data

```diff
export const PersonalizedBadge = memo(
  PersonalizedBadgeComponent,
  (prev, next) => {
-    return (
-      prev.score === next.score &&
-      prev.personalized === next.personalized &&
-      prev.displayMode === next.displayMode &&
-      prev.size === next.size &&
-      prev.showDelta === next.showDelta
-    );
+    // Complete comparison including all props
+    if (
+      prev.score !== next.score ||
+      prev.personalized !== next.personalized ||
+      prev.displayMode !== next.displayMode ||
+      prev.size !== next.size ||
+      prev.showDelta !== next.showDelta ||
+      prev.baseScore !== next.baseScore ||
+      prev.className !== next.className
+    ) return false;
+
+    // Deep compare breakdown
+    if (prev.breakdown !== next.breakdown) {
+      if (!prev.breakdown || !next.breakdown) return false;
+      if (
+        prev.breakdown.base !== next.breakdown.base ||
+        prev.breakdown.onboardingPrefs !== next.breakdown.onboardingPrefs ||
+        prev.breakdown.learnedPrefs !== next.breakdown.learnedPrefs ||
+        prev.breakdown.affinity !== next.breakdown.affinity
+      ) return false;
+    }
+
+    // Deep compare affinityData
+    if (prev.affinityData !== next.affinityData) {
+      if (!prev.affinityData || !next.affinityData) return false;
+      if (
+        prev.affinityData.sessionCount !== next.affinityData.sessionCount ||
+        prev.affinityData.lastSurfed.getTime() !== next.affinityData.lastSurfed.getTime()
+      ) return false;
+    }
+
+    return true;
  }
);
```

**Impact:** Fixes UI bug + prevents unnecessary re-renders

---

### 2. Add React.memo to ForecastTable
**File:** `components/forecast/forecast-table.tsx:379-451`
**Issue:** Expensive grouping logic runs on every parent update
**Status:** 🟡 Missing optimization

```diff
+import { memo } from "react";
+
-export function ForecastTable({
+function ForecastTableComponent({
  forecasts,
  variant = "standard",
  className,
}: ForecastTableProps) {
  // ... existing logic
}

+export const ForecastTable = memo(ForecastTableComponent);
+ForecastTable.displayName = 'ForecastTable';
+
+export const MultiDayForecastTable = memo(
+  (props: Omit<ForecastTableProps, "variant">) =>
+    <ForecastTable {...props} variant="standard" />
+);
+MultiDayForecastTable.displayName = 'MultiDayForecastTable';
+
+export const SimplifiedForecastTable = memo(
+  (props: Omit<ForecastTableProps, "variant">) =>
+    <ForecastTable {...props} variant="simplified" />
+);
+SimplifiedForecastTable.displayName = 'SimplifiedForecastTable';
```

**Impact:** 40-60% reduction in renders

---

### 3. Add React.memo to TideChart
**File:** `components/forecast/tide-chart-recharts.tsx:363-697`
**Issue:** Heavy Recharts component re-renders unnecessarily
**Status:** 🟡 Missing optimization

```diff
+import { memo } from "react";
+
-export function TideChart({
+function TideChartComponent({
  data,
  forecasts,
  hourly,
  events,
  // ... other props
}: TideChartProps) {
  // ... existing logic
}

+export const TideChart = memo(
+  TideChartComponent,
+  (prev, next) => {
+    return (
+      prev.data === next.data &&
+      prev.forecasts === next.forecasts &&
+      prev.hourly === next.hourly &&
+      prev.events === next.events &&
+      prev.now?.getTime() === next.now?.getTime() &&
+      prev.windowHours === next.windowHours
+    );
+  }
+);
+TideChart.displayName = 'TideChart';
```

**Impact:** 60-80% reduction in renders, significant CPU savings

---

## 🔥 High Priority Fixes (P1) - Fix This Sprint

### 4. Add React.memo to ForecastDisplayWithTransparency
**File:** `components/forecast/forecast-display-with-transparency.tsx:52-464`
**Lines of Code:** 400+

```typescript
import { memo } from "react";

function ForecastDisplayWithTransparencyComponent({ /* props */ }) {
  // ... existing logic
}

export const ForecastDisplayWithTransparency = memo(
  ForecastDisplayWithTransparencyComponent,
  (prev, next) => {
    return (
      prev.forecasts === next.forecasts &&
      prev.beach?.id === next.beach?.id &&
      prev.loading === next.loading &&
      prev.error === next.error &&
      prev.showTransparency === next.showTransparency
    );
  }
);
```

**Impact:** 50-70% reduction in re-renders

---

### 5. Add React.memo to ForecastDayTable
**File:** `components/forecast/forecast-table.tsx:78-377`
**Instances:** 10+ per forecast view

```typescript
const ForecastDayTable = memo(function ForecastDayTable({
  forecasts,
  date,
  isExpanded,
  onToggle,
  isToday,
  variant,
}: ForecastDayTableProps) {
  // ... existing logic
});
ForecastDayTable.displayName = 'ForecastDayTable';
```

**Impact:** Major reduction in child component renders

---

### 6. Add useCallback to BeachCard Event Handlers
**File:** `components/beach-card.tsx:90-110`

```diff
+import { useCallback } from "react";
+
-const handleMapClick = () => {
+const handleMapClick = useCallback(() => {
  if (onMapClick) {
    onMapClick();
  } else if (beachUrl) {
    router.push(beachUrl);
  }
-};
+}, [onMapClick, beachUrl, router]);

-const handleReviewsClick = () => {
+const handleReviewsClick = useCallback(() => {
  if (onReviewsClick) {
    onReviewsClick();
  } else if (beachReviewsUrl) {
    router.push(beachReviewsUrl);
  }
-};
+}, [onReviewsClick, beachReviewsUrl, router]);

-const toggleExpanded = () => {
+const toggleExpanded = useCallback(() => {
-  setIsExpanded(!isExpanded);
+  setIsExpanded(prev => !prev);
-};
+}, []);
```

**Impact:** Prevents child re-renders from prop changes

---

### 7. Memoize WaveHeightDisplay getDataSourceInfo
**File:** `components/ui/wave-height-display.tsx:37-73`

```diff
+import { memo, useMemo } from "react";
+
-export function WaveHeightDisplay({
+function WaveHeightDisplayComponent({
  height,
  showTooltip = true,
  className = "",
  dataSource = null,
  confidenceScore = null,
}: WaveHeightDisplayProps) {
  if (!height) {
    return <span className={className}>--</span>;
  }

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
    }
    // ... rest of logic
-  };
+  }, [dataSource]);

-  const sourceInfo = getDataSourceInfo();

  // ... rest of component
}

+export const WaveHeightDisplay = memo(WaveHeightDisplayComponent);
+WaveHeightDisplay.displayName = 'WaveHeightDisplay';
```

**Impact:** 10-20% reduction in computation

---

### 8. Add useCallback to ForecastTable handleToggle
**File:** `components/forecast/forecast-table.tsx:414-424`

```diff
+import { useCallback } from "react";
+
-const handleToggle = (date: string) => {
+const handleToggle = useCallback((date: string) => {
  setExpandedDates((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    return newSet;
  });
-};
+}, []);
```

**Impact:** Prevents child re-renders on expand/collapse

---

## 📊 Performance Impact Summary

| Component | Current Re-renders | After Fix | Improvement |
|-----------|-------------------|-----------|-------------|
| ForecastTable | Every parent update | Only on forecast change | 40-60% |
| TideChart | Every parent update | Only on data change | 60-80% |
| ForecastDisplayWithTransparency | Every parent update | Only on forecast change | 50-70% |
| ForecastDayTable (×10) | Every parent update | Only on data change | 80-90% |
| PersonalizedBadge | ⚠️ Stale UI bug | Fixed + optimized | Bug fix + 30% |
| BeachCard | Some child re-renders | Minimal re-renders | 20-30% |
| WaveHeightDisplay | Every render | Only on data change | 10-20% |

**Overall Expected Improvement:** 50-70% reduction in total component re-renders

---

## 🎯 Success Metrics

### Before Optimization
- Total client components: 265
- Components with React.memo: 4 (1.5%)
- Re-render count: Baseline needed

### Target After P0+P1 Fixes
- Components with React.memo: 12+ (4.5%)
- Re-render reduction: 50-70%
- CPU time reduction: 40-60%
- Time to Interactive: <3.5s
- Lighthouse Performance: >90

---

## 📅 Implementation Timeline

### Week 1 (P0)
- [ ] Fix PersonalizedBadge comparison bug
- [ ] Add React.memo to ForecastTable
- [ ] Add React.memo to TideChart
- [ ] Measure baseline performance
- [ ] Measure improvement after fixes

### Week 2 (P1 - Part 1)
- [ ] Add React.memo to ForecastDisplayWithTransparency
- [ ] Add React.memo to ForecastDayTable
- [ ] Add useCallback to BeachCard handlers
- [ ] Measure cumulative improvement

### Week 3 (P1 - Part 2)
- [ ] Memoize WaveHeightDisplay
- [ ] Add useCallback to ForecastTable
- [ ] Add React.memo to skeleton components
- [ ] Final P1 performance measurement

### Week 4 (Documentation & Testing)
- [ ] Update ARCHITECTURE.md with patterns
- [ ] Create performance testing suite
- [ ] Document performance gains
- [ ] Create ESLint rules for future components

---

## 🛠️ Testing Commands

```bash
# Profile with React DevTools
yarn dev
# Open http://localhost:3000
# Open React DevTools > Profiler
# Record interaction (e.g., navigate to beach, expand forecast)
# Analyze flame graph for re-renders

# Lighthouse performance test
yarn build
yarn start
# Open Chrome DevTools > Lighthouse
# Run performance audit

# Component render count test
# Add to component: console.count('ComponentName render')
# Navigate app and check console
```

---

## 📚 Reference

**Full Analysis:** `docs/performance/REACT_RENDERING_ANALYSIS.md`

**Key Files:**
- `/components/beach-card.tsx` - List item (already memoized)
- `/components/forecast/forecast-table.tsx` - Needs memo + useCallback
- `/components/forecast/tide-chart-recharts.tsx` - Needs memo (expensive)
- `/components/forecast/forecast-display-with-transparency.tsx` - Needs memo
- `/components/recommendations/PersonalizedBadge.tsx` - Fix comparison bug
- `/components/ui/wave-height-display.tsx` - Needs memo + useMemo
- `/components/home-screen/best-conditions-cards.tsx` - Good example (already optimized)

---

## ✅ Code Review Checklist (For Future PRs)

```markdown
## Performance Review
- [ ] Client component with frequent re-renders? → Add React.memo
- [ ] Component receives stable props? → Add React.memo
- [ ] Expensive calculations in render? → Wrap in useMemo
- [ ] Event handlers passed to children? → Wrap in useCallback
- [ ] Rendered in a list (map)? → Ensure parent AND child memoized
- [ ] Custom React.memo comparison? → Verify ALL props compared
- [ ] Array operations (.map/.filter/.reduce)? → Consider useMemo
- [ ] Inline arrow functions in JSX? → Extract and useCallback
```

---

**Next:** Start with P0 fixes, measure impact, then proceed to P1
