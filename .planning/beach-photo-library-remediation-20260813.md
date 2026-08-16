# Beach Photo Library — Remediation Scope

**Date:** 2026-08-13
**Status:** Scoped, not started. Blocks the zine migration of `/alerts` and the session log form.
**Origin:** `/impeccable:audit` → "the logged-in surfaces look like flat forms, we have no images". Investigation showed the imagery exists but is not usable.

---

## 1. Why design work is paused

`SessionScrollForm` contains zero zine references — flat navy, which is the "dark dashboard" the design context rules out. `/alerts` is half-migrated: tape and stencil header, then plain form controls. The obvious fix is photography. It doesn't survive contact with the data.

### What `beach_photos` actually contains

| | count | share |
|---|---|---|
| Rows | 1,107 | |
| Approved, not deleted | 828 | |
| `google_places` | 432 | 52% |
| `openverse` | ~366 | |
| `wikimedia` | ~30 | |

### Licence position

| bucket | count | consequence |
|---|---|---|
| `google_places` | 432 | Places ToS: Google attribution must show, no caching, no modification. Cannot take the zine halftone/duotone treatment. |
| `BY-ND` | 22 | NoDerivatives — restyling is a licence violation. |
| `BY` / `BY-SA` | 339 | Usable and modifiable, **visible credit line required**. |
| `CC0` / `PDM` | 17 | Unencumbered. |

### Relevance position

Classified all 828 approved rows by whether the title plausibly describes the beach it is attached to:

| bucket | count | share | verdict |
|---|---|---|---|
| Title mentions the beach name | 179 | 22% | keep |
| Title has a surf/coast term | 60 | 7% | review |
| Title is a city/county name only | 85 | 10% | drop |
| Title unrelated to the coast | 72 | 9% | drop |
| No title (mostly `google_places`) | 432 | 52% | unknown, and unusable anyway |

Real rows, verbatim:

- `"Leaving On A Jet Plane"` → **Pacific Beach**, and the same photo → **Ocean Beach**
- `"Fish Cleaning Table"` → **Crystal Pier**, **Ocean Beach Pier**, **Pacific Beach**
- `"[2005] Coney Island"` (New York) → **Ocean Beach Pier** (San Diego)
- `"McWay Falls"` (a Big Sur waterfall) → **Seaside Cove**
- `"Christine"` → **Waikiki Beach**
- `"Rattlesnakes respect sign"` → a beach row
- `"Lhok Nga Beach"` (Indonesia) → a California break
- 84 further rows titled only `"San Diego"` / `"Orange County"` / `"Los Angeles County"`

49 photos are attached to more than one beach; one photo is shared by 4. 66 of 828 rows are repeats of an already-used image. This is proximity scraping, not curation.

### The number that decides it

**Photos that are both relevant and licence-clean: 206, covering 78 of 346 beaches — 23%.**

A perfect cull still leaves 77% of beaches with no usable photo. That is not a foundation for a visual system. Building photo-first would mean most users see the flat form anyway, plus a credit line inside a form for the minority who don't.

---

## 2. The finding that changes the plan

**The community photo pipeline is built end-to-end except the upload UI, and has never received a single submission.**

`community_spot_photos`: **0 rows.** `beach_photo_submissions`: **0 rows.**

Already built and shipped:

| piece | location |
|---|---|
| Upload/vote/report/recover repository — 12 exported functions | `lib/community-photos/repository.ts` |
| Photo resolution for targets, canonical selection | `lib/community-photos/resolver.ts` |
| Admin moderation queue, 382 lines | `components/admin/community-photo-moderation.tsx` |
| Admin route | `app/admin/community-photos/page.tsx` |
| Retention cron | `app/api/cron/community-photo-retention/route.ts` |
| Storage bucket | `community-spot-photos` |
| Database RPCs — preflight, finalize, moderate, hold, pin, consent, vote, report, Wilson lower-bound scoring, orphan purge | 16+ in `types/database.generated.ts` |
| User-facing recovery UI | `components/profile/community-photo-recovery.tsx` |

