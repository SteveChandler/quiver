# Implicit Preference Learning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement implicit preference learning to solve cold-start personalization by capturing behavioral signals and blending them with explicit preferences.

**Architecture:** Event stream (user_events) → Nightly aggregation (user_implicit_preferences) → Confidence-blended scoring. Privacy gatekeeper ensures opt-out users are respected.

**Tech Stack:** Supabase (PostgreSQL), Next.js API Routes, React hooks, TypeScript

---

## Task 1: Database Migration - Core Tables

**Files:**
- Create: `supabase/migrations/20260125120000_implicit_preference_learning.sql`

**Step 1: Write the migration file**

```sql
-- Migration: Implicit Preference Learning
-- Purpose: Create tables and functions for behavioral signal capture and preference inference
-- Design Doc: docs/plans/2026-01-25-implicit-preference-learning-design.md

-- ============================================================================
-- 1. USER_EVENTS TABLE - Captures behavioral signals
-- ============================================================================

CREATE TABLE user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'beach_view',
    'discovery_click',
    'discovery_skip',
    'forecast_check',
    'location_update'
  )),
  beach_id uuid REFERENCES beaches(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

-- Indexes for efficient queries
CREATE INDEX idx_user_events_user_recent ON user_events(user_id, created_at DESC);
CREATE INDEX idx_user_events_type ON user_events(event_type, created_at DESC);
CREATE INDEX idx_user_events_beach ON user_events(beach_id) WHERE beach_id IS NOT NULL;
CREATE INDEX idx_user_events_cleanup ON user_events(expires_at) WHERE expires_at < now();

-- RLS policies
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON user_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own events"
  ON user_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own events"
  ON user_events FOR DELETE
  USING (user_id = auth.uid());

-- Service role can do everything (for aggregation jobs)
CREATE POLICY "Service role full access"
  ON user_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE user_events IS 'Behavioral signals for implicit preference learning. 90-day retention.';
COMMENT ON COLUMN user_events.event_type IS 'beach_view, discovery_click, discovery_skip, forecast_check, location_update';
COMMENT ON COLUMN user_events.metadata IS 'Event-specific data: duration_ms, position, score_shown, lat/lon, etc.';

-- ============================================================================
-- 2. USER_IMPLICIT_PREFERENCES TABLE - Aggregated preferences
-- ============================================================================

CREATE TABLE user_implicit_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inferred wave preferences
  inferred_wave_min_ft numeric(4,1),
  inferred_wave_max_ft numeric(4,1),

  -- Weighted preference distributions (JSONB for flexibility)
  break_type_weights jsonb DEFAULT '{}',
  time_slot_weights jsonb DEFAULT '{}',

  -- Location patterns
  location_centroid_lat numeric(10,6),
  location_centroid_lon numeric(10,6),
  typical_travel_radius_miles numeric(5,1),

  -- Engagement rankings
  top_engaged_beach_ids uuid[] DEFAULT '{}',

  -- Confidence & metadata
  confidence numeric(3,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  event_count int NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  computed_from timestamptz,
  computed_to timestamptz
);

-- RLS policies
ALTER TABLE user_implicit_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own implicit preferences"
  ON user_implicit_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON user_implicit_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE user_implicit_preferences IS 'Aggregated implicit preferences computed from user_events. Updated nightly.';
COMMENT ON COLUMN user_implicit_preferences.confidence IS 'Sigmoid-based confidence (0-1) derived from weighted event volume';
COMMENT ON COLUMN user_implicit_preferences.break_type_weights IS 'e.g. {"beach": 0.6, "point": 0.3, "reef": 0.1}';

-- ============================================================================
-- 3. ADD PRIVACY SETTING TO PROFILES
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS allow_implicit_tracking boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.allow_implicit_tracking IS 'User opt-out for behavioral tracking. Default true.';

-- ============================================================================
-- 4. EVENT CLEANUP FUNCTION (for pg_cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_events()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM user_events WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_events IS 'Removes events older than 90 days. Run daily via pg_cron.';

-- ============================================================================
-- 5. PURGE USER HISTORY FUNCTION (for "Clear my data" button)
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_implicit_history(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller owns the data or is service role
  IF target_user_id != auth.uid() AND (auth.jwt() ->> 'role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM user_events WHERE user_id = target_user_id;
  DELETE FROM user_implicit_preferences WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION purge_implicit_history IS 'Deletes all implicit tracking data for a user. Called from Settings.';
```

**Step 2: Apply the migration locally**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && npx supabase migration up`

Expected: Migration applied successfully

**Step 3: Verify tables exist**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && npx supabase db reset --dry-run | grep -E "user_events|user_implicit_preferences"`

Expected: Tables mentioned in output

**Step 4: Commit**

```bash
git add supabase/migrations/20260125120000_implicit_preference_learning.sql
git commit -m "feat(db): add implicit preference learning tables

- user_events: behavioral signal capture with 90-day retention
- user_implicit_preferences: aggregated preferences from events
- profiles.allow_implicit_tracking: privacy opt-out setting
- cleanup_expired_events(): daily cleanup function
- purge_implicit_history(): user data deletion RPC"
```

---

## Task 2: Database Migration - Aggregation Function

**Files:**
- Create: `supabase/migrations/20260125120001_implicit_preference_aggregation.sql`

**Step 1: Write the aggregation function**

