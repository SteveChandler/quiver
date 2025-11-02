# Morning Intel Refactoring Plan: Split 923-line God File into 5 Modules

**Status:** Phase 7.1 - Design Complete | Phase 7.2 - In Progress
**Date:** 2025-11-02
**Total Effort:** 88 hours across 3 weeks

## Executive Summary

The `lib/utils/morning-intel-utils.ts` file (923 lines) has become a monolithic god file handling all morning intel generation logic. This refactoring will split it into 5 focused, maintainable modules with clear single responsibilities.

**Critical Complexity Issue:** The `findNextBestWindow` function has a cyclomatic complexity of 68, making it difficult to test, maintain, and extend.

## Current State Analysis

### File Structure
- **Total Lines:** 923
- **Total Functions:** 19
- **Exported Functions:** 9
- **Private Functions:** 10
- **Dependencies:** date-fns, date-fns-tz, @/types/morning-intel

### Function Inventory

#### Tide-Related Functions (Lines 34-212)
- `normalizeTideDirection` (lines 34-41) - 8 lines
- `tideAt` (lines 144-212) - 69 lines
- `recommendTideWindow` (lines 58-114) - 57 lines

#### Swell-Related Functions (Lines 217-260)
- `primarySecondarySwell` (lines 217-260) - 44 lines

#### Wind-Related Functions (Lines 265-364)
- `windAt` (lines 265-330) - 66 lines
- `calculateOnOffshore` (lines 336-340) - 5 lines
- `normalizeAngle` (lines 345-349) - 5 lines
- `degreesToCardinal` (lines 354-364) - 11 lines

#### Session Window Functions (Lines 369-593)
- `bestWindowHeuristic` (lines 369-437) - 69 lines
- **`findNextBestWindow` (lines 443-593) - 151 lines - COMPLEXITY 68**
- `confidenceHeuristic` (lines 598-638) - 41 lines

#### Conditions Analysis Functions (Lines 643-851)
- `isAngleInWindow` (lines 643-661) - 19 lines
- `analyzeSwellMatch` (lines 666-720) - 55 lines
- `analyzeWindConditions` (lines 725-776) - 52 lines
- `analyzeTideConditions` (lines 781-820) - 40 lines
- `analyzeConditions` (lines 825-851) - 27 lines

#### Formatting Functions (Lines 46-53, 856-923)
- `getWaveHeightDescription` (lines 46-53) - 8 lines
- `renderIntelMarkdown` (lines 856-923) - 68 lines

#### Shared Utilities (Lines 119-139)
- `deriveSurfRange` (lines 119-139) - 21 lines

### Current Dependencies

**Consumers:**
1. `lib/services/intel-generation-service.ts` (Primary consumer)
2. `components/beach-detail/best-surf-window.tsx` (Uses findNextBestWindow)
3. `scripts/morningIntel.ts` (Batch generation)

**Tests:**
1. `__tests__/lib/utils/find-next-best-window.test.ts` (217 lines)
2. Various intel-related component tests

## Target Module Architecture

### 1. TideAnalyzer Module
**File:** `lib/analyzers/tide-analyzer.ts`
**Estimated Lines:** ~150
**Effort:** 12 hours

**Responsibilities:**
- Tide height interpolation and calculation
- Tide direction determination (rising/falling/slack)
- Tide window recommendations based on beach preferences
- Next tide event prediction

**Functions to Extract:**
- `normalizeTideDirection` (private)
- `tideAt` (export)
- `recommendTideWindow` (export)

**Exports:**
```typescript
export class TideAnalyzer {
  // Calculate tide metrics at specific time
  calculateTideAtTime(
    targetTime: string,
    tides: ForecastSlice["tides"],
    timezone: string
  ): TideMetrics;

  // Recommend optimal tide window based on beach preferences
  recommendTideWindow(
    forecasts: ForecastSlice["forecasts"],
    beachPrefs: BeachPreferences | null
  ): TideMetrics & { recommendedTime?: string; optimalRange?: string | null };

  // Analyze tide conditions vs preferences
  analyzeTideConditions(
    tideHeight: number,
    beach: BeachPreferences
  ): ConditionEvaluation;
}
```

### 2. WindAnalyzer Module
**File:** `lib/analyzers/wind-analyzer.ts`
**Estimated Lines:** ~120
**Effort:** 12 hours

**Responsibilities:**
- Wind speed and direction analysis
- Offshore/onshore determination
- Wind quality evaluation
- Wind-based scoring

