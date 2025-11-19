# Quiver Personalization Strategy

**Status:** Planning
**Priority:** High (Core Growth Feature)
**Owner:** Engineering Team
**Last Updated:** November 2, 2025

---

## 🎯 Executive Summary

Transform Quiver's surf recommendations from generic beach scoring to truly personalized suggestions by learning from user behavior, preferences, and social patterns. The system will analyze actual surf sessions to understand each user's preferred conditions and recommend beaches within a 10-mile radius that match their personal style.

**Key Innovation:** Learn from what users actually surf, not just what they say they prefer.

---

## 📊 Current State Analysis

### What We Have Today

**Scoring Criteria (0-100 points):**
1. **Swell Window Match** (30 pts) - Beach-specific optimal directions
2. **Wind Quality** (30 pts) - Offshore/cross-shore/onshore evaluation
3. **Tide Range** (20 pts) - Beach-specific preferred tides
4. **Skill Match** (10 pts) - ⭐ **Only personalized criterion**

**Location Filtering:**
- ✅ 10-mile radius from home beach (PostGIS spatial queries)
- ✅ Efficient with geography indexes
- ❌ No current location (GPS) support

**User Data:**
- Profile: `experience_level`, `home_beach_id`
- Sessions: Logged but not analyzed for preferences
- No preference learning system

### The Gap

**Only 1 of 4 scoring criteria considers user data.** The other 3 use generic beach metadata.

**Critical Missing Features:**
- No learning from session history
- No user preference storage beyond skill level
- No beach affinity tracking
- No collaborative filtering ("surfers like you")
- No crowd avoidance preferences
- No advanced filters (beach type, amenities)

---

## 🚀 Vision: Truly Personal Recommendations

### Design Principles

1. **Learn from Behavior:** Actual sessions trump stated preferences
2. **Privacy First:** Anonymize collaborative data, give users control
3. **Progressive Enhancement:** Works without learning data, improves over time
4. **10-Mile Focus:** Hyper-local recommendations within practical driving distance
5. **Transparency:** Show users why recommendations are made

### Target User Experience

**New User (0-5 sessions):**
- Generic scoring based on skill level and beach metadata
- "Getting to know your style..." message
- Quick wins: crowd avoidance preference, explicit filters

**Experienced User (20+ sessions):**
- "Based on your 23 logged sessions, we think you'll love..."
- Recommendations match their actual surfing patterns
- "You haven't tried this spot yet, but surfers like you rate it highly"
- Boost beaches they've surfed before

---

## 📋 Implementation Roadmap

### Phase 1: Session Forecast Capture (Foundation)

**Goal:** Capture actual conditions when users surf

#### 1.1 Database Schema

**New Table: `session_conditions`**
```sql
CREATE TABLE session_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Wave conditions
  wave_height_ft NUMERIC(4,1),
  wave_min_ft NUMERIC(4,1),
  wave_max_ft NUMERIC(4,1),
  wave_direction_deg INTEGER, -- 0-360
  wave_period_s INTEGER,

  -- Wind conditions
  wind_speed_mph NUMERIC(4,1),
  wind_direction_deg INTEGER, -- 0-360
  wind_quality TEXT, -- 'offshore', 'cross-shore', 'onshore', 'calm'

  -- Tide conditions
  tide_height_ft NUMERIC(4,1),
  tide_status TEXT, -- 'rising', 'falling', 'high', 'low', 'steady'

  -- Metadata
  forecast_source TEXT NOT NULL, -- 'noaa', 'cdip', 'ndbc'
  confidence TEXT, -- 'high', 'medium', 'low'
  raw_forecast_data JSONB, -- full snapshot for debugging

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_conditions_session_id ON session_conditions(session_id);
CREATE INDEX idx_session_conditions_captured_at ON session_conditions(captured_at);
```

**Extend `sessions` table:**
```sql
ALTER TABLE sessions
  ADD COLUMN conditions_snapshot_id UUID REFERENCES session_conditions(id);

CREATE INDEX idx_sessions_conditions_snapshot ON sessions(conditions_snapshot_id);
```

#### 1.2 Capture Logic

**When user creates session:**
1. Query current forecast for beach/timestamp
2. Create `session_conditions` record
3. Link via `conditions_snapshot_id`

**Data sources (priority order):**
1. `beach_daily_intel` (pre-computed, most reliable)
2. `enhanced_forecasts` (hourly forecast data)
3. `marine_forecasts` + `tide_forecasts` (raw data)

**Backfill Strategy:**
- Run migration to backfill existing sessions
- Use historical forecast data where available
- Mark confidence level based on data freshness

#### 1.3 Data Quality

**Validation:**
- Wave height: 0-30 ft (reject outliers)
- Wind speed: 0-50 mph
- Tide: -2 to +10 ft (location dependent)
- Directions: 0-360 degrees

**Confidence Scoring:**
- High: Data from within 30 minutes of session
- Medium: Data from within 2 hours
- Low: Data older than 2 hours or interpolated

---

### Phase 2: Preference Learning

**Goal:** Compute what conditions each user actually surfs in

#### 2.1 Database Schema

