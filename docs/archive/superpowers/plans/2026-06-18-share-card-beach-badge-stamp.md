# Share-Card Beach-Badge Stamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Validate file/symbol existence against committed `main` (`git show main:<path>`); the working tree was cleaned on 2026-06-18.

**Goal:** Stamp a per-beach vintage "badge" PNG onto the session share card (the `/api/og/session` image) so every shared session is location-branded, on both web and native.

**Architecture:** Bake the badge **server-side into the OG image** so both web and native share flows get it for free from the one endpoint. The OG route gains an optional `beachSlug` param; a small shared registry maps a beach slug → badge asset; the route renders a rotated corner badge when the beach has one (graceful no-op otherwise). Both the web and native share-URL builders pass the beach slug.

**Tech Stack:** Next.js `next/og` `ImageResponse` (runtime `nodejs`), TypeScript, Jest. Assets are static PNGs in `public/`.

**Scope note:** This plan ships independently. It shares its asset-prep (Task 1) and the registry (Task 2) with the Beach Passport plan (`2026-06-18-beach-passport-badges.md`); both tasks are idempotent, so whichever plan runs first does them and the other skips.

**Design constraint (no duplicate sticker per surface):** the same sticker must never render twice on one surface. The card stamps exactly ONE beach badge; if other decorative stickers are added to the card alongside it, keep them distinct. (Reusing a sticker on a different surface is fine — the rule is per-card/per-page.)

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `public/images/beach-badges/<db-slug>.png` (15) | Static badge assets, named by DB beach slug | Create |
| `lib/beach-badges/beach-badge-registry.ts` | Single source of truth: beach slug → `{ badgeSlug, asset, label }` + `getBeachBadge()` | Create |
| `__tests__/lib/beach-badges/beach-badge-registry.test.ts` | Registry unit tests | Create |
| `app/api/og/session/route.tsx` | Read `beachSlug`, render corner badge `<img>` when present | Modify |
| `lib/share/build-share-card-url.ts` | Add `beachSlug` to `SessionShareParams` + `buildSessionShareUrl` | Modify |
| `lib/share/session-share.ts` | Pass `session.beaches?.slug` into the builder | Modify |
| `__tests__/lib/share/session-share.test.ts` | Assert slug is forwarded | Create/extend |
| `../quiver-native/src/lib/share/build-share-card-url.ts` | Add `beachSlug` param (mirror web) | Modify |
| `../quiver-native/src/components/share/share-sheet.tsx` | Pass `beachSlug` from session data | Modify |

**Beach slug → asset filename → badge_slug** (exact, from quiverDB):

| DB slug | source file (`Brand-Vault/surf-stickers/beaches/png/`) | dest (`public/images/beach-badges/`) |
|---|---|---|
| `pacific-beach` | `pacific-beach-v1-badge.png` | `pacific-beach.png` |
| `la-jolla-shores` | `la-jolla-shores.png` | `la-jolla-shores.png` |
| `ocean-beach` | `ocean-beach.png` | `ocean-beach.png` |
| `tourmaline-surf-park` | `tourmaline.png` | `tourmaline-surf-park.png` |
| `mission-beach` | `mission-beach.png` | `mission-beach.png` |
| `oceanside-pier` | `oceanside-pier.png` | `oceanside-pier.png` |
| `ponto` | `ponto.png` | `ponto.png` |
| `windansea` | `windansea.png` | `windansea.png` |
| `blacks` | `blacks-beach.png` | `blacks.png` |
| `del-mar` | `del-mar.png` | `del-mar.png` |
| `malibu-third-point-malibu-ca` | `malibu.png` | `malibu-third-point-malibu-ca.png` |
| `huntington-beach-pier` | `huntington-beach.png` | `huntington-beach-pier.png` |
| `san-clemente-state-beach` | `san-clemente.png` | `san-clemente-state-beach.png` |
| `linda-mar-pacifica-ca` | `linda-mar.png` | `linda-mar-pacifica-ca.png` |
| `ponce-inlet-ponce-inlet-fl` | `ponce-inlet.png` | `ponce-inlet-ponce-inlet-fl.png` |

---

### Task 1: Place beach-badge assets (idempotent; shared with passport plan)

**Files:**
- Create: `public/images/beach-badges/*.png` (15 files)

- [ ] **Step 1: Copy + resize the 15 badges to 512px, named by DB slug**

Run from the workspace root (`/Users/stevenchandler/Desktop/dev`). `sips` is macOS-native; if absent use `npx sharp-cli` or ImageMagick `magick`.