**Functions to Extract:**
- `windAt` (export)
- `calculateOnOffshore` (private)
- `normalizeAngle` (export as shared utility)
- `degreesToCardinal` (export as shared utility)
- `analyzeWindConditions` (export)

**Exports:**
```typescript
export class WindAnalyzer {
  // Calculate wind metrics at specific time
  calculateWindAtTime(
    targetTime: string,
    forecasts: ForecastSlice["forecasts"],
    timezone: string,
    beachAspect?: number
  ): WindMetrics;

  // Determine if wind is offshore
  isOffshore(windDir: number, beachNormal: number): boolean;

  // Analyze wind conditions vs preferences
  analyzeWindConditions(
    wind: WindMetrics,
    beach: BeachPreferences
  ): ConditionEvaluation;

  // Utility: Convert degrees to cardinal direction
  degreesToCardinal(degrees: number): string;

  // Utility: Normalize angle to 0-360
  normalizeAngle(angle: number): number;
}
```

### 3. SwellAnalyzer Module
**File:** `lib/analyzers/swell-analyzer.ts`
**Estimated Lines:** ~100
**Effort:** 10 hours

**Responsibilities:**
- Swell component extraction (primary/secondary)
- Swell direction matching with beach windows
- Swell quality scoring

**Functions to Extract:**
- `primarySecondarySwell` (export)
- `isAngleInWindow` (private)
- `analyzeSwellMatch` (export)

**Exports:**
```typescript
export class SwellAnalyzer {
  // Extract primary and secondary swell components
  extractSwellComponents(
    forecasts: ForecastSlice["forecasts"]
  ): { primary: SwellComponent | null; secondary: SwellComponent | null };

  // Analyze swell direction match with beach preferences
  analyzeSwellMatch(
    swellDirection: number | null | undefined,
    beach: BeachPreferences
  ): ConditionEvaluation;

  // Check if angle is within window (handles 0/360 wraparound)
  private isAngleInWindow(
    angle: number,
    minDeg: number,
    maxDeg: number
  ): boolean;
}
```

### 4. SessionWindowScorer Module
**File:** `lib/analyzers/session-window-scorer.ts`
**Estimated Lines:** ~250
**Effort:** 16 hours (includes complexity reduction of findNextBestWindow)

**Responsibilities:**
- Session window scoring and ranking
- Best surf window determination
- Multi-factor condition scoring (wind, tide, period, time-of-day)
- Data confidence calculation

**Functions to Extract:**
- `bestWindowHeuristic` (export)
- **`findNextBestWindow` (export) - REQUIRES COMPLEXITY REDUCTION**
- `confidenceHeuristic` (export)

**Critical Refactoring:**
The `findNextBestWindow` function (complexity 68) must be decomposed into smaller functions:
- `scoreForecast()` - Score individual forecast (wind, period, tide, time-of-day)
- `findBestForecast()` - Identify top-scoring forecast
- `extendWindow()` - Extend window with similar-quality adjacent forecasts
- `buildWindowDescription()` - Generate human-readable description
- `findNextBestWindow()` - Main orchestrator (reduced to ~20 lines)

**Exports:**
```typescript
export class SessionWindowScorer {
  // Find next best surf window from current time (complexity reduced)
  findNextBestWindow(
    forecasts: Array<ForecastEntry>,
    currentTime: Date,
    beachAspect?: number
  ): SessionWindow | null;

  // Calculate best surf window heuristic for morning
  bestWindowHeuristic(
    forecasts: ForecastSlice["forecasts"],
    tides: ForecastSlice["tides"],
    timezone: string
  ): string;

  // Calculate confidence based on data completeness
  calculateConfidence(
    forecasts: ForecastSlice["forecasts"],
    tides: ForecastSlice["tides"]
  ): "Low" | "Medium" | "High";

  // Score individual forecast conditions
  private scoreForecast(
    forecast: ForecastEntry,
    beachAspect: number
  ): number;

  // Find best scoring forecast
  private findBestForecast(
    scoredForecasts: ScoredForecast[]
  ): ScoredForecast;

  // Extend window with similar quality forecasts
  private extendWindow(
    startIdx: number,
    forecasts: ForecastEntry[],
    scoredForecasts: ScoredForecast[],
    bestScore: number
  ): number;

  // Build human-readable window description
  private buildWindowDescription(
    forecast: ForecastEntry,
    score: number,
    beachAspect: number
  ): { description: string; conditions: string };
}

interface ScoredForecast {
  forecast: ForecastEntry;
  score: number;
}

interface SessionWindow {
  startTime: string | null;
  endTime: string | null;
  description: string;
  conditions: string;
}
```