**New Table: `user_surf_preferences`**
```sql
CREATE TABLE user_surf_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Wave preferences (learned from sessions)
  preferred_wave_min_ft NUMERIC(4,1),
  preferred_wave_max_ft NUMERIC(4,1),
  preferred_wave_direction_deg INTEGER, -- circular mean
  wave_direction_tolerance_deg INTEGER DEFAULT 45,

  -- Wind preferences
  max_acceptable_wind_mph NUMERIC(4,1),
  prefers_offshore_wind BOOLEAN DEFAULT true,

  -- Tide preferences
  preferred_tide_min_ft NUMERIC(4,1),
  preferred_tide_max_ft NUMERIC(4,1),
  preferred_tide_stages TEXT[], -- ['rising', 'high', 'falling']

  -- Crowd avoidance (explicit preference)
  avoid_crowded_beaches BOOLEAN DEFAULT false,

  -- Metadata
  sample_size INTEGER NOT NULL DEFAULT 0, -- number of sessions analyzed
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_surf_preferences_updated ON user_surf_preferences(updated_at);
CREATE INDEX idx_user_surf_preferences_confidence ON user_surf_preferences(confidence_score);
```

#### 2.2 Learning Algorithm

**Implementation: `lib/services/preference-learning-service.ts`**

```typescript
interface UserSurfPreferences {
  userId: string;
  waveHeightRange: { min: number; max: number };
  waveDirection: { deg: number; tolerance: number };
  maxWindSpeed: number;
  tideRange: { min: number; max: number };
  tideStages: string[];
  sampleSize: number;
  confidence: number;
}

async function computeUserPreferences(userId: string): Promise<UserSurfPreferences> {
  // 1. Get user's sessions with conditions (last 50 sessions, or last 12 months)
  const sessions = await getSessionsWithConditions(userId, {
    limit: 50,
    maxAgeMonths: 12
  });

  if (sessions.length < 3) {
    return null; // Not enough data
  }

  // 2. Extract condition arrays
  const waveHeights = sessions.map(s => s.conditions.wave_height_ft).filter(Boolean);
  const windSpeeds = sessions.map(s => s.conditions.wind_speed_mph).filter(Boolean);
  const tideHeights = sessions.map(s => s.conditions.tide_height_ft).filter(Boolean);
  const tideStages = sessions.map(s => s.conditions.tide_status).filter(Boolean);

  // 3. Compute ranges (10th-90th percentile to exclude outliers)
  const waveRange = {
    min: percentile(waveHeights, 10),
    max: percentile(waveHeights, 90)
  };

  // 4. Max wind (95th percentile - user occasionally surfs in this)
  const maxWind = percentile(windSpeeds, 95);

  // 5. Tide range (10th-90th percentile)
  const tideRange = {
    min: percentile(tideHeights, 10),
    max: percentile(tideHeights, 90)
  };

  // 6. Most common tide stages (mode)
  const preferredTideStages = mode(tideStages, 2); // top 2

  // 7. Wave direction (circular mean with outlier removal)
  const waveDirs = sessions
    .map(s => s.conditions.wave_direction_deg)
    .filter(Boolean);
  const waveDirection = circularMean(waveDirs);

  // 8. Recency weighting (recent sessions more important)
  // Apply exponential decay: weight = e^(-age_days / 90)

  // 9. Confidence scoring
  const confidence = calculateConfidence(sessions.length, {
    minSessions: 5,
    optimalSessions: 20
  });

  return {
    userId,
    waveHeightRange: waveRange,
    waveDirection,
    maxWindSpeed: maxWind,
    tideRange,
    tideStages: preferredTideStages,
    sampleSize: sessions.length,
    confidence
  };
}

function calculateConfidence(sampleSize: number, thresholds: { minSessions: number; optimalSessions: number }): number {
  // Sigmoid function for confidence
  // 0-5 sessions: low confidence (0-0.3)
  // 5-20 sessions: growing confidence (0.3-0.8)
  // 20+ sessions: high confidence (0.8-1.0)

  if (sampleSize < thresholds.minSessions) {
    return sampleSize / thresholds.minSessions * 0.3;
  }

  const normalized = (sampleSize - thresholds.minSessions) /
                     (thresholds.optimalSessions - thresholds.minSessions);

  return 0.3 + (Math.min(1, normalized) * 0.7);
}
```

#### 2.3 Update Schedule

**Cron Job: Daily Preference Recomputation**
```
Schedule: 2 AM daily
Targets: Users with sessions in last 30 days
Batch size: 100 users per run
```

**Trigger: Immediate Update**
- After user logs 5th, 10th, 20th session (milestones)
- Improves onboarding experience

---

### Phase 3: Beach Affinity Tracking

**Goal:** Track which beaches users actually surf at

#### 3.1 Database Schema

**New Table: `user_beach_affinity`**
```sql
CREATE TABLE user_beach_affinity (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- Activity metrics
  session_count INTEGER NOT NULL DEFAULT 0,
  intel_post_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,

  -- Recency
  first_surfed_at TIMESTAMPTZ,
  last_surfed_at TIMESTAMPTZ,

  -- Computed affinity
  affinity_score NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0-100

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, beach_id)
);

CREATE INDEX idx_user_beach_affinity_user ON user_beach_affinity(user_id, affinity_score DESC);
CREATE INDEX idx_user_beach_affinity_beach ON user_beach_affinity(beach_id);
CREATE INDEX idx_user_beach_affinity_score ON user_beach_affinity(affinity_score DESC);
```

#### 3.2 Affinity Scoring Algorithm

**Factors:**
1. **Frequency:** Number of sessions (primary signal)
2. **Recency:** When last surfed (decay function)
3. **Engagement:** Intel posts + reviews (secondary signal)