```bash
SRC="Brand-Vault/surf-stickers/beaches/png"
DST="quiver/public/images/beach-badges"
mkdir -p "$DST"
copy() { sips -Z 512 "$SRC/$1" --out "$DST/$2" >/dev/null; }
copy pacific-beach-v1-badge.png pacific-beach.png
copy la-jolla-shores.png        la-jolla-shores.png
copy ocean-beach.png            ocean-beach.png
copy tourmaline.png             tourmaline-surf-park.png
copy mission-beach.png          mission-beach.png
copy oceanside-pier.png         oceanside-pier.png
copy ponto.png                  ponto.png
copy windansea.png              windansea.png
copy blacks-beach.png           blacks.png
copy del-mar.png                del-mar.png
copy malibu.png                 malibu-third-point-malibu-ca.png
copy huntington-beach.png       huntington-beach-pier.png
copy san-clemente.png           san-clemente-state-beach.png
copy linda-mar.png              linda-mar-pacifica-ca.png
copy ponce-inlet.png            ponce-inlet-ponce-inlet-fl.png
ls "$DST" | wc -l   # expect 15
```

- [ ] **Step 2: Commit**

```bash
git add public/images/beach-badges
git commit -m "feat(assets): add 15 per-beach badge stickers for share cards"
```

---

### Task 2: Shared beach-badge registry (idempotent; shared with passport plan)

**Files:**
- Create: `lib/beach-badges/beach-badge-registry.ts`
- Test: `__tests__/lib/beach-badges/beach-badge-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/beach-badges/beach-badge-registry.test.ts
import { getBeachBadge, BEACH_BADGES } from "@/lib/beach-badges/beach-badge-registry";

describe("beach-badge-registry", () => {
  it("resolves a known beach slug to its badge", () => {
    const b = getBeachBadge("pacific-beach");
    expect(b).toEqual({
      badgeSlug: "beach_pacific_beach",
      asset: "/images/beach-badges/pacific-beach.png",
      label: "Pacific Beach",
    });
  });

  it("converts hyphens to underscores in badgeSlug", () => {
    expect(getBeachBadge("la-jolla-shores")?.badgeSlug).toBe("beach_la_jolla_shores");
  });

  it("returns null for an unknown beach", () => {
    expect(getBeachBadge("nonexistent-beach")).toBeNull();
  });

  it("returns null/undefined-safe for empty input", () => {
    expect(getBeachBadge(undefined)).toBeNull();
    expect(getBeachBadge(null)).toBeNull();
    expect(getBeachBadge("")).toBeNull();
  });

  it("has all 15 seeded beaches with matching badgeSlug shape", () => {
    expect(Object.keys(BEACH_BADGES)).toHaveLength(15);
    for (const [slug, b] of Object.entries(BEACH_BADGES)) {
      expect(b.badgeSlug).toBe(`beach_${slug.replace(/-/g, "_")}`);
      expect(b.asset).toBe(`/images/beach-badges/${slug}.png`);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test:unit __tests__/lib/beach-badges/beach-badge-registry.test.ts`
Expected: FAIL — cannot find module `@/lib/beach-badges/beach-badge-registry`.

- [ ] **Step 3: Implement the registry**

