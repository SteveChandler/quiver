# Beach Passport (Badge-Integrated) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Validate against committed `main` (`git show main:<path>`); working tree cleaned 2026-06-18. **Migration safety:** read `docs/MIGRATION_SAFETY.md`; wrap in `BEGIN;…COMMIT;`; production mutations are PLAN→APPROVAL.

**Goal:** Turn the per-beach badges into a collectible "passport" inside the existing gamification system — a new `beach` badge category, one badge per beach (awarded on first logged session there, granting XP), rendered as the bespoke PNG, surfaced in the profile badge gallery as unlocked/locked.

**Architecture:** Extend, don't replace. `badge_definitions` gains a `beach` category + an `image_url` column; the 15 beaches are seeded as `beach_<slug>` rows. A new **DB-driven** awarding step in `evaluateBadgeUnlocks` (which already runs on the `log_session` XP trigger) awards any seeded beach badge whose beach the user has surfed. `BadgeIcon` learns to render `image_url`; `BadgeGallery` gains a `beach` tab. Adding future beaches = migration + asset only, no code change. **Web is v1; native gamification UI doesn't exist yet and is a documented phase 2.**

**Tech Stack:** Supabase Postgres (migration), Next.js/React, TypeScript, Jest. Award engine in `lib/gamification/`.

**Depends on:** the beach-badge assets + registry from `2026-06-18-share-card-beach-badge-stamp.md` (Tasks 1–2). Those tasks are idempotent — run them first if not already done.

**Design constraint (no duplicate sticker per surface):** the same sticker must never render twice on one surface. The passport gallery shows each beach badge once (all distinct) — don't repeat a badge or a decorative sticker within the gallery, the profile card, or the "Beaches" tab.

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `public/images/beach-badges/*.png`, `lib/beach-badges/beach-badge-registry.ts` | Assets + registry (from stamp plan) | Prereq |
| `supabase/migrations/2026MMDDHHMMSS_beach_passport_badges.sql` | `beach` category, `image_url` column, seed 15 | Create |
| `lib/gamification/beach-badges.ts` | Pure `beachSlugToBadgeSlug` + `computeBeachBadgesToAward` | Create |
| `__tests__/lib/gamification/beach-badges.test.ts` | Pure-logic tests | Create |
| `lib/gamification/badge-service.ts` | `evaluateBeachBadges()`; call it in `evaluateBadgeUnlocks`; add `image_url` to selects | Modify |
| `app/api/gamification/badge-definitions/route.ts`, `app/api/gamification/user-badges/route.ts` | Include `image_url` in selects | Modify |
| `components/gamification/badge-icon.tsx` | Render `image_url` as `<Image>` | Modify |
| `components/gamification/badge-gallery.tsx` | Add `beach` category + "Beaches" tab | Modify |
| `lib/gamification/types.ts` | Add `image_url` to badge types | Modify |

---

### Task 1: Prereqs — assets + registry

- [ ] **Step 1:** If `public/images/beach-badges/` and `lib/beach-badges/beach-badge-registry.ts` don't exist, run Tasks 1–2 of `2026-06-18-share-card-beach-badge-stamp.md`. Verify:

```bash
ls public/images/beach-badges | wc -l   # 15
test -f lib/beach-badges/beach-badge-registry.ts && echo OK
```

---

### Task 2: Migration — category, image_url, seed 15 beach badges

**Files:**
- Create: `supabase/migrations/<timestamp>_beach_passport_badges.sql`

- [ ] **Step 1: Write the migration**

Name it with a real UTC timestamp (e.g. `20260618170000_beach_passport_badges.sql`).

