# Implicit Preference Learning Design

**Date:** 2026-01-25
**Status:** Approved
**Authors:** PO + Claude (Brainstorming Session)

## Problem Statement

Quiver's personalization system requires 5+ rated sessions before it can learn user preferences. This creates a poor experience for new users who receive generic recommendations until they've logged enough sessions.

**Goals:**
1. Solve the cold-start problem with immediate personalization for new users
2. Capture richer behavioral signals beyond explicit session ratings
3. Maintain user trust through transparency and privacy controls

## Solution Overview

A three-layer implicit preference learning system:

1. **Event Capture** - Track behavioral signals (views, clicks, location)
2. **Aggregation** - Nightly computation of implicit preferences with weighted decay
3. **Scoring Integration** - Blend implicit + explicit preferences based on confidence

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data retention | 90 days | Balance signal richness with privacy |
| Aggregation timing | Nightly batch | Simpler ops, acceptable latency |
| Confidence blend | `implicit × (1 - explicit)` | Graceful handoff as users log sessions |
| Privacy default | Opt-out available | Respect user choice, default to personalization |

## Technical Design

### 1. Event Schema

```sql
CREATE TABLE user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  beach_id uuid REFERENCES beaches(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX idx_user_events_user_recent ON user_events(user_id, created_at DESC);
CREATE INDEX idx_user_events_type ON user_events(event_type, created_at DESC);
CREATE INDEX idx_user_events_cleanup ON user_events(expires_at) WHERE expires_at < now();
```

**Event Types:**

| Event Type | Metadata | Signal |
|------------|----------|--------|
| `beach_view` | `{duration_ms, referrer, forecast_viewed}` | Interest level |
| `discovery_click` | `{position, score_shown, alternatives_count}` | Preference revelation |
| `discovery_skip` | `{position, score_shown, chosen_beach_id}` | Negative signal |
| `forecast_check` | `{time_slot, conditions_summary}` | Timing preferences |
| `location_update` | `{lat, lon, accuracy_m}` | Real behavior patterns |

### 2. Implicit Preferences Table

```sql
CREATE TABLE user_implicit_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inferred wave preferences
  inferred_wave_min_ft numeric(4,1),
  inferred_wave_max_ft numeric(4,1),

  -- Weighted preference distributions
  break_type_weights jsonb DEFAULT '{}',
  time_slot_weights jsonb DEFAULT '{}',

  -- Location patterns
  location_centroid_lat numeric(10,6),
  location_centroid_lon numeric(10,6),
  typical_travel_radius_miles numeric(5,1),

  -- Engagement rankings
  top_engaged_beach_ids uuid[] DEFAULT '{}',

  -- Confidence & metadata
  confidence numeric(3,2) NOT NULL DEFAULT 0,
  event_count int NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  computed_from timestamptz,
  computed_to timestamptz
);
```

### 3. Event Weight Hierarchy

Events are weighted by intent signal strength:

| Event Type | Weight | Rationale |
|------------|--------|-----------|
| `location_update` | 10.0 | Ground truth - physically present |
| `discovery_click` | 3.0 | Active choice |
| `forecast_check` | 2.5 | Planning intent |
| `beach_view` | 0.5 | Low signal - aspirational browsing risk |
| `discovery_skip` | -1.0 | Soft negative signal |

**Aspirational Browsing Protection:** The 20:1 ratio between location_update and beach_view prevents users who browse big wave spots out of curiosity from getting dangerous recommendations.

### 4. Aggregation Algorithm

Weighted decay algorithm combining event weights with recency:

```sql
-- Recency factor: linear decay over 90 days
recency_factor = GREATEST(0, 1.0 - age_in_days / 90)

-- Weighted preference calculation
preference = SUM(value × weight × recency_factor) / SUM(weight × recency_factor)

-- Confidence: sigmoid based on weighted event volume
confidence = 1.0 / (1.0 + EXP(-0.05 × (total_weight - 20)))
```

### 5. Scoring Integration

**Confidence Blend Formula:**

```typescript
const explicitConf = learnedPrefs?.confidence ?? 0;
const implicitConf = implicitPrefs?.confidence ?? 0;
const implicitWeight = implicitConf * (1 - explicitConf);
```

**Behavior by user state:**
- No sessions → 100% implicit
- 5 sessions → ~50/50 blend
- 20+ sessions → ~95% explicit

**Implicit Preference Bonuses (max +25 pts):**
- Inferred wave range match: +10 pts × implicitWeight
- Inferred break type match: +8 pts × implicitWeight
- Within travel radius: +5 pts × implicitWeight
- Top engaged beach: +2 pts (flat)

