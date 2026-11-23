# NPC Intel Bots System

Historical reference for Quiver's NPC (Non-Player Character) persona publisher.

**Status:** Persona posting and its Vercel schedule were removed on November 22, 2026. Persona profiles, `npc_content_templates`, historical posts and reviews, and their migrations are retained. The labeled system-card publisher and beach traffic weights have their own schedules.

---

## Overview

The NPC Intel Bots system creates realistic community activity using 25 distinct NPC profiles with unique personalities, posting patterns, and regional affiliations. The system includes a dedicated "Quiver Surf Forecast" bot that posts daily regional forecasts.

### Key Features

- **25 unique NPCs** with natural names and diverse personalities
- **Personality-driven posting** windows and content styles
- **Real forecast integration** using actual surf/weather data
- **Template-based content** with variable hydration for natural variation
- **Regional focus** across California coast regions
- **Staleness monitoring** to prevent repetitive content

---

## Original Architecture

```
+------------------------------------------------------------------+
|                    Configuration Layer                            |
|  +------------------+              +----------------------+       |
|  | config/          |              | config/              |       |
|  | npc-roster.ts    |              | regions.ts           |       |
|  | (25 NPCs)        |              | (5 regions)          |       |
|  +------------------+              +----------------------+       |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Utility Library (lib/npc/)                     |
|  +-------------------+  +------------------+  +----------------+  |
|  | template-         |  | beach-           |  | posting-       |  |
|  | hydration.ts      |  | selection.ts     |  | windows.ts     |  |
|  +-------------------+  +------------------+  +----------------+  |
|  +-------------------+                                            |
|  | forecast-         |                                            |
|  | formatter.ts      |                                            |
|  +-------------------+                                            |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Scripts                                        |
|  +---------------------+  +-------------------+  +--------------+ |
|  | migrate-npc-        |  | morning-          |  | check-       | |
|  | profiles.ts         |  | forecast.ts       |  | template-    | |
|  |                     |  | (daily 5:30am PT) |  | health.ts    | |
|  +---------------------+  +-------------------+  +--------------+ |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Database                                       |
|  +---------------------+         +------------------------+       |
|  | profiles            |         | npc_content_templates  |       |
|  | (NPC config fields) |         | (AI-generated content) |       |
|  +---------------------+         +------------------------+       |
+------------------------------------------------------------------+
```

---

## NPC Roster

### Personality Types

| Type | Description | Posting Window | Content Style |
|------|-------------|----------------|---------------|
| **local** | Dedicated regulars who surf their home break | 5-8am, 4-7pm | Technical, insider knowledge |
| **rookie** | Enthusiastic learners | 9am-12pm, 2-5pm | Excited, appreciative |
| **traveler** | Surfers passing through | 7-11am, 3-6pm | Comparative, exploratory |
| **photographer** | Visual-focused surfers | 5-7am, 5-8pm | Aesthetic, lighting-focused |
| **tactical** | Analytical approach | 5-6am, 11am-1pm | Precise, data-driven |
| **competitor** | Performance-focused | 6-9am, 3-6pm | Training emphasis, critical |
| **forecaster** | System account | 5-6am daily | Regional reports |

### Regional Distribution

| Region | NPCs | Key Beaches |
|--------|------|-------------|
| SF Bay Area | 4 | Ocean Beach, Pacifica, Lindamar, Bolinas |
| Central Coast | 4 | Steamer Lane, Pleasure Point, Morro Bay |
| North San Diego | 4 | Scripps, Blacks, Cardiff, Swamis |
| South San Diego | 4 | OB Pier, Sunset Cliffs, Coronado |
| Orange County | 4 | Huntington, Trestles, San Onofre |
| Visitors | 4 | Roaming NorCal/SoCal |
| System | 1 | Quiver Surf Forecast (all regions) |

---

## Database Schema

### Profile Fields (profiles table)

```sql
-- Added columns for NPC behavioral configuration
home_region TEXT             -- e.g., 'north-san-diego', 'sf-bay-area'
home_beach_ids UUID[]        -- Primary beaches (70% of posts)
secondary_beaches UUID[]     -- Regional beaches (25% of posts)
posting_window JSONB         -- {"primary": [5, 8], "secondary": [16, 19]}
activity_level TEXT          -- 'high', 'medium', 'low'
personality_type TEXT        -- 'rookie', 'local', etc.
is_system_account BOOLEAN    -- true for Quiver Surf Forecast
```

### Content Templates (npc_content_templates table)