Missing:

**Nothing in the application imports `lib/community-photos/repository.ts`.** Its only importer is `__tests__/lib/community-photos/repository.test.ts`. There is no upload entry point anywhere in the app, so `preflightCommunityPhotoUpload` and `completeCommunityPhotoUpload` are unreachable. The moderation queue has never had anything to moderate.

This is the [silent-failure pattern](project-silent-failure-pattern-aug2026.md) again: a complete subsystem reporting healthy while delivering nothing, because one link was never connected.

---

## 3. Recommendation

Do not look for a better scraping source. Connect the pipeline that exists.

Surfer-submitted photos are the only option that is simultaneously **licence-clean** (consent is already modelled), **relevant** (a surfer photographs the break they surf), **on-brand** (the design context asks for "made by surfers, for surfers"), and **aligned with the growth-first mission** — UGC is a community loop, not a content cost. It also converts an already-paid-for subsystem from zero return to real return.

### Work, in order

**A. Light up the upload path** — the whole unblock, and by far the smallest piece
1. Build the upload UI and wire it to `preflightCommunityPhotoUpload` → storage PUT → `completeCommunityPhotoUpload`.
2. Entry points: beach detail (the natural "I was here" moment) and post-session share, where the user already has a photo in hand.
3. Confirm the consent capture flow satisfies what `community_photo_consents` expects.
4. Verify end-to-end that a submission lands in the admin queue — the queue has never been exercised against real input.

**B. Cull the scraped library**
5. Soft-delete the 157 measurably-wrong rows (85 geo-only + 72 off-topic) — `deleted_at`, reversible, no destructive SQL. See `docs/MIGRATION_SAFETY.md`.
6. Break the 49 multi-beach attachments; keep one, drop the rest.
7. Triage the 432 untitled `google_places` rows. They cannot be restyled regardless, so decide whether they stay as plain photos with Google attribution or leave the pool entirely.
8. Keep the 179 name-matched rows as the interim fallback.

**C. Only then, design**
9. With real coverage, revisit the zine migration of `/alerts` and the session form.
10. Until coverage is real, the illustrated zine atoms (`components/beach-detail/zine/atoms/` — `HalftonePhoto`, `MapDoodle`, `DoodleWave`, `TornDivider`, and 12 more) are the fallback, and will remain the fallback for any beach without a photo permanently.

### Explicitly not recommended

- **More scraping.** The current library is what proximity-based scraping produces. Another source repeats the failure at a different address.
- **Stock APIs (Unsplash/Pexels).** Cleaner licensing, same fundamental problem — no photo of *this* break on *this* day. Generic coastal stock is what we already have.
- **Blocking the design work on full coverage.** Coverage will never be 100%; the illustrated fallback is required regardless and should be built to stand on its own.

---

## 4. Open questions for the operator

1. **Moderation load.** UGC means a review queue with a human behind it. Who works it, and what turnaround? The machinery exists; the staffing does not.
2. **Cold start.** 0 photos and 1,433 sessions across a small user base. Does seeding come from a founder upload pass, or a prompt attached to session logging?
3. **`google_places` rows.** Keep 432 as plain unstyled photos with Google's attribution, or drop them for a consistent look?
4. **Retention/abuse.** The retention cron and moderation holds are built but never exercised. Worth a dry run before real user content lands.

---

## Appendix — reproducing these numbers

Scripts used are in the session scratchpad; each reads `.env.local` and queries with the service-role key, read-only:

- `photo-inventory.mjs` — table counts, per-beach coverage
- `photo-detail.mjs` — licence/source breakdown, live `HEAD` check on image URLs (12/12 resolved, so the URLs are not the problem)
- `photo-curation-audit.mjs` — relevance classification, duplicate detection, post-cull coverage

Counts are as of 2026-08-13 against production.