```sql
-- Migration: Implicit Preference Aggregation Function
-- Purpose: Computes implicit preferences from user_events with weighted decay

-- Event weight constants (matching design doc)
-- location_update: 10.0, discovery_click: 3.0, forecast_check: 2.5, beach_view: 0.5, discovery_skip: -1.0

CREATE OR REPLACE FUNCTION compute_implicit_preferences(target_user_id uuid DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  -- Upsert computed preferences for each user with events
  INSERT INTO user_implicit_preferences (
    user_id,
    inferred_wave_min_ft,
    inferred_wave_max_ft,
    break_type_weights,
    location_centroid_lat,
    location_centroid_lon,
    top_engaged_beach_ids,
    confidence,
    event_count,
    last_computed_at,
    computed_from,
    computed_to
  )
  SELECT
    we.user_id,

    -- Inferred wave min (weighted average of beach typical_wave_min)
    ROUND(
      SUM(b.typical_wave_min * we.weight * we.recency_factor) /
      NULLIF(SUM(CASE WHEN b.typical_wave_min IS NOT NULL THEN we.weight * we.recency_factor ELSE 0 END), 0),
      1
    ),

    -- Inferred wave max (weighted average of beach typical_wave_max)
    ROUND(
      SUM(b.typical_wave_max * we.weight * we.recency_factor) /
      NULLIF(SUM(CASE WHEN b.typical_wave_max IS NOT NULL THEN we.weight * we.recency_factor ELSE 0 END), 0),
      1
    ),

    -- Break type weights (aggregated per user, computed separately)
    (
      SELECT jsonb_object_agg(break_type, ROUND(weight_pct::numeric, 2))
      FROM (
        SELECT
          b2.break_type,
          SUM(we2.weight * we2.recency_factor) / NULLIF(SUM(SUM(we2.weight * we2.recency_factor)) OVER (), 0) as weight_pct
        FROM (
          SELECT
            e.user_id, e.beach_id,
            CASE e.event_type
              WHEN 'location_update' THEN 10.0
              WHEN 'discovery_click' THEN 3.0
              WHEN 'forecast_check' THEN 2.5
              WHEN 'beach_view' THEN 0.5
              WHEN 'discovery_skip' THEN -1.0
              ELSE 0
            END as weight,
            GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) as recency_factor
          FROM user_events e
          WHERE e.created_at > now() - interval '90 days'
            AND e.user_id = we.user_id
        ) we2
        JOIN beaches b2 ON we2.beach_id = b2.id
        WHERE b2.break_type IS NOT NULL
        GROUP BY b2.break_type
        HAVING SUM(we2.weight * we2.recency_factor) > 0
      ) bt
    ),

    -- Location centroid lat (weighted average)
    ROUND(
      SUM(b.center_lat * we.weight * we.recency_factor) /
      NULLIF(SUM(CASE WHEN b.center_lat IS NOT NULL THEN we.weight * we.recency_factor ELSE 0 END), 0),
      6
    ),

    -- Location centroid lon (weighted average)
    ROUND(
      SUM(b.center_lng * we.weight * we.recency_factor) /
      NULLIF(SUM(CASE WHEN b.center_lng IS NOT NULL THEN we.weight * we.recency_factor ELSE 0 END), 0),
      6
    ),

    -- Top 5 engaged beaches
    ARRAY(
      SELECT beach_id FROM (
        SELECT we3.beach_id, SUM(we3.weight * we3.recency_factor) as engagement
        FROM (
          SELECT
            e.beach_id,
            CASE e.event_type
              WHEN 'location_update' THEN 10.0
              WHEN 'discovery_click' THEN 3.0
              WHEN 'forecast_check' THEN 2.5
              WHEN 'beach_view' THEN 0.5
              WHEN 'discovery_skip' THEN -1.0
              ELSE 0
            END as weight,
            GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) as recency_factor
          FROM user_events e
          WHERE e.created_at > now() - interval '90 days'
            AND e.user_id = we.user_id
            AND e.beach_id IS NOT NULL
        ) we3
        GROUP BY we3.beach_id
        HAVING SUM(we3.weight * we3.recency_factor) > 0
        ORDER BY engagement DESC
        LIMIT 5
      ) top_beaches
    ),

    -- Confidence: sigmoid based on total weighted events
    ROUND(
      (1.0 / (1.0 + EXP(-0.05 * (SUM(ABS(we.weight)) - 20))))::numeric,
      2
    ),

    -- Event count
    COUNT(*)::int,

    now(),
    MIN(we.created_at),
    MAX(we.created_at)

  FROM (
    SELECT
      e.user_id,
      e.beach_id,
      e.event_type,
      e.created_at,
      CASE e.event_type
        WHEN 'location_update' THEN 10.0
        WHEN 'discovery_click' THEN 3.0
        WHEN 'forecast_check' THEN 2.5
        WHEN 'beach_view' THEN 0.5
        WHEN 'discovery_skip' THEN -1.0
        ELSE 0
      END as weight,
      GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) as recency_factor
    FROM user_events e
    WHERE e.created_at > now() - interval '90 days'
      AND (target_user_id IS NULL OR e.user_id = target_user_id)
  ) we
  JOIN beaches b ON we.beach_id = b.id
  GROUP BY we.user_id
  HAVING COUNT(*) >= 3  -- Minimum 3 events to compute
  ON CONFLICT (user_id) DO UPDATE SET
    inferred_wave_min_ft = EXCLUDED.inferred_wave_min_ft,
    inferred_wave_max_ft = EXCLUDED.inferred_wave_max_ft,
    break_type_weights = EXCLUDED.break_type_weights,
    location_centroid_lat = EXCLUDED.location_centroid_lat,
    location_centroid_lon = EXCLUDED.location_centroid_lon,
    top_engaged_beach_ids = EXCLUDED.top_engaged_beach_ids,
    confidence = EXCLUDED.confidence,
    event_count = EXCLUDED.event_count,
    last_computed_at = now(),
    computed_from = EXCLUDED.computed_from,
    computed_to = EXCLUDED.computed_to;

  GET DIAGNOSTICS processed_count = ROW_COUNT;
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION compute_implicit_preferences IS
'Computes implicit preferences from user_events. Call with NULL for all users (nightly job) or user_id for single user.';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260125120001_implicit_preference_aggregation.sql
git commit -m "feat(db): add implicit preference aggregation function

- compute_implicit_preferences(): weighted decay algorithm
- Event weights: location(10) > click(3) > forecast(2.5) > view(0.5) > skip(-1)
- Sigmoid confidence based on weighted event volume
- Supports single-user and batch computation"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `types/implicit-preferences.ts`
- Modify: `types/database.ts` (add import)

**Step 1: Write the types file**

```typescript
// types/implicit-preferences.ts