### 6. Privacy Controls

**Gatekeeper Pattern:**
```typescript
// Check BEFORE writing any event
const { data } = await supabase
  .from('user_preferences')
  .select('allow_implicit_tracking')
  .eq('user_id', user.id)
  .single();

if (data && !data.allow_implicit_tracking) {
  return NextResponse.json({ ok: true, status: 'tracking_disabled' });
}
```

**User Controls:**
- Settings toggle: "Use my browsing to improve recommendations"
- "Clear browsing data" button → deletes user_events + user_implicit_preferences
- "Not interested" button on recommendations → creates discovery_skip event

### 7. Transparency UI

**API Response Structure:**
```typescript
{
  beach_id: "...",
  total_score: 85,
  match_reasons: [
    { type: "learned", label: "Matches your wave preference (3-5ft)", confidence: "high" },
    { type: "implicit", label: "Based on recent views", confidence: "medium" },
    { type: "implicit", label: "Within your usual drive", confidence: "low" }
  ],
  personalization_source: "blended",
  scoring_breakdown: {
    base: 40,
    onboarding: 0,
    learned: 30,
    implicit: 15,
    affinity: 0
  }
}
```

**UI Messaging by Confidence:**
- Low implicit confidence: "Based on your setup profile..."
- High implicit confidence: "Because you frequent [Beach X]..."

## Implementation Plan

### Phase 1: Database Migration
**File:** `supabase/migrations/20260125_implicit_signals.sql`

- [ ] Create `user_events` table (consider monthly partitioning for scale)
- [ ] Create `user_implicit_preferences` table
- [ ] Add `allow_implicit_tracking` to `user_preferences` (default: true)
- [ ] Create `purge_implicit_history(user_id)` RPC function
- [ ] Create `compute_implicit_preferences(user_id)` function
- [ ] Set up pg_cron for nightly aggregation
- [ ] Set up pg_cron for 90-day event cleanup

### Phase 2: Backend Logic
- [ ] Implement `/api/events` route with Privacy Gatekeeper
- [ ] Add preference caching (5-minute TTL)
- [ ] Create `getImplicitPreferences(userId)` service function
- [ ] Update `scoreBeachesForUser` with confidence blend

### Phase 3: Frontend Instrumentation
- [ ] Create `useTrackEvent` hook with debouncing
- [ ] Instrument `BeachDetailClient` (view + duration)
- [ ] Instrument `SurfDiscoveryCard` (click)
- [ ] Instrument `DiscoveryCarousel` (skip / "Not interested")
- [ ] Instrument `ForecastTab` (forecast_check)
- [ ] Instrument `LocationStep` (location_update)

### Phase 4: Privacy & Transparency UI
- [ ] Add "Privacy & Data" section to Settings
- [ ] Implement opt-out toggle
- [ ] Implement "Clear browsing data" button
- [ ] Add "Why this?" tooltip to recommendation cards
- [ ] Update recommendation API response structure

### Phase 5: Testing & Validation
- [ ] Unit tests for aggregation functions
- [ ] Integration tests for scoring blend
- [ ] E2E tests for privacy controls
- [ ] Manual QA: cold-start user flow
- [ ] Manual QA: power user flow (verify explicit still dominates)

## Future Considerations (V2)

1. **Trip Planning Floor:** Change blend formula to preserve 20% implicit influence:
   ```typescript
   const implicitWeight = implicitConf * Math.max(0.2, 1 - explicitConf);
   ```

2. **Real-time Aggregation:** For high-value events (location_update), trigger immediate recomputation instead of waiting for nightly batch.

3. **Collaborative Filtering:** "Users like you also surf..." based on similar implicit preference profiles.

4. **Data Export:** GDPR-compliant export of all user_events for transparency.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Aspirational browsing skews preferences | 20:1 weight ratio (location vs view) |
| Power users lose implicit signals | V2 floor (20% minimum) |
| Privacy concerns | Opt-out available, transparent "Why this?" UI |
| Database load from events | Debouncing, preference caching, 90-day retention |
| Stale implicit preferences | Nightly recomputation with recency decay |

## Success Metrics

1. **Cold-start improvement:** New users see personalized scores within first session (vs. 5+ sessions today)
2. **Recommendation CTR:** 10%+ improvement in discovery card click-through rate
3. **User trust:** <5% opt-out rate for implicit tracking
4. **Data quality:** Implicit preferences align with eventual explicit preferences (>70% correlation)