### 5. IntelFormatter Module
**File:** `lib/formatters/intel-formatter.ts`
**Estimated Lines:** ~100
**Effort:** 8 hours

**Responsibilities:**
- Wave height description formatting
- Intel markdown rendering
- Display text generation

**Functions to Extract:**
- `getWaveHeightDescription` (export)
- `renderIntelMarkdown` (export)
- `deriveSurfRange` (possibly - or could go in shared utils)

**Exports:**
```typescript
export class IntelFormatter {
  // Convert wave height to readable description
  getWaveHeightDescription(avgHeight: number): string;

  // Render complete intel markdown
  renderIntelMarkdown(data: MorningIntelData): string;

  // Derive surf range from forecast data
  deriveSurfRange(forecasts: ForecastSlice["forecasts"]): SurfMetrics;

  // Format tide direction for display
  private formatTideDirection(direction: TideDirection): string;

  // Format wind description
  private formatWindDescription(wind: WindMetrics): string;

  // Format swell component for display
  private formatSwellComponent(swell: SwellComponent | null): string;
}
```

### Shared Constants Module
**File:** `lib/analyzers/constants.ts`

```typescript
export const FEET_TO_METERS = 0.3048;
export const METERS_TO_FEET = 3.28084;
export const OB_SHORE_NORMAL = 270; // Ocean Beach, San Diego faces WSW
export const MAX_WINDOW_HOURS = 4;
export const WINDOW_QUALITY_THRESHOLD = 0.75; // 75% of best score
```

## Refactoring Strategy

### Phase 7.2.1: Extract IntelFormatter (Simplest First)
**Effort:** 8 hours
**Risk:** Low

1. Create `lib/formatters/intel-formatter.ts`
2. Extract formatting functions
3. Update imports in consumers
4. Run tests
5. Commit: "refactor: Extract IntelFormatter module from morning-intel-utils"

### Phase 7.2.2: Extract SwellAnalyzer
**Effort:** 10 hours
**Risk:** Low

1. Create `lib/analyzers/swell-analyzer.ts`
2. Extract swell analysis functions
3. Update imports
4. Run tests
5. Commit: "refactor: Extract SwellAnalyzer module from morning-intel-utils"

### Phase 7.2.3: Extract TideAnalyzer
**Effort:** 12 hours
**Risk:** Medium (complex interpolation logic)

1. Create `lib/analyzers/tide-analyzer.ts`
2. Extract tide calculation functions
3. Preserve exact interpolation behavior
4. Update imports
5. Run tests
6. Commit: "refactor: Extract TideAnalyzer module from morning-intel-utils"

### Phase 7.2.4: Extract WindAnalyzer
**Effort:** 12 hours
**Risk:** Medium (offshore calculation critical)

1. Create `lib/analyzers/wind-analyzer.ts`
2. Extract wind analysis functions
3. Preserve offshore calculation logic
4. Update imports
5. Run tests
6. Commit: "refactor: Extract WindAnalyzer module from morning-intel-utils"

### Phase 7.2.5: Extract SessionWindowScorer (Most Complex)
**Effort:** 16 hours
**Risk:** High (complexity 68 function)

1. Create `lib/analyzers/session-window-scorer.ts`
2. **First: Decompose findNextBestWindow**
   - Extract `scoreForecast` (wind scoring + period scoring + tide scoring + time-of-day bonus)
   - Extract `findBestForecast` (top 30% selection)
   - Extract `extendWindow` (adjacent forecast quality check)
   - Extract `buildWindowDescription` (description generation)
   - Refactor main function to orchestrate
3. Extract other window/confidence functions
4. Update imports
5. Run extensive tests (especially find-next-best-window.test.ts)
6. Measure complexity reduction (target: <10 per function)
7. Commit: "refactor: Extract SessionWindowScorer with complexity reduction"

### Phase 7.3: Update Consumers (12 hours)

1. Update `lib/services/intel-generation-service.ts`
   - Replace function imports with module imports
   - Update function calls to use class methods

2. Update `components/beach-detail/best-surf-window.tsx`
   - Import SessionWindowScorer
   - Update findNextBestWindow usage

3. Update `scripts/morningIntel.ts`
   - Update imports

4. Search for any other consumers