**Formula:**
```typescript
function calculateAffinityScore(metrics: {
  sessionCount: number;
  lastSurfedAt: Date;
  intelPostCount: number;
  reviewCount: number;
}): number {
  // Frequency component (0-60 points)
  const frequencyScore = Math.min(60, metrics.sessionCount * 5);

  // Recency component (0-30 points)
  const daysSinceLastSurf = daysBetween(metrics.lastSurfedAt, new Date());
  const recencyScore = Math.max(0, 30 * Math.exp(-daysSinceLastSurf / 180));
  // Decay over 6 months

  // Engagement component (0-10 points)
  const engagementScore = Math.min(10,
    (metrics.intelPostCount * 3) + (metrics.reviewCount * 2)
  );

  return Math.round(frequencyScore + recencyScore + engagementScore);
}
```

**Update Triggers:**
- After session creation → increment session_count
- After intel post → increment intel_post_count
- After review → increment review_count
- Nightly batch: Recompute scores for updated records

---

### Phase 4: Enhanced Scoring Algorithm

**Goal:** Integrate learned preferences into recommendations

#### 4.1 New Scoring Criteria

**Updated Scoring System (0-120 points → normalized to 0-100):**

1. **Swell Window Match** (25 pts) - Existing
2. **Wind Quality** (25 pts) - Existing
3. **Tide Range** (15 pts) - Existing
4. **Skill Match** (10 pts) - Existing
5. **User Preference Match** (25 pts) - 🆕 NEW
6. **Beach Affinity** (15 pts) - 🆕 NEW
7. **Crowd Avoidance** (10 pts) - 🆕 NEW

**Penalty: Skill Too Low** (-20 pts) - Existing

#### 4.2 Implementation

**New Scorer: `UserPreferenceScorer`**
```typescript
class UserPreferenceScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot, userPrefs: UserSurfPreferences): ScoringResult {
    if (!userPrefs || userPrefs.confidence < 0.3) {
      return { points: 0, reasons: [] }; // Not enough data
    }

    let points = 0;
    const reasons: string[] = [];

    // Wave height match (0-10 points)
    const waveHeight = snapshot.wave_height_ft;
    if (waveHeight && userPrefs.waveHeightRange) {
      if (waveHeight >= userPrefs.waveHeightRange.min &&
          waveHeight <= userPrefs.waveHeightRange.max) {
        points += 10;
        reasons.push('wave_height_match');
      } else {
        const distance = Math.min(
          Math.abs(waveHeight - userPrefs.waveHeightRange.min),
          Math.abs(waveHeight - userPrefs.waveHeightRange.max)
        );
        // Partial credit: 10 - distance (max 10 ft off)
        points += Math.max(0, 10 - distance);
        if (points > 0) reasons.push('wave_height_close');
      }
    }

    // Wind speed match (0-8 points)
    const windSpeed = snapshot.wind_speed_mph;
    if (windSpeed && userPrefs.maxWindSpeed) {
      if (windSpeed <= userPrefs.maxWindSpeed) {
        points += 8;
        reasons.push('wind_speed_ok');
      } else {
        // Penalty for exceeding preference
        const excess = windSpeed - userPrefs.maxWindSpeed;
        points += Math.max(0, 8 - excess); // 1 pt per mph over
      }
    }

    // Tide match (0-7 points)
    const tideHeight = snapshot.tide_ft;
    const tideStatus = snapshot.tide_status;
    if (tideHeight && userPrefs.tideRange) {
      if (tideHeight >= userPrefs.tideRange.min &&
          tideHeight <= userPrefs.tideRange.max) {
        points += 4;
        reasons.push('tide_height_match');
      }
    }
    if (tideStatus && userPrefs.tideStages.includes(tideStatus)) {
      points += 3;
      reasons.push('tide_stage_match');
    }

    // Scale by confidence
    points = Math.round(points * userPrefs.confidence);

    return { points, reasons };
  }
}
```

**New Scorer: `BeachAffinityScorer`**
```typescript
class BeachAffinityScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot, affinity: BeachAffinity): ScoringResult {
    if (!affinity) {
      return { points: 0, reasons: [] };
    }

    // Affinity score 0-100 → 0-15 points (linear scale)
    const points = Math.round((affinity.affinity_score / 100) * 15);

    const reasons: string[] = [];
    if (points >= 12) {
      reasons.push('favorite_beach'); // Surfed 10+ times recently
    } else if (points >= 6) {
      reasons.push('familiar_beach'); // Surfed 3-9 times
    } else if (points > 0) {
      reasons.push('surfed_before'); // Surfed 1-2 times
    }

    return { points, reasons };
  }
}
```

**New Scorer: `CrowdAvoidanceScorer`**
```typescript
class CrowdAvoidanceScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot, userPrefs: UserSurfPreferences): ScoringResult {
    if (!userPrefs?.avoidCrowdedBeaches) {
      return { points: 0, reasons: [] };
    }

    const crowdLevel = beach.typical_crowd_level || snapshot.crowd_level || 'moderate';

    if (crowdLevel === 'uncrowded') {
      return { points: 10, reasons: ['uncrowded_spot'] };
    } else if (crowdLevel === 'crowded') {
      return { points: -15, reasons: ['crowded_spot'] }; // Penalty
    }

    return { points: 0, reasons: [] }; // Moderate = neutral
  }
}
```

