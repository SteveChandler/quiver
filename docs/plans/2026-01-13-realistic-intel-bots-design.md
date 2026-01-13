# Realistic Intel Bots Design

**Date:** 2026-01-13
**Status:** Draft
**Author:** Steven Chandler + Claude

## Overview

Redesign the NPC (intel bot) system to create more realistic, believable community activity. The current system uses templated content that feels repetitive and artificial. This design introduces AI-generated templates, behavioral realism, and real-world forecast integration.

## Goals

1. **Content Quality** - More varied, natural-sounding posts via AI-generated templates
2. **Behavioral Realism** - NPCs post at realistic times with consistent patterns
3. **Real-World Integration** - Posts reflect actual surf/weather forecasts from existing data
4. **Natural Identities** - Replace obvious names like "Larry 'Local' Thompson" with realistic names

## Non-Goals

- Social dynamics (NPCs interacting with each other or real users)
- Real-time AI generation at post time (too slow, too expensive)
- Personality inference from post history

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Template Generation (Offline)                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ CLI Command  │───▶│ Claude API   │───▶│ npc_templates DB │  │
│  │ (on-demand)  │    │ (batch gen)  │    │ (500+ templates) │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Activity (Runtime)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Cron Job     │───▶│ Select NPCs  │───▶│ Fetch Forecast   │  │
│  │ (hourly)     │    │ (behavioral) │    │ (existing data)  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                   │              │
│                                                   ▼              │
│                      ┌──────────────┐    ┌──────────────────┐  │
│                      │ Create Post  │◀───│ Hydrate Template │  │
│                      │ (intel_posts)│    │ (real conditions)│  │
│                      └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Morning Forecast (5:30am PT)                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Cron Job     │───▶│ Fetch All    │───▶│ Generate 3 Posts │  │
│  │ (daily)      │    │ Regional Data│    │ (NorCal/Cen/SoCal│  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Profile Enhancements

Add columns to `profiles` table for NPC behavioral configuration:

```sql
ALTER TABLE profiles ADD COLUMN home_region TEXT;
-- e.g., 'north-san-diego', 'sf-bay-area', 'central-coast'

ALTER TABLE profiles ADD COLUMN home_beach_ids UUID[];
-- 1-2 primary beaches (70% of posts)

ALTER TABLE profiles ADD COLUMN secondary_beaches UUID[];
-- Regional beaches for occasional visits (25% of posts)

ALTER TABLE profiles ADD COLUMN posting_window JSONB;
-- e.g., {"primary": [5, 8], "secondary": [16, 19]}

ALTER TABLE profiles ADD COLUMN activity_level TEXT;
-- 'high' (daily), 'medium' (2-3x/week), 'low' (weekly)

ALTER TABLE profiles ADD COLUMN personality_type TEXT;
-- 'rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster'

ALTER TABLE profiles ADD COLUMN is_system_account BOOLEAN DEFAULT false;
-- true for Quiver Surf Forecast bot
```

### Template Storage

New table for AI-generated content templates:

```sql
CREATE TABLE npc_content_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    TEXT NOT NULL,      -- 'intel', 'session_note', 'review'
  personality     TEXT NOT NULL,      -- 'rookie', 'local', etc.
  tag             TEXT,               -- for intel: 'conditions', 'parking', 'crowd', 'access'
  template        TEXT NOT NULL,      -- content with {{variables}}
  variables       TEXT[],             -- ['beach_name', 'wave_height', 'time_of_day']
  use_count       INT DEFAULT 0,      -- tracks usage for staleness
  last_used_at    TIMESTAMPTZ,
  archived        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_lookup
ON npc_content_templates(content_type, personality, tag)
WHERE archived = false;

CREATE INDEX idx_templates_freshness
ON npc_content_templates(use_count, last_used_at)
WHERE archived = false;
```

---

## NPC Roster

### Cleanup Strategy

Current state: ~90 profiles with `is_mock=true`, many duplicates.
Target state: 25 unique NPCs with natural names + 1 system forecast account.

### Name Mappings

| Current Name | New Name | Personality | Home Region |
|--------------|----------|-------------|-------------|
| Larry "Local" Thompson | Marcus Chen | local | north-san-diego |
| Riley "Rookie" Rodriguez | Emma Davis | rookie | south-san-diego |
| Tina "Travel" Chen | Sofia Reyes | traveler | socal-visitor |
| Paul "PhotoPro" Martinez | Kai Nakamura | photographer | sf-bay-area |
| Dana "Dawn Patrol" Wilson | Ryan Fitzgerald | local | south-san-diego |
| Jake "NorCal" Anderson | Diego Santos | local | central-coast |
| Sofia "SoCal" Ramirez | Carmen Vega | local | south-san-diego |
| Kai "Hawaii" Nakamura | Ethan Brooks | competitor | central-coast |
| Ryan "Tech" Kumar | David Kim | local | orange-county |
| Emma "Weather" Foster | Priya Sharma | local | sf-bay-area |
| Mia "Safety" Rodriguez | Anika Patel | rookie | orange-county |
| Marcus "East Coast" Johnson | Chris Morales | traveler | norcal-visitor |
| Big Boss | Ben Kowalski | tactical | north-san-diego |
| Solid Snake | Mike Patterson | tactical | orange-county |
| Liquid Snake | Tyler O'Brien | competitor | north-san-diego |
| Mia R. | Mia Gonzalez | photographer | central-coast |
| Tina C. | Natalie Foster | traveler | socal-visitor |
| Dawn Patrol | Jordan Rivera | local | north-san-diego |
| Kai N. | Andre Williams | competitor | south-san-diego |
| Emma F. | Sarah Tanaka | rookie | sf-bay-area |
| Riley R. | Lauren Mitchell | rookie | central-coast |
| P. Martinez | Maya Johnson | photographer | orange-county |
| M. Johnson | Nina Okonkwo | traveler | norcal-visitor |
| Ryan K. | Jasmine Wu | local | sf-bay-area |
| Morning Intel Bot | Quiver Surf Forecast | forecaster | (all regions) |

### NPC Backgrounds

| Name | Personality | Background |
|------|-------------|------------|
| Marcus Chen | local | Software engineer, surfs Scripps before work |
| Sofia Reyes | traveler | Travel nurse, chases waves between assignments |
| Tyler O'Brien | competitor | Former NSSA junior, trains at Huntington |
| Kai Nakamura | photographer | Surf photographer, shoots Ocean Beach regulars |
| Emma Davis | rookie | Just moved from Denver, learning at La Jolla Shores |
| Diego Santos | local | Grew up in Santa Cruz, knows every reef |
| Priya Sharma | local | ER doctor, dawn patrol at Pacifica is her therapy |
| Ryan Fitzgerald | local | Firefighter, 20 years surfing OB Pier |
| Anika Patel | rookie | Tech PM, started surfing at 35, fully hooked |
| Chris Morales | traveler | Surfs globally, documenting California leg |
| Jasmine Wu | local | Marine biologist, surfs Lindamar year-round |
| Ben Kowalski | tactical | Ex-Navy, treats every session like a mission |
| Lauren Mitchell | rookie | Yoga instructor, finding balance in the water |
| Andre Williams | competitor | Former college athlete, training for pro-am |
| Mia Gonzalez | photographer | Fine art photographer, captures Morro Bay moods |
| David Kim | local | Accountant by day, Trestles regular since '08 |
| Natalie Foster | traveler | Australian expat, comparing Cali to home |
| Jordan Rivera | local | High school teacher, Cardiff Reef is his office |
| Sarah Tanaka | rookie | Startup founder, stress relief at Bolinas |
| Mike Patterson | tactical | Security consultant, precision approach to waves |
| Carmen Vega | local | Restaurant owner, sunrise sessions at Sunset Cliffs |
| Ethan Brooks | competitor | Steamer Lane devotee, chasing QS points |
| Nina Okonkwo | traveler | Journalist writing about California surf culture |
| Maya Johnson | photographer | Content creator, golden hour at San Onofre |

---

## Behavioral System

### Posting Windows

NPCs post during personality-appropriate time windows:

```typescript
const POSTING_WINDOWS = {
  local: {
    primary: [5, 8],      // Dawn patrol
    secondary: [16, 19],  // After work
    weekend_boost: true
  },
  rookie: {
    primary: [9, 12],     // Mid-morning
    secondary: [14, 17],  // Afternoon
    weekend_boost: true
  },
  traveler: {
    primary: [7, 11],     // Tourist hours
    secondary: [15, 18],
    weekend_boost: false  // Don't know what day it is
  },
  photographer: {
    primary: [5, 7],      // Golden hour AM
    secondary: [17, 20],  // Golden hour PM
    weekend_boost: false
  },
  tactical: {
    primary: [5, 6],      // Pre-dawn recon
    secondary: [11, 13],  // Midday assessment
    weekend_boost: false
  },
  competitor: {
    primary: [6, 9],      // Training block
    secondary: [15, 18],  // Afternoon session
    weekend_boost: true
  },
  forecaster: {
    primary: [5, 6],      // 5:30am daily
    secondary: [],
    weekend_boost: false
  }
};
```

### Activity Levels

Each NPC has an activity frequency:

| Level | Posts/Week | Typical Personalities |
|-------|------------|----------------------|
| high | 5-7 | Dedicated locals, competitors |
| medium | 2-4 | Most NPCs |
| low | 1-2 | Casuals, travelers passing through |

### Beach Selection Logic

```typescript
function selectBeachForPost(npc: NPCProfile): Beach {
  const roll = Math.random();

  if (roll < 0.70) {
    // 70% - Home beach
    return pickRandom(npc.home_beach_ids);
  } else if (roll < 0.95) {
    // 25% - Secondary/regional beaches
    return pickRandom(npc.secondary_beaches);
  } else {
    // 5% - Random adventure
    return pickRandomRegionalBeach(npc.home_region);
  }
}
```

---

## Template System

### Template Variables

Templates use mustache-style variables filled at runtime:

```
"{{time_of_day}} session at {{beach_name}} was solid.
Sets in the {{wave_range}} range with {{wind_description}}.
{{crowd_sentence}} {{personality_closer}}"
```

### Variable Sources

| Variable | Source | Example |
|----------|--------|---------|
| `{{beach_name}}` | Beach record | "Ocean Beach" |
| `{{wave_range}}` | forecast.wave_height ± 0.5 | "3-4ft" |
| `{{wave_period}}` | forecast.wave_period | "12-second" |
| `{{wind_description}}` | forecast.wind_* | "light NW winds" |
| `{{tide_state}}` | tide_predictions | "incoming mid-tide" |
| `{{water_temp}}` | forecast.water_temp | "62°F" |
| `{{time_of_day}}` | post timestamp | "dawn patrol" |
| `{{crowd_sentence}}` | conditions.crowd_level | "Lineup was mellow with plenty of space." |
| `{{personality_closer}}` | personality-specific | "Still stoked just to be out there." |

### Template Volume Targets

Per personality (6 types) × per content type:

| Content Type | Templates/Personality | Tags | Total |
|--------------|----------------------|------|-------|
| Intel - conditions | 15 | 1 | 90 |
| Intel - parking | 10 | 1 | 60 |
| Intel - crowd | 10 | 1 | 60 |
| Intel - access | 10 | 1 | 60 |
| Session notes | 20 | - | 120 |
| Reviews | 15 | - | 90 |
| **Total** | | | **~480** |

### CLI Generator

```bash
# Generate all template types
yarn generate:npc-templates

# Generate specific types
yarn generate:npc-templates --type=intel --personality=local

# Force regenerate (ignore existing)
yarn generate:npc-templates --fresh

# Preview without saving
yarn generate:npc-templates --dry-run
```

### Staleness Detection

Templates track usage to detect repetition:

```sql
-- Find overused templates
SELECT
  personality,
  content_type,
  tag,
  COUNT(*) FILTER (WHERE use_count >= 3) as stale_count,
  COUNT(*) as total_count
FROM npc_content_templates
WHERE last_used_at > now() - interval '7 days'
  AND archived = false
GROUP BY personality, content_type, tag
HAVING COUNT(*) FILTER (WHERE use_count >= 3) > COUNT(*) * 0.3;
```

**Trigger Conditions** (alert only, no auto-regeneration):
- A single template used 3+ times in 7 days
- >30% of templates in a category used 2+ times in 7 days
- Template pool for any personality/type drops below 10 available

---

## Quiver Surf Forecast

### Profile Configuration

```typescript
const QUIVER_FORECAST_PROFILE = {
  name: 'Quiver Surf Forecast',
  personality_type: 'forecaster',
  is_system_account: true,
  is_mock: true,
  avatar: 'quiver-forecast-logo',
  bio: 'Daily California surf conditions from the Quiver team'
};
```

### Daily Schedule

Three posts each morning at 5:30am PT, ~2 minutes apart:

**Post 1 - NorCal:**
```
NorCal Morning Report

Ocean Beach and Pacifica waking up to a building NW groundswell,
4-6ft faces with 12-second period. Light offshore until 10am—dawn
patrol is the call. Lindamar offering a mellower option in the
3-4ft range. Bolinas worth checking if you want to dodge the crowd.

Low tide 7:12am. Water 58°F—bring rubber.
```

**Post 2 - Central Coast:**
```
Central Coast Morning Report

Steamer Lane showing pointed 3-4ft peaks on the southern end.
Clean but not epic. Pleasure Point slightly smaller, friendlier
crowd. Morro Bay has some texture if you're willing to drive.

Low tide 7:18am. Water 60°F.
```

**Post 3 - SoCal:**
```
SoCal Morning Report

South-facing spots still waiting on that promised S swell.
Trestles has waist-high leftovers, Scripps basically flat.
Huntington picking up small NW windswell—your best bet if
you need a fix. Sunset Cliffs showing some life on the points.

Low tide 7:24am. Water 62°F.
```

### Beach Association

Each regional post gets tagged to a representative beach:
- NorCal → Ocean Beach SF
- Central → Steamer Lane
- SoCal → Scripps Pier

---

## Real-World Integration

### Data Sources

Pull from existing Supabase tables:

```typescript
async function getBeachConditions(beachId: string): Promise<SurfConditions> {
  // Primary: beach forecasts
  const { data: forecast } = await supabase
    .from('beach_forecasts')
    .select('wave_height, wave_period, wind_speed, wind_direction, water_temp')
    .eq('beach_id', beachId)
    .order('forecast_time', { ascending: false })
    .limit(1)
    .single();

  // Tide data
  const { data: tide } = await supabase
    .from('tide_predictions')
    .select('height, type')
    .eq('beach_id', beachId)
    .gte('time', new Date().toISOString())
    .limit(1)
    .single();

  return mapToConditions(forecast, tide);
}
```

### Condition-Driven Posting

When conditions are good (clean, 3-6ft, light wind):
- Increase posting probability by 2x
- More "conditions" intel posts
- Higher session ratings

When conditions are poor:
- Fewer posts overall
- More "checking in, it's flat" content
- Locals still post (they always check)

---

## Regional Configuration

```typescript
const REGIONS = {
  'sf-bay-area': {
    beaches: ['ocean-beach-sf', 'pacifica', 'lindamar', 'bolinas'],
    timezone: 'America/Los_Angeles',
    forecast_beaches: ['ocean-beach-sf', 'pacifica']
  },
  'central-coast': {
    beaches: ['steamer-lane', 'pleasure-point', 'cowell', 'morro-bay'],
    timezone: 'America/Los_Angeles',
    forecast_beaches: ['steamer-lane', 'pleasure-point']
  },
  'north-san-diego': {
    beaches: ['scripps', 'blacks', 'cardiff', 'swamis'],
    timezone: 'America/Los_Angeles',
    forecast_beaches: ['scripps', 'blacks']
  },
  'south-san-diego': {
    beaches: ['ob-pier', 'sunset-cliffs', 'coronado'],
    timezone: 'America/Los_Angeles',
    forecast_beaches: ['ob-pier', 'sunset-cliffs']
  },
  'orange-county': {
    beaches: ['huntington', 'trestles', 'san-onofre', 'doheny'],
    timezone: 'America/Los_Angeles',
    forecast_beaches: ['huntington', 'trestles']
  },
  'socal-visitor': {
    beaches: [], // Visitors can post anywhere in SoCal
    timezone: 'America/Los_Angeles',
    forecast_beaches: []
  },
  'norcal-visitor': {
    beaches: [], // Visitors can post anywhere in NorCal
    timezone: 'America/Los_Angeles',
    forecast_beaches: []
  }
};
```

---

## Implementation Plan

### Files to Create

```
scripts/
├── generate-npc-templates.ts     # AI template CLI
├── npc-daily-activity.ts         # REWRITE - behavioral realism
├── morning-forecast.ts           # Quiver Surf Forecast bot
├── check-template-health.ts      # Staleness alerts
├── migrate-npc-profiles.ts       # Cleanup & rename NPCs

lib/npc/
├── template-hydration.ts         # Fill templates with real data
├── beach-selection.ts            # Home beach weighted logic
├── posting-windows.ts            # Time-of-day personality rules
├── forecast-formatter.ts         # Format conditions into prose

config/
├── npc-roster.ts                 # 25 NPC profiles
├── regions.ts                    # Region→beach mappings

supabase/migrations/
├── XXXXXX_add_npc_profile_fields.sql
├── XXXXXX_create_npc_templates_table.sql
├── XXXXXX_cleanup_duplicate_npcs.sql
```

### Cron Jobs

| Job | Schedule | Script |
|-----|----------|--------|
| Morning forecast | 5:30am PT daily | `morning-forecast.ts` |
| NPC activity | 6am-8pm PT (hourly) | `npc-daily-activity.ts` |
| Template health | Sunday 9am PT | `check-template-health.ts` |

### Migration Steps

1. **Database migrations** - Add profile fields, create templates table
2. **NPC cleanup** - Dedupe, rename, assign regions/beaches
3. **Generate templates** - Run CLI to create initial 500+ templates
4. **Deploy new scripts** - Replace old npc-daily-activity.ts
5. **Set up crons** - Morning forecast + hourly activity + weekly health check

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unique template phrases | ~50 | 500+ |
| Content repetition rate | High | <10% in 7 days |
| Posts during odd hours | ~30% | <5% |
| Real condition accuracy | 0% | 100% |
| User reports of "fake feeling" | Unknown | Zero |

---

## Open Questions

1. **Slack webhook URL** - Needed for template staleness alerts
2. **Beach ID mappings** - Need to map beach names to UUIDs for regional config
3. **Forecast table schema** - Confirm exact column names for wave/wind/tide data
4. **Avatar images** - Should NPCs have AI-generated profile photos?

---

## Appendix: Sample AI Prompt for Template Generation

```
Generate 15 unique intel post templates for a "local" personality surfer
posting about surf CONDITIONS at their home beach.

Requirements:
- Write as a real California surfer would text a friend
- Vary sentence structure and length (some short, some longer)
- Include local slang naturally (not forced)
- Reference realistic details (specific conditions, time windows)
- Never use emojis
- Use {{variables}} for dynamic content:
  - {{beach_name}}, {{wave_range}}, {{wave_period}}, {{wind_description}}
  - {{tide_state}}, {{water_temp}}, {{time_of_day}}, {{crowd_sentence}}

Output as JSON array:
[
  {
    "template": "{{time_of_day}} check at {{beach_name}}...",
    "variables": ["time_of_day", "beach_name", ...]
  }
]

Tone examples:
- "Solid" not "Amazing"
- "Lined up nicely" not "Perfect epic barrels"
- "Worth the paddle" not "You HAVE to get out there!!!"
```