### Phase 7.4: Integration Testing (12 hours)

1. Run full test suite
2. Manual testing of intel generation
3. Visual regression testing of surf windows
4. Performance benchmarking
5. Documentation updates

## Success Metrics

### Complexity Reduction
- **Before:** 1 file with 923 lines
- **After:** 5 focused modules, each <250 lines
- **findNextBestWindow complexity:** 68 → <10 per decomposed function

### Maintainability
- Clear single responsibilities per module
- Easier to test in isolation
- Easier to extend with new features
- Better code organization

### Test Coverage
- Maintain or improve >80% coverage
- All existing tests pass
- No behavior changes

### Performance
- No degradation in intel generation speed
- Memory usage stable

## Risk Mitigation

### High-Risk Areas
1. **findNextBestWindow complexity 68** - Requires careful decomposition
2. **Tide interpolation** - Complex math, easy to break
3. **Wind offshore calculation** - Critical for quality scoring
4. **Test coverage gaps** - Characterization tests needed

### Mitigation Strategies
1. Extract simplest modules first (IntelFormatter, SwellAnalyzer)
2. One module at a time with full test verification
3. Atomic commits for easy reversion
4. Comprehensive test coverage before refactoring
5. Performance benchmarks for session scoring

## Testing Strategy

### Unit Tests
- Existing tests must pass without modification
- Add characterization tests for complex logic
- Test each module in isolation

### Integration Tests
- Intel generation end-to-end
- Surf window recommendations
- Multi-beach scenarios

### Regression Tests
- Compare old vs new outputs on sample data
- Visual regression for UI components
- Performance regression tests

## Timeline

### Week 7 (Current Week)
- **Day 1-2:** Design complete ✓, Start Phase 7.2.1 (IntelFormatter)
- **Day 3-4:** Complete IntelFormatter, Start SwellAnalyzer
- **Day 5:** Complete SwellAnalyzer

### Week 8
- **Day 1-2:** TideAnalyzer extraction
- **Day 3-4:** WindAnalyzer extraction
- **Day 5:** Start SessionWindowScorer complexity reduction

### Week 9
- **Day 1-3:** Complete SessionWindowScorer extraction
- **Day 4:** Update all consumers
- **Day 5:** Integration testing and documentation

## Module Dependencies

```
IntelFormatter ─┐
                │
SwellAnalyzer ──┼─→ MorningIntelData (output)
                │
TideAnalyzer ───┼─→ analyzeConditions ─→ ConditionsAnalysis
                │
WindAnalyzer ───┼─→ SessionWindowScorer ─→ bestWindow
                │
                └─→ IntelGenerationService (consumer)
```

## Rollback Plan

If issues arise:
1. Each phase is independently revertible via git
2. Feature flag: `USE_LEGACY_INTEL_UTILS` can toggle between old/new
3. Parallel implementation during transition period
4. Staged rollout to production

## Next Steps

1. ✅ Complete Phase 7.1: Design Module Structure
2. ⏳ Begin Phase 7.2.1: Extract IntelFormatter module
3. Verify tests pass
4. Continue with remaining modules in order of complexity

## Appendix: Function Call Graph

```
renderIntelMarkdown
  └─ (formatting only, no complex dependencies)

deriveSurfRange
  └─ getWaveHeightDescription

recommendTideWindow
  └─ normalizeTideDirection

tideAt
  └─ normalizeTideDirection

primarySecondarySwell
  └─ degreesToCardinal
      └─ normalizeAngle

windAt
  └─ calculateOnOffshore
  │   └─ normalizeAngle
  └─ degreesToCardinal
      └─ normalizeAngle

bestWindowHeuristic
  ├─ calculateOnOffshore
  │   └─ normalizeAngle
  ├─ tideAt
  │   └─ normalizeTideDirection
  └─ windAt
      └─ calculateOnOffshore
      └─ degreesToCardinal

findNextBestWindow (COMPLEX)
  └─ calculateOnOffshore
      └─ normalizeAngle

analyzeConditions
  ├─ analyzeSwellMatch
  │   ├─ isAngleInWindow
  │   ├─ degreesToCardinal
  │   └─ normalizeAngle
  ├─ analyzeWindConditions
  │   └─ normalizeAngle
  └─ analyzeTideConditions
```

## Notes

- All refactoring must preserve exact behavior (zero behavior changes)
- Tests must pass after each extraction
- Atomic commits for each module extraction
- Documentation updated alongside code changes
- Performance benchmarks run before/after