#### 4.3 Score Normalization

**Total possible: 120 points**
- Normalize to 0-100: `finalScore = Math.round((rawScore / 120) * 100)`
- Clamp: `Math.max(0, Math.min(100, finalScore))`

---

### Phase 5: User Preferences & Filters

**Goal:** Give users explicit control over recommendations

#### 5.1 Database Schema

**Extend `profiles` table:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  -- Explicit overrides (null = use learned preferences)
  pref_wave_min_ft NUMERIC(4,1),
  pref_wave_max_ft NUMERIC(4,1),
  pref_wind_max_mph NUMERIC(4,1),
  pref_tide_stages TEXT[],

  -- Crowd preference
  pref_avoid_crowds BOOLEAN DEFAULT false,

  -- Beach type filters (null = all types)
  pref_beach_types TEXT[], -- ['beach_break', 'reef', 'point']

  -- Amenity requirements
  pref_require_parking BOOLEAN DEFAULT false,
  pref_require_showers BOOLEAN DEFAULT false,
  pref_beginner_friendly_only BOOLEAN DEFAULT false;
```

#### 5.2 Beach Metadata Enhancement

**Extend `beaches` table:**
```sql
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS
  -- Beach characteristics
  beach_type TEXT CHECK (beach_type IN ('beach_break', 'reef', 'point', 'jetty', 'rivermouth')),

  -- Amenities
  has_parking BOOLEAN DEFAULT false,
  parking_notes TEXT,
  has_showers BOOLEAN DEFAULT false,
  has_restrooms BOOLEAN DEFAULT false,
  has_lifeguard BOOLEAN DEFAULT false,

  -- Difficulty
  beginner_friendly BOOLEAN DEFAULT false,

  -- Crowd estimation
  typical_crowd_level TEXT CHECK (typical_crowd_level IN ('uncrowded', 'moderate', 'crowded')),
  crowd_notes TEXT;
```

**Migration Task:** Backfill data for existing CA beaches (manual curation or crowdsource)

#### 5.3 Filter Application Logic

**Priority Order:**
1. **Explicit user preferences** (if set) override learned preferences
2. **Hard filters** applied first (beach type, amenities)
3. **Soft preferences** used in scoring (crowd level, conditions)

**Implementation:**
```typescript
function filterAndScoreBeaches(
  beaches: Beach[],
  forecasts: Map<string, Forecast>,
  userPrefs: UserSurfPreferences,
  explicitPrefs: ExplicitPreferences
): BeachRecommendation[] {
  // 1. Apply hard filters
  let filtered = beaches.filter(beach => {
    // Beach type filter
    if (explicitPrefs.beachTypes?.length > 0) {
      if (!explicitPrefs.beachTypes.includes(beach.beach_type)) {
        return false;
      }
    }

    // Amenity requirements
    if (explicitPrefs.requireParking && !beach.has_parking) return false;
    if (explicitPrefs.requireShowers && !beach.has_showers) return false;
    if (explicitPrefs.beginnerFriendlyOnly && !beach.beginner_friendly) return false;

    return true;
  });

  // 2. Score remaining beaches
  const scored = filtered.map(beach => {
    const forecast = forecasts.get(beach.id);
    const score = scoreRecommendation(beach, forecast, userPrefs, explicitPrefs);
    return { beach, score };
  });

  // 3. Sort by score
  scored.sort((a, b) => b.score.total - a.score.total);

  return scored.map(s => ({
    ...s.beach,
    score: s.score.total,
    reasons: s.score.reasons
  }));
}
```

#### 5.4 UI Design

**Profile → Surf Preferences Page**

**Section 1: Conditions**
```
Wave Height
[ ] Use learned preferences (recommended)
[x] Set custom range: [Min: 2 ft] [Max: 8 ft]

Wind Tolerance
[ ] Use learned preferences
[x] Max wind speed: [15 mph]

Tide Preferences
[x] Low tide  [x] Mid tide  [ ] High tide
```

**Section 2: Beach Preferences**
```
Crowd Level
[x] Prefer uncrowded spots

Beach Types (select all that apply)
[x] Beach break  [x] Point break  [ ] Reef break  [ ] Jetty

Must-Have Amenities
[x] Parking  [ ] Showers  [ ] Lifeguard  [ ] Beginner-friendly
```

**Section 3: Learning Status**
```
Your Surf Profile
📊 Based on 18 logged sessions
Confidence: High ⭐⭐⭐⭐⭐