```sql
-- Beach Passport: adds a `beach` badge category, an image_url column for PNG badges,
-- and seeds one badge per beach that has bespoke art. Idempotent.
BEGIN;

-- 1. Allow the new category. Default constraint name is <table>_<column>_check.
ALTER TABLE public.badge_definitions DROP CONSTRAINT IF EXISTS badge_definitions_category_check;
ALTER TABLE public.badge_definitions
  ADD CONSTRAINT badge_definitions_category_check
  CHECK (category IN ('global', 'journal', 'quiver', 'beach'));

-- 2. Image badges (Lucide-name `icon` stays NOT NULL as a fallback; image_url wins when set).
ALTER TABLE public.badge_definitions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Seed the 15 beach badges (badge_slug = beach_<slug with - → _>).
INSERT INTO public.badge_definitions (badge_slug, name, description, icon, category, xp_reward, image_url) VALUES
('beach_pacific_beach',                'Pacific Beach',     'Logged a session at Pacific Beach',     'MapPin', 'beach', 25, '/images/beach-badges/pacific-beach.png'),
('beach_la_jolla_shores',              'La Jolla Shores',   'Logged a session at La Jolla Shores',   'MapPin', 'beach', 25, '/images/beach-badges/la-jolla-shores.png'),
('beach_ocean_beach',                  'Ocean Beach',       'Logged a session at Ocean Beach',       'MapPin', 'beach', 25, '/images/beach-badges/ocean-beach.png'),
('beach_tourmaline_surf_park',         'Tourmaline',        'Logged a session at Tourmaline',        'MapPin', 'beach', 25, '/images/beach-badges/tourmaline-surf-park.png'),
('beach_mission_beach',                'Mission Beach',     'Logged a session at Mission Beach',     'MapPin', 'beach', 25, '/images/beach-badges/mission-beach.png'),
('beach_oceanside_pier',               'Oceanside Pier',    'Logged a session at Oceanside Pier',    'MapPin', 'beach', 25, '/images/beach-badges/oceanside-pier.png'),
('beach_ponto',                        'Ponto',             'Logged a session at Ponto',             'MapPin', 'beach', 25, '/images/beach-badges/ponto.png'),
('beach_windansea',                    'Windansea',         'Logged a session at Windansea',         'MapPin', 'beach', 25, '/images/beach-badges/windansea.png'),
('beach_blacks',                       'Blacks Beach',      'Logged a session at Blacks Beach',      'MapPin', 'beach', 25, '/images/beach-badges/blacks.png'),
('beach_del_mar',                      'Del Mar',           'Logged a session at Del Mar',           'MapPin', 'beach', 25, '/images/beach-badges/del-mar.png'),
('beach_malibu_third_point_malibu_ca', 'Malibu',            'Logged a session at Malibu',            'MapPin', 'beach', 25, '/images/beach-badges/malibu-third-point-malibu-ca.png'),
('beach_huntington_beach_pier',        'Huntington Beach',  'Logged a session at Huntington Beach',  'MapPin', 'beach', 25, '/images/beach-badges/huntington-beach-pier.png'),
('beach_san_clemente_state_beach',     'San Clemente',      'Logged a session at San Clemente',      'MapPin', 'beach', 25, '/images/beach-badges/san-clemente-state-beach.png'),
('beach_linda_mar_pacifica_ca',        'Linda Mar',         'Logged a session at Linda Mar',         'MapPin', 'beach', 25, '/images/beach-badges/linda-mar-pacifica-ca.png'),
('beach_ponce_inlet_ponce_inlet_fl',   'Ponce Inlet',       'Logged a session at Ponce Inlet',       'MapPin', 'beach', 25, '/images/beach-badges/ponce-inlet-ponce-inlet-fl.png')
ON CONFLICT (badge_slug) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply locally + verify**

Run: `supabase db reset` (local) or apply the single migration locally, then:
```sql
SELECT category, count(*) FROM badge_definitions GROUP BY category;  -- expect beach=15
SELECT badge_slug, image_url FROM badge_definitions WHERE category='beach' LIMIT 3;
```
Expected: 15 `beach` rows with `image_url` set.

- [ ] **Step 3: Regenerate DB types**

Run: `yarn db:types` (local). Confirm `image_url` appears on `badge_definitions` Row in `types/database.generated.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_beach_passport_badges.sql types/database.generated.ts
git commit -m "feat(gamification): add beach badge category + seed 15 beach passport badges"
```

> **Production:** do NOT auto-apply. Surface the migration for PLAN→APPROVAL per `docs/MIGRATION_SAFETY.md`.

---

### Task 3: Pure award logic

**Files:**
- Create: `lib/gamification/beach-badges.ts`
- Test: `__tests__/lib/gamification/beach-badges.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/gamification/beach-badges.test.ts
import { beachSlugToBadgeSlug, computeBeachBadgesToAward } from "@/lib/gamification/beach-badges";