```ts
// lib/beach-badges/beach-badge-registry.ts
export interface BeachBadge {
  /** Gamification badge_slug. Hyphens → underscores (badge_slug CHECK is [a-z0-9_]). */
  badgeSlug: string;
  /** Public path to the 512px transparent PNG. */
  asset: string;
  /** Human label (beach name). */
  label: string;
}

/** Keyed by `beaches.slug`. Only beaches with bespoke badge art appear here. */
export const BEACH_BADGES: Record<string, BeachBadge> = {
  "pacific-beach": { badgeSlug: "beach_pacific_beach", asset: "/images/beach-badges/pacific-beach.png", label: "Pacific Beach" },
  "la-jolla-shores": { badgeSlug: "beach_la_jolla_shores", asset: "/images/beach-badges/la-jolla-shores.png", label: "La Jolla Shores" },
  "ocean-beach": { badgeSlug: "beach_ocean_beach", asset: "/images/beach-badges/ocean-beach.png", label: "Ocean Beach" },
  "tourmaline-surf-park": { badgeSlug: "beach_tourmaline_surf_park", asset: "/images/beach-badges/tourmaline-surf-park.png", label: "Tourmaline" },
  "mission-beach": { badgeSlug: "beach_mission_beach", asset: "/images/beach-badges/mission-beach.png", label: "Mission Beach" },
  "oceanside-pier": { badgeSlug: "beach_oceanside_pier", asset: "/images/beach-badges/oceanside-pier.png", label: "Oceanside Pier" },
  "ponto": { badgeSlug: "beach_ponto", asset: "/images/beach-badges/ponto.png", label: "Ponto" },
  "windansea": { badgeSlug: "beach_windansea", asset: "/images/beach-badges/windansea.png", label: "Windansea" },
  "blacks": { badgeSlug: "beach_blacks", asset: "/images/beach-badges/blacks.png", label: "Blacks Beach" },
  "del-mar": { badgeSlug: "beach_del_mar", asset: "/images/beach-badges/del-mar.png", label: "Del Mar" },
  "malibu-third-point-malibu-ca": { badgeSlug: "beach_malibu_third_point_malibu_ca", asset: "/images/beach-badges/malibu-third-point-malibu-ca.png", label: "Malibu" },
  "huntington-beach-pier": { badgeSlug: "beach_huntington_beach_pier", asset: "/images/beach-badges/huntington-beach-pier.png", label: "Huntington Beach" },
  "san-clemente-state-beach": { badgeSlug: "beach_san_clemente_state_beach", asset: "/images/beach-badges/san-clemente-state-beach.png", label: "San Clemente" },
  "linda-mar-pacifica-ca": { badgeSlug: "beach_linda_mar_pacifica_ca", asset: "/images/beach-badges/linda-mar-pacifica-ca.png", label: "Linda Mar" },
  "ponce-inlet-ponce-inlet-fl": { badgeSlug: "beach_ponce_inlet_ponce_inlet_fl", asset: "/images/beach-badges/ponce-inlet-ponce-inlet-fl.png", label: "Ponce Inlet" },
};

export function getBeachBadge(slug: string | null | undefined): BeachBadge | null {
  if (!slug) return null;
  return BEACH_BADGES[slug] ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test:unit __tests__/lib/beach-badges/beach-badge-registry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/beach-badges/beach-badge-registry.ts __tests__/lib/beach-badges/beach-badge-registry.test.ts
git commit -m "feat(beach-badges): add shared beach-slug→badge registry"
```

---

### Task 3: Render the badge in the OG session card

**Files:**
- Modify: `app/api/og/session/route.tsx`

The route reads params near line 48 and renders the beach name `{displayBeach}` around line 425 inside the absolute-positioned content `<div>` (`padding: 72`). Badge art is a corner sticker.

- [ ] **Step 1: Read the param block + import the registry**

At the top of the file, add the import (after the existing imports):

```ts
import { getBeachBadge } from "@/lib/beach-badges/beach-badge-registry";
```

In the param block (where `const beach = searchParams.get('beach') || 'Unknown Beach';` lives, ~line 48), add:

```ts
const beachSlug = searchParams.get('beachSlug') || '';
```

- [ ] **Step 2: Resolve the badge + its absolute URL**

Immediately after the param block (before the `new ImageResponse(` call), compute the badge URL using the same origin logic the font fetch uses:

```ts
const badge = getBeachBadge(beachSlug);
const ogOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app"
    : `${new URL(request.url).protocol}//${new URL(request.url).host}`;
const badgeUrl = badge ? `${ogOrigin}${badge.asset}` : null;
```

- [ ] **Step 3: Render the badge as a rotated corner sticker**

Inside the content `<div>` (the one with `padding: 72`, ~lines 227–536), add this as the **last child** so it floats above siblings. Place it in the top-right; `position: absolute` is relative to the padded content div:

```tsx
{badgeUrl && (
  <img
    src={badgeUrl}
    width={300}
    height={300}
    style={{
      position: "absolute",
      top: 64,
      right: 64,
      width: 300,
      height: 300,
      objectFit: "contain",
      transform: "rotate(3deg)",
      filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.45))",
    }}
  />
)}
```

> Note: `next/og` fetches `<img src>` over HTTP at render time; an absolute URL to a `public/` asset is the established pattern in this file (the background image uses it). No `arrayBuffer` needed.

- [ ] **Step 4: Manual render verification (ImageResponse can't be unit-tested)**

Run: `yarn dev`, then open:
`http://localhost:3000/api/og/session?beach=Pacific%20Beach&beachSlug=pacific-beach&stars=4&rating=Good&size=Chest-High`
Expected: the card renders with the Pacific Beach badge rotated in the top-right.
Then open the same URL **without** `beachSlug` — expected: identical card, no badge, no error (graceful).
Also try `&beachSlug=not-a-beach` — expected: no badge, no error.

- [ ] **Step 5: Commit**

```bash
git add app/api/og/session/route.tsx
git commit -m "feat(og): stamp per-beach badge onto session share card"
```

---

### Task 4: Forward the beach slug from the web share-URL builders

