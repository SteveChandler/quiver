# Session Wizard Consolidation - Executive Summary

## Overview

Consolidation of the Quiver Session Wizard to fix critical data loss issues and improve UX by reducing steps from 6 to 4 in log mode.

**Status:** Design Complete
**Priority:** High
**Complexity:** Medium
**Est. Implementation:** 3-5 days

---

## Critical Issues Fixed

### 1. Data Loss (6 Fields)
Previously collected but NOT saved:
- ✅ Wave Height (ft)
- ✅ Wind Speed (mph)
- ✅ Wind Direction
- ✅ Water Temperature (°F)
- ✅ Session Vibe Notes
- ✅ Forecast Accuracy

### 2. State Management
- ✅ Local state disconnected from formState
- ✅ Photos isolated in AnimatedSessionWizard
- ✅ No updateField calls for condition data

### 3. Redundant Fields
- ✅ Multiple notes fields (consolidated to single field)

---

## Solution Architecture

### New Step Structure

**Log Mode (4 Steps):**
1. Location
2. Date & Time
3. Equipment
4. **Session Details** ← CONSOLIDATED (was 3 separate steps)

**Plan Mode (4 Steps - Unchanged):**
1. Location
2. Date & Time
3. Goals
4. Notes & Invites

---

## Consolidated Step: Session Details

Combines:
- ✅ Conditions (wave height, wind, water temp, ratings)
- ✅ Photos (drag-and-drop upload)
- ✅ Notes (single field)

All data flows through formState → database.

---

## Database Changes

New columns added to `sessions` table:

```sql
wave_height_ft      DECIMAL(4,1)  -- Actual wave height
wind_speed_mph      INTEGER       -- Wind speed
wind_direction      TEXT          -- N, NE, E, SE, S, SW, W, NW, etc.
forecast_accuracy   TEXT          -- 'accurate', 'somewhat', 'inaccurate'
wave_types          TEXT[]        -- Array of wave type IDs
```

**Impact:** Zero downtime (nullable columns)

---

## Key Components

### New
- `SessionDetailsSection.tsx` - Main consolidated component
- `session-wizard-config.ts` - Step configuration
- Sub-components:
  - DurationInput
  - ForecastComparison
  - PhotoUploadSection
  - ForecastAccuracySelector

### Modified
- `AnimatedSessionWizard.tsx` - Use new step config
- `use-session-form.ts` - Updated types
- `session-actions.ts` - Handle new fields

### Deprecated
- `ConditionsSection.tsx` (delete after rollout)
- `PhotoSelectionSection.tsx` (delete after rollout)
- Separate `NotesSection.tsx` for log mode

---

## Data Flow (Before vs After)

### Before (BROKEN)
```
UI Input → Local State (useState) → Lost ❌
Photos → AnimatedSessionWizard state → Partial save
Notes → Two separate fields → Confusion
```

### After (FIXED)
```
UI Input → formState (updateField) → Database ✅
Photos → formState.photos → Full save ✅
Notes → Single formState.notes → Clear ✅
```

---

## Implementation Plan

### Phase 1: Database (Day 1)
- [ ] Create migration
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Regenerate types

### Phase 2: Components (Days 2-3)
- [ ] Build SessionDetailsSection
- [ ] Build sub-components
- [ ] Add validation
- [ ] Update wizard config

### Phase 3: Integration (Day 4)
- [ ] Update AnimatedSessionWizard
- [ ] Update session actions
- [ ] Connect all data flows
- [ ] Remove local state

### Phase 4: Testing (Day 5)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual QA

### Phase 5: Deployment
- [ ] Feature flag rollout (10% → 100%)
- [ ] Monitor metrics
- [ ] Cleanup old code

---

## Success Metrics

### Data Quality
- **Target:** >70% completion rate for new condition fields
- **Measure:** Users filling in wave height, wind, water temp

### User Experience
- **Target:** >80% wizard completion rate
- **Target:** >40% photo upload rate
- **Target:** <30s average time per step

### Performance
- **Target:** <1s wizard load time
- **Target:** <5s photo upload time
- **Target:** <2s session submission

---

## Risk Assessment

### Low Risk
- ✅ Database changes (nullable columns, backward compatible)
- ✅ Feature flag allows instant rollback
- ✅ Existing sessions unaffected

### Medium Risk
- ⚠️ User adaptation to new flow
- ⚠️ Photo upload performance with multiple files
- **Mitigation:** Compress photos client-side, show progress

### High Risk
- ❌ None identified

---

## Migration Path

1. **Week 1:** Deploy database migration
2. **Week 2:** Deploy code with feature flag OFF
3. **Week 3:** Enable for 10% of users, monitor
4. **Week 4:** Enable for 100% if metrics good
5. **Week 5:** Remove flag, cleanup old code

---

## User Impact

### Positive
- ✅ Fewer steps (6 → 4)
- ✅ All data now saved
- ✅ Better photo upload UX
- ✅ Clearer notes field
- ✅ Faster completion

### Neutral
- ℹ️ Slightly different UI layout
- ℹ️ More fields in one step (but better organized)

### Negative
- ❌ None expected

---

## Technical Debt Eliminated

1. ✅ Local state anti-pattern removed
2. ✅ Redundant components deleted
3. ✅ Data loss bugs fixed
4. ✅ Type safety improved
5. ✅ Validation centralized

---

## Future Enhancements (Post-Launch)

1. **Smart Pre-filling:** Auto-populate from forecast
2. **Condition Templates:** Save common setups
3. **Voice Notes:** Record audio during session
4. **Community Insights:** Show recent reports from others
5. **Session Comparison:** Compare to previous sessions

---

## Questions?

See full design document: `SESSION_WIZARD_CONSOLIDATION_DESIGN.md`

**Contact:**
- Design Review: PM Team
- Technical Review: Engineering Lead
- Database Review: DBA Team

---

**Ready to Implement:** ✅ Yes (pending approval)