describe("beach badge award logic", () => {
  it("maps a beach slug to its badge_slug", () => {
    expect(beachSlugToBadgeSlug("pacific-beach")).toBe("beach_pacific_beach");
    expect(beachSlugToBadgeSlug("malibu-third-point-malibu-ca")).toBe("beach_malibu_third_point_malibu_ca");
  });

  it("awards seeded, surfed, not-yet-owned beach badges", () => {
    const surfed = ["pacific-beach", "ocean-beach", "some-unbadged-beach"];
    const seeded = new Set(["beach_pacific_beach", "beach_ocean_beach", "beach_blacks"]);
    const owned = new Set(["beach_pacific_beach"]);
    expect(computeBeachBadgesToAward(surfed, seeded, owned)).toEqual(["beach_ocean_beach"]);
  });

  it("dedupes repeated beaches and ignores unseeded ones", () => {
    const surfed = ["ponto", "ponto", "no-art-beach"];
    const seeded = new Set(["beach_ponto"]);
    expect(computeBeachBadgesToAward(surfed, seeded, new Set())).toEqual(["beach_ponto"]);
  });

  it("returns [] when nothing qualifies", () => {
    expect(computeBeachBadgesToAward([], new Set(), new Set())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test:unit __tests__/lib/gamification/beach-badges.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/gamification/beach-badges.ts
export function beachSlugToBadgeSlug(beachSlug: string): string {
  return `beach_${beachSlug.replace(/-/g, "_")}`;
}

/**
 * Pure: which beach badge_slugs to award.
 * @param surfedBeachSlugs distinct beaches.slug the user has logged sessions at
 * @param seededBadgeSlugs badge_slugs that exist in badge_definitions (category='beach')
 * @param ownedBadgeSlugs badge_slugs already in user_badges
 */
export function computeBeachBadgesToAward(
  surfedBeachSlugs: string[],
  seededBadgeSlugs: Set<string>,
  ownedBadgeSlugs: Set<string>
): string[] {
  const out = new Set<string>();
  for (const slug of surfedBeachSlugs) {
    const badgeSlug = beachSlugToBadgeSlug(slug);
    if (seededBadgeSlugs.has(badgeSlug) && !ownedBadgeSlugs.has(badgeSlug)) {
      out.add(badgeSlug);
    }
  }
  return [...out];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test:unit __tests__/lib/gamification/beach-badges.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gamification/beach-badges.ts __tests__/lib/gamification/beach-badges.test.ts
git commit -m "feat(gamification): pure beach-badge award logic"
```

---

### Task 4: Wire beach-badge awarding into the engine

**Files:**
- Modify: `lib/gamification/badge-service.ts`

`evaluateBadgeUnlocks(userId, supabase)` (~line 336) is the single award entrypoint (called by `trackXP` → fired on `log_session`). Add a beach pass at its end, before `return`.

- [ ] **Step 1: Add `evaluateBeachBadges` + call it**

Add the import at the top of `badge-service.ts`:

```ts
import { computeBeachBadgesToAward } from "./beach-badges";
```

Add this function (e.g. above `evaluateBadgeUnlocks`):

```ts
/** Award per-beach passport badges for beaches the user has logged a session at. */
async function evaluateBeachBadges(
  userId: string,
  supabase: SupabaseClient,
  ownedBadgeSlugs: Set<string>
): Promise<BadgeUnlock[]> {
  // Seeded beach badges (DB is source of truth).
  const { data: defs } = await supabase
    .from("badge_definitions")
    .select("badge_slug, name, icon, xp_reward")
    .eq("category", "beach");
  const seeded = new Set((defs || []).map((d) => d.badge_slug));
  if (seeded.size === 0) return [];

  // Distinct beaches the user has surfed.
  const { data: sessions } = await supabase
    .from("sessions")
    .select("beaches(slug)")
    .eq("user_id", userId)
    .not("beach_id", "is", null)
    .limit(2000);
  const surfedSlugs = Array.from(
    new Set(
      (sessions || [])
        .map((s) => (s as { beaches?: { slug?: string | null } | null }).beaches?.slug ?? null)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const toAward = computeBeachBadgesToAward(surfedSlugs, seeded, ownedBadgeSlugs);
  if (toAward.length === 0) return [];

  const awardedDefs = (defs || []).filter((d) => toAward.includes(d.badge_slug));
  const { error } = await supabase.from("user_badges").insert(
    awardedDefs.map((d) => ({ user_id: userId, badge_slug: d.badge_slug, context: {} }))
  );
  if (error) throw new Error(`Failed to insert beach badges: ${error.message}`);

  for (const d of awardedDefs) {
    if (d.xp_reward > 0) {
      await supabase.from("xp_events").insert({
        user_id: userId,
        action: "badge_unlock",
        xp_amount: d.xp_reward,
        related_entity_type: "badge",
        related_entity_id: d.badge_slug,
      });
    }
  }
  return awardedDefs;
}
```

In `evaluateBadgeUnlocks`, just before `return newlyUnlockedBadges;`, add:

```ts
  // Beach passport badges (per-entity; not expressible in the static getBadgeChecks list).
  const ownedAfter = new Set([
    ...existingBadgeSlugs,
    ...newlyUnlockedBadges.map((b) => b.badge_slug),
  ]);
  const beachAwards = await evaluateBeachBadges(userId, supabase, ownedAfter);
  newlyUnlockedBadges.push(...beachAwards);
```

- [ ] **Step 2: Add `image_url` to the read selects**

In `fetchUserBadges` (~line 442), extend the nested select:

```ts
        badge_definitions (
          name,
          description,
          icon,
          category,
          xp_reward,
          image_url
        )
```

(`fetchAllBadgeDefinitions` uses `select("*")` — already includes `image_url`.)

- [ ] **Step 3: Add `image_url` to badge types**

In `lib/gamification/types.ts`, add `image_url?: string | null;` to the badge-definition and `BadgeUnlock` shapes (wherever `icon` is declared). Run `yarn typecheck`.

- [ ] **Step 4: Integration check**

Local: log a session at Pacific Beach for a test user (or call `trackXP("log_session", …)`), then:
```sql
SELECT badge_slug FROM user_badges WHERE user_id = '<test-user>' AND badge_slug LIKE 'beach_%';
```
Expected: `beach_pacific_beach` present. Re-running does not duplicate (insert is gated by `ownedAfter`).

- [ ] **Step 5: Commit**

```bash
git add lib/gamification/badge-service.ts lib/gamification/types.ts
git commit -m "feat(gamification): award beach passport badges on session log"
```

---

### Task 5: API routes return `image_url`

**Files:**
- Modify: `app/api/gamification/user-badges/route.ts`
- Modify: `app/api/gamification/badge-definitions/route.ts`

- [ ] **Step 1:** In each route, add `image_url` to the `badge_definitions` select (mirror the columns already listed: `badge_slug, name, description, icon, category, xp_reward, image_url`). If a route uses `select("*")`, no change needed — verify.

- [ ] **Step 2: Typecheck + commit**

```bash
yarn typecheck
git add app/api/gamification/user-badges/route.ts app/api/gamification/badge-definitions/route.ts
git commit -m "feat(gamification): expose badge image_url via API"
```

---

### Task 6: Render image badges

**Files:**
- Modify: `components/gamification/badge-icon.tsx`
- Test: `__tests__/components/gamification/badge-icon.test.tsx`

`BadgeIcon` currently handles emoji (regex) then Lucide-name lookup. Add an image case that wins when `imageUrl` is present.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/gamification/badge-icon.test.tsx
import { render, screen } from "@testing-library/react";
import { BadgeIcon } from "@/components/gamification/badge-icon";

it("renders an <img> when imageUrl is provided", () => {
  render(<BadgeIcon icon="MapPin" imageUrl="/images/beach-badges/pacific-beach.png" alt="Pacific Beach" />);
  const img = screen.getByRole("img", { name: "Pacific Beach" });
  expect(img).toHaveAttribute("src", expect.stringContaining("pacific-beach.png"));
});

it("falls back to the icon when no imageUrl", () => {
  const { container } = render(<BadgeIcon icon="Waves" />);
  expect(container.querySelector("img")).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL** (`imageUrl`/`alt` props don't exist).

Run: `yarn test:unit __tests__/components/gamification/badge-icon.test.tsx`

- [ ] **Step 3: Implement**

Extend the `BadgeIcon` props with `imageUrl?: string | null;` and `alt?: string;`, and at the very top of the render body (before emoji detection) add:

```tsx
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={alt ?? "Badge"}
        width={size ?? 48}
        height={size ?? 48}
        className={className}
        style={{ objectFit: "contain" }}
      />
    );
  }
```

Add `import Image from "next/image";` if not present. Keep the existing emoji/Lucide branches unchanged. Update the call site in `badge-gallery.tsx` to pass `imageUrl={badge.image_url}` and `alt={badge.name}`.

- [ ] **Step 4: Run → PASS**, then commit.

```bash
git add components/gamification/badge-icon.tsx __tests__/components/gamification/badge-icon.test.tsx components/gamification/badge-gallery.tsx
git commit -m "feat(gamification): render PNG image badges"
```

---

### Task 7: Add the "Beaches" passport tab to the gallery

**Files:**
- Modify: `components/gamification/badge-gallery.tsx`

The gallery groups badges by category and renders unlocked + locked. It currently handles `"global" | "journal" | "quiver"` with 4 tabs (All/Global/Journal+/Quiver).

- [ ] **Step 1:** Extend the category union (the `category` type, ~line 23/41) to include `| "beach"`.

- [ ] **Step 2:** Add a "Beaches" tab. In the `TabsList` add `<TabsTrigger value="beach">Beaches</TabsTrigger>` and a matching `<TabsContent value="beach">` that filters badges to `category === "beach"`, reusing the existing unlocked/locked grid renderer. This yields the passport: surfed beaches show their badge, un-surfed seeded beaches show locked/greyed. Update the grid column count if the list is hardcoded.

- [ ] **Step 3:** Verify with Playwright MCP / `yarn dev`: open a profile → gamification → "Beaches" tab. A user with a Pacific Beach session shows it unlocked; others greyed.

- [ ] **Step 4: Commit**

```bash
git add components/gamification/badge-gallery.tsx
git commit -m "feat(gamification): beach passport tab in badge gallery"
```

---

### Task 8 (Phase 2, documented — not implemented in v1): Native passport

Native has **no gamification UI today** (no `user_badges`/`badge_definitions` reads; only XP-free profile stats). A native passport requires: (a) a `/api/gamification/user-badges` fetch in `src/screens/you.tsx`, (b) registering beach badge PNGs in `src/lib/quiver-sticker-assets.ts` + `manifest.json` (⚠️ also edited on `wip/learned-me-activation-loop` — coordinate), (c) a "Beaches Surfed" horizontal strip after the "Your Quiver" section (~`you.tsx:252-316`). Scope as a follow-up plan once web v1 ships. The **share-card stamp already gives native users the badge** via the OG image, so native users see beach badges in sharing without this.

---

## Self-Review

- **Spec coverage:** category+schema (T2), award engine (T3–T4), API (T5), rendering (T6), gallery passport (T7), native deferred + justified (T8). ✓
- **Badge-engine fit:** beach badges bypass the global static `getBadgeChecks` via a dedicated DB-driven `evaluateBeachBadges`, hooked into the existing `evaluateBadgeUnlocks` trigger — no change to `log_session` call sites. ✓
- **Idempotency:** migration `ON CONFLICT DO NOTHING` + `ADD COLUMN IF NOT EXISTS`; awarding gated by `ownedAfter` set so re-runs don't duplicate. ✓
- **Type consistency:** `image_url?: string | null` added to types, service selects, API selects, and `BadgeIcon` props; `beachSlugToBadgeSlug` shared by award logic (registry's `badgeSlug` uses the same transform — verified identical in the stamp plan). ✓
- **No placeholders:** migration, award engine, pure logic, and badge-icon code are complete; all 15 rows concrete.
- **Blast radius:** `lib/gamification/*`, gamification API routes, badge UI. Run `yarn test:unit __tests__/lib/gamification __tests__/components/gamification` and `yarn typecheck` (Node 22).
- **Migration safety:** single `BEGIN/COMMIT`, additive only, no destructive ops; prod = PLAN→APPROVAL.
- **CHANGELOG:** `[Unreleased] / Added`: "Beach Passport — collectible per-beach badges in the profile gamification gallery, awarded on first session at a beach."