**Files:**
- Modify: `lib/share/build-share-card-url.ts`
- Modify: `lib/share/session-share.ts`
- Test: `__tests__/lib/share/session-share.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/share/session-share.test.ts  (add to existing file or create)
import { buildSessionShareImageUrl } from "@/lib/share/session-share";

describe("buildSessionShareImageUrl beach badge", () => {
  it("includes beachSlug when the session's beach has a slug", () => {
    const session = {
      id: "s1",
      rating: 4,
      arrival_time: "2026-06-18T13:00:00Z",
      beaches: { name: "Pacific Beach", slug: "pacific-beach" },
    } as never;
    const url = buildSessionShareImageUrl(session);
    expect(url).toContain("beachSlug=pacific-beach");
  });

  it("omits beachSlug when no slug is present", () => {
    const session = {
      id: "s2",
      rating: 4,
      arrival_time: "2026-06-18T13:00:00Z",
      beaches: { name: "Unknown Beach" },
    } as never;
    const url = buildSessionShareImageUrl(session);
    expect(url).not.toContain("beachSlug=");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test:unit __tests__/lib/share/session-share.test.ts`
Expected: FAIL — `beachSlug` not in the URL.

- [ ] **Step 3: Add `beachSlug` to the builder**

In `lib/share/build-share-card-url.ts`, add to the `SessionShareParams` interface (after `board: string;`):

```ts
  beachSlug?: string;
```

In `buildSessionShareUrl`, after `searchParams.set('board', params.board);`:

```ts
  if (params.beachSlug) searchParams.set('beachSlug', params.beachSlug);
```

- [ ] **Step 4: Forward the slug in `session-share.ts`**

In `lib/share/session-share.ts`, add a helper next to `getSessionBeachName`:

```ts
export function getSessionBeachSlug(session: SessionWithDetails): string | undefined {
  return session.beach?.slug ?? session.beaches?.slug ?? undefined;
}
```

In `buildSessionShareImageUrl`, add to the object passed to `buildSessionShareUrl(...)`:

```ts
    beachSlug: getSessionBeachSlug(session),
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn test:unit __tests__/lib/share/session-share.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/share/build-share-card-url.ts lib/share/session-share.ts __tests__/lib/share/session-share.test.ts
git commit -m "feat(share): forward beach slug to OG session card"
```

---

### Task 5: Forward the beach slug from native

**Files:**
- Modify: `../quiver-native/src/lib/share/build-share-card-url.ts`
- Modify: `../quiver-native/src/components/share/share-sheet.tsx`

> Cross-repo: run native checks from `/Users/stevenchandler/Desktop/dev/quiver-native`. The native sticker registry is being edited on `wip/learned-me-activation-loop`; this task does NOT touch that file, so no conflict.

- [ ] **Step 1: Add `beachSlug` to the native builder**

In `src/lib/share/build-share-card-url.ts`, add to `SessionShareCardParams` (after `board: string;`):

```ts
  beachSlug?: string;
```

In `buildSessionShareCardUrl`, after `searchParams.set('board', params.board);`:

```ts
  if (params.beachSlug) searchParams.set('beachSlug', params.beachSlug);
```

- [ ] **Step 2: Pass the slug from the share sheet**

In `src/components/share/share-sheet.tsx`, find the `buildSessionShareCardUrl({ ... })` call (the props built around lines 119–129) and add `beachSlug` sourced from the session's beach. Use the same field the component already uses for the beach name; add its slug sibling, e.g.:

```ts
    beachSlug: session?.beach?.slug ?? session?.beaches?.slug ?? undefined,
```

(Match the exact session shape already in scope in this component — confirm the beach object field name before editing.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` (in `quiver-native`)
Expected: passes.

- [ ] **Step 4: Manual verify**

In the native app, open the share sheet for a session logged at Pacific Beach; the preview (the web OG image) shows the badge. Sessions at beaches without art show no badge (unchanged).

- [ ] **Step 5: Commit (native repo)**

```bash
git -C ../quiver-native add src/lib/share/build-share-card-url.ts src/components/share/share-sheet.tsx
git -C ../quiver-native commit -m "feat(share): pass beach slug to OG session card for badge stamp"
```

---

## Self-Review

- **Spec coverage:** asset prep (T1) ✓, registry (T2) ✓, OG render (T3) ✓, web forwarding (T4) ✓, native forwarding (T5) ✓.
- **Graceful degradation:** every render path is guarded by `getBeachBadge(...)` returning `null` → no badge, no error. Verified in T3 Step 4.
- **Type consistency:** `beachSlug?: string` added to both `SessionShareParams` (web) and `SessionShareCardParams` (native); `getBeachBadge` accepts `string | null | undefined`.
- **No placeholders:** all 15 slug→asset rows and registry entries are concrete; OG render code is complete.
- **Blast radius:** OG route, share-url builders, session-share. Run `yarn test:unit __tests__/lib/share __tests__/lib/beach-badges` after T4.
- **CHANGELOG:** add under `[Unreleased] / Added`: "Per-beach badge stamped onto session share cards (15 beaches)."