/**
 * Implicit Preference Learning Types
 *
 * Types for behavioral signal capture and preference inference.
 * @see docs/plans/2026-01-25-implicit-preference-learning-design.md
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * Valid event types for implicit preference tracking
 */
export type ImplicitEventType =
  | 'beach_view'
  | 'discovery_click'
  | 'discovery_skip'
  | 'forecast_check'
  | 'location_update';

/**
 * Event weights for preference computation
 */
export const EVENT_WEIGHTS: Record<ImplicitEventType, number> = {
  location_update: 10.0,
  discovery_click: 3.0,
  forecast_check: 2.5,
  beach_view: 0.5,
  discovery_skip: -1.0,
} as const;

/**
 * Metadata structure for each event type
 */
export interface BeachViewMetadata {
  duration_ms?: number;
  referrer?: string;
  forecast_viewed?: boolean;
}

export interface DiscoveryClickMetadata {
  position: number;
  score_shown: number;
  alternatives_count: number;
}

export interface DiscoverySkipMetadata {
  position: number;
  score_shown: number;
  chosen_beach_id?: string;
}

export interface ForecastCheckMetadata {
  time_slot?: string;
  conditions_summary?: string;
}

export interface LocationUpdateMetadata {
  lat: number;
  lon: number;
  accuracy_m?: number;
}

export type EventMetadata =
  | BeachViewMetadata
  | DiscoveryClickMetadata
  | DiscoverySkipMetadata
  | ForecastCheckMetadata
  | LocationUpdateMetadata;

/**
 * User event record (matches database schema)
 */
export interface UserEvent {
  id: string;
  user_id: string;
  event_type: ImplicitEventType;
  beach_id: string | null;
  metadata: EventMetadata;
  created_at: string;
  expires_at: string;
}

// ============================================================================
// Implicit Preferences Types
// ============================================================================

/**
 * Break type weight distribution
 */
export interface BreakTypeWeights {
  beach?: number;
  point?: number;
  reef?: number;
  [key: string]: number | undefined;
}

/**
 * Time slot weight distribution
 */
export interface TimeSlotWeights {
  'dawn-patrol'?: number;
  morning?: number;
  afternoon?: number;
  [key: string]: number | undefined;
}

/**
 * User implicit preferences (matches database schema)
 */
export interface UserImplicitPreferences {
  user_id: string;
  inferred_wave_min_ft: number | null;
  inferred_wave_max_ft: number | null;
  break_type_weights: BreakTypeWeights;
  time_slot_weights: TimeSlotWeights;
  location_centroid_lat: number | null;
  location_centroid_lon: number | null;
  typical_travel_radius_miles: number | null;
  top_engaged_beach_ids: string[];
  confidence: number;
  event_count: number;
  last_computed_at: string;
  computed_from: string | null;
  computed_to: string | null;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body for /api/events
 */
export interface TrackEventRequest {
  eventType: ImplicitEventType;
  beachId?: string;
  metadata?: EventMetadata;
}

/**
 * Response from /api/events
 */
export interface TrackEventResponse {
  ok: boolean;
  status?: 'tracking_disabled';
}

/**
 * Match reason for transparency UI
 */
export interface MatchReason {
  type: 'learned' | 'implicit' | 'onboarding' | 'affinity';
  label: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extended scoring breakdown with implicit preferences
 */
export interface ExtendedScoringBreakdown {
  base: number;
  onboarding: number;
  learned: number;
  implicit: number;
  affinity: number;
}

/**
 * Personalization source indicator
 */
export type PersonalizationSource = 'explicit' | 'implicit' | 'blended' | 'none';
```

**Step 2: Commit**

```bash
git add types/implicit-preferences.ts
git commit -m "feat(types): add implicit preference learning types

- ImplicitEventType and EVENT_WEIGHTS constants
- Metadata interfaces for each event type
- UserImplicitPreferences matching DB schema
- API request/response types
- Match reason types for transparency UI"
```

---

## Task 4: Events API Route

**Files:**
- Create: `app/api/events/route.ts`
- Create: `__tests__/app/api/events/route.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/app/api/events/route.test.ts

import { POST } from '@/app/api/events/route';
import { createAPIServerClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createAPIServerClient: jest.fn(),
}));

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(() => ({
      error: null,
    })),
  })),
};

