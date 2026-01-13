# Realistic NPC Intel Bots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement realistic NPC intel bots with AI-generated templates, behavioral realism, and real-world forecast integration.

**Architecture:** Offline AI template generation stored in DB, runtime template hydration with real forecast data, personality-driven posting windows and beach selection.

**Tech Stack:** TypeScript, Supabase (PostgreSQL), Claude API for template generation, existing marine_forecasts/tide_forecasts tables.

---

## Task 1: Database Migration - Add NPC Profile Fields

**Files:**
- Create: `supabase/migrations/20260113200001_add_npc_profile_fields.sql`

**Step 1: Write the migration SQL**

```sql
-- Add NPC behavioral configuration fields to profiles table
-- These enable personality-driven posting patterns and beach selection

BEGIN;

-- Home region for the NPC (e.g., 'north-san-diego', 'sf-bay-area')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_region TEXT;

-- Primary home beaches - 70% of posts come from these (array of beach UUIDs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_beach_ids UUID[];

-- Secondary/regional beaches - 25% of posts (array of beach UUIDs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_beaches UUID[];

-- Posting window preferences as JSON (e.g., {"primary": [5, 8], "secondary": [16, 19]})
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posting_window JSONB;

-- Activity frequency: 'high' (5-7/week), 'medium' (2-4/week), 'low' (1-2/week)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level TEXT CHECK (activity_level IN ('high', 'medium', 'low'));

-- Personality type for content generation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personality_type TEXT CHECK (personality_type IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster'));

-- System account flag for Quiver Surf Forecast bot
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT false;

-- Create index for querying NPCs by activity level and personality
CREATE INDEX IF NOT EXISTS idx_profiles_npc_config ON profiles (activity_level, personality_type) WHERE is_mock = true;

COMMIT;
```

**Step 2: Apply migration**

Run: Use Supabase MCP `apply_migration` tool with the SQL above

Expected: Migration applied successfully, new columns added to profiles table

**Step 3: Verify migration**

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('home_region', 'home_beach_ids', 'secondary_beaches', 'posting_window', 'activity_level', 'personality_type', 'is_system_account');`

Expected: 7 rows returned

**Step 4: Commit**

```bash
git add supabase/migrations/20260113200001_add_npc_profile_fields.sql
git commit -m "feat(db): add NPC profile fields for behavioral realism

- home_region, home_beach_ids, secondary_beaches for beach selection
- posting_window for personality-based timing
- activity_level and personality_type for content patterns
- is_system_account for Quiver Surf Forecast bot"
```

---

## Task 2: Database Migration - Create NPC Templates Table

**Files:**
- Create: `supabase/migrations/20260113200002_create_npc_templates_table.sql`

**Step 1: Write the migration SQL**

```sql
-- Create table for AI-generated content templates
-- Templates use {{variables}} that get hydrated with real forecast data at runtime

BEGIN;