Log 2 more sessions to unlock better recommendations!
[View Your Patterns →]
```

---

### Phase 6: Collaborative Filtering

**Goal:** "Surfers like you also surf at..."

#### 6.1 Algorithm Design

**User Similarity Calculation:**
```typescript
function calculateUserSimilarity(userA: string, userB: string): number {
  // Get beach affinity profiles
  const beachesA = await getUserBeachAffinities(userA); // Map<beachId, score>
  const beachesB = await getUserBeachAffinities(userB);

  // Jaccard similarity on beaches surfed (binary)
  const surfedA = new Set(beachesA.filter(a => a.sessionCount > 0).map(a => a.beachId));
  const surfedB = new Set(beachesB.filter(b => b.sessionCount > 0).map(b => b.beachId));

  const intersection = setIntersection(surfedA, surfedB).size;
  const union = setUnion(surfedA, surfedB).size;

  if (union === 0) return 0;

  const jaccard = intersection / union;

  // Bonus for similar skill levels
  const profileA = await getProfile(userA);
  const profileB = await getProfile(userB);

  const skillBonus = (profileA.experience_level === profileB.experience_level) ? 0.1 : 0;

  return Math.min(1, jaccard + skillBonus);
}
```

**Finding Similar Users:**
```typescript
async function findSimilarUsers(userId: string, minSimilarity = 0.3, limit = 20): Promise<SimilarUser[]> {
  // 1. Get user's beach profile
  const userBeaches = await getUserBeachAffinities(userId);
  const userBeachIds = userBeaches.map(b => b.beachId);

  // 2. Find other users who surf at any of these beaches
  const candidateUsers = await db.query(`
    SELECT DISTINCT user_id
    FROM user_beach_affinity
    WHERE beach_id = ANY($1)
      AND user_id != $2
      AND session_count > 0
  `, [userBeachIds, userId]);

  // 3. Calculate similarity for each candidate
  const similarities = await Promise.all(
    candidateUsers.map(async candidate => ({
      userId: candidate.user_id,
      similarity: await calculateUserSimilarity(userId, candidate.user_id)
    }))
  );

  // 4. Filter and sort
  return similarities
    .filter(s => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

#### 6.2 Collaborative Recommendations

**Discovery: Beaches similar users surf that you haven't tried**
```typescript
async function getCollaborativeRecommendations(
  userId: string,
  radiusMiles = 10,
  limit = 5
): Promise<CollaborativeRecommendation[]> {
  // 1. Find similar users
  const similarUsers = await findSimilarUsers(userId, 0.3, 20);

  if (similarUsers.length === 0) {
    return []; // Not enough data
  }

  // 2. Get user's home beach for radius filtering
  const profile = await getProfile(userId);
  const homeBeach = await getBeach(profile.homeBeachId);

  // 3. Get beaches user has already surfed
  const userBeaches = await getUserBeachAffinities(userId);
  const surfedBeachIds = new Set(
    userBeaches.filter(b => b.sessionCount > 0).map(b => b.beachId)
  );

  // 4. Get popular beaches among similar users
  const popularBeaches = await db.query(`
    SELECT
      beach_id,
      COUNT(DISTINCT user_id) as surfer_count,
      AVG(affinity_score) as avg_affinity,
      SUM(session_count) as total_sessions
    FROM user_beach_affinity
    WHERE user_id = ANY($1)
      AND session_count > 0
      AND beach_id != ALL($2)
    GROUP BY beach_id
    HAVING COUNT(DISTINCT user_id) >= 3
    ORDER BY surfer_count DESC, avg_affinity DESC
  `, [similarUsers.map(u => u.userId), Array.from(surfedBeachIds)]);

  // 5. Filter by radius from home beach
  const nearbyBeaches = await Promise.all(
    popularBeaches.map(async b => {
      const beach = await getBeach(b.beach_id);
      const distance = calculateDistance(
        homeBeach.lat, homeBeach.lon,
        beach.lat, beach.lon
      );

      if (distance <= radiusMiles) {
        return {
          beach,
          surferCount: b.surfer_count,
          avgAffinity: b.avg_affinity,
          totalSessions: b.total_sessions,
          distance
        };
      }
      return null;
    })
  );

  return nearbyBeaches
    .filter(Boolean)
    .slice(0, limit);
}
```

#### 6.3 Privacy Considerations

**Anonymization:**
- Never show which specific users are similar
- Show aggregate statistics only: "Popular with 8 surfers like you"
- No user-to-user graph exposure

**Opt-Out:**
- Add `profiles.allow_collaborative_filtering` boolean (default true)
- Users can disable in privacy settings

#### 6.4 UI Integration

**Recommendation Cards:**
```
┌────────────────────────────────────┐
│ 🌟 Pleasure Point                  │
│ Santa Cruz • 5.2 mi                │
│                                    │
│ Popular with surfers like you      │
│ 8 similar surfers • 45 sessions    │
│                                    │
│ Score: 87  [View Details →]       │
└────────────────────────────────────┘
```

**New Section: "Discover New Spots"**
- Shows collaborative recommendations
- Badge: "🆕 New for you"
- Explanation: "Based on surfers with similar preferences"

---

### Phase 7: Current Location Support

> ⚠️ **NOTE (Nov 2025)**: This phase describes GPS-based beach recommendations that were partially implemented via `getBestBeachesNearHome` but later removed along with the Best Conditions home page feature. This section is preserved for historical reference.

**Goal:** ~~GPS-based recommendations for traveling surfers~~ NOT IMPLEMENTED

#### 7.1 API Enhancement (NOT IMPLEMENTED)

**~~New Action: `getBestBeachesNearLocation`~~** (Similar functionality was in `getBestBeachesNearHome` before removal)
```typescript
// actions/beach/best-beaches-near-location.ts
export async function getBestBeachesNearLocation(
  lat: number,
  lon: number,
  radiusMiles = 10,
  usePersonalization = true
): Promise<BeachRecommendation[]> {
  const user = await getCurrentUser();

  // Same logic as getBestBeachesNearHome
  // but use provided coordinates instead of home_beach_id

  const nearbyBeaches = await getNearbyBeaches(lat, lon, radiusMiles);

  // Load user preferences if personalization enabled
  const userPrefs = usePersonalization && user
    ? await getUserPreferences(user.id)
    : null;

  // Score and rank
  return scoreAndRankBeaches(nearbyBeaches, userPrefs);
}
```

**New API Endpoint:**
```
POST /api/recommendations/nearby
Body: {
  lat: number,
  lon: number,
  radiusMiles?: number,
  usePersonalization?: boolean
}
Response: BeachRecommendation[]
```

#### 7.2 Mobile Integration

**Capacitor Geolocation Plugin:**
```typescript
import { Geolocation } from '@capacitor/geolocation';

async function getCurrentLocationRecommendations() {
  try {
    // Request permission
    const permission = await Geolocation.requestPermissions();

    if (permission.location !== 'granted') {
      // Fall back to home beach
      return getBestBeachesNearHome();
    }

    // Get current position
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });

    // Fetch recommendations
    return await fetch('/api/recommendations/nearby', {
      method: 'POST',
      body: JSON.stringify({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        radiusMiles: 10
      })
    });
  } catch (error) {
    console.error('Geolocation error:', error);
    return getBestBeachesNearHome();
  }
}
```

#### 7.3 UI Design

**Home Screen Enhancement:**
```
┌────────────────────────────────────┐
│ Best Spots Near You                │
│                                    │
│ 📍 Using: Home Beach (Capitola)    │
│ [📍 Use Current Location]          │
│                                    │
│ [Recommendation Cards...]          │
└────────────────────────────────────┘
```

**On "Use Current Location" tap:**
1. Request location permission (if not granted)
2. Show loading state: "Finding spots near you..."
3. Fetch recommendations based on GPS coordinates
4. Update header: "📍 Based on your current location"
5. Cache for 30 minutes (assumption: user doesn't move far)

**Privacy:**
- Location never stored on server
- Used only for one-time query
- Clear indication when GPS is active

---

## 📊 Success Metrics

### Key Performance Indicators

**Adoption Metrics:**
- % users with learned preferences (confidence > 0.5)
  - Target: 70% of active users within 60 days
- % users who set explicit preferences
  - Target: 40% of users
- % users who enable crowd avoidance
  - Target: 25% of users

**Engagement Metrics:**
- Recommendation click-through rate (CTR)
  - Baseline: ~15% (estimated)
  - Target: 25%+ with personalization
- Sessions logged via recommendations
  - Target: 20% of all sessions come from recommendation tap
- Time on recommendations page
  - Target: +30% increase

**Quality Metrics:**
- User satisfaction survey: "Do recommendations match your style?"
  - Target: 8.0/10 average rating
- Recommendation diversity
  - Track: Are we showing variety or always same beaches?
  - Target: Top 4 recommendations change at least 2x per week

**Collaborative Filtering:**
- % users with similar user matches
  - Target: 60% of users have 3+ similar surfers
- Discovery rate: % new beaches tried from collaborative recs
  - Target: 15% of users try a collaborative recommendation

### A/B Testing Strategy

**Phase 1 Launch:**
- 50/50 split: Personalized vs. Generic recommendations
- Metric: CTR, session creation rate, user satisfaction
- Duration: 4 weeks

**Gradual Rollout:**
- Week 1-2: 20% of users
- Week 3-4: 50% of users
- Week 5+: 100% of users (if metrics positive)

---

## 🧪 Testing Strategy

### Unit Tests

**Preference Learning:**
```typescript
describe('PreferenceLearningService', () => {
  test('computes wave height range from sessions', async () => {
    const sessions = [
      { waveHeightFt: 3 },
      { waveHeightFt: 4 },
      { waveHeightFt: 5 },
      { waveHeightFt: 6 }
    ];

    const prefs = await computeUserPreferences(userId);

    expect(prefs.waveHeightRange).toEqual({ min: 3, max: 6 });
  });

  test('handles outliers with percentile method', async () => {
    const sessions = [
      { waveHeightFt: 3 },
      { waveHeightFt: 4 },
      { waveHeightFt: 5 },
      { waveHeightFt: 15 } // outlier
    ];

    const prefs = await computeUserPreferences(userId);

    expect(prefs.waveHeightRange.max).toBeLessThan(10);
  });

  test('returns null for insufficient data', async () => {
    const sessions = [{ waveHeightFt: 3 }]; // only 1 session

    const prefs = await computeUserPreferences(userId);

    expect(prefs).toBeNull();
  });
});
```

**Scoring Algorithm:**
```typescript
describe('UserPreferenceScorer', () => {
  test('awards full points for perfect match', () => {
    const userPrefs = {
      waveHeightRange: { min: 3, max: 6 },
      maxWindSpeed: 15,
      confidence: 0.9
    };

    const snapshot = {
      wave_height_ft: 4,
      wind_speed_mph: 10
    };

    const result = new UserPreferenceScorer().score(beach, snapshot, userPrefs);

    expect(result.points).toBeGreaterThan(20); // High score
    expect(result.reasons).toContain('wave_height_match');
  });

  test('scales score by confidence', () => {
    const lowConfidence = { ...userPrefs, confidence: 0.3 };
    const highConfidence = { ...userPrefs, confidence: 0.9 };

    const lowScore = new UserPreferenceScorer().score(beach, snapshot, lowConfidence);
    const highScore = new UserPreferenceScorer().score(beach, snapshot, highConfidence);

    expect(highScore.points).toBeGreaterThan(lowScore.points * 2);
  });
});
```

**Collaborative Filtering:**
```typescript
describe('CollaborativeFiltering', () => {
  test('calculates user similarity correctly', async () => {
    const userA = await createUserWithBeaches(['beach1', 'beach2', 'beach3']);
    const userB = await createUserWithBeaches(['beach2', 'beach3', 'beach4']);

    const similarity = await calculateUserSimilarity(userA.id, userB.id);

    // Intersection: 2, Union: 4 → Jaccard: 0.5
    expect(similarity).toBeCloseTo(0.5, 1);
  });

  test('finds similar users within threshold', async () => {
    const user = await createUserWithBeaches(['beach1', 'beach2']);

    const similar = await findSimilarUsers(user.id, 0.3, 10);

    expect(similar.length).toBeGreaterThan(0);
    expect(similar.every(s => s.similarity >= 0.3)).toBe(true);
  });
});
```

### Integration Tests

**Session → Preference Flow:**
```typescript
describe('Session Capture → Preference Update', () => {
  test('captures forecast when session is created', async () => {
    const session = await createSession({
      beachId: 'beach1',
      date: '2025-11-02',
      time: '08:00'
    });

    const conditions = await getSessionConditions(session.id);

    expect(conditions).toBeDefined();
    expect(conditions.wave_height_ft).toBeGreaterThan(0);
    expect(conditions.forecast_source).toBeTruthy();
  });

  test('updates user preferences after 5th session', async () => {
    const user = await createUser();

    // Create 4 sessions
    for (let i = 0; i < 4; i++) {
      await createSession({ userId: user.id });
    }

    let prefs = await getUserPreferences(user.id);
    expect(prefs).toBeNull(); // Not enough data

    // Create 5th session
    await createSession({ userId: user.id });

    prefs = await getUserPreferences(user.id);
    expect(prefs).toBeDefined();
    expect(prefs.confidence).toBeGreaterThan(0.3);
  });
});
```

**Recommendation Filtering:**
```typescript
describe('Recommendation Filters', () => {
  test('filters beaches by type preference', async () => {
    const user = await createUserWithPreferences({
      beachTypes: ['reef', 'point']
    });

    const recs = await getBestBeachesNearHome(user.id);

    expect(recs.every(r => ['reef', 'point'].includes(r.beach_type))).toBe(true);
  });

  test('filters beaches by required parking', async () => {
    const user = await createUserWithPreferences({
      requireParking: true
    });

    const recs = await getBestBeachesNearHome(user.id);

    expect(recs.every(r => r.has_parking === true)).toBe(true);
  });
});
```

### E2E Tests (Playwright)

**Personalization Journey:**
```typescript
test('user sees personalized recommendations after logging sessions', async ({ page }) => {
  // 1. New user logs in
  await loginAsUser(page, 'newuser@test.com');

  // 2. Set home beach
  await setHomeBeach(page, 'Capitola');

  // 3. Initial recommendations (generic)
  await page.goto('/');
  const initialRecs = await page.locator('[data-testid="beach-recommendation"]').count();
  const initialBadges = await page.locator('[data-testid="personalized-badge"]').count();

  expect(initialBadges).toBe(0); // No personalized badges yet

  // 4. Log 5 sessions with similar conditions
  for (let i = 0; i < 5; i++) {
    await createSession(page, {
      beach: 'Pleasure Point',
      waveHeight: 4 + i * 0.5, // 4-6 ft
      wind: 'Light offshore'
    });
  }

  // 5. Return to home, check for personalized recs
  await page.goto('/');
  await page.waitForTimeout(1000); // Wait for preferences to compute

  const personalizedBadges = await page.locator('[data-testid="personalized-badge"]').count();
  expect(personalizedBadges).toBeGreaterThan(0);

  // 6. Check that recommendations match learned preferences
  const recTexts = await page.locator('[data-testid="wave-height"]').allTextContents();
  const wavesInRange = recTexts.filter(text => {
    const height = parseFloat(text);
    return height >= 3 && height <= 7; // User's learned range
  });

  expect(wavesInRange.length).toBeGreaterThan(initialRecs * 0.6); // 60%+ match
});
```

**Collaborative Discovery:**
```typescript
test('user discovers new beach from similar surfers', async ({ page }) => {
  // Setup: Create similar users who surf at "Secret Spot"
  await createSimilarUsersWhoSurfAt('Secret Spot');

  // Test user has never been to Secret Spot
  await loginAsUser(page, 'testuser@test.com');

  // Navigate to recommendations
  await page.goto('/');

  // Look for collaborative recommendation
  const collabRec = page.locator('[data-testid="collaborative-recommendation"]').first();
  await expect(collabRec).toBeVisible();

  const beachName = await collabRec.locator('[data-testid="beach-name"]').textContent();
  expect(beachName).toContain('Secret Spot');

  const badge = await collabRec.locator('[data-testid="badge"]').textContent();
  expect(badge).toMatch(/Popular with \d+ surfers like you/);
});
```

---

## 🔒 Privacy & Security

### Data Privacy

**User Control:**
- Profile → Privacy Settings
  - [ ] Allow learning from my sessions (default: on)
  - [ ] Include me in collaborative filtering (default: on)
  - [ ] Allow GPS-based recommendations (default: off until requested)

**Data Retention:**
- Keep last 50 sessions for preference learning
- Purge older `session_conditions` records after 1 year
- User can request data deletion (GDPR compliance)

**Transparency:**
- Show users what data is collected: "We analyze your last 20 sessions..."
- Show what factors influenced recommendations: "Based on your preference for 4-6 ft waves"
- Allow users to view/export their preference profile

### Anonymization

**Collaborative Filtering:**
- Never reveal specific user identities
- Show aggregate stats only: "8 surfers like you"
- No social graph exposure
- Similarity calculations done server-side only

**Session Conditions:**
- Conditions are tied to sessions (private to user)
- Aggregated for preferences (user-level, private)
- Never exposed in public APIs

---

## 🚀 Quick Wins (Can Start Immediately)

These features require minimal schema changes and can be implemented quickly:

### 1. Beach Affinity Tracking (Week 1)
**Effort:** Low
**Impact:** High

- Create `user_beach_affinity` table
- Populate from existing sessions
- Add "You've surfed here X times" badge to beach cards
- Boost familiar beaches in recommendations

**No new user-facing features required - just better scoring**

### 2. Crowd Avoidance Preference (Week 1)
**Effort:** Very Low
**Impact:** Medium

- Add `pref_avoid_crowds` boolean to profiles
- Add toggle in user preferences
- Implement `CrowdAvoidanceScorer`
- Immediate personalization without learning data

**Users get value on day 1**

### 3. Session Conditions Capture (Week 2)
**Effort:** Medium
**Impact:** High (foundation for everything)

- Create `session_conditions` table
- Modify session creation to capture forecast
- No user-facing changes yet
- Start collecting data for future features

**Silent data collection enables all future features**

---

## 📚 Technical Debt & Considerations

### Performance

**Database Indexes:**
```sql
-- Critical for performance
CREATE INDEX idx_session_conditions_user_date
  ON session_conditions(user_id, captured_at DESC);

CREATE INDEX idx_user_beach_affinity_user_score
  ON user_beach_affinity(user_id, affinity_score DESC);

CREATE INDEX idx_user_surf_preferences_confidence
  ON user_surf_preferences(confidence DESC);
```

**Caching Strategy:**
- User preferences: Cache for 24 hours (updated nightly)
- Beach affinities: Cache for 1 hour
- Collaborative matches: Cache for 7 days (expensive to compute)

### Scalability

**Batch Processing:**
- Preference recomputation: 100 users/minute (avoid overload)
- Affinity score updates: Real-time for recent, batch for old
- Collaborative similarity: Precompute top 20 matches nightly

**Query Optimization:**
- Use materialized views for expensive aggregations
- Limit collaborative filtering to top 1000 active users initially
- Implement query timeouts (max 500ms per recommendation call)

### Monitoring

**Metrics to Track:**
```typescript
// Performance
- avg_recommendation_response_time_ms
- preference_computation_time_ms
- collaborative_query_time_ms

// Quality
- recommendation_diversity_score (0-1)
- preference_confidence_distribution
- user_satisfaction_rating

// Business
- personalization_adoption_rate
- ctr_personalized_vs_generic
- session_creation_from_recommendations
```

**Alerts:**
- Response time > 1s (95th percentile)
- Preference computation failures > 5%
- Recommendation quality score < 0.6

---

## 🎯 Success Criteria

### Phase 1 Success (Foundation - 4 weeks)
- ✅ Session conditions captured for 90%+ of new sessions
- ✅ User beach affinities computed for all active users
- ✅ No performance degradation (p95 < 500ms)

### Phase 2 Success (Preference Learning - 4 weeks)
- ✅ 60%+ active users have learned preferences (confidence > 0.5)
- ✅ Preference computation runs nightly without errors
- ✅ User satisfaction: "Recommendations match my style" > 7/10

### Phase 3 Success (Enhanced Scoring - 4 weeks)
- ✅ Recommendation CTR improves by 20%+
- ✅ Session creation via recommendations increases 15%+
- ✅ Users rate personalized recs higher than generic (A/B test)

### Phase 4 Success (Filters & Collaborative - 8 weeks)
- ✅ 30%+ users set explicit preferences
- ✅ 50%+ users have 3+ similar surfer matches
- ✅ 10%+ users try a collaborative recommendation

### Phase 5 Success (Current Location - 4 weeks)
- ✅ GPS recommendations work on iOS/Android
- ✅ 20%+ mobile users try "Use Current Location"
- ✅ No privacy concerns raised

---

## 📖 References & Resources

### Internal Documentation
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
- [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) - Design philosophy
- [docs/FORECAST_ARCHITECTURE.md](./FORECAST_ARCHITECTURE.md) - Forecast data flow

### External Resources
- [Collaborative Filtering Overview](https://en.wikipedia.org/wiki/Collaborative_filtering)
- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index)
- [Recommender Systems](https://developers.google.com/machine-learning/recommendation)
- [Percentile-Based Range Estimation](https://en.wikipedia.org/wiki/Percentile)

### Tools & Libraries
- PostGIS for spatial queries
- date-fns for date manipulation
- @capacitor/geolocation for GPS
- Zod for input validation

---

## 🤝 Contributing

This is a **core growth feature**. All changes should:

1. Follow the phased approach outlined above
2. Include comprehensive tests (unit + integration + E2E)
3. Maintain backwards compatibility
4. Update this document when implementation details change
5. Track metrics in analytics dashboard

**Questions?** Reach out to the engineering team or open a discussion in GitHub.

---

**Document Version:** 1.0
**Last Reviewed:** November 2, 2025
**Next Review:** After Phase 1 implementation