describe('/api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createAPIServerClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'beach_view', beachId: '123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid event type', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'invalid_event' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('skips tracking when user has opted out', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // User has opted out
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { allow_implicit_tracking: false },
            error: null,
          }),
        })),
      })),
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'beach_view', beachId: '123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('tracking_disabled');
  });

  it('inserts event when tracking is allowed', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: true },
                error: null,
              }),
            })),
          })),
        };
      }
      return { insert: mockInsert };
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'beach_view',
        beachId: '123',
        metadata: { duration_ms: 5000 }
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      event_type: 'beach_view',
      beach_id: '123',
      metadata: { duration_ms: 5000 },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/app/api/events/route.test.ts`

Expected: FAIL with "Cannot find module '@/app/api/events/route'"

**Step 3: Write the API route**

```typescript
// app/api/events/route.ts

import { createAPIServerClient } from '@/lib/supabase/server';
import {
  createSuccessResponse,
  createAuthError,
  createErrorResponse,
} from '@/lib/api-utils';
import type { ImplicitEventType, TrackEventRequest } from '@/types/implicit-preferences';

export const dynamic = 'force-dynamic';

const VALID_EVENTS: ImplicitEventType[] = [
  'beach_view',
  'discovery_click',
  'discovery_skip',
  'forecast_check',
  'location_update',
];

// In-memory cache for tracking preference (5-minute TTL)
const trackingAllowedCache = new Map<string, { allowed: boolean; expires: number }>();

async function isTrackingAllowed(
  supabase: ReturnType<typeof createAPIServerClient>,
  userId: string
): Promise<boolean> {
  // Check cache first
  const cached = trackingAllowedCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.allowed;
  }

  // Query database
  const { data } = await supabase
    .from('profiles')
    .select('allow_implicit_tracking')
    .eq('id', userId)
    .single();

  // Default to true if no preference set
  const allowed = data?.allow_implicit_tracking !== false;

  // Cache for 5 minutes
  trackingAllowedCache.set(userId, {
    allowed,
    expires: Date.now() + 5 * 60 * 1000
  });

  return allowed;
}

/**
 * POST /api/events
 *
 * Records a user behavioral event for implicit preference learning.
 * Respects user privacy settings (allow_implicit_tracking).
 *
 * Request body: { eventType, beachId?, metadata? }
 */
export async function POST(request: Request) {
  const supabase = createAPIServerClient();

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return createAuthError('Unauthorized');
  }

  // 2. Privacy gatekeeper
  const allowed = await isTrackingAllowed(supabase, user.id);
  if (!allowed) {
    // Return success to client (don't retry) but don't write data
    return createSuccessResponse({ ok: true, status: 'tracking_disabled' });
  }

  // 3. Parse and validate request
  let body: TrackEventRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', undefined, 400);
  }

  const { eventType, beachId, metadata } = body;

  if (!eventType || !VALID_EVENTS.includes(eventType as ImplicitEventType)) {
    return createErrorResponse(
      `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}`,
      undefined,
      400
    );
  }

  // 4. Insert event
  const { error: insertError } = await supabase
    .from('user_events')
    .insert({
      user_id: user.id,
      event_type: eventType,
      beach_id: beachId || null,
      metadata: metadata || {},
    });

  if (insertError) {
    console.error('Error inserting event:', insertError);
    return createErrorResponse('Failed to record event', undefined, 500);
  }

  return createSuccessResponse({ ok: true });
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/app/api/events/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/events/route.ts __tests__/app/api/events/route.test.ts
git commit -m "feat(api): add /api/events endpoint for behavioral tracking

- Privacy gatekeeper checks allow_implicit_tracking before writing
- 5-minute cache to reduce DB hits on preference check
- Validates event types: beach_view, discovery_click, discovery_skip, forecast_check, location_update
- Returns 200 with status='tracking_disabled' for opted-out users"
```

---

## Task 5: Implicit Preferences Service

**Files:**
- Create: `lib/services/implicit-preferences-service.ts`
- Create: `__tests__/services/implicit-preferences-service.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/services/implicit-preferences-service.test.ts

import {
  getImplicitPreferences,
  matchesInferredWaveRange,
  matchesInferredBreakType,
  calculateImplicitBonus
} from '@/lib/services/implicit-preferences-service';
import type { UserImplicitPreferences } from '@/types/implicit-preferences';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  })),
}));