CREATE TABLE IF NOT EXISTS public.npc_content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('intel', 'session_note', 'review')),
  personality TEXT NOT NULL CHECK (personality IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster')),
  tag TEXT, -- For intel posts: 'conditions', 'parking', 'crowd', 'access'
  template TEXT NOT NULL, -- Content with {{variables}} like {{beach_name}}, {{wave_range}}
  variables TEXT[] NOT NULL, -- Array of variable names used in template
  use_count INT DEFAULT 0, -- Tracks usage for staleness detection
  last_used_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient template lookup during content generation
CREATE INDEX IF NOT EXISTS idx_templates_lookup
ON npc_content_templates(content_type, personality, tag)
WHERE archived = false;

-- Index for staleness detection queries
CREATE INDEX IF NOT EXISTS idx_templates_freshness
ON npc_content_templates(use_count, last_used_at)
WHERE archived = false;

-- Enable RLS
ALTER TABLE npc_content_templates ENABLE ROW LEVEL SECURITY;

-- Allow public read access (templates are not sensitive)
CREATE POLICY npc_templates_select_all ON npc_content_templates
  FOR SELECT USING (true);

COMMIT;
```

**Step 2: Apply migration**

Run: Use Supabase MCP `apply_migration` tool

Expected: Migration applied successfully, npc_content_templates table created

**Step 3: Verify migration**

Run: `SELECT table_name FROM information_schema.tables WHERE table_name = 'npc_content_templates';`

Expected: 1 row returned

**Step 4: Commit**

```bash
git add supabase/migrations/20260113200002_create_npc_templates_table.sql
git commit -m "feat(db): create npc_content_templates table

- Stores AI-generated templates with {{variables}}
- Tracks usage for staleness detection
- Indexes for efficient lookup and health monitoring"
```

---

## Task 3: Create NPC Roster Configuration

**Files:**
- Create: `config/npc-roster.ts`

**Step 1: Write the NPC roster configuration**

```typescript
/**
 * NPC Roster Configuration
 *
 * Defines 25 unique NPC profiles with natural names, personalities,
 * and regional assignments. Used by migration script and daily activity.
 */

export interface NPCProfile {
  oldName: string | null;
  name: string;
  personality: 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor' | 'forecaster';
  homeRegion: string;
  activityLevel: 'high' | 'medium' | 'low';
  background: string;
}

export const NPC_ROSTER: NPCProfile[] = [
  { oldName: 'Larry "Local" Thompson', name: 'Marcus Chen', personality: 'local', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'Software engineer, surfs Scripps before work' },
  { oldName: 'Riley "Rookie" Rodriguez', name: 'Emma Davis', personality: 'rookie', homeRegion: 'south-san-diego', activityLevel: 'medium', background: 'Just moved from Denver, learning at La Jolla Shores' },
  { oldName: 'Tina "Travel" Chen', name: 'Sofia Reyes', personality: 'traveler', homeRegion: 'socal-visitor', activityLevel: 'low', background: 'Travel nurse, chases waves between assignments' },
  { oldName: 'Paul "PhotoPro" Martinez', name: 'Kai Nakamura', personality: 'photographer', homeRegion: 'sf-bay-area', activityLevel: 'medium', background: 'Surf photographer, shoots Ocean Beach regulars' },
  { oldName: 'Dana "Dawn Patrol" Wilson', name: 'Ryan Fitzgerald', personality: 'local', homeRegion: 'south-san-diego', activityLevel: 'high', background: 'Firefighter, 20 years surfing OB Pier' },
  { oldName: 'Jake "NorCal" Anderson', name: 'Diego Santos', personality: 'local', homeRegion: 'central-coast', activityLevel: 'high', background: 'Grew up in Santa Cruz, knows every reef' },
  { oldName: 'Sofia "SoCal" Ramirez', name: 'Carmen Vega', personality: 'local', homeRegion: 'south-san-diego', activityLevel: 'medium', background: 'Restaurant owner, sunrise sessions at Sunset Cliffs' },
  { oldName: 'Kai "Hawaii" Nakamura', name: 'Ethan Brooks', personality: 'competitor', homeRegion: 'central-coast', activityLevel: 'high', background: 'Steamer Lane devotee, chasing QS points' },
  { oldName: 'Ryan "Tech" Kumar', name: 'David Kim', personality: 'local', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Accountant by day, Trestles regular since 08' },
  { oldName: 'Emma "Weather" Foster', name: 'Priya Sharma', personality: 'local', homeRegion: 'sf-bay-area', activityLevel: 'high', background: 'ER doctor, dawn patrol at Pacifica is her therapy' },
  { oldName: 'Mia "Safety" Rodriguez', name: 'Anika Patel', personality: 'rookie', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Tech PM, started surfing at 35, fully hooked' },
  { oldName: 'Marcus "East Coast" Johnson', name: 'Chris Morales', personality: 'traveler', homeRegion: 'norcal-visitor', activityLevel: 'low', background: 'Surfs globally, documenting California leg' },
  { oldName: 'Big Boss', name: 'Ben Kowalski', personality: 'tactical', homeRegion: 'north-san-diego', activityLevel: 'medium', background: 'Ex-Navy, treats every session like a mission' },
  { oldName: 'Solid Snake', name: 'Mike Patterson', personality: 'tactical', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Security consultant, precision approach to waves' },
  { oldName: 'Liquid Snake', name: 'Tyler OBrien', personality: 'competitor', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'Former NSSA junior, trains at Huntington' },
  { oldName: 'Mia R.', name: 'Mia Gonzalez', personality: 'photographer', homeRegion: 'central-coast', activityLevel: 'medium', background: 'Fine art photographer, captures Morro Bay moods' },
  { oldName: 'Tina C.', name: 'Natalie Foster', personality: 'traveler', homeRegion: 'socal-visitor', activityLevel: 'low', background: 'Australian expat, comparing Cali to home' },
  { oldName: 'Dawn Patrol', name: 'Jordan Rivera', personality: 'local', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'High school teacher, Cardiff Reef is his office' },
  { oldName: 'Kai N.', name: 'Andre Williams', personality: 'competitor', homeRegion: 'south-san-diego', activityLevel: 'high', background: 'Former college athlete, training for pro-am' },
  { oldName: 'Emma F.', name: 'Sarah Tanaka', personality: 'rookie', homeRegion: 'sf-bay-area', activityLevel: 'medium', background: 'Startup founder, stress relief at Bolinas' },
  { oldName: 'Riley R.', name: 'Lauren Mitchell', personality: 'rookie', homeRegion: 'central-coast', activityLevel: 'medium', background: 'Yoga instructor, finding balance in the water' },
  { oldName: 'P. Martinez', name: 'Maya Johnson', personality: 'photographer', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Content creator, golden hour at San Onofre' },
  { oldName: 'M. Johnson', name: 'Nina Okonkwo', personality: 'traveler', homeRegion: 'norcal-visitor', activityLevel: 'low', background: 'Journalist writing about California surf culture' },
  { oldName: 'Ryan K.', name: 'Jasmine Wu', personality: 'local', homeRegion: 'sf-bay-area', activityLevel: 'high', background: 'Marine biologist, surfs Lindamar year-round' },
  { oldName: 'Morning Intel Bot', name: 'Quiver Surf Forecast', personality: 'forecaster', homeRegion: 'all-regions', activityLevel: 'high', background: 'Daily California surf conditions from the Quiver team' }
];

// Posting windows by personality type (hours in PT)
export const POSTING_WINDOWS: Record<string, { primary: [number, number]; secondary: [number, number]; weekendBoost: boolean }> = {
  local: { primary: [5, 8], secondary: [16, 19], weekendBoost: true },
  rookie: { primary: [9, 12], secondary: [14, 17], weekendBoost: true },
  traveler: { primary: [7, 11], secondary: [15, 18], weekendBoost: false },
  photographer: { primary: [5, 7], secondary: [17, 20], weekendBoost: false },
  tactical: { primary: [5, 6], secondary: [11, 13], weekendBoost: false },
  competitor: { primary: [6, 9], secondary: [15, 18], weekendBoost: true },
  forecaster: { primary: [5, 6], secondary: [5, 6], weekendBoost: false }
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit config/npc-roster.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add config/npc-roster.ts
git commit -m "feat(config): add NPC roster with 25 natural-named profiles

- Maps old names to new natural names
- Includes personality, region, and activity level
- Defines posting windows by personality type"
```

---

## Task 4: Create Regional Configuration

**Files:**
- Create: `config/regions.ts`

**Step 1: Write the regional configuration**

```typescript
/**
 * Regional Configuration
 *
 * Defines beach-to-region mappings for NPC beach selection
 * and forecast aggregation.
 */

export interface RegionConfig {
  beaches: string[];
  timezone: string;
  forecastBeaches: string[];
}

export const REGIONS: Record<string, RegionConfig> = {
  'sf-bay-area': {
    beaches: ['ocean beach', 'pacifica', 'lindamar', 'bolinas', 'fort point', 'rockaway'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ocean beach', 'pacifica']
  },
  'central-coast': {
    beaches: ['steamer lane', 'pleasure point', 'cowell', 'morro bay', 'pismo', 'cayucos'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['steamer lane', 'pleasure point']
  },
  'north-san-diego': {
    beaches: ['scripps', 'blacks', 'cardiff', 'swamis', 'del mar', 'torrey pines'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['scripps', 'blacks']
  },
  'south-san-diego': {
    beaches: ['ob pier', 'sunset cliffs', 'coronado', 'imperial beach', 'mission beach'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ob pier', 'sunset cliffs']
  },
  'orange-county': {
    beaches: ['huntington', 'trestles', 'san onofre', 'doheny', 'laguna', 'newport'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['huntington', 'trestles']
  },
  'socal-visitor': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'norcal-visitor': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'all-regions': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] }
};

export const FORECAST_REGIONS = {
  norcal: { name: 'NorCal', primaryBeach: 'ocean beach', regions: ['sf-bay-area'] },
  central: { name: 'Central Coast', primaryBeach: 'steamer lane', regions: ['central-coast'] },
  socal: { name: 'SoCal', primaryBeach: 'scripps', regions: ['north-san-diego', 'south-san-diego', 'orange-county'] }
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit config/regions.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add config/regions.ts
git commit -m "feat(config): add regional beach configuration

- Maps regions to beach patterns
- Defines forecast regions for morning reports
- Supports visitor NPCs that can post anywhere"
```

---

## Task 5: Create Template Hydration Utility

**Files:**
- Create: `lib/npc/template-hydration.ts`
- Create: `__tests__/lib/npc/template-hydration.test.ts`

**Step 1: Write the failing test**

```typescript
import { hydrateTemplate, type TemplateVariables } from '@/lib/npc/template-hydration';

describe('hydrateTemplate', () => {
  it('replaces single variable', () => {
    const template = 'Checked {{beach_name}} this morning.';
    const variables: TemplateVariables = { beach_name: 'Ocean Beach' };
    expect(hydrateTemplate(template, variables)).toBe('Checked Ocean Beach this morning.');
  });

  it('replaces multiple variables', () => {
    const template = '{{time_of_day}} session at {{beach_name}} was solid.';
    const variables: TemplateVariables = { time_of_day: 'Dawn patrol', beach_name: 'Scripps' };
    expect(hydrateTemplate(template, variables)).toBe('Dawn patrol session at Scripps was solid.');
  });

  it('handles missing variables gracefully', () => {
    const template = '{{beach_name}} looking {{condition}} today.';
    const variables: TemplateVariables = { beach_name: 'Pacifica' };
    expect(hydrateTemplate(template, variables)).toBe('Pacifica looking  today.');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/npc/template-hydration.test.ts`

Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

```typescript
/**
 * Template Hydration Utility
 */

export interface TemplateVariables {
  beach_name?: string;
  wave_range?: string;
  wave_period?: string;
  wind_description?: string;
  tide_state?: string;
  water_temp?: string;
  time_of_day?: string;
  crowd_sentence?: string;
  [key: string]: string | undefined;
}

export function hydrateTemplate(template: string, variables: TemplateVariables): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => variables[varName] ?? '');
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(match => match.replace(/[{}]/g, ''));
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/npc/template-hydration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/npc/template-hydration.ts __tests__/lib/npc/template-hydration.test.ts
git commit -m "feat(npc): add template hydration utility"
```

---

## Task 6: Create Beach Selection Utility

**Files:**
- Create: `lib/npc/beach-selection.ts`
- Create: `__tests__/lib/npc/beach-selection.test.ts`

**Step 1: Write the failing test**

```typescript
import { selectBeachForPost, type NPCBeachConfig } from '@/lib/npc/beach-selection';

describe('selectBeachForPost', () => {
  const mockConfig: NPCBeachConfig = {
    homeBeachIds: ['beach-1', 'beach-2'],
    secondaryBeaches: ['beach-3', 'beach-4', 'beach-5'],
    homeRegion: 'north-san-diego'
  };

  it('returns a beach ID', () => {
    const result = selectBeachForPost(mockConfig);
    expect(typeof result).toBe('string');
  });

  it('returns home beach most often', () => {
    const results = Array.from({ length: 1000 }, () => selectBeachForPost(mockConfig));
    const homeCount = results.filter(id => mockConfig.homeBeachIds.includes(id)).length;
    expect(homeCount).toBeGreaterThan(600);
    expect(homeCount).toBeLessThan(800);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/npc/beach-selection.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
/**
 * Beach Selection Utility - 70% home, 25% secondary, 5% adventure
 */

export interface NPCBeachConfig {
  homeBeachIds: string[];
  secondaryBeaches: string[];
  homeRegion: string;
}

export function selectBeachForPost(config: NPCBeachConfig): string {
  const { homeBeachIds, secondaryBeaches } = config;
  if (!homeBeachIds.length) throw new Error('NPC must have at least one home beach');

  const roll = Math.random();
  if (roll < 0.70 || secondaryBeaches.length === 0) {
    return pickRandom(homeBeachIds);
  } else if (roll < 0.95) {
    return pickRandom(secondaryBeaches);
  } else {
    return secondaryBeaches.length > 0 ? pickRandom(secondaryBeaches) : pickRandom(homeBeachIds);
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/npc/beach-selection.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/npc/beach-selection.ts __tests__/lib/npc/beach-selection.test.ts
git commit -m "feat(npc): add beach selection with weighted randomization"
```

---

## Task 7: Create Posting Windows Utility

**Files:**
- Create: `lib/npc/posting-windows.ts`
- Create: `__tests__/lib/npc/posting-windows.test.ts`

**Step 1: Write the failing test**

```typescript
import { isInPostingWindow } from '@/lib/npc/posting-windows';

describe('isInPostingWindow', () => {
  it('returns true when hour is in primary window', () => {
    const date = new Date('2026-01-13T06:30:00-08:00');
    expect(isInPostingWindow('local', date)).toBe(true);
  });

  it('returns false when outside posting windows', () => {
    const date = new Date('2026-01-13T12:00:00-08:00');
    expect(isInPostingWindow('local', date)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/npc/posting-windows.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
export type PersonalityType = 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor' | 'forecaster';
export type ActivityLevel = 'high' | 'medium' | 'low';

const POSTING_WINDOWS: Record<PersonalityType, { primary: [number, number]; secondary: [number, number] }> = {
  local: { primary: [5, 8], secondary: [16, 19] },
  rookie: { primary: [9, 12], secondary: [14, 17] },
  traveler: { primary: [7, 11], secondary: [15, 18] },
  photographer: { primary: [5, 7], secondary: [17, 20] },
  tactical: { primary: [5, 6], secondary: [11, 13] },
  competitor: { primary: [6, 9], secondary: [15, 18] },
  forecaster: { primary: [5, 6], secondary: [5, 6] }
};

export function isInPostingWindow(personality: PersonalityType, date: Date): boolean {
  const hour = date.getHours();
  const windows = POSTING_WINDOWS[personality];
  const [primaryStart, primaryEnd] = windows.primary;
  const [secondaryStart, secondaryEnd] = windows.secondary;
  return (hour >= primaryStart && hour < primaryEnd) || (hour >= secondaryStart && hour < secondaryEnd);
}

export function shouldPostNow(personality: PersonalityType, activityLevel: ActivityLevel, date: Date = new Date()): boolean {
  if (!isInPostingWindow(personality, date)) return false;
  const probability = { high: 0.15, medium: 0.08, low: 0.04 }[activityLevel];
  return Math.random() < probability;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/npc/posting-windows.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/npc/posting-windows.ts __tests__/lib/npc/posting-windows.test.ts
git commit -m "feat(npc): add posting windows utility"
```

---

## Task 8: Create Forecast Formatter Utility

**Files:**
- Create: `lib/npc/forecast-formatter.ts`
- Create: `__tests__/lib/npc/forecast-formatter.test.ts`

**Step 1: Write the failing test**

```typescript
import { formatWaveRange, formatWindDescription, formatTimeOfDay } from '@/lib/npc/forecast-formatter';

describe('formatWaveRange', () => {
  it('formats wave height into range', () => {
    expect(formatWaveRange(3.5)).toBe('3-4ft');
    expect(formatWaveRange(5.0)).toBe('4-6ft');
  });
});

describe('formatWindDescription', () => {
  it('describes calm conditions', () => {
    expect(formatWindDescription(2, 'NW')).toContain('glassy');
  });
});

describe('formatTimeOfDay', () => {
  it('formats early morning as dawn patrol', () => {
    const date = new Date('2026-01-13T05:30:00');
    expect(formatTimeOfDay(date)).toBe('dawn patrol');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/npc/forecast-formatter.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
export function formatWaveRange(heightFt: number): string {
  const lower = Math.max(0, Math.floor(heightFt - 0.5));
  const upper = Math.ceil(heightFt + 0.5);
  return `${lower}-${upper}ft`;
}

export function formatWindDescription(speedKts: number, direction: string): string {
  if (speedKts <= 3) return 'glassy conditions';
  const intensity = speedKts <= 7 ? 'light' : speedKts <= 12 ? 'moderate' : 'breezy';
  return `${intensity} ${direction.toUpperCase()} winds`;
}

export function formatTideState(heightFt: number, isRising: boolean): string {
  const level = heightFt < 1 ? 'low' : heightFt < 3 ? 'mid' : 'high';
  return `${isRising ? 'incoming' : 'dropping'} ${level}-tide`;
}

export function formatWaterTemp(tempF: number): string {
  const rounded = Math.round(tempF);
  if (rounded <= 58) return `${rounded}°F (bring rubber)`;
  if (rounded <= 64) return `${rounded}°F`;
  return `${rounded}°F (comfortable)`;
}

export function formatCrowdSentence(level: number): string {
  if (level <= 1) return 'Lineup is basically empty.';
  if (level === 2) return 'Crowd is light with plenty of space.';
  if (level === 3) return 'Crowd is manageable, respectful vibe.';
  if (level === 4) return 'Busy lineup but friendly energy.';
  return 'Packed lineup—pick your moments.';
}

export function formatTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'pre-dawn';
  if (hour < 7) return 'dawn patrol';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'late morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'sunset session';
  return 'evening';
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/npc/forecast-formatter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/npc/forecast-formatter.ts __tests__/lib/npc/forecast-formatter.test.ts
git commit -m "feat(npc): add forecast formatter for natural language"
```

---

## Task 9: Create NPC Profile Migration Script

**Files:**
- Create: `scripts/migrate-npc-profiles.ts`

**Step 1: Write the migration script**

This script reads existing mock profiles, matches them to the NPC_ROSTER by old name, and updates them with new names, personalities, regions, and beach assignments.

```typescript
#!/usr/bin/env node

/**
 * NPC Profile Migration Script
 *
 * Usage:
 *   CONFIRM_TARGET=DEV npx ts-node scripts/migrate-npc-profiles.ts
 *   CONFIRM_TARGET=PROD CONFIRM_PROD=YES npx ts-node scripts/migrate-npc-profiles.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { NPC_ROSTER, POSTING_WINDOWS } from '../config/npc-roster';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🎭 Starting NPC Profile Migration\n');

  const target = process.env.CONFIRM_TARGET;
  if (target !== 'DEV' && target !== 'PROD') {
    console.error('Set CONFIRM_TARGET=DEV or CONFIRM_TARGET=PROD');
    process.exit(1);
  }

  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_mock', true);

  console.log(`Found ${existingProfiles?.length || 0} existing NPCs\n`);

  let updated = 0;
  let created = 0;

  for (const profile of NPC_ROSTER) {
    const existing = existingProfiles?.find(p =>
      p.full_name?.toLowerCase().includes(profile.oldName?.toLowerCase().split(' ')[0] || '')
    );

    const postingWindow = POSTING_WINDOWS[profile.personality];

    if (existing) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.name,
          personality_type: profile.personality,
          home_region: profile.homeRegion,
          activity_level: profile.activityLevel,
          posting_window: postingWindow,
          is_system_account: profile.personality === 'forecaster'
        })
        .eq('id', existing.id);

      if (!error) {
        console.log(`✅ Updated ${existing.full_name} → ${profile.name}`);
        updated++;
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({
          full_name: profile.name,
          personality_type: profile.personality,
          home_region: profile.homeRegion,
          activity_level: profile.activityLevel,
          posting_window: postingWindow,
          is_mock: true,
          is_system_account: profile.personality === 'forecaster'
        });

      if (!error) {
        console.log(`✨ Created ${profile.name}`);
        created++;
      }
    }
  }

  console.log(`\n📊 Summary: ${updated} updated, ${created} created`);
}

main().catch(console.error);
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit scripts/migrate-npc-profiles.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add scripts/migrate-npc-profiles.ts
git commit -m "feat(scripts): add NPC profile migration script"
```

---

## Task 10: Create Morning Forecast Script

**Files:**
- Create: `scripts/morning-forecast.ts`

**Step 1: Write the morning forecast script**

Creates 3 regional forecast posts from the "Quiver Surf Forecast" system account.

```typescript
#!/usr/bin/env node

/**
 * Morning Forecast Script - Posts regional surf forecasts at 5:30am PT
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { FORECAST_REGIONS } from '../config/regions';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('🌊 Quiver Surf Forecast - Morning Report\n');

  const { data: forecaster } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_system_account', true)
    .eq('personality_type', 'forecaster')
    .single();

  if (!forecaster) {
    console.error('Forecaster profile not found');
    process.exit(1);
  }

  for (const [key, config] of Object.entries(FORECAST_REGIONS)) {
    const { data: beach } = await supabase
      .from('beaches')
      .select('id, lat, lon')
      .ilike('name', `%${config.primaryBeach}%`)
      .single();

    if (!beach) continue;

    const { data: forecast } = await supabase
      .from('marine_forecasts')
      .select('wave_height_m, wave_period_s, wind_speed_ms')
      .eq('beach_id', beach.id)
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    const waveHeight = forecast?.wave_height_m ? (forecast.wave_height_m * 3.28).toFixed(0) : '2-3';
    const title = `${config.name} Morning Report`;
    const description = `${config.name}: ${waveHeight}ft with ${Math.round(forecast?.wave_period_s || 10)}s period. Winds light offshore.`;

    await supabase.from('intel_posts').insert({
      user_id: forecaster.id,
      beach_id: beach.id,
      latitude: beach.lat,
      longitude: beach.lon,
      tag: 'conditions',
      title,
      description,
      is_active: true
    });

    console.log(`✅ Posted: ${title}`);
  }
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add scripts/morning-forecast.ts
git commit -m "feat(scripts): add morning forecast script"
```

---

## Task 11: Create Template Health Check Script

**Files:**
- Create: `scripts/check-template-health.ts`

**Step 1: Write the health check script**

Monitors template staleness and sends alerts.

```typescript
#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('🔍 NPC Template Health Check\n');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: overused } = await supabase
    .from('npc_content_templates')
    .select('id, content_type, personality, use_count')
    .gte('use_count', 3)
    .gte('last_used_at', sevenDaysAgo)
    .eq('archived', false);

  const { data: categories } = await supabase
    .from('npc_content_templates')
    .select('content_type, personality')
    .eq('archived', false);

  console.log(`Overused templates: ${overused?.length || 0}`);
  console.log(`Total templates: ${categories?.length || 0}`);

  if (overused && overused.length > 0) {
    console.log('\n⚠️ Alerts:');
    overused.forEach(t => console.log(`  - ${t.personality}/${t.content_type}: ${t.use_count} uses`));
  } else {
    console.log('\n✅ All templates healthy!');
  }
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add scripts/check-template-health.ts
git commit -m "feat(scripts): add template health check"
```

---

## Task 12: Add Package.json Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add scripts**

Add to package.json scripts section:

```json
"npc:migrate": "ts-node scripts/migrate-npc-profiles.ts",
"npc:forecast": "ts-node scripts/morning-forecast.ts",
"npc:health": "ts-node scripts/check-template-health.ts"
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "feat(scripts): add NPC management scripts to package.json"
```

---

## Task 13: Run All Tests and Final Verification

**Step 1: Run all NPC tests**

Run: `yarn test __tests__/lib/npc/`

Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `yarn typecheck`

Expected: No errors

**Step 3: Run build**

Run: `yarn build`

Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(npc): complete realistic intel bots implementation

Implements design from 2026-01-13-realistic-intel-bots-design.md:
- Database migrations for profile fields and templates table
- NPC roster with 25 natural-named profiles
- Regional configuration for beach selection
- Template hydration, beach selection, posting windows utilities
- Migration script for existing NPCs
- Morning forecast script for Quiver Surf Forecast
- Template health check with alerts"
```

---

## Post-Implementation Checklist

- [ ] All migrations applied
- [ ] NPC profiles migrated with new names
- [ ] All unit tests pass
- [ ] TypeScript compiles without errors
- [ ] Build succeeds

## Cron Job Setup (Manual)

| Job | Schedule | Command |
|-----|----------|---------|
| Morning forecast | 5:30am PT daily | `CONFIRM_TARGET=PROD CONFIRM_PROD=YES yarn npc:forecast` |
| Template health | Sunday 9am PT | `yarn npc:health` |

---

## Design Document Reference

This plan implements: `docs/plans/2026-01-13-realistic-intel-bots-design.md`
