# Condition Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users define custom surf condition alert rules on beaches and receive a single consolidated daily alert (email + push) 2 hours before matching conditions begin.

**Architecture:** Two-phase cron system — an evaluation cron (~09:00 UTC daily) writes matching alerts to an `alert_queue` table, and a delivery cron (every 5 min) consolidates and sends them. Alert rules use JSONB conditions with AND logic. Presets pre-fill the JSONB; custom rules build it field by field. Entitlements gated by `ALERT_PREVIEW_MODE` env var (everything unlocked during preview).

**Tech Stack:** Next.js API routes (cron), Supabase PostgreSQL (tables + RLS + RPCs), Resend (email), Expo Push / FCM (push), suncalc (sunrise/sunset), React (email templates via @react-email), Radix UI (popovers), Tailwind CSS.

**Spec:** `docs/archive/superpowers/specs/2026-03-31-condition-alerts-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDD_add_condition_alerts.sql` | Create `alert_rules`, `alert_queue`, `alert_deliveries` tables + RLS + indexes |
| `lib/alerts/types.ts` | TypeScript types for alert conditions, presets, queue items, payloads |
| `lib/alerts/presets.ts` | 7 preset definitions with conditions JSONB and metadata |
| `lib/alerts/entitlements.ts` | `getUserEntitlement()`, cap constants, validation helpers |
| `lib/alerts/condition-evaluator.ts` | Pure function: evaluate a single forecast hour against a rule's conditions |
| `lib/alerts/window-finder.ts` | Find contiguous matching windows from a set of forecast hours |
| `lib/alerts/best-hour.ts` | Normalized distance-from-ideal scoring for best hour within a window |
| `lib/alerts/degree-utils.ts` | Circular degree math: wrapping, angular distance, within-range checks |
| `lib/alerts/sunrise.ts` | Sunrise/sunset calculation wrapper around suncalc |
| `lib/alerts/payload-builder.ts` | Consolidate queue items into per-user alert payloads |
| `lib/alerts/push-formatter.ts` | Format consolidated payload into push notification title + body |
| `lib/alerts/push-sender.ts` | Send push notifications via Expo Push API + FCM |
| `app/api/cron/condition-alert-evaluate/route.ts` | Phase 1 evaluation cron |
| `app/api/cron/condition-alert-deliver/route.ts` | Phase 2 delivery cron |
| `app/api/alerts/rules/route.ts` | GET (list user's rules), POST (create rule) |
| `app/api/alerts/rules/[ruleId]/route.ts` | PATCH (update rule), DELETE (delete rule) |
| `app/api/alerts/rules/[ruleId]/disable-email/route.ts` | POST — one-click disable from email |
| `app/api/alerts/debug/[ruleId]/route.ts` | GET — why didn't this rule match today |
| `lib/mailer/templates/ConsolidatedAlertEmail.tsx` | Multi-beach consolidated alert email template |
| `components/alerts/alert-creation-popover.tsx` | Preset picker + custom builder popover |
| `components/alerts/preset-card.tsx` | Individual preset card component |
| `components/alerts/condition-builder.tsx` | Custom condition builder with add-field pattern |
| `components/alerts/alert-rule-card.tsx` | Single rule display with toggle/edit/delete |
| `components/alerts/alert-management-panel.tsx` | Expandable panel for beaches tab |
| `__tests__/lib/alerts/condition-evaluator.test.ts` | Tests for condition evaluation |
| `__tests__/lib/alerts/window-finder.test.ts` | Tests for window finding |
| `__tests__/lib/alerts/best-hour.test.ts` | Tests for best hour scoring |
| `__tests__/lib/alerts/degree-utils.test.ts` | Tests for degree math |
| `__tests__/lib/alerts/presets.test.ts` | Tests for preset definitions |
| `__tests__/lib/alerts/entitlements.test.ts` | Tests for entitlement logic |
| `__tests__/lib/alerts/payload-builder.test.ts` | Tests for payload consolidation |
| `__tests__/lib/alerts/push-formatter.test.ts` | Tests for push notification formatting |

### Modified Files

| File | Change |
|------|--------|
| `components/beach-detail/beach-alert-cta.tsx` | Redesign: visible CTA, opens popover, active state |
| `components/beach-detail/beach-actions.tsx` | Add alert CTA alongside Report Conditions |
| `components/favorite-beaches.tsx` | Add alert status row + management panel |
| `vercel.json` | Add cron schedules for both cron jobs |
| `types/database.generated.ts` | Regenerate after migration |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260408163000_add_condition_alerts.sql`

- [ ] **Step 1: Write the migration**

```sql
BEGIN;

-- Alert rules: one row per user-defined alert on a beach
CREATE TABLE alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_type text CHECK (preset_type IN (
    'glass_off', 'big_day', 'clean_groundswell', 'mellow_session',
    'tide_window', 'dawn_patrol', 'epic_conditions'
  )),
  conditions jsonb NOT NULL DEFAULT '{}',
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_beach_id ON alert_rules(beach_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(user_id, enabled) WHERE enabled = true;

-- RLS: users can only access their own rules
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alert rules"
  ON alert_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert rules"
  ON alert_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert rules"
  ON alert_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert rules"
  ON alert_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for cron jobs
CREATE POLICY "Service role can read all alert rules"
  ON alert_rules FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update alert rules"
  ON alert_rules FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alert queue: evaluation cron writes here, delivery cron reads
CREATE TABLE alert_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  alert_date date NOT NULL,
  send_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  best_hour timestamptz NOT NULL,
  conditions_snapshot jsonb NOT NULL DEFAULT '{}',
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_queue_delivery ON alert_queue(sent, send_at) WHERE sent = false;
CREATE INDEX idx_alert_queue_user_date ON alert_queue(user_id, alert_date);

ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert queue"
  ON alert_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Alert deliveries: deduplication tracking
CREATE TABLE alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_date date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_alert_deliveries_dedup
  ON alert_deliveries(user_id, alert_date, channel);

ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert deliveries"
  ON alert_deliveries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own alert deliveries"
  ON alert_deliveries FOR SELECT
  USING (auth.uid() = user_id);

-- Updated_at trigger for alert_rules
CREATE TRIGGER set_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

COMMIT;
```

- [ ] **Step 2: Apply migration locally**

Run: `cd quiver && supabase db reset`
Expected: Migration applies without errors.

- [ ] **Step 3: Regenerate database types**

Run: `cd quiver && yarn db:types`
Expected: `types/database.generated.ts` updated with `alert_rules`, `alert_queue`, `alert_deliveries` table types.

- [ ] **Step 4: Commit**

```bash
cd quiver
git add supabase/migrations/20260408163000_add_condition_alerts.sql types/database.generated.ts
git commit -m "feat: add alert_rules, alert_queue, alert_deliveries tables"
```

---

## Task 2: Alert Types & Preset Definitions

**Files:**
- Create: `lib/alerts/types.ts`
- Create: `lib/alerts/presets.ts`
- Create: `__tests__/lib/alerts/presets.test.ts`

- [ ] **Step 1: Write types**

```ts
// lib/alerts/types.ts

export interface AlertConditions {
  swell_height_min?: number;
  swell_height_max?: number;
  swell_direction_min_deg?: number;
  swell_direction_max_deg?: number;
  swell_period_min?: number;
  wind_direction?: "offshore" | "onshore" | "cross-shore";
  wind_speed_max_kt?: number;
  tide_height_min_ft?: number;
  tide_height_max_ft?: number;
  tide_direction?: "rising" | "falling" | "high" | "low";
}

export type PresetType =
  | "glass_off"
  | "big_day"
  | "clean_groundswell"
  | "mellow_session"
  | "tide_window"
  | "dawn_patrol"
  | "epic_conditions";

export interface PresetDefinition {
  type: PresetType;
  name: string;
  description: string;
  conditionsSummary: string;
  group: "popular" | "specific";
  /** Returns conditions JSONB, optionally using beach metadata for dynamic values */
  buildConditions: (beach: BeachAlertMeta) => AlertConditions;
}

export interface BeachAlertMeta {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lon: number;
  timezone: string;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
}

export interface ForecastHour {
  forecast_at: string;
  wave_height: number | null;
  wave_period: number | null;
  swell_1_height: number | null;
  swell_1_period: number | null;
  swell_1_direction: number | null;
  wind_speed: number | null;
  wind_direction_deg: number | null;
  tide_height: number | null;
  tide_status: string | null;
}

export interface MatchingWindow {
  rule_id: string;
  rule_name: string;
  beach_id: string;
  beach_name: string;
  beach_timezone: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
  notify_email: boolean;
  notify_push: boolean;
}

export interface ConsolidatedAlertPayload {
  user_id: string;
  alert_date: string;
  send_at: string;
  matches: MatchingWindow[];
}

export interface AlertQueueRow {
  id: string;
  user_id: string;
  rule_id: string;
  beach_id: string;
  alert_date: string;
  send_at: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
}
```

- [ ] **Step 2: Write the failing test for presets**

```ts
// __tests__/lib/alerts/presets.test.ts
import { PRESETS, getPreset, getPresetsForGroup } from "@/lib/alerts/presets";
import type { BeachAlertMeta } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1",
  name: "Blacks Beach",
  slug: "blacks-beach",
  lat: 32.88,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 45,
  aspect_deg: 270,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 60,
};

describe("presets", () => {
  it("defines exactly 7 presets", () => {
    expect(PRESETS).toHaveLength(7);
  });

  it("has 3 popular and 4 specific presets", () => {
    expect(getPresetsForGroup("popular")).toHaveLength(3);
    expect(getPresetsForGroup("specific")).toHaveLength(4);
  });

  it("each preset has required fields", () => {
    for (const preset of PRESETS) {
      expect(preset.type).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.conditionsSummary).toBeTruthy();
      expect(preset.group).toMatch(/^(popular|specific)$/);
      expect(typeof preset.buildConditions).toBe("function");
    }
  });

  it("glass_off builds correct conditions", () => {
    const preset = getPreset("glass_off")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.wind_direction).toBe("offshore");
    expect(conditions.wind_speed_max_kt).toBe(5);
    expect(conditions.swell_height_min).toBe(2);
  });

  it("mellow_session uses beach preferred tide range", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBe(1);
    expect(conditions.swell_height_max).toBe(4);
  });

  it("tide_window uses beach preferred tide range and direction", () => {
    const preset = getPreset("tide_window")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.tide_direction).toBe("rising");
  });

  it("epic_conditions uses all beach metadata", () => {
    const preset = getPreset("epic_conditions")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.wind_direction).toBe("offshore");
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBeGreaterThan(0);
    expect(conditions.swell_period_min).toBeGreaterThan(0);
  });

  it("getPreset returns undefined for invalid type", () => {
    expect(getPreset("nonexistent" as any)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/presets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write presets implementation**

```ts
// lib/alerts/presets.ts
import type { AlertConditions, BeachAlertMeta, PresetDefinition, PresetType } from "./types";

export const PRESETS: PresetDefinition[] = [
  // Popular
  {
    type: "glass_off",
    name: "Glass-Off",
    description: "Light wind and clean waves — perfect morning glass",
    conditionsSummary: "Offshore or <5kt wind, 2ft+ swell",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      wind_direction: "offshore",
      wind_speed_max_kt: 5,
      swell_height_min: 2,
    }),
  },
  {
    type: "mellow_session",
    name: "Mellow Session",
    description: "Small, clean, and fun — great for longboarding or learning",
    conditionsSummary: "1-4ft swell, <8kt wind, favorable tide",
    group: "popular",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      swell_height_min: 1,
      swell_height_max: 4,
      wind_speed_max_kt: 8,
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
    }),
  },
  {
    type: "dawn_patrol",
    name: "Dawn Patrol",
    description: "Anything rideable at first light — for the daily surfer",
    conditionsSummary: "1.5ft+ swell, <15kt wind, first 2 hours",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 1.5,
      wind_speed_max_kt: 15,
    }),
  },
  // Specific
  {
    type: "big_day",
    name: "Big Day",
    description: "Large swell incoming — for experienced surfers chasing size",
    conditionsSummary: "6ft+ swell, 10s+ period",
    group: "specific",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 6,
      swell_period_min: 10,
    }),
  },
  {
    type: "clean_groundswell",
    name: "Clean Groundswell",
    description: "Long-period swell with clean conditions — quality over quantity",
    conditionsSummary: "12s+ period, <10kt wind, favorable direction",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      swell_period_min: 12,
      wind_speed_max_kt: 10,
      swell_direction_min_deg: beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null
        ? (beach.swell_window_center_deg - beach.swell_window_halfwidth_deg + 360) % 360
        : undefined,
      swell_direction_max_deg: beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null
        ? (beach.swell_window_center_deg + beach.swell_window_halfwidth_deg) % 360
        : undefined,
    }),
  },
  {
    type: "tide_window",
    name: "Tide Window",
    description: "Optimal tide for this spot — great for reef breaks",
    conditionsSummary: "Tide in spot's preferred range and direction",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
      tide_direction: (beach.preferred_tide_direction as AlertConditions["tide_direction"]) ?? undefined,
    }),
  },
  {
    type: "epic_conditions",
    name: "Epic Conditions",
    description: "Everything aligns — the rare days you don't want to miss",
    conditionsSummary: "All conditions in spot's ideal ranges",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      wind_direction: "offshore",
      wind_speed_max_kt: 10,
      swell_height_min: 3,
      swell_period_min: 10,
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
      swell_direction_min_deg: beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null
        ? (beach.swell_window_center_deg - beach.swell_window_halfwidth_deg + 360) % 360
        : undefined,
      swell_direction_max_deg: beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null
        ? (beach.swell_window_center_deg + beach.swell_window_halfwidth_deg) % 360
        : undefined,
    }),
  },
];

export function getPreset(type: PresetType): PresetDefinition | undefined {
  return PRESETS.find((p) => p.type === type);
}

export function getPresetsForGroup(group: "popular" | "specific"): PresetDefinition[] {
  return PRESETS.filter((p) => p.group === group);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quiver && yarn test __tests__/lib/alerts/presets.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd quiver
git add lib/alerts/types.ts lib/alerts/presets.ts __tests__/lib/alerts/presets.test.ts
git commit -m "feat: add alert types and preset definitions"
```

---

## Task 3: Degree Utilities

**Files:**
- Create: `lib/alerts/degree-utils.ts`
- Create: `__tests__/lib/alerts/degree-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/alerts/degree-utils.test.ts
import {
  normalizeAngle,
  angularDistance,
  isWithinArc,
  resolveWindDirection,
} from "@/lib/alerts/degree-utils";

describe("normalizeAngle", () => {
  it("normalizes negative angles", () => {
    expect(normalizeAngle(-10)).toBe(350);
  });

  it("normalizes angles over 360", () => {
    expect(normalizeAngle(370)).toBe(10);
  });

  it("leaves 0-359 unchanged", () => {
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(0)).toBe(0);
  });
});

describe("angularDistance", () => {
  it("calculates simple distance", () => {
    expect(angularDistance(10, 20)).toBe(10);
  });

  it("handles wrapping around north", () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(10, 350)).toBe(20);
  });

  it("returns 180 for opposite directions", () => {
    expect(angularDistance(0, 180)).toBe(180);
  });
});

describe("isWithinArc", () => {
  it("matches within simple arc", () => {
    expect(isWithinArc(200, 180, 270)).toBe(true);
  });

  it("rejects outside simple arc", () => {
    expect(isWithinArc(100, 180, 270)).toBe(false);
  });

  it("handles arc wrapping around north (315 to 45)", () => {
    expect(isWithinArc(350, 315, 45)).toBe(true);
    expect(isWithinArc(10, 315, 45)).toBe(true);
    expect(isWithinArc(0, 315, 45)).toBe(true);
    expect(isWithinArc(180, 315, 45)).toBe(false);
    expect(isWithinArc(90, 315, 45)).toBe(false);
  });

  it("handles full circle (min === max)", () => {
    expect(isWithinArc(100, 45, 45)).toBe(true);
  });
});

describe("resolveWindDirection", () => {
  it("identifies offshore wind", () => {
    // Beach faces west (270), offshore is east (90), tolerance 45
    expect(resolveWindDirection(90, 90, 45, 270)).toBe("offshore");
    expect(resolveWindDirection(110, 90, 45, 270)).toBe("offshore");
  });

  it("identifies onshore wind", () => {
    // Wind coming from same direction beach faces = onshore
    expect(resolveWindDirection(270, 90, 45, 270)).toBe("onshore");
  });

  it("identifies cross-shore wind", () => {
    expect(resolveWindDirection(180, 90, 30, 270)).toBe("cross-shore");
  });

  it("returns null if offshore_deg is null", () => {
    expect(resolveWindDirection(90, null, null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/degree-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```ts
// lib/alerts/degree-utils.ts

/** Normalize an angle to [0, 360) */
export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Shortest angular distance between two bearings (0-180) */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Check if a bearing falls within an arc from minDeg to maxDeg (clockwise).
 * Handles wrapping around 0/360.
 * If minDeg === maxDeg, the arc is 360° (matches everything).
 */
export function isWithinArc(
  bearing: number,
  minDeg: number,
  maxDeg: number
): boolean {
  const b = normalizeAngle(bearing);
  const min = normalizeAngle(minDeg);
  const max = normalizeAngle(maxDeg);

  if (min === max) return true;
  if (min < max) return b >= min && b <= max;
  // Wraps around north: e.g., 315 to 45
  return b >= min || b <= max;
}

/**
 * Classify wind direction relative to a beach's orientation.
 * Returns null if beach metadata is insufficient.
 */
export function resolveWindDirection(
  windDeg: number,
  offshoreDeg: number | null,
  offshoreTolDeg: number | null,
  aspectDeg: number | null
): "offshore" | "onshore" | "cross-shore" | null {
  if (offshoreDeg == null) return null;

  const tolerance = offshoreTolDeg ?? 45;

  if (angularDistance(windDeg, offshoreDeg) <= tolerance) {
    return "offshore";
  }

  if (aspectDeg != null && angularDistance(windDeg, aspectDeg) <= tolerance) {
    return "onshore";
  }

  return "cross-shore";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quiver && yarn test __tests__/lib/alerts/degree-utils.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd quiver
git add lib/alerts/degree-utils.ts __tests__/lib/alerts/degree-utils.test.ts
git commit -m "feat: add degree wrapping and wind direction utilities"
```

---

## Task 4: Condition Evaluator

**Files:**
- Create: `lib/alerts/condition-evaluator.ts`
- Create: `__tests__/lib/alerts/condition-evaluator.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/alerts/condition-evaluator.test.ts
import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1",
  name: "Blacks Beach",
  slug: "blacks-beach",
  lat: 32.88,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 45,
  aspect_deg: 270,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 60,
};

const baseForecast: ForecastHour = {
  forecast_at: "2026-04-01T15:00:00Z",
  wave_height: 4,
  wave_period: 12,
  swell_1_height: 4,
  swell_1_period: 12,
  swell_1_direction: 250,
  wind_speed: 5,
  wind_direction_deg: 45,
  tide_height: 3.5,
  tide_status: "rising",
};

describe("evaluateConditions", () => {
  it("returns true when all conditions match", () => {
    const conditions: AlertConditions = {
      swell_height_min: 3,
      wind_speed_max_kt: 10,
      tide_direction: "rising",
    };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(true);
  });

  it("returns false when swell height below minimum", () => {
    const conditions: AlertConditions = { swell_height_min: 6 };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);
  });

  it("returns false when swell height above maximum", () => {
    const conditions: AlertConditions = { swell_height_max: 3 };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);
  });

  it("evaluates swell period minimum", () => {
    const conditions: AlertConditions = { swell_period_min: 14 };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);

    const conditions2: AlertConditions = { swell_period_min: 10 };
    expect(evaluateConditions(conditions2, baseForecast, mockBeach)).toBe(true);
  });

  it("evaluates wind speed maximum", () => {
    const conditions: AlertConditions = { wind_speed_max_kt: 3 };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);

    const conditions2: AlertConditions = { wind_speed_max_kt: 10 };
    expect(evaluateConditions(conditions2, baseForecast, mockBeach)).toBe(true);
  });

  it("evaluates offshore wind direction", () => {
    const conditions: AlertConditions = { wind_direction: "offshore" };
    // Wind at 45°, offshore is 45° — should match
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(true);
  });

  it("evaluates onshore wind direction", () => {
    const conditions: AlertConditions = { wind_direction: "onshore" };
    const onshoreWind = { ...baseForecast, wind_direction_deg: 270 };
    expect(evaluateConditions(conditions, onshoreWind, mockBeach)).toBe(true);
  });

  it("evaluates tide height range", () => {
    const conditions: AlertConditions = { tide_height_min_ft: 2, tide_height_max_ft: 4 };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(true);

    const highTide = { ...baseForecast, tide_height: 6 };
    expect(evaluateConditions(conditions, highTide, mockBeach)).toBe(false);
  });

  it("evaluates tide direction", () => {
    const conditions: AlertConditions = { tide_direction: "falling" };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);

    const conditions2: AlertConditions = { tide_direction: "rising" };
    expect(evaluateConditions(conditions2, baseForecast, mockBeach)).toBe(true);
  });

  it("evaluates swell direction with degree wrapping", () => {
    const conditions: AlertConditions = {
      swell_direction_min_deg: 315,
      swell_direction_max_deg: 45,
    };
    const northSwell = { ...baseForecast, swell_1_direction: 350 };
    expect(evaluateConditions(conditions, northSwell, mockBeach)).toBe(true);

    const southSwell = { ...baseForecast, swell_1_direction: 180 };
    expect(evaluateConditions(conditions, southSwell, mockBeach)).toBe(false);
  });

  it("returns true with empty conditions (no filters)", () => {
    expect(evaluateConditions({}, baseForecast, mockBeach)).toBe(true);
  });

  it("handles null forecast values gracefully (condition fails)", () => {
    const conditions: AlertConditions = { swell_height_min: 3 };
    const nullForecast = { ...baseForecast, wave_height: null };
    expect(evaluateConditions(conditions, nullForecast, mockBeach)).toBe(false);
  });

  it("uses AND logic — all conditions must match", () => {
    const conditions: AlertConditions = {
      swell_height_min: 3,
      wind_speed_max_kt: 3, // fails — wind is 5
    };
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/condition-evaluator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```ts
// lib/alerts/condition-evaluator.ts
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { isWithinArc, resolveWindDirection } from "./degree-utils";

/**
 * Evaluate whether a single forecast hour matches all specified conditions.
 * Uses AND logic — every specified condition must pass.
 * Returns true if all conditions match (or if no conditions are specified).
 */
export function evaluateConditions(
  conditions: AlertConditions,
  forecast: ForecastHour,
  beach: BeachAlertMeta
): boolean {
  // Swell height min
  if (conditions.swell_height_min != null) {
    if (forecast.wave_height == null) return false;
    if (forecast.wave_height < conditions.swell_height_min) return false;
  }

  // Swell height max
  if (conditions.swell_height_max != null) {
    if (forecast.wave_height == null) return false;
    if (forecast.wave_height > conditions.swell_height_max) return false;
  }

  // Swell period min
  if (conditions.swell_period_min != null) {
    const period = forecast.swell_1_period ?? forecast.wave_period;
    if (period == null) return false;
    if (period < conditions.swell_period_min) return false;
  }

  // Swell direction arc
  if (conditions.swell_direction_min_deg != null && conditions.swell_direction_max_deg != null) {
    if (forecast.swell_1_direction == null) return false;
    if (!isWithinArc(forecast.swell_1_direction, conditions.swell_direction_min_deg, conditions.swell_direction_max_deg)) {
      return false;
    }
  }

  // Wind direction (relative to beach)
  if (conditions.wind_direction != null) {
    if (forecast.wind_direction_deg == null) return false;
    const resolved = resolveWindDirection(
      forecast.wind_direction_deg,
      beach.wind_offshore_deg,
      beach.wind_offshore_tol_deg,
      beach.aspect_deg
    );
    if (resolved !== conditions.wind_direction) return false;
  }

  // Wind speed max
  if (conditions.wind_speed_max_kt != null) {
    if (forecast.wind_speed == null) return false;
    if (forecast.wind_speed > conditions.wind_speed_max_kt) return false;
  }

  // Tide height range
  if (conditions.tide_height_min_ft != null) {
    if (forecast.tide_height == null) return false;
    if (forecast.tide_height < conditions.tide_height_min_ft) return false;
  }
  if (conditions.tide_height_max_ft != null) {
    if (forecast.tide_height == null) return false;
    if (forecast.tide_height > conditions.tide_height_max_ft) return false;
  }

  // Tide direction
  if (conditions.tide_direction != null) {
    if (forecast.tide_status == null) return false;
    if (forecast.tide_status !== conditions.tide_direction) return false;
  }

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quiver && yarn test __tests__/lib/alerts/condition-evaluator.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd quiver
git add lib/alerts/condition-evaluator.ts __tests__/lib/alerts/condition-evaluator.test.ts
git commit -m "feat: add condition evaluator with AND logic and degree wrapping"
```

---

## Task 5: Best Hour Scoring

**Files:**
- Create: `lib/alerts/best-hour.ts`
- Create: `__tests__/lib/alerts/best-hour.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/alerts/best-hour.test.ts
import { scoreForecastHour } from "@/lib/alerts/best-hour";
import type { AlertConditions, ForecastHour } from "@/lib/alerts/types";

describe("scoreForecastHour", () => {
  it("scores higher when swell exceeds minimum by more", () => {
    const conditions: AlertConditions = { swell_height_min: 3 };
    const f1: ForecastHour = { forecast_at: "a", wave_height: 4, wave_period: null, swell_1_height: null, swell_1_period: null, swell_1_direction: null, wind_speed: null, wind_direction_deg: null, tide_height: null, tide_status: null };
    const f2: ForecastHour = { ...f1, wave_height: 6 };
    expect(scoreForecastHour(conditions, f2)).toBeGreaterThan(scoreForecastHour(conditions, f1));
  });

  it("scores higher when wind is further below maximum", () => {
    const conditions: AlertConditions = { wind_speed_max_kt: 10 };
    const f1: ForecastHour = { forecast_at: "a", wave_height: null, wave_period: null, swell_1_height: null, swell_1_period: null, swell_1_direction: null, wind_speed: 8, wind_direction_deg: null, tide_height: null, tide_status: null };
    const f2: ForecastHour = { ...f1, wind_speed: 2 };
    expect(scoreForecastHour(conditions, f2)).toBeGreaterThan(scoreForecastHour(conditions, f1));
  });

  it("scores higher when tide is closer to range center", () => {
    const conditions: AlertConditions = { tide_height_min_ft: 2, tide_height_max_ft: 6 };
    const center: ForecastHour = { forecast_at: "a", wave_height: null, wave_period: null, swell_1_height: null, swell_1_period: null, swell_1_direction: null, wind_speed: null, wind_direction_deg: null, tide_height: 4, tide_status: null };
    const edge: ForecastHour = { ...center, tide_height: 2.5 };
    expect(scoreForecastHour(conditions, center)).toBeGreaterThan(scoreForecastHour(conditions, edge));
  });

  it("returns 0 for empty conditions", () => {
    const f: ForecastHour = { forecast_at: "a", wave_height: null, wave_period: null, swell_1_height: null, swell_1_period: null, swell_1_direction: null, wind_speed: null, wind_direction_deg: null, tide_height: null, tide_status: null };
    expect(scoreForecastHour({}, f)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/best-hour.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```ts
// lib/alerts/best-hour.ts
import type { AlertConditions, ForecastHour } from "./types";

/**
 * Score how strongly a forecast hour exceeds rule thresholds.
 * Higher = better conditions. Used to pick the "best hour" within a matching window.
 */
export function scoreForecastHour(
  conditions: AlertConditions,
  forecast: ForecastHour
): number {
  const scores: number[] = [];

  // Minimums: higher is better
  if (conditions.swell_height_min != null && forecast.wave_height != null) {
    scores.push((forecast.wave_height - conditions.swell_height_min) / Math.max(conditions.swell_height_min, 1));
  }
  if (conditions.swell_period_min != null) {
    const period = forecast.swell_1_period ?? forecast.wave_period;
    if (period != null) {
      scores.push((period - conditions.swell_period_min) / Math.max(conditions.swell_period_min, 1));
    }
  }

  // Maximums: lower is better
  if (conditions.wind_speed_max_kt != null && forecast.wind_speed != null) {
    scores.push((conditions.wind_speed_max_kt - forecast.wind_speed) / Math.max(conditions.wind_speed_max_kt, 1));
  }

  // Ranges: center is best
  if (conditions.tide_height_min_ft != null && conditions.tide_height_max_ft != null && forecast.tide_height != null) {
    const center = (conditions.tide_height_min_ft + conditions.tide_height_max_ft) / 2;
    const halfWidth = (conditions.tide_height_max_ft - conditions.tide_height_min_ft) / 2;
    if (halfWidth > 0) {
      scores.push(1 - Math.abs(forecast.tide_height - center) / halfWidth);
    }
  }

  if (conditions.swell_height_min != null && conditions.swell_height_max != null && forecast.wave_height != null) {
    const center = (conditions.swell_height_min + conditions.swell_height_max) / 2;
    const halfWidth = (conditions.swell_height_max - conditions.swell_height_min) / 2;
    if (halfWidth > 0) {
      scores.push(1 - Math.abs(forecast.wave_height - center) / halfWidth);
    }
  }

  // Binary: pass/fail scored as 1.0 (wind_direction, tide_direction already filtered by evaluator)
  if (conditions.wind_direction != null) scores.push(1.0);
  if (conditions.tide_direction != null) scores.push(1.0);

  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quiver && yarn test __tests__/lib/alerts/best-hour.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd quiver
git add lib/alerts/best-hour.ts __tests__/lib/alerts/best-hour.test.ts
git commit -m "feat: add best-hour scoring with normalized distance-from-ideal"
```

---

## Task 6: Window Finder

**Files:**
- Create: `lib/alerts/window-finder.ts`
- Create: `__tests__/lib/alerts/window-finder.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/alerts/window-finder.test.ts
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1", name: "Test Beach", slug: "test", lat: 32.88, lon: -117.25,
  timezone: "America/Los_Angeles", wind_offshore_deg: 45, wind_offshore_tol_deg: 45,
  aspect_deg: 270, preferred_tide_ft_min: 2, preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising", swell_window_center_deg: 270, swell_window_halfwidth_deg: 60,
};

function makeForecast(hour: number, overrides: Partial<ForecastHour> = {}): ForecastHour {
  return {
    forecast_at: `2026-04-01T${String(hour).padStart(2, "0")}:00:00Z`,
    wave_height: 4, wave_period: 12, swell_1_height: 4, swell_1_period: 12,
    swell_1_direction: 250, wind_speed: 5, wind_direction_deg: 45,
    tide_height: 3.5, tide_status: "rising", ...overrides,
  };
}

describe("findMatchingWindows", () => {
  const conditions: AlertConditions = { swell_height_min: 3, wind_speed_max_kt: 10 };

  it("finds a single contiguous window", () => {
    const forecasts = [makeForecast(7), makeForecast(8), makeForecast(9)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(1);
    expect(windows[0].window_start).toBe(forecasts[0].forecast_at);
    expect(windows[0].window_end).toBe(forecasts[2].forecast_at);
  });

  it("splits non-contiguous matches into separate windows", () => {
    const forecasts = [
      makeForecast(7),
      makeForecast(8, { wind_speed: 20 }), // fails
      makeForecast(9),
    ];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(2);
  });

  it("returns empty array when nothing matches", () => {
    const forecasts = [makeForecast(7, { wave_height: 1 })];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows).toHaveLength(0);
  });

  it("picks the best hour within a window", () => {
    const forecasts = [
      makeForecast(7, { wave_height: 3 }),
      makeForecast(8, { wave_height: 6 }), // bigger waves = better
      makeForecast(9, { wave_height: 4 }),
    ];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows[0].best_hour).toBe(forecasts[1].forecast_at);
  });

  it("snapshots conditions at best hour", () => {
    const forecasts = [makeForecast(8)];
    const windows = findMatchingWindows(conditions, forecasts, mockBeach);
    expect(windows[0].conditions_snapshot).toHaveProperty("wave_height", 4);
    expect(windows[0].conditions_snapshot).toHaveProperty("wind_speed", 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/window-finder.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```ts
// lib/alerts/window-finder.ts
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { evaluateConditions } from "./condition-evaluator";
import { scoreForecastHour } from "./best-hour";

export interface FoundWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
}

/**
 * Find contiguous windows of forecast hours that match all conditions.
 * Returns an array of windows with start, end, best hour, and conditions snapshot.
 */
export function findMatchingWindows(
  conditions: AlertConditions,
  forecasts: ForecastHour[],
  beach: BeachAlertMeta
): FoundWindow[] {
  const windows: FoundWindow[] = [];
  let currentWindow: ForecastHour[] = [];

  for (const forecast of forecasts) {
    if (evaluateConditions(conditions, forecast, beach)) {
      currentWindow.push(forecast);
    } else {
      if (currentWindow.length > 0) {
        windows.push(buildWindow(conditions, currentWindow));
        currentWindow = [];
      }
    }
  }

  if (currentWindow.length > 0) {
    windows.push(buildWindow(conditions, currentWindow));
  }

  return windows;
}

function buildWindow(conditions: AlertConditions, hours: ForecastHour[]): FoundWindow {
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < hours.length; i++) {
    const score = scoreForecastHour(conditions, hours[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const best = hours[bestIdx];

  return {
    window_start: hours[0].forecast_at,
    window_end: hours[hours.length - 1].forecast_at,
    best_hour: best.forecast_at,
    best_score: bestScore,
    conditions_snapshot: {
      wave_height: best.wave_height,
      wave_period: best.wave_period,
      swell_1_period: best.swell_1_period,
      swell_1_direction: best.swell_1_direction,
      wind_speed: best.wind_speed,
      wind_direction_deg: best.wind_direction_deg,
      tide_height: best.tide_height,
      tide_status: best.tide_status,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quiver && yarn test __tests__/lib/alerts/window-finder.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd quiver
git add lib/alerts/window-finder.ts __tests__/lib/alerts/window-finder.test.ts
git commit -m "feat: add window finder for contiguous matching forecast hours"
```

---

## Task 7: Sunrise Utility & Entitlements

**Files:**
- Create: `lib/alerts/sunrise.ts`
- Create: `lib/alerts/entitlements.ts`
- Create: `__tests__/lib/alerts/entitlements.test.ts`

- [ ] **Step 1: Install suncalc**

Run: `cd quiver && yarn add suncalc && yarn add -D @types/suncalc`

- [ ] **Step 2: Write sunrise utility**

```ts
// lib/alerts/sunrise.ts
import SunCalc from "suncalc";

export interface DaylightWindow {
  sunrise: Date;
  sunset: Date;
}

/**
 * Get sunrise and sunset for a location on a given date.
 */
export function getDaylightWindow(lat: number, lon: number, date: Date): DaylightWindow {
  const times = SunCalc.getTimes(date, lat, lon);
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
  };
}

/**
 * Filter forecast hours to only those within daylight.
 */
export function filterToDaylight<T extends { forecast_at: string }>(
  forecasts: T[],
  lat: number,
  lon: number
): T[] {
  if (forecasts.length === 0) return [];

  const date = new Date(forecasts[0].forecast_at);
  const { sunrise, sunset } = getDaylightWindow(lat, lon, date);

  return forecasts.filter((f) => {
    const t = new Date(f.forecast_at);
    return t >= sunrise && t <= sunset;
  });
}
```

- [ ] **Step 3: Write entitlements failing test**

```ts
// __tests__/lib/alerts/entitlements.test.ts
import {
  getUserEntitlement,
  canCreateRule,
  CAPS,
} from "@/lib/alerts/entitlements";

describe("getUserEntitlement", () => {
  const origEnv = process.env.ALERT_PREVIEW_MODE;

  afterEach(() => {
    process.env.ALERT_PREVIEW_MODE = origEnv;
  });

  it("returns premium when preview mode is on", () => {
    process.env.ALERT_PREVIEW_MODE = "true";
    expect(getUserEntitlement("any-user")).toBe("premium");
  });

  it("returns free when preview mode is off", () => {
    process.env.ALERT_PREVIEW_MODE = "false";
    expect(getUserEntitlement("any-user")).toBe("free");
  });

  it("returns free when preview mode is undefined", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    expect(getUserEntitlement("any-user")).toBe("free");
  });
});

describe("canCreateRule", () => {
  it("allows free user on home beach within cap", () => {
    const result = canCreateRule({
      tier: "free",
      homeBeachId: "beach-1",
      targetBeachId: "beach-1",
      existingRuleCount: 2,
      existingBeachCount: 1,
      presetType: "mellow_session",
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects free user on non-home beach", () => {
    const result = canCreateRule({
      tier: "free",
      homeBeachId: "beach-1",
      targetBeachId: "beach-2",
      existingRuleCount: 0,
      existingBeachCount: 1,
      presetType: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("home beach");
  });

  it("rejects free user exceeding rule cap", () => {
    const result = canCreateRule({
      tier: "free",
      homeBeachId: "beach-1",
      targetBeachId: "beach-1",
      existingRuleCount: 3,
      existingBeachCount: 1,
      presetType: null,
    });
    expect(result.allowed).toBe(false);
  });

  it("rejects free user using premium preset", () => {
    const result = canCreateRule({
      tier: "free",
      homeBeachId: "beach-1",
      targetBeachId: "beach-1",
      existingRuleCount: 0,
      existingBeachCount: 1,
      presetType: "glass_off",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("premium");
  });

  it("allows premium user on any beach within caps", () => {
    const result = canCreateRule({
      tier: "premium",
      homeBeachId: "beach-1",
      targetBeachId: "beach-5",
      existingRuleCount: 10,
      existingBeachCount: 5,
      presetType: "epic_conditions",
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects premium user exceeding beach cap", () => {
    const result = canCreateRule({
      tier: "premium",
      homeBeachId: "beach-1",
      targetBeachId: "new-beach",
      existingRuleCount: 0,
      existingBeachCount: 10,
      presetType: null,
    });
    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd quiver && yarn test __tests__/lib/alerts/entitlements.test.ts`
Expected: FAIL.

- [ ] **Step 5: Write entitlements implementation**

```ts
// lib/alerts/entitlements.ts
import type { PresetType } from "./types";

export type Tier = "free" | "premium";

export const CAPS = {
  free: { beaches: 1, rulesPerBeach: 3, totalRules: 3 },
  premium: { beaches: 10, rulesPerBeach: 5, totalRules: 50 },
} as const;

const FREE_PRESETS: PresetType[] = ["mellow_session"];

export function getUserEntitlement(_userId: string): Tier {
  if (process.env.ALERT_PREVIEW_MODE === "true") return "premium";
  // TODO: check subscription status when payments ship
  return "free";
}

interface CanCreateRuleInput {
  tier: Tier;
  homeBeachId: string | null;
  targetBeachId: string;
  existingRuleCount: number;
  existingBeachCount: number;
  presetType: PresetType | null;
}

interface CanCreateRuleResult {
  allowed: boolean;
  reason?: string;
}

export function canCreateRule(input: CanCreateRuleInput): CanCreateRuleResult {
  const caps = CAPS[input.tier];

  // Beach restriction for free tier
  if (input.tier === "free" && input.targetBeachId !== input.homeBeachId) {
    return { allowed: false, reason: "Free tier: alerts only on home beach. Upgrade for more beaches." };
  }

  // Preset restriction for free tier
  if (input.tier === "free" && input.presetType && !FREE_PRESETS.includes(input.presetType)) {
    return { allowed: false, reason: `${input.presetType} is a premium preset. Upgrade to unlock.` };
  }

  // Beach count cap (only matters if this is a new beach)
  if (input.existingBeachCount >= caps.beaches) {
    return { allowed: false, reason: `Maximum ${caps.beaches} beaches reached.` };
  }

  // Total rule count cap
  if (input.existingRuleCount >= caps.totalRules) {
    return { allowed: false, reason: `Maximum ${caps.totalRules} alert rules reached.` };
  }

  return { allowed: true };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd quiver && yarn test __tests__/lib/alerts/entitlements.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd quiver
git add lib/alerts/sunrise.ts lib/alerts/entitlements.ts __tests__/lib/alerts/entitlements.test.ts package.json yarn.lock
git commit -m "feat: add sunrise utility and entitlement logic"
```

---

## Task 8: Payload Builder & Push Formatter

**Files:**
- Create: `lib/alerts/payload-builder.ts`
- Create: `lib/alerts/push-formatter.ts`
- Create: `__tests__/lib/alerts/payload-builder.test.ts`
- Create: `__tests__/lib/alerts/push-formatter.test.ts`

- [ ] **Step 1: Write payload builder tests**

```ts
// __tests__/lib/alerts/payload-builder.test.ts
import { consolidateQueueItems } from "@/lib/alerts/payload-builder";

const baseItem = {
  id: "q1",
  user_id: "user-1",
  rule_id: "rule-1",
  beach_id: "beach-1",
  alert_date: "2026-04-01",
  send_at: "2026-04-01T13:00:00Z",
  window_start: "2026-04-01T15:00:00Z",
  window_end: "2026-04-01T18:00:00Z",
  best_hour: "2026-04-01T16:00:00Z",
  conditions_snapshot: { wave_height: 4, wind_speed: 5, tide_height: 3.5, tide_status: "rising" },
  sent: false,
  // Joined data
  rule_name: "Glass-Off",
  beach_name: "Blacks Beach",
  beach_timezone: "America/Los_Angeles",
  notify_email: true,
  notify_push: true,
  best_score: 0.8,
};

describe("consolidateQueueItems", () => {
  it("groups items by user into a single payload", () => {
    const items = [baseItem, { ...baseItem, id: "q2", rule_id: "rule-2", beach_id: "beach-2", beach_name: "Trestles", rule_name: "Big Day" }];
    const payloads = consolidateQueueItems(items);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].matches).toHaveLength(2);
  });

  it("sorts matches by best_score descending", () => {
    const items = [
      { ...baseItem, id: "q1", best_score: 0.5 },
      { ...baseItem, id: "q2", rule_id: "rule-2", beach_name: "Trestles", best_score: 0.9 },
    ];
    const payloads = consolidateQueueItems(items);
    expect(payloads[0].matches[0].beach_name).toBe("Trestles");
  });

  it("uses earliest send_at for the payload", () => {
    const items = [
      { ...baseItem, id: "q1", send_at: "2026-04-01T14:00:00Z" },
      { ...baseItem, id: "q2", send_at: "2026-04-01T13:00:00Z" },
    ];
    const payloads = consolidateQueueItems(items);
    expect(payloads[0].send_at).toBe("2026-04-01T13:00:00Z");
  });
});
```

- [ ] **Step 2: Write push formatter tests**

```ts
// __tests__/lib/alerts/push-formatter.test.ts
import { formatPushNotification } from "@/lib/alerts/push-formatter";
import type { MatchingWindow } from "@/lib/alerts/types";

function makeMatch(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "r1", rule_name: "Glass-Off",
    beach_id: "b1", beach_name: "Blacks Beach", beach_timezone: "America/Los_Angeles",
    window_start: "2026-04-01T14:00:00Z", window_end: "2026-04-01T17:00:00Z",
    best_hour: "2026-04-01T15:30:00Z", best_score: 0.8,
    conditions_snapshot: { wave_height: 4, swell_1_period: 14, wind_speed: 5, tide_height: 3.2, tide_status: "rising" },
    notify_email: true, notify_push: true,
    ...overrides,
  };
}

describe("formatPushNotification", () => {
  it("formats single beach with rich detail", () => {
    const result = formatPushNotification([makeMatch()]);
    expect(result.title).toBe("Conditions lining up today");
    expect(result.body).toContain("Blacks Beach");
    expect(result.body.length).toBeLessThanOrEqual(150);
  });

  it("formats two beaches", () => {
    const matches = [makeMatch(), makeMatch({ beach_name: "Trestles", beach_id: "b2" })];
    const result = formatPushNotification(matches);
    expect(result.body).toContain("Blacks Beach");
    expect(result.body).toContain("Trestles");
  });

  it("caps at 2 beaches with 'and N more'", () => {
    const matches = [
      makeMatch(),
      makeMatch({ beach_name: "Trestles", beach_id: "b2" }),
      makeMatch({ beach_name: "Malibu", beach_id: "b3" }),
    ];
    const result = formatPushNotification(matches);
    expect(result.body).toContain("and 1 more");
    expect(result.body).not.toContain("Malibu");
  });

  it("body stays under 150 characters", () => {
    const matches = [
      makeMatch({ beach_name: "Very Long Beach Name That Goes On" }),
      makeMatch({ beach_name: "Another Extremely Long Beach Name Here", beach_id: "b2" }),
    ];
    const result = formatPushNotification(matches);
    expect(result.body.length).toBeLessThanOrEqual(150);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd quiver && yarn test __tests__/lib/alerts/payload-builder.test.ts __tests__/lib/alerts/push-formatter.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write payload builder implementation**

```ts
// lib/alerts/payload-builder.ts
import type { ConsolidatedAlertPayload, MatchingWindow } from "./types";

export interface QueueItemWithMeta {
  id: string;
  user_id: string;
  rule_id: string;
  beach_id: string;
  alert_date: string;
  send_at: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
  rule_name: string;
  beach_name: string;
  beach_timezone: string;
  notify_email: boolean;
  notify_push: boolean;
  best_score: number;
}

/**
 * Consolidate queue items into per-user alert payloads.
 * Items are assumed to all belong to the same delivery window (send_at <= now).
 */
export function consolidateQueueItems(
  items: QueueItemWithMeta[]
): ConsolidatedAlertPayload[] {
  const byUser = new Map<string, QueueItemWithMeta[]>();

  for (const item of items) {
    const existing = byUser.get(item.user_id) ?? [];
    existing.push(item);
    byUser.set(item.user_id, existing);
  }

  const payloads: ConsolidatedAlertPayload[] = [];

  for (const [userId, userItems] of byUser) {
    const sorted = userItems.sort((a, b) => b.best_score - a.best_score);
    const earliestSendAt = userItems.reduce(
      (min, item) => (item.send_at < min ? item.send_at : min),
      userItems[0].send_at
    );

    const matches: MatchingWindow[] = sorted.map((item) => ({
      rule_id: item.rule_id,
      rule_name: item.rule_name,
      beach_id: item.beach_id,
      beach_name: item.beach_name,
      beach_timezone: item.beach_timezone,
      window_start: item.window_start,
      window_end: item.window_end,
      best_hour: item.best_hour,
      best_score: item.best_score,
      conditions_snapshot: item.conditions_snapshot,
      notify_email: item.notify_email,
      notify_push: item.notify_push,
    }));

    payloads.push({
      user_id: userId,
      alert_date: userItems[0].alert_date,
      send_at: earliestSendAt,
      matches,
    });
  }

  return payloads;
}
```

- [ ] **Step 5: Write push formatter implementation**

```ts
// lib/alerts/push-formatter.ts
import type { MatchingWindow } from "./types";

interface PushContent {
  title: string;
  body: string;
  data: { type: string; beach_id: string };
}

/**
 * Format a consolidated alert into push notification content.
 * Body stays under 150 characters for lock screen display.
 */
export function formatPushNotification(matches: MatchingWindow[]): PushContent {
  const title = "Conditions lining up today";
  const topMatch = matches[0];

  if (matches.length === 1) {
    const snap = topMatch.conditions_snapshot;
    const waveHeight = snap.wave_height ? `${snap.wave_height}ft` : "";
    const period = snap.swell_1_period ? ` @ ${snap.swell_1_period}s` : "";
    const wind = snap.wind_speed ? `, ${snap.wind_speed}kt wind` : "";
    const timeWindow = formatTimeRange(topMatch.window_start, topMatch.window_end, topMatch.beach_timezone);

    let body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}${wind}`;
    if (body.length > 150) {
      body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}`;
    }
    if (body.length > 150) {
      body = body.substring(0, 147) + "...";
    }

    return { title, body, data: { type: "forecast_alert", beach_id: topMatch.beach_id } };
  }

  const showCount = Math.min(matches.length, 2);
  const parts: string[] = [];

  for (let i = 0; i < showCount; i++) {
    const m = matches[i];
    const timeWindow = formatTimeRange(m.window_start, m.window_end, m.beach_timezone);
    parts.push(`${m.beach_name} ${timeWindow}`);
  }

  let body = parts.join(" · ");
  if (matches.length > 2) {
    body += ` and ${matches.length - 2} more`;
  }

  if (body.length > 150) {
    body = body.substring(0, 147) + "...";
  }

  return { title, body, data: { type: "forecast_alert", beach_id: topMatch.beach_id } };
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: undefined, timeZone: timezone };
  const startStr = new Date(start).toLocaleTimeString("en-US", opts);
  const endStr = new Date(end).toLocaleTimeString("en-US", opts);
  return `${startStr}-${endStr}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd quiver && yarn test __tests__/lib/alerts/payload-builder.test.ts __tests__/lib/alerts/push-formatter.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd quiver
git add lib/alerts/payload-builder.ts lib/alerts/push-formatter.ts __tests__/lib/alerts/payload-builder.test.ts __tests__/lib/alerts/push-formatter.test.ts
git commit -m "feat: add payload consolidation and push notification formatter"
```

---

## Task 9: Evaluation Cron

**Files:**
- Create: `app/api/cron/condition-alert-evaluate/route.ts`

- [ ] **Step 1: Write the evaluation cron**

```ts
// app/api/cron/condition-alert-evaluate/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { getUserEntitlement, CAPS } from "@/lib/alerts/entitlements";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[condition-alert-evaluate]";

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const summary = { evaluated: 0, matched: 0, queued: 0, skipped: 0, errors: 0 };

  try {
    // 1. Fetch all enabled rules with user + beach data
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(`
        id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at,
        beaches!inner(id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg,
          preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
          swell_window_center_deg, swell_window_halfwidth_deg),
        profiles!inner(id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled)
      `)
      .eq("enabled", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      console.log(`${CONTEXT_TAG} No enabled alert rules found`);
      return NextResponse.json({ ...summary, message: "No rules to evaluate" });
    }

    // 2. Group rules by user
    const byUser = new Map<string, typeof rules>();
    for (const rule of rules) {
      if (!rule.profiles?.notif_forecast_alerts) {
        summary.skipped++;
        continue;
      }
      const existing = byUser.get(rule.user_id) ?? [];
      existing.push(rule);
      byUser.set(rule.user_id, existing);
    }

    // 3. Evaluate each user's rules
    for (const [userId, userRules] of byUser) {
      try {
        // Determine user's local date for dedup
        const homeBeachId = userRules[0].profiles?.home_beach_id;
        const homeBeachTz = userRules.find((r) => r.beach_id === homeBeachId)?.beaches?.timezone ?? "America/New_York";
        const userLocalDate = new Date().toLocaleDateString("en-CA", { timeZone: homeBeachTz });

        // Check if already delivered today
        const { data: existing } = await supabase
          .from("alert_deliveries")
          .select("id")
          .eq("user_id", userId)
          .eq("alert_date", userLocalDate)
          .limit(1);

        if (existing && existing.length > 0) {
          summary.skipped += userRules.length;
          continue;
        }

        // Apply entitlement caps — skip newest rules first
        const tier = getUserEntitlement(userId);
        const caps = CAPS[tier];
        const sortedRules = [...userRules].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const activeRules = sortedRules.slice(0, caps.totalRules);

        // Evaluate each rule
        for (const rule of activeRules) {
          summary.evaluated++;
          const beach = rule.beaches as unknown as BeachAlertMeta;
          const conditions = rule.conditions as AlertConditions;

          // Fetch today's forecasts for this beach
          const todayStart = `${userLocalDate}T00:00:00Z`;
          const todayEnd = `${userLocalDate}T23:59:59Z`;

          const { data: forecasts } = await supabase
            .from("enhanced_forecasts")
            .select("forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status")
            .eq("beach_id", rule.beach_id)
            .gte("forecast_at", todayStart)
            .lt("forecast_at", todayEnd)
            .order("forecast_at", { ascending: true });

          if (!forecasts || forecasts.length === 0) continue;

          // Parse string values to numbers
          const parsed: ForecastHour[] = forecasts.map((f) => ({
            forecast_at: f.forecast_at,
            wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
            wave_period: f.wave_period ? parseFloat(f.wave_period.replace("s", "")) : null,
            swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
            swell_1_period: f.swell_1_period ? parseFloat(f.swell_1_period.replace("s", "")) : null,
            swell_1_direction: f.swell_1_direction ? parseFloat(String(f.swell_1_direction)) : null,
            wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null,
            wind_direction_deg: f.wind_direction_deg,
            tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
            tide_status: f.tide_status,
          }));

          // Filter to daylight hours
          const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
          if (daylight.length === 0) continue;

          // Find matching windows
          const windows = findMatchingWindows(conditions, daylight, beach);
          if (windows.length === 0) continue;

          summary.matched++;

          // Write to alert_queue
          const { sunrise } = getDaylightWindow(beach.lat, beach.lon, new Date(userLocalDate));

          for (const window of windows) {
            const sendAtDate = new Date(new Date(window.window_start).getTime() - 2 * 60 * 60 * 1000);
            const clampedSendAt = sendAtDate < sunrise ? sunrise : sendAtDate;
            const sendAt = clampedSendAt < new Date() ? new Date() : clampedSendAt;

            const { error: insertError } = await supabase.from("alert_queue").insert({
              user_id: userId,
              rule_id: rule.id,
              beach_id: rule.beach_id,
              alert_date: userLocalDate,
              send_at: sendAt.toISOString(),
              window_start: window.window_start,
              window_end: window.window_end,
              best_hour: window.best_hour,
              conditions_snapshot: window.conditions_snapshot,
            });

            if (insertError) {
              console.error(`${CONTEXT_TAG} Failed to queue alert:`, insertError);
              summary.errors++;
            } else {
              summary.queued++;
            }
          }

          // Update last_matched_at
          await supabase
            .from("alert_rules")
            .update({ last_matched_at: new Date().toISOString() })
            .eq("id", rule.id);
        }
      } catch (err) {
        console.error(`${CONTEXT_TAG} Error evaluating user ${userId}:`, err);
        summary.errors++;
      }
    }

    console.log(`${CONTEXT_TAG} Summary:`, summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error", summary }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd quiver
git add app/api/cron/condition-alert-evaluate/route.ts
git commit -m "feat: add condition alert evaluation cron job"
```

---

## Task 10: Consolidated Alert Email Template

**Files:**
- Create: `lib/mailer/templates/ConsolidatedAlertEmail.tsx`

- [ ] **Step 1: Write the email template**

```tsx
// lib/mailer/templates/ConsolidatedAlertEmail.tsx
import {
  Body, Container, Head, Html, Preview, Section, Text, Button, Hr, Row, Column,
} from "@react-email/components";
import type { MatchingWindow } from "@/lib/alerts/types";

export interface ConsolidatedAlertEmailProps {
  displayName: string | null;
  alertDate: string;
  matches: MatchingWindow[];
  manageAlertsUrl: string;
  unsubscribeUrl: string;
  baseUrl: string;
}

export function ConsolidatedAlertEmail({
  displayName,
  alertDate,
  matches,
  manageAlertsUrl,
  unsubscribeUrl,
  baseUrl,
}: ConsolidatedAlertEmailProps) {
  const greeting = displayName ? `Hey ${displayName}` : "Hey";

  return (
    <Html>
      <Head />
      <Preview>
        {matches.length === 1
          ? `${matches[0].beach_name} is looking good today`
          : `${matches.length} beaches lining up today`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>Quiver</Text>
          </Section>

          <Section style={content}>
            <Text style={headingText}>
              {greeting}, your surf alert for {alertDate}
            </Text>

            {matches.map((match, i) => {
              const timeWindow = formatWindow(match);
              const snap = match.conditions_snapshot;
              const conditionsLine = buildConditionsLine(snap);
              const beachUrl = `${baseUrl}/surf/${match.beach_name.toLowerCase().replace(/\s+/g, "-")}`;
              const disableUrl = `${baseUrl}/api/alerts/rules/${match.rule_id}/disable-email`;

              return (
                <Section key={match.rule_id + i} style={beachSection}>
                  <Text style={beachName}>{match.beach_name}</Text>
                  <Text style={ruleName}>{match.rule_name} alert matched</Text>
                  <Text style={windowText}>Best window: {timeWindow}</Text>
                  <Text style={conditionsText}>{conditionsLine}</Text>

                  <Row>
                    <Column>
                      <Button href={beachUrl} style={ctaButton}>
                        Check {match.beach_name} Forecast
                      </Button>
                    </Column>
                  </Row>

                  <Text style={disableLink}>
                    <a href={disableUrl} style={linkStyle}>Not relevant? Disable this rule</a>
                  </Text>

                  {i < matches.length - 1 && <Hr style={divider} />}
                </Section>
              );
            })}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              <a href={manageAlertsUrl} style={linkStyle}>Manage your alerts</a>
              {" · "}
              <a href={unsubscribeUrl} style={linkStyle}>Unsubscribe</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function formatWindow(match: MatchingWindow): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: match.beach_timezone };
  const start = new Date(match.window_start).toLocaleTimeString("en-US", opts);
  const end = new Date(match.window_end).toLocaleTimeString("en-US", opts);
  const best = new Date(match.best_hour).toLocaleTimeString("en-US", opts);
  const tzAbbr = new Date(match.best_hour).toLocaleTimeString("en-US", { timeZone: match.beach_timezone, timeZoneName: "short" }).split(" ").pop();
  return `${start} – ${end} ${tzAbbr}, peak around ${best}`;
}

function buildConditionsLine(snap: Record<string, unknown>): string {
  const parts: string[] = [];
  if (snap.wave_height) parts.push(`${snap.wave_height}ft`);
  if (snap.swell_1_period) parts.push(`@ ${snap.swell_1_period}s`);
  if (snap.wind_speed) parts.push(`${snap.wind_speed}kt wind`);
  if (snap.tide_height && snap.tide_status) parts.push(`tide ${snap.tide_height}ft ${snap.tide_status}`);
  return parts.join(", ");
}

// Styles
const body = { backgroundColor: "#1a1f4e", margin: "0", padding: "0", fontFamily: "'DM Sans', sans-serif" };
const container = { maxWidth: "600px", margin: "0 auto" };
const header = { backgroundColor: "#252D6B", padding: "24px 32px", textAlign: "center" as const };
const logoText = { color: "#F78E42", fontSize: "28px", fontWeight: "700", margin: "0", fontFamily: "'Space Grotesk', sans-serif" };
const content = { backgroundColor: "#2D357D", padding: "24px 32px" };
const headingText = { color: "#ffffff", fontSize: "20px", fontWeight: "600", marginBottom: "24px" };
const beachSection = { marginBottom: "16px" };
const beachName = { color: "#ffffff", fontSize: "18px", fontWeight: "700", margin: "0 0 4px 0", fontFamily: "'Space Grotesk', sans-serif" };
const ruleName = { color: "#9ca3af", fontSize: "13px", margin: "0 0 8px 0" };
const windowText = { color: "#F78E42", fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" };
const conditionsText = { color: "#d1d5db", fontSize: "14px", margin: "0 0 16px 0" };
const ctaButton = { backgroundColor: "#F78E42", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none" };
const disableLink = { fontSize: "12px", margin: "8px 0 0 0" };
const linkStyle = { color: "#9ca3af", textDecoration: "underline" };
const divider = { borderColor: "#404C92", margin: "24px 0" };
const footer = { padding: "16px 32px", textAlign: "center" as const };
const footerText = { color: "#6b7280", fontSize: "12px" };
```

- [ ] **Step 2: Commit**

```bash
cd quiver
git add lib/mailer/templates/ConsolidatedAlertEmail.tsx
git commit -m "feat: add consolidated multi-beach alert email template"
```

---

## Task 11: Delivery Cron

**Files:**
- Create: `app/api/cron/condition-alert-deliver/route.ts`
- Create: `lib/alerts/push-sender.ts`

- [ ] **Step 1: Write push sender**

```ts
// lib/alerts/push-sender.ts

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
}

/**
 * Send push notifications via Expo Push API.
 * Handles both Expo tokens (ExponentPushToken[...]) and FCM tokens.
 */
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const expoMessages = messages.filter((m) => m.to.startsWith("ExponentPushToken"));
  const fcmMessages = messages.filter((m) => !m.to.startsWith("ExponentPushToken"));

  // Expo Push API
  if (expoMessages.length > 0) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expoMessages.map((m) => ({ ...m, sound: m.sound ?? "default" }))),
    });

    if (!response.ok) {
      console.error("[push-sender] Expo push failed:", await response.text());
    }
  }

  // FCM messages handled via Firebase Admin SDK
  if (fcmMessages.length > 0) {
    // FCM sending requires firebase-admin; for now, log and skip non-Expo tokens
    // TODO: add Firebase Admin integration for web push
    console.log(`[push-sender] ${fcmMessages.length} FCM messages skipped (not yet implemented)`);
  }
}
```

- [ ] **Step 2: Write the delivery cron**

```ts
// app/api/cron/condition-alert-deliver/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { consolidateQueueItems } from "@/lib/alerts/payload-builder";
import { formatPushNotification } from "@/lib/alerts/push-formatter";
import { sendPushNotifications } from "@/lib/alerts/push-sender";
import { ConsolidatedAlertEmail } from "@/lib/mailer/templates/ConsolidatedAlertEmail";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { createEmailLogger } from "@/lib/services/email-logging-service";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTEXT_TAG = "[condition-alert-deliver]";

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const rateLimiter = createResendRateLimiter();
  const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
  const summary = { delivered: 0, emailsSent: 0, pushSent: 0, errors: 0 };

  try {
    // 1. Fetch due queue items with joined data
    const { data: queueItems, error } = await supabase
      .from("alert_queue")
      .select(`
        *,
        alert_rules!inner(name, notify_email, notify_push),
        beaches!inner(name, timezone),
        profiles!inner(email, display_name, notif_email_enabled, notif_push_enabled)
      `)
      .eq("sent", false)
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true });

    if (error) throw error;
    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ ...summary, message: "No alerts due" });
    }

    // 2. Map to typed items with metadata
    const itemsWithMeta = queueItems.map((q: any) => ({
      ...q,
      rule_name: q.alert_rules.name,
      beach_name: q.beaches.name,
      beach_timezone: q.beaches.timezone,
      notify_email: q.alert_rules.notify_email,
      notify_push: q.alert_rules.notify_push,
      best_score: 0, // scored during eval, not stored in queue — sort by window_start instead
    }));

    // 3. Consolidate into per-user payloads
    const payloads = consolidateQueueItems(itemsWithMeta);
    const baseUrl = getBaseUrl();

    for (const payload of payloads) {
      try {
        const userProfile = queueItems.find((q: any) => q.user_id === payload.user_id)?.profiles;
        if (!userProfile) continue;

        // Filter matches by channel preferences
        const emailMatches = payload.matches.filter(
          (m) => m.notify_email && userProfile.notif_email_enabled
        );
        const pushMatches = payload.matches.filter(
          (m) => m.notify_push && userProfile.notif_push_enabled
        );

        // Send email
        if (emailMatches.length > 0 && userProfile.email) {
          try {
            await rateLimiter.throttle();

            const subject = emailMatches.length === 1
              ? `${emailMatches[0].beach_name} is looking good today`
              : `${emailMatches.length} beaches lining up today`;

            const { data: sendData, error: sendError } = await resend.emails.send({
              from: MAIL_FROM,
              replyTo: MAIL_REPLY_TO,
              to: userProfile.email,
              subject,
              react: ConsolidatedAlertEmail({
                displayName: userProfile.display_name,
                alertDate: payload.alert_date,
                matches: emailMatches,
                manageAlertsUrl: `${baseUrl}/profile?tab=beaches`,
                unsubscribeUrl: `${baseUrl}/settings/notifications`,
                baseUrl,
              }),
            });

            if (sendError) throw sendError;

            await supabase.from("alert_deliveries").insert({
              user_id: payload.user_id,
              alert_date: payload.alert_date,
              channel: "email",
              payload: { matches: emailMatches, resend_message_id: sendData?.id },
            });

            await emailLogger.logDelivery({
              userId: payload.user_id,
              emailType: "conditions_alert",
              subject,
              resendMessageId: sendData?.id,
            });

            summary.emailsSent++;
          } catch (emailErr) {
            console.error(`${CONTEXT_TAG} Email failed for ${payload.user_id}:`, emailErr);
            summary.errors++;
          }
        }

        // Send push
        if (pushMatches.length > 0) {
          try {
            const { data: devices } = await supabase
              .from("user_devices")
              .select("device_token")
              .eq("user_id", payload.user_id);

            if (devices && devices.length > 0) {
              const pushContent = formatPushNotification(pushMatches);

              await sendPushNotifications(
                devices.map((d) => ({
                  to: d.device_token,
                  title: pushContent.title,
                  body: pushContent.body,
                  data: pushContent.data,
                }))
              );

              await supabase.from("alert_deliveries").upsert({
                user_id: payload.user_id,
                alert_date: payload.alert_date,
                channel: "push",
                payload: { matches: pushMatches },
              }, { onConflict: "user_id,alert_date,channel" });

              summary.pushSent++;
            }
          } catch (pushErr) {
            console.error(`${CONTEXT_TAG} Push failed for ${payload.user_id}:`, pushErr);
            summary.errors++;
          }
        }

        // Mark queue items as sent
        const queueIds = queueItems
          .filter((q: any) => q.user_id === payload.user_id)
          .map((q: any) => q.id);

        await supabase
          .from("alert_queue")
          .update({ sent: true })
          .in("id", queueIds);

        summary.delivered++;
      } catch (userErr) {
        console.error(`${CONTEXT_TAG} Failed for user ${payload.user_id}:`, userErr);
        summary.errors++;
      }
    }

    console.log(`${CONTEXT_TAG} Summary:`, summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error", summary }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd quiver
git add lib/alerts/push-sender.ts app/api/cron/condition-alert-deliver/route.ts
git commit -m "feat: add condition alert delivery cron with email and push"
```

---

## Task 12: Alert Rules API Routes

**Files:**
- Create: `app/api/alerts/rules/route.ts`
- Create: `app/api/alerts/rules/[ruleId]/route.ts`
- Create: `app/api/alerts/rules/[ruleId]/disable-email/route.ts`

- [ ] **Step 1: Write GET/POST routes**

```ts
// app/api/alerts/rules/route.ts
import { withAuth, createSuccessResponse, createErrorResponse } from "@/lib/middleware/api-wrappers";
import { getUserEntitlement, canCreateRule, CAPS } from "@/lib/alerts/entitlements";
import type { PresetType } from "@/lib/alerts/types";

// GET: list user's alert rules
export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("*, beaches(name, slug, timezone)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return createSuccessResponse(data);
}, { errorMessage: "Failed to fetch alert rules" });

// POST: create a new alert rule
export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await request.json();
  const { beach_id, name, preset_type, conditions, notify_email, notify_push } = body;

  if (!beach_id || !name) {
    return createErrorResponse("beach_id and name are required", 400);
  }

  // Get user's home beach
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_beach_id")
    .eq("id", user.id)
    .single();

  // Count existing rules and beaches
  const { data: existingRules } = await supabase
    .from("alert_rules")
    .select("id, beach_id")
    .eq("user_id", user.id);

  const existingBeachIds = new Set((existingRules ?? []).map((r) => r.beach_id));
  const isNewBeach = !existingBeachIds.has(beach_id);

  const tier = getUserEntitlement(user.id);
  const check = canCreateRule({
    tier,
    homeBeachId: profile?.home_beach_id ?? null,
    targetBeachId: beach_id,
    existingRuleCount: existingRules?.length ?? 0,
    existingBeachCount: isNewBeach ? existingBeachIds.size : existingBeachIds.size - 1,
    presetType: (preset_type as PresetType) ?? null,
  });

  if (!check.allowed) {
    return createErrorResponse(check.reason ?? "Not allowed", 403);
  }

  // Auto-favorite the beach if not already
  const { data: existingFav } = await supabase
    .from("favorite_beaches")
    .select("id")
    .eq("user_id", user.id)
    .eq("beach_id", beach_id)
    .maybeSingle();

  if (!existingFav) {
    await supabase.from("favorite_beaches").insert({ user_id: user.id, beach_id });
  }

  // Create the rule
  const { data: rule, error } = await supabase
    .from("alert_rules")
    .insert({
      user_id: user.id,
      beach_id,
      name,
      preset_type: preset_type ?? null,
      conditions: conditions ?? {},
      notify_email: notify_email ?? true,
      notify_push: notify_push ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return createSuccessResponse(rule);
}, { errorMessage: "Failed to create alert rule" });
```

- [ ] **Step 2: Write PATCH/DELETE routes**

```ts
// app/api/alerts/rules/[ruleId]/route.ts
import { withAuth, createSuccessResponse, createErrorResponse } from "@/lib/middleware/api-wrappers";
import { validateUuidParam } from "@/lib/middleware/api-wrappers";

// PATCH: update a rule
export const PATCH = withAuth(async (request, { user, supabase, params }) => {
  const ruleId = validateUuidParam((await params).ruleId, "ruleId");
  const body = await request.json();

  const allowedFields = ["name", "conditions", "notify_email", "notify_push", "enabled"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse("No valid fields to update", 400);
  }

  const { data, error } = await supabase
    .from("alert_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return createErrorResponse("Rule not found", 404);

  return createSuccessResponse(data);
}, { errorMessage: "Failed to update alert rule" });

// DELETE: delete a rule
export const DELETE = withAuth(async (_request, { user, supabase, params }) => {
  const ruleId = validateUuidParam((await params).ruleId, "ruleId");

  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", user.id);

  if (error) throw error;
  return createSuccessResponse({ deleted: true });
}, { errorMessage: "Failed to delete alert rule" });
```

- [ ] **Step 3: Write email disable endpoint**

```ts
// app/api/alerts/rules/[ruleId]/disable-email/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// One-click disable from email — uses service role to allow unauthenticated access
// In production, this should use a signed token for security
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const { ruleId } = await params;
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("alert_rules")
    .update({ notify_email: false })
    .eq("id", ruleId);

  if (error) {
    return NextResponse.json({ error: "Failed to disable" }, { status: 500 });
  }

  // Redirect to a confirmation page
  return NextResponse.redirect(new URL("/settings/notifications?alert_disabled=true", process.env.NEXT_PUBLIC_APP_URL));
}
```

- [ ] **Step 4: Commit**

```bash
cd quiver
git add app/api/alerts/rules/route.ts app/api/alerts/rules/\[ruleId\]/route.ts app/api/alerts/rules/\[ruleId\]/disable-email/route.ts
git commit -m "feat: add alert rules CRUD API routes"
```

---

## Task 13: Debug API Route

**Files:**
- Create: `app/api/alerts/debug/[ruleId]/route.ts`

- [ ] **Step 1: Write the debug endpoint**

```ts
// app/api/alerts/debug/[ruleId]/route.ts
import { withAuth, createSuccessResponse, createErrorResponse } from "@/lib/middleware/api-wrappers";
import { validateUuidParam } from "@/lib/middleware/api-wrappers";
import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import { filterToDaylight } from "@/lib/alerts/sunrise";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";
import { resolveWindDirection } from "@/lib/alerts/degree-utils";

export const GET = withAuth(async (_request, { user, supabase, params }) => {
  const ruleId = validateUuidParam((await params).ruleId, "ruleId");

  // Fetch rule with beach data
  const { data: rule, error } = await supabase
    .from("alert_rules")
    .select("*, beaches(*)")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .single();

  if (error || !rule) return createErrorResponse("Rule not found", 404);

  const beach = rule.beaches as unknown as BeachAlertMeta;
  const conditions = rule.conditions as AlertConditions;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: beach.timezone });

  // Fetch today's forecasts
  const { data: forecasts } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status")
    .eq("beach_id", rule.beach_id)
    .gte("forecast_at", `${today}T00:00:00Z`)
    .lt("forecast_at", `${today}T23:59:59Z`)
    .order("forecast_at", { ascending: true });

  if (!forecasts || forecasts.length === 0) {
    return createSuccessResponse({ rule_id: ruleId, reason: "no_forecast_data", checks: [] });
  }

  // Parse and filter to daylight
  const parsed: ForecastHour[] = forecasts.map((f) => ({
    forecast_at: f.forecast_at,
    wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
    wave_period: f.wave_period ? parseFloat(f.wave_period.replace("s", "")) : null,
    swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
    swell_1_period: f.swell_1_period ? parseFloat(f.swell_1_period.replace("s", "")) : null,
    swell_1_direction: f.swell_1_direction ? parseFloat(String(f.swell_1_direction)) : null,
    wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null,
    wind_direction_deg: f.wind_direction_deg,
    tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
    tide_status: f.tide_status,
  }));

  const daylight = filterToDaylight(parsed, beach.lat, beach.lon);

  // Build per-condition checks for the "best" forecast hour (highest total conditions)
  const midday = daylight[Math.floor(daylight.length / 2)] ?? parsed[0];

  const checks: Array<{ condition: string; rule_value: string; actual_value: string; passed: boolean }> = [];

  if (conditions.swell_height_min != null) {
    checks.push({
      condition: "Swell height",
      rule_value: `≥ ${conditions.swell_height_min}ft`,
      actual_value: midday.wave_height != null ? `${midday.wave_height}ft` : "N/A",
      passed: midday.wave_height != null && midday.wave_height >= conditions.swell_height_min,
    });
  }

  if (conditions.swell_height_max != null) {
    checks.push({
      condition: "Swell height",
      rule_value: `≤ ${conditions.swell_height_max}ft`,
      actual_value: midday.wave_height != null ? `${midday.wave_height}ft` : "N/A",
      passed: midday.wave_height != null && midday.wave_height <= conditions.swell_height_max,
    });
  }

  if (conditions.swell_period_min != null) {
    const period = midday.swell_1_period ?? midday.wave_period;
    checks.push({
      condition: "Swell period",
      rule_value: `≥ ${conditions.swell_period_min}s`,
      actual_value: period != null ? `${period}s` : "N/A",
      passed: period != null && period >= conditions.swell_period_min,
    });
  }

  if (conditions.wind_speed_max_kt != null) {
    checks.push({
      condition: "Wind speed",
      rule_value: `≤ ${conditions.wind_speed_max_kt}kt`,
      actual_value: midday.wind_speed != null ? `${midday.wind_speed}kt` : "N/A",
      passed: midday.wind_speed != null && midday.wind_speed <= conditions.wind_speed_max_kt,
    });
  }

  if (conditions.wind_direction != null) {
    const resolved = midday.wind_direction_deg != null
      ? resolveWindDirection(midday.wind_direction_deg, beach.wind_offshore_deg, beach.wind_offshore_tol_deg, beach.aspect_deg)
      : null;
    checks.push({
      condition: "Wind direction",
      rule_value: conditions.wind_direction,
      actual_value: resolved ?? "N/A",
      passed: resolved === conditions.wind_direction,
    });
  }

  if (conditions.tide_height_min_ft != null || conditions.tide_height_max_ft != null) {
    const min = conditions.tide_height_min_ft;
    const max = conditions.tide_height_max_ft;
    checks.push({
      condition: "Tide height",
      rule_value: `${min ?? "any"} – ${max ?? "any"}ft`,
      actual_value: midday.tide_height != null ? `${midday.tide_height}ft` : "N/A",
      passed: midday.tide_height != null
        && (min == null || midday.tide_height >= min)
        && (max == null || midday.tide_height <= max),
    });
  }

  if (conditions.tide_direction != null) {
    checks.push({
      condition: "Tide direction",
      rule_value: conditions.tide_direction,
      actual_value: midday.tide_status ?? "N/A",
      passed: midday.tide_status === conditions.tide_direction,
    });
  }

  const anyHourMatches = daylight.some((f) => evaluateConditions(conditions, f, beach));

  return createSuccessResponse({
    rule_id: ruleId,
    date: today,
    daylight_hours: daylight.length,
    any_hour_matches: anyHourMatches,
    sample_hour: midday.forecast_at,
    checks,
  });
}, { errorMessage: "Failed to debug alert rule" });
```

- [ ] **Step 2: Commit**

```bash
cd quiver
git add app/api/alerts/debug/\[ruleId\]/route.ts
git commit -m "feat: add alert rule debug endpoint for condition diagnostics"
```

---

## Task 14: Vercel Cron Configuration

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Read current vercel.json**

Read `quiver/vercel.json` to see existing cron config format.

- [ ] **Step 2: Add cron entries**

Add these two entries to the `crons` array:

```json
{
  "path": "/api/cron/condition-alert-evaluate",
  "schedule": "0 9 * * *"
},
{
  "path": "/api/cron/condition-alert-deliver",
  "schedule": "*/5 * * * *"
}
```

The evaluation cron runs at 09:00 UTC daily (5 AM EDT / 2 AM PDT). The delivery cron runs every 5 minutes.

- [ ] **Step 3: Add `ALERT_PREVIEW_MODE=true` to environment**

Add to `.env.local`:
```
ALERT_PREVIEW_MODE=true
```

And ensure it's set in Vercel environment variables for production.

- [ ] **Step 4: Commit**

```bash
cd quiver
git add vercel.json
git commit -m "feat: add cron schedules for condition alert evaluate and deliver"
```

---

## Task 15: Bell CTA Redesign (Web)

**Files:**
- Modify: `components/beach-detail/beach-alert-cta.tsx`
- Modify: `components/beach-detail/beach-actions.tsx`

- [ ] **Step 1: Read current files**

Read `quiver/components/beach-detail/beach-alert-cta.tsx` and `quiver/components/beach-detail/beach-actions.tsx` fully.

- [ ] **Step 2: Rewrite beach-alert-cta.tsx**

Replace the current binary toggle with a visible CTA that shows alert state and opens the creation popover. Key changes:
- Orange bell icon (`#F78E42`) when no alerts exist
- Filled bell with badge when alerts active
- Fetches rule count from `/api/alerts/rules?beach_id=X`
- Opens `AlertCreationPopover` on click (built in Task 16)
- Keeps the `usePendingAction` pattern for anonymous users

- [ ] **Step 3: Add CTA to beach-actions.tsx**

Move the alert CTA from the tab actions bar to the `BeachActions` component, alongside "Report Conditions" and "Get Directions." Give it prominent styling — not ghost-styled.

- [ ] **Step 4: Test manually**

Run: `cd quiver && yarn dev`
Verify: Bell icon is visible with orange color, positioned alongside beach actions. Clicking opens creation flow (or auth modal for anon users).

- [ ] **Step 5: Commit**

```bash
cd quiver
git add components/beach-detail/beach-alert-cta.tsx components/beach-detail/beach-actions.tsx
git commit -m "feat: redesign bell CTA with visible styling and alert state"
```

---

## Task 16: Alert Creation Popover

**Files:**
- Create: `components/alerts/alert-creation-popover.tsx`
- Create: `components/alerts/preset-card.tsx`
- Create: `components/alerts/condition-builder.tsx`

- [ ] **Step 1: Write preset-card.tsx**

A tappable card showing preset name, description, and conditions summary. Uses the Quiver dark theme with orange accents. On click, calls the creation API and shows success state.

```tsx
// components/alerts/preset-card.tsx
"use client";

import type { PresetDefinition, BeachAlertMeta } from "@/lib/alerts/types";

interface PresetCardProps {
  preset: PresetDefinition;
  beach: BeachAlertMeta;
  onSelect: (preset: PresetDefinition) => void;
  disabled?: boolean;
}

export function PresetCard({ preset, beach, onSelect, disabled }: PresetCardProps) {
  return (
    <button
      onClick={() => onSelect(preset)}
      disabled={disabled}
      className="w-full text-left p-3 rounded-lg bg-[#354090]/50 hover:bg-[#354090] border border-[#404C92] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="font-semibold text-white text-sm">{preset.name}</div>
      <div className="text-gray-400 text-xs mt-0.5">{preset.description}</div>
      <div className="text-gray-500 text-[11px] mt-1 font-mono">{preset.conditionsSummary}</div>
    </button>
  );
}
```

- [ ] **Step 2: Write condition-builder.tsx**

Add-field pattern with a "+ Add Condition" button that opens a picker for the 7 condition types. Each selected condition renders an inline input (number slider for ranges, select for direction).

- [ ] **Step 3: Write alert-creation-popover.tsx**

Two-stage popover:
- Stage 1: Grid of preset cards (Popular row, Specific row, Custom option)
- Stage 2: Expandable customization with conditions + channel toggles

Uses Radix `Popover` on desktop, renders as a sheet-like element on mobile.

- [ ] **Step 4: Wire into beach-alert-cta.tsx**

Import and render `AlertCreationPopover` when the bell CTA is clicked.

- [ ] **Step 5: Test manually**

Run: `cd quiver && yarn dev`
Navigate to a beach detail page. Click the bell icon. Verify the popover shows presets. Select one. Verify the rule is created via the API.

- [ ] **Step 6: Commit**

```bash
cd quiver
git add components/alerts/
git commit -m "feat: add alert creation popover with preset cards and condition builder"
```

---

## Task 17: Beaches Tab Alert Management

**Files:**
- Modify: `components/favorite-beaches.tsx`
- Create: `components/alerts/alert-rule-card.tsx`
- Create: `components/alerts/alert-management-panel.tsx`

- [ ] **Step 1: Read favorite-beaches.tsx**

Read `quiver/components/favorite-beaches.tsx` fully.

- [ ] **Step 2: Write alert-rule-card.tsx**

Individual rule display: name, enabled toggle, overflow menu (edit, delete). Uses the same dark theme as existing beach cards.

- [ ] **Step 3: Write alert-management-panel.tsx**

Expandable panel that shows:
- List of `AlertRuleCard` components
- "+ Add Rule" button
- Fetches rules from `/api/alerts/rules?beach_id=X`
- Handles enable/disable via PATCH
- Handles delete via DELETE
- "+ Add Rule" opens the same `AlertCreationPopover`

- [ ] **Step 4: Integrate into favorite-beaches.tsx**

Add an alert status row to each beach card:
- Bell icon (filled/outlined based on rule count)
- "[N] alert rules active" or "No alerts set"
- "Manage" button that toggles the `AlertManagementPanel`

Add the unfavorite confirmation dialog for beaches with active alerts.

- [ ] **Step 5: Test manually**

Run: `cd quiver && yarn dev`
Navigate to Profile > Beaches tab. Verify alert status shows on each beach card. Click Manage. Verify rules expand. Toggle/delete a rule.

- [ ] **Step 6: Commit**

```bash
cd quiver
git add components/alerts/alert-rule-card.tsx components/alerts/alert-management-panel.tsx components/favorite-beaches.tsx
git commit -m "feat: add alert management panel to beaches tab"
```

---

## Task 18: Discoverability Nudges

**Files:**
- Modify: `components/beach-detail.tsx` (empty state prompt)
- Modify: session confirmation component (post-session nudge)

- [ ] **Step 1: Add empty state prompt on beach detail**

When a user visits a favorited beach with zero alerts, show a dismissible one-liner below the hero:
"Get notified when [beach name] has your ideal conditions" with "Set Up Alert" link.

Stored in `localStorage` per beach to avoid repeat showing.

- [ ] **Step 2: Add post-session nudge**

In the session log confirmation flow, if the user logged at a beach without alerts, add:
"Want to know when [beach name] gets this good again? Set an alert."

- [ ] **Step 3: Add bell-plus icon to beaches tab**

For favorite beaches with zero alerts, show a subtle bell-plus icon in the card footer (already handled by the alert status row from Task 17, but ensure the zero-state has good CTA affordance).

- [ ] **Step 4: Test manually**

Run: `cd quiver && yarn dev`
Verify: empty state prompt shows on favorited beach with no alerts. Dismiss it. Refresh. It doesn't reappear.

- [ ] **Step 5: Commit**

```bash
cd quiver
git add components/beach-detail.tsx
git commit -m "feat: add alert discoverability nudges"
```

---

## Task 19: Run All Tests & Type Check

- [ ] **Step 1: Run unit tests**

Run: `cd quiver && yarn test`
Expected: All tests pass, including new alert tests.

- [ ] **Step 2: Run type check**

Run: `cd quiver && yarn typecheck`
Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `cd quiver && yarn lint`
Expected: No lint errors.

- [ ] **Step 4: Fix any issues found**

If any tests, type errors, or lint errors, fix them and re-run.

- [ ] **Step 5: Commit fixes if any**

```bash
cd quiver
git add -A
git commit -m "fix: resolve test/type/lint issues from condition alerts"
```

---

## Task 20: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry under [Unreleased]**

```markdown
### Added
- Condition alerts: custom surf condition alert rules with 7 preset templates
- Two-phase cron system: evaluation + delivery with timezone-aware scheduling
- Alert creation flow with preset picker and custom condition builder
- Alert management in Profile > Beaches tab
- Consolidated daily alert (email + push) with multi-beach support
- "Why didn't this match?" debug view for alert rule diagnostics
- Alert discoverability nudges (empty state prompt, post-session nudge)
- `ALERT_PREVIEW_MODE` flag for preview period (all features free)
```

- [ ] **Step 2: Commit**

```bash
cd quiver
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG with condition alerts feature"
```