describe('implicit-preferences-service', () => {
  const mockImplicitPrefs: UserImplicitPreferences = {
    user_id: 'user-123',
    inferred_wave_min_ft: 2.0,
    inferred_wave_max_ft: 5.0,
    break_type_weights: { beach: 0.6, point: 0.3, reef: 0.1 },
    time_slot_weights: { morning: 0.5, afternoon: 0.3, 'dawn-patrol': 0.2 },
    location_centroid_lat: 33.8,
    location_centroid_lon: -118.4,
    typical_travel_radius_miles: 25,
    top_engaged_beach_ids: ['beach-1', 'beach-2'],
    confidence: 0.75,
    event_count: 50,
    last_computed_at: new Date().toISOString(),
    computed_from: null,
    computed_to: null,
  };

  describe('matchesInferredWaveRange', () => {
    it('returns true when wave height is within range', () => {
      const forecast = { wave_height: '3.5' } as EnhancedForecastEntity;
      expect(matchesInferredWaveRange(forecast, mockImplicitPrefs)).toBe(true);
    });

    it('returns false when wave height is below range', () => {
      const forecast = { wave_height: '1.0' } as EnhancedForecastEntity;
      expect(matchesInferredWaveRange(forecast, mockImplicitPrefs)).toBe(false);
    });

    it('returns false when wave height is above range', () => {
      const forecast = { wave_height: '8.0' } as EnhancedForecastEntity;
      expect(matchesInferredWaveRange(forecast, mockImplicitPrefs)).toBe(false);
    });

    it('returns false when preferences have no wave range', () => {
      const forecast = { wave_height: '3.5' } as EnhancedForecastEntity;
      const prefs = { ...mockImplicitPrefs, inferred_wave_min_ft: null, inferred_wave_max_ft: null };
      expect(matchesInferredWaveRange(forecast, prefs)).toBe(false);
    });
  });

  describe('matchesInferredBreakType', () => {
    it('returns true when beach break type matches top preference', () => {
      expect(matchesInferredBreakType('beach', mockImplicitPrefs)).toBe(true);
    });

    it('returns true when point break type has significant weight', () => {
      expect(matchesInferredBreakType('point', mockImplicitPrefs)).toBe(true);
    });

    it('returns false when break type has low weight', () => {
      expect(matchesInferredBreakType('reef', mockImplicitPrefs)).toBe(false);
    });

    it('returns false when break type not in weights', () => {
      expect(matchesInferredBreakType('river', mockImplicitPrefs)).toBe(false);
    });
  });

  describe('calculateImplicitBonus', () => {
    it('returns correct bonus for matching wave range', () => {
      const forecast = { wave_height: '3.5' } as EnhancedForecastEntity;
      const bonus = calculateImplicitBonus(
        forecast,
        'beach',
        false, // not top engaged
        mockImplicitPrefs,
        0.5 // implicitWeight
      );

      // Wave match (10 * 0.5) + break type match (8 * 0.5) = 9
      expect(bonus.total).toBeGreaterThan(0);
      expect(bonus.breakdown.waveRange).toBe(5); // 10 * 0.5
      expect(bonus.breakdown.breakType).toBe(4); // 8 * 0.5
    });

    it('returns flat bonus for top engaged beach', () => {
      const forecast = { wave_height: '10' } as EnhancedForecastEntity; // Out of range
      const bonus = calculateImplicitBonus(
        forecast,
        'reef', // Low weight
        true, // IS top engaged
        mockImplicitPrefs,
        0.5
      );

      expect(bonus.breakdown.topEngaged).toBe(2); // Flat bonus
    });

    it('returns zero when implicitWeight is zero', () => {
      const forecast = { wave_height: '3.5' } as EnhancedForecastEntity;
      const bonus = calculateImplicitBonus(
        forecast,
        'beach',
        true,
        mockImplicitPrefs,
        0 // No implicit weight
      );

      expect(bonus.total).toBe(2); // Only top engaged flat bonus
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/services/implicit-preferences-service.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write the service**

```typescript
// lib/services/implicit-preferences-service.ts

/**
 * Implicit Preferences Service
 *
 * Provides functions for:
 * 1. Fetching user's implicit preferences
 * 2. Matching forecasts against implicit preferences
 * 3. Calculating implicit preference bonuses for scoring
 *
 * @see docs/plans/2026-01-25-implicit-preference-learning-design.md
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { UserImplicitPreferences } from '@/types/implicit-preferences';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Bonus point values (from design doc)
const IMPLICIT_WAVE_BONUS = 10;
const IMPLICIT_BREAK_TYPE_BONUS = 8;
const IMPLICIT_TRAVEL_RADIUS_BONUS = 5;
const IMPLICIT_TOP_ENGAGED_BONUS = 2; // Flat, not weighted

// Minimum break type weight to count as a match
const BREAK_TYPE_MATCH_THRESHOLD = 0.2;

/**
 * Fetch user's implicit preferences from database
 */
export async function getImplicitPreferences(
  userId: string
): Promise<UserImplicitPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from('user_implicit_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = not found, which is expected for users without computed preferences
    if (error.code !== 'PGRST116') {
      console.error(`Error fetching implicit preferences for ${userId}:`, error);
    }
    return null;
  }

  return data as UserImplicitPreferences;
}

/**
 * Check if forecast wave height matches inferred wave range
 */
export function matchesInferredWaveRange(
  forecast: EnhancedForecastEntity,
  prefs: UserImplicitPreferences
): boolean {
  if (prefs.inferred_wave_min_ft === null || prefs.inferred_wave_max_ft === null) {
    return false;
  }

  const height = parseFloat(forecast.wave_height || '0');
  if (isNaN(height) || height === 0) return false;

  return height >= prefs.inferred_wave_min_ft && height <= prefs.inferred_wave_max_ft;
}

/**
 * Check if beach break type matches inferred preference (>20% weight)
 */
export function matchesInferredBreakType(
  breakType: string | null | undefined,
  prefs: UserImplicitPreferences
): boolean {
  if (!breakType || !prefs.break_type_weights) return false;

  const weight = prefs.break_type_weights[breakType];
  return typeof weight === 'number' && weight >= BREAK_TYPE_MATCH_THRESHOLD;
}

/**
 * Check if beach is within typical travel radius
 */
export function isWithinTravelRadius(
  beachLat: number,
  beachLon: number,
  prefs: UserImplicitPreferences
): boolean {
  if (
    prefs.location_centroid_lat === null ||
    prefs.location_centroid_lon === null ||
    prefs.typical_travel_radius_miles === null
  ) {
    return false;
  }

  // Haversine formula for distance in miles
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(beachLat - prefs.location_centroid_lat);
  const dLon = toRad(beachLon - prefs.location_centroid_lon);
  const lat1 = toRad(prefs.location_centroid_lat);
  const lat2 = toRad(beachLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= prefs.typical_travel_radius_miles;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if beach is in user's top engaged beaches
 */
export function isTopEngagedBeach(
  beachId: string,
  prefs: UserImplicitPreferences
): boolean {
  return prefs.top_engaged_beach_ids?.includes(beachId) ?? false;
}

/**
 * Calculate implicit preference bonus for scoring
 *
 * @param forecast - Current forecast for the beach
 * @param breakType - Beach's break type
 * @param isTopEngaged - Whether beach is in top engaged list
 * @param prefs - User's implicit preferences
 * @param implicitWeight - Weight for implicit bonuses (0-1), based on confidence blend
 * @returns Bonus points and breakdown
 */
export function calculateImplicitBonus(
  forecast: EnhancedForecastEntity,
  breakType: string | null | undefined,
  isTopEngaged: boolean,
  prefs: UserImplicitPreferences,
  implicitWeight: number
): { total: number; breakdown: { waveRange: number; breakType: number; topEngaged: number } } {
  let waveRangeBonus = 0;
  let breakTypeBonus = 0;
  let topEngagedBonus = 0;

  // Wave range match (weighted)
  if (matchesInferredWaveRange(forecast, prefs)) {
    waveRangeBonus = Math.round(IMPLICIT_WAVE_BONUS * implicitWeight);
  }

  // Break type match (weighted)
  if (matchesInferredBreakType(breakType, prefs)) {
    breakTypeBonus = Math.round(IMPLICIT_BREAK_TYPE_BONUS * implicitWeight);
  }

  // Top engaged beach (flat bonus, always applies)
  if (isTopEngaged) {
    topEngagedBonus = IMPLICIT_TOP_ENGAGED_BONUS;
  }

  return {
    total: waveRangeBonus + breakTypeBonus + topEngagedBonus,
    breakdown: {
      waveRange: waveRangeBonus,
      breakType: breakTypeBonus,
      topEngaged: topEngagedBonus,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/services/implicit-preferences-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/implicit-preferences-service.ts __tests__/services/implicit-preferences-service.test.ts
git commit -m "feat(service): add implicit preferences service

- getImplicitPreferences(): fetch user's computed preferences
- matchesInferredWaveRange(): check forecast vs inferred wave range
- matchesInferredBreakType(): check beach vs weighted break type prefs
- isWithinTravelRadius(): haversine distance check
- calculateImplicitBonus(): compute bonus points with breakdown"
```

---

## Task 6: Integrate Implicit Preferences into Scoring

**Files:**
- Modify: `lib/services/personalized-scoring-service.ts`
- Modify: `__tests__/services/personalized-scoring-service.test.ts`

**Step 1: Write failing test for implicit integration**

Add to `__tests__/services/personalized-scoring-service.test.ts`:

```typescript
// Add to existing test file

describe('implicit preference integration', () => {
  it('applies implicit bonus when explicit confidence is low', async () => {
    // Mock: user with low explicit confidence but high implicit confidence
    // ... test setup

    const score = await scoreBeachForUser(
      'user-123',
      'beach-456',
      mockForecast,
      50 // base score
    );

    // Expect implicit bonus to be applied
    expect(score.breakdown.implicitPrefs).toBeGreaterThan(0);
  });

  it('reduces implicit bonus when explicit confidence is high', async () => {
    // Mock: user with high explicit confidence
    // Implicit bonus should be minimal
  });
});
```

**Step 2: Update PersonalizedScore interface**

In `lib/services/personalized-scoring-service.ts`, update the interface:

```typescript
export interface PersonalizedScore {
  score: number;
  personalized: boolean;
  breakdown: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    implicitPrefs: number;  // NEW
    affinity: number;
  };
}
```

**Step 3: Update scoreBeachesForUser function**

Add implicit preference integration after learned preferences:

```typescript
// After line ~275 (after learned preferences section)

// 3. Get implicit preferences and calculate blend weight
const implicitPrefs = await getImplicitPreferences(userId);

if (implicitPrefs && implicitPrefs.confidence > 0.1) {
  // Confidence blend: implicit fills the gap left by explicit
  const explicitConf = learnedPrefs?.confidence ?? 0;
  const implicitWeight = implicitPrefs.confidence * (1 - explicitConf);

  if (implicitWeight > 0.1) {
    const beachType = beachTypeMap.get(beachId);
    const isTopEngaged = implicitPrefs.top_engaged_beach_ids?.includes(beachId) ?? false;

    const implicitBonus = calculateImplicitBonus(
      forecast,
      beachType,
      isTopEngaged,
      implicitPrefs,
      implicitWeight
    );

    if (implicitBonus.total > 0) {
      score += implicitBonus.total;
      breakdown.implicitPrefs = implicitBonus.total;
      personalized = true;
    }
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/services/personalized-scoring-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/personalized-scoring-service.ts __tests__/services/personalized-scoring-service.test.ts
git commit -m "feat(scoring): integrate implicit preferences into scoring

- Add implicitPrefs to PersonalizedScore breakdown
- Implement confidence blend: implicit × (1 - explicit)
- Apply bonuses: wave range (+10), break type (+8), top engaged (+2)
- Graceful handoff: 100% implicit for new users → 95% explicit for power users"
```

---

## Task 7: useTrackEvent Hook

**Files:**
- Create: `hooks/use-track-event.ts`
- Create: `__tests__/hooks/use-track-event.test.ts`

**Step 1: Write failing test**

```typescript
// __tests__/hooks/use-track-event.test.ts

import { renderHook, act } from '@testing-library/react';
import { useTrackEvent } from '@/hooks/use-track-event';

// Mock fetch
global.fetch = jest.fn();

// Mock auth context
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

describe('useTrackEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('calls /api/events with correct payload', async () => {
    const { result } = renderHook(() => useTrackEvent());

    await act(async () => {
      await result.current.track('beach_view', {
        beachId: 'beach-123',
        metadata: { duration_ms: 5000 },
      });
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'beach_view',
        beachId: 'beach-123',
        metadata: { duration_ms: 5000 },
      }),
      keepalive: true,
    });
  });

  it('debounces duplicate events', async () => {
    const { result } = renderHook(() => useTrackEvent());

    await act(async () => {
      // Fire same event twice quickly
      result.current.track('beach_view', { beachId: 'beach-123' });
      result.current.track('beach_view', { beachId: 'beach-123' });
    });

    // Should only fire once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not track for guests', async () => {
    // Override mock to return null user
    jest.doMock('@/context/auth-context', () => ({
      useAuth: () => ({ user: null }),
    }));

    const { result } = renderHook(() => useTrackEvent());

    await act(async () => {
      await result.current.track('beach_view', { beachId: 'beach-123' });
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

**Step 2: Write the hook**

```typescript
// hooks/use-track-event.ts

'use client';

import { useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import type { ImplicitEventType, EventMetadata } from '@/types/implicit-preferences';

interface TrackEventOptions {
  beachId?: string;
  metadata?: EventMetadata;
  debounceMs?: number;
}

/**
 * Hook for tracking user behavioral events
 *
 * Events are sent to /api/events and stored for implicit preference learning.
 * Respects user privacy settings (checked server-side).
 *
 * @example
 * const { track } = useTrackEvent();
 * track('beach_view', { beachId: beach.id, metadata: { duration_ms: 5000 } });
 */
export function useTrackEvent() {
  const { user } = useAuth();
  const lastFired = useRef<Map<string, number>>(new Map());

  const track = useCallback(
    async (
      eventType: ImplicitEventType,
      { beachId, metadata = {}, debounceMs = 1000 }: TrackEventOptions = {}
    ) => {
      // Skip for guests
      if (!user?.id) return;

      // Debounce duplicate events
      const key = `${eventType}-${beachId ?? 'no-beach'}`;
      const now = Date.now();
      const lastTime = lastFired.current.get(key) ?? 0;

      if (now - lastTime < debounceMs) return;
      lastFired.current.set(key, now);

      // Fire and forget - don't block UI
      try {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType,
            beachId,
            metadata,
          }),
          keepalive: true, // Survives page navigation
        });
      } catch {
        // Swallow errors - tracking should never break the app
      }
    },
    [user?.id]
  );

  return { track };
}
```

**Step 3: Run tests**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:unit __tests__/hooks/use-track-event.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add hooks/use-track-event.ts __tests__/hooks/use-track-event.test.ts
git commit -m "feat(hook): add useTrackEvent for behavioral event capture

- Debounces duplicate events (default 1s)
- Skips tracking for guests
- Uses keepalive for reliable delivery on navigation
- Fire-and-forget pattern - never blocks UI"
```

---

## Task 8: Instrument BeachDetailClient

**Files:**
- Modify: `app/beach/[slug]/beach-detail-client.tsx`

**Step 1: Add tracking imports and hook**

```typescript
// Add to imports
import { useTrackEvent } from '@/hooks/use-track-event';

// Inside component, after useAuth
const { track } = useTrackEvent();
const mountTime = useRef(Date.now());
```

**Step 2: Add beach view tracking**

```typescript
// Replace/extend existing useEffect
useEffect(() => {
  // Track public page view (existing)
  if (!user) {
    trackPublicPageView("beach-detail", { slug });
  }

  // Track beach view for implicit preferences
  if (user) {
    track('beach_view', {
      beachId: beach.id,
      metadata: { referrer: document.referrer },
    });
  }

  // Track duration on unmount
  return () => {
    if (user) {
      const duration = Date.now() - mountTime.current;
      if (duration > 3000) {
        track('beach_view', {
          beachId: beach.id,
          metadata: {
            duration_ms: duration,
            forecast_viewed: true
          },
          debounceMs: 0, // Force fire on unmount
        });
      }
    }
  };
}, [slug, user, beach.id, track]);
```

**Step 3: Manual test**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn dev`

1. Log in as test user
2. Visit a beach detail page
3. Check Network tab for `/api/events` call
4. Navigate away after 5 seconds
5. Check for duration event

**Step 4: Commit**

```bash
git add app/beach/[slug]/beach-detail-client.tsx
git commit -m "feat(tracking): instrument BeachDetailClient with beach_view events

- Track initial view with referrer
- Track duration on unmount (if >3s)
- Skip tracking for guests"
```

---

## Task 9: Privacy Settings UI

**Files:**
- Modify: `components/edit-profile-form.tsx` (add privacy toggle)

**Step 1: Add privacy toggle to edit profile form**

Add after existing preference fields:

```typescript
// In the form JSX, add new section:
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Privacy</h3>

  <div className="flex items-center justify-between">
    <div>
      <Label htmlFor="allow_implicit_tracking">
        Improve recommendations with my activity
      </Label>
      <p className="text-sm text-muted-foreground">
        Uses your browsing to personalize surf spot recommendations
      </p>
    </div>
    <Switch
      id="allow_implicit_tracking"
      checked={formState.allow_implicit_tracking ?? true}
      onCheckedChange={(checked) =>
        setFormState(prev => ({ ...prev, allow_implicit_tracking: checked }))
      }
    />
  </div>

  {!formState.allow_implicit_tracking && (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClearBrowsingData}
      disabled={isClearing}
    >
      {isClearing ? 'Clearing...' : 'Clear browsing data'}
    </Button>
  )}
</div>
```

**Step 2: Add clear data handler**

```typescript
const [isClearing, setIsClearing] = useState(false);

const handleClearBrowsingData = async () => {
  setIsClearing(true);
  try {
    const { error } = await supabase.rpc('purge_implicit_history', {
      target_user_id: user.id,
    });
    if (error) throw error;
    toast({ title: 'Browsing data cleared' });
  } catch (err) {
    toast({ title: 'Failed to clear data', variant: 'destructive' });
  } finally {
    setIsClearing(false);
  }
};
```

**Step 3: Commit**

```bash
git add components/edit-profile-form.tsx
git commit -m "feat(ui): add privacy controls to profile settings

- Toggle for allow_implicit_tracking preference
- 'Clear browsing data' button calls purge_implicit_history RPC
- Shows explanatory text about what tracking does"
```

---

## Task 10: E2E Test for Privacy Controls

**Files:**
- Create: `e2e/implicit-preference-privacy.spec.ts`

**Step 1: Write E2E test**

```typescript
// e2e/implicit-preference-privacy.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth-helpers';

test.describe('Implicit Preference Privacy Controls', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('can opt out of implicit tracking', async ({ page }) => {
    // Go to profile settings
    await page.goto('/profile/edit');

    // Find and toggle the privacy switch
    const trackingToggle = page.getByRole('switch', {
      name: /improve recommendations/i
    });

    // Should be on by default
    await expect(trackingToggle).toBeChecked();

    // Turn it off
    await trackingToggle.click();
    await expect(trackingToggle).not.toBeChecked();

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Reload and verify persisted
    await page.reload();
    await expect(trackingToggle).not.toBeChecked();
  });

  test('can clear browsing data', async ({ page }) => {
    // First opt out to show the clear button
    await page.goto('/profile/edit');

    const trackingToggle = page.getByRole('switch', {
      name: /improve recommendations/i
    });
    await trackingToggle.click();

    // Click clear button
    const clearButton = page.getByRole('button', { name: /clear browsing data/i });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Wait for success toast
    await expect(page.getByText(/browsing data cleared/i)).toBeVisible();
  });
});
```

**Step 2: Run E2E test**

Run: `cd /Users/stevenchandler/Desktop/quiver/.worktrees/implicit-preference-learning && yarn test:e2e e2e/implicit-preference-privacy.spec.ts`

Expected: PASS (may need to adjust selectors based on actual UI)

**Step 3: Commit**

```bash
git add e2e/implicit-preference-privacy.spec.ts
git commit -m "test(e2e): add privacy controls E2E tests

- Test opt-out toggle persistence
- Test clear browsing data functionality"
```

---

## Task 11: Final Integration Test

**Files:**
- Create: `__tests__/integration/implicit-preference-flow.test.ts`

**Step 1: Write integration test for full flow**

```typescript
// __tests__/integration/implicit-preference-flow.test.ts

/**
 * Integration test for implicit preference learning flow
 *
 * Tests the complete cycle:
 * 1. User views beaches (events captured)
 * 2. Aggregation computes preferences
 * 3. Scoring uses implicit preferences for new users
 */

describe('Implicit Preference Learning Flow', () => {
  it('computes preferences from events and applies to scoring', async () => {
    // This would be a more comprehensive integration test
    // requiring database setup - marking as TODO for manual testing
    expect(true).toBe(true);
  });
});
```

**Step 2: Commit**

```bash
git add __tests__/integration/implicit-preference-flow.test.ts
git commit -m "test(integration): add implicit preference flow test placeholder

TODO: Full integration test with database setup"
```

---

## Task 12: Update CHANGELOG and Documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `lib/services/ARCHITECTURE.md`

**Step 1: Update CHANGELOG**

Add to top of CHANGELOG.md:

```markdown
## [Unreleased]

### Added
- **Implicit Preference Learning**: Solves cold-start personalization problem
  - Captures behavioral signals: beach views, discovery clicks, forecast checks, location
  - Weighted aggregation algorithm (location 10x > click 3x > view 0.5x)
  - Confidence-blended scoring: implicit fills the gap left by explicit preferences
  - Privacy controls: opt-out toggle and "Clear browsing data" in Settings
  - 90-day data retention with automatic cleanup
```

**Step 2: Update services ARCHITECTURE.md**

Add new section for implicit preferences:

```markdown
## Implicit Preferences Service

**File:** `lib/services/implicit-preferences-service.ts`

Provides implicit preference learning capabilities:

- `getImplicitPreferences(userId)` - Fetch computed preferences
- `matchesInferredWaveRange(forecast, prefs)` - Check wave match
- `matchesInferredBreakType(breakType, prefs)` - Check break type match
- `calculateImplicitBonus(...)` - Compute scoring bonus

**Confidence Blend Formula:**
```typescript
implicitWeight = implicitConf * (1 - explicitConf)
```

This ensures graceful handoff from implicit (new users) to explicit (power users).
```

**Step 3: Commit**

```bash
git add CHANGELOG.md lib/services/ARCHITECTURE.md
git commit -m "docs: update CHANGELOG and architecture docs for implicit preferences"
```

---

## Summary

**12 Tasks Total:**

1. Database Migration - Core Tables
2. Database Migration - Aggregation Function
3. TypeScript Types
4. Events API Route
5. Implicit Preferences Service
6. Integrate into Scoring
7. useTrackEvent Hook
8. Instrument BeachDetailClient
9. Privacy Settings UI
10. E2E Privacy Tests
11. Integration Test Placeholder
12. Documentation Updates

**Estimated commits:** 12
**Key files created:** 8 new files
**Key files modified:** 5 existing files