```sql
CREATE TABLE npc_content_templates (
  id              UUID PRIMARY KEY,
  content_type    TEXT NOT NULL,      -- 'intel', 'session_note', 'review'
  personality     TEXT NOT NULL,      -- 'rookie', 'local', etc.
  tag             TEXT,               -- 'conditions', 'parking', 'crowd', 'access'
  template        TEXT NOT NULL,      -- Content with {{variables}}
  variables       TEXT[],             -- ['beach_name', 'wave_height', ...]
  use_count       INT DEFAULT 0,      -- Staleness tracking
  last_used_at    TIMESTAMPTZ,
  archived        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Migrations

- `20260113200001_add_npc_profile_fields.sql` - Adds NPC config columns to profiles
- `20260113200002_create_npc_templates_table.sql` - Creates template storage

---

## Configuration Files

### NPC Roster (`config/npc-roster.ts`)

Defines all 25 NPCs with their attributes:

```typescript
interface NPCProfile {
  oldName: string | null;    // For migration matching
  name: string;              // Natural name
  personality: PersonalityType;
  homeRegion: string;
  activityLevel: 'high' | 'medium' | 'low';
  background: string;        // Character backstory
}
```

### Regions (`config/regions.ts`)

Maps regions to beaches:

```typescript
interface RegionConfig {
  beaches: string[];         // All beaches in region
  timezone: string;          // Always 'America/Los_Angeles'
  forecastBeaches: string[]; // Key beaches for forecast posts
}

// Regions: sf-bay-area, central-coast, north-san-diego,
//          south-san-diego, orange-county, socal-visitor, norcal-visitor
```

---

## Template Variables

Available variables for content templates:

| Variable | Source | Example |
|----------|--------|---------|
| `{{beach_name}}` | Beach record | "Ocean Beach" |
| `{{wave_range}}` | forecast.wave_height | "3-4ft" |
| `{{wave_period}}` | forecast.wave_period | "12-second" |
| `{{wind_description}}` | forecast.wind_* | "light NW winds" |
| `{{tide_state}}` | tide_predictions | "incoming mid-tide" |
| `{{water_temp}}` | forecast.water_temp | "62F" |
| `{{time_of_day}}` | Post timestamp | "dawn patrol" |
| `{{crowd_sentence}}` | conditions.crowd_level | "Lineup was mellow." |

---

## Integration with Existing Systems

### Gamification

NPC posts earn XP for the author (via service-role bypass):
- Intel posts: 50 XP
- Session logs: 50 XP
- Reviews: 25 XP

### Social Feed

NPC content appears in:
- Beach detail pages (local intel)
- Home feed (followed beaches)
- Regional activity feeds

### Forecasting

Morning forecast bot pulls from:
- `marine_forecasts` table (wave height, period, wind)
- `tide_predictions` table (tide timing)
- `beaches` table (coordinates for tagging)

---

## Safety Features

1. **Environment Validation** - Requires `CONFIRM_TARGET=DEV/PROD`
2. **Production Guard** - Requires `CONFIRM_PROD=YES` for production
3. **Mock User Protection** - Only operates on `is_mock=true` profiles
4. **Service Role** - Uses service role key to bypass RLS

---

## Historical Content

### Find Historical NPC Posts

```sql
-- Recent NPC posts
SELECT p.full_name, i.tag, i.created_at
FROM intel_posts i
JOIN profiles p ON i.user_id = p.id
WHERE p.is_mock = true
ORDER BY i.created_at DESC
LIMIT 20;

-- Activity by personality
SELECT p.personality_type, COUNT(*) as post_count
FROM intel_posts i
JOIN profiles p ON i.user_id = p.id
WHERE p.is_mock = true
  AND i.created_at > now() - interval '7 days'
GROUP BY p.personality_type;
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Unique template phrases | 500+ |
| Content repetition rate | <10% in 7 days |
| Posts during odd hours | <5% |
| Real condition accuracy | 100% |
| User reports of "fake feeling" | Zero |

---

## Files Reference

### Configuration
- `config/npc-roster.ts` - 25 NPC profiles with personalities
- `config/regions.ts` - California coast region mappings

### Database
- `supabase/migrations/20260113200001_add_npc_profile_fields.sql`
- `supabase/migrations/20260113200002_create_npc_templates_table.sql`

---

## Related Documentation

- [GAMIFICATION.md](GAMIFICATION.md) - XP system and daily activity overview
- [plans/2026-01-13-realistic-intel-bots-design.md](../plans/2026-01-13-realistic-intel-bots-design.md) - Original design document
