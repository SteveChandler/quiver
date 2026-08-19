# AEO Brand Pages — Design Spec

**Date:** 2026-06-23
**Author:** design pass off the 2026-06-22 AEO citation report
**Status:** approved direction; spec for review before implementation
**Deliverable:** brand-vault-aligned design for one net-new page + two existing-page optimizations. Spec-first — no code until this is signed off and a deploy window is chosen.

---

## 1. Scope & origin

The 2026-06-22 AEO routine surfaced three "actions." Local validation corrected two of them:

| Original action | Reality | This spec does |
|---|---|---|
| Build "best surf forecast app" / `/compare` page | That SERP is owned by third-party roundups + a recurring Reddit thread; AI Overviews distrust a brand ranking *itself* #1 in its own "best apps" list — low citability, brand-credibility risk | **Surface A** — a focused head-to-head at `/vs/surfline/free` instead |
| Fix `/learn/how-to-read-surf-conditions` | Exists; reframed 2026-06-15; GSC avg position **84.4** (indexed, buried) | **Surface B** — on-page + linking optimization |
| Create groundswell vs wind swell article | **Already exists** as `/learn/groundswell-vs-wind-swell` | **Surface C** — same optimization pattern |

All three ship in **one deploy** (see §9).

---

## 2. Strategic decision — why `/vs/surfline/free`, not `/best-surf-forecast-app`

- `/vs/surfline` already ranks **#9** for "surfline alternative" (the only product-category query Quiver ranks for) and already lists "best surf forecast app" in its keywords.
- Quiver is **absent** for the free-qualified variant "free surfline alternative" — a clean, non-cannibalizing gap.
- `/vs/surfline/free` is a **child of the ranking cluster** → inherits authority, reciprocal-links to the flagship, avoids overlap with `/free-surf-reports` and `/features`.
- A broad `/best-surf-forecast-app` listicle has a structurally low ceiling and a brand-credibility risk. **Do not build it.**

---

## 3. Copy posture — sell the app

These are marketing pages. Lead with strengths, write with confidence, cut the defensive hedging. Loosened from the earlier draft:
- Frame coverage as a strength — "280+ breaks dialed in," not "regional, not global."
- Claim the personalization boldly — it's the real edge over a regional star rating.
- Drop "where streams are available" and in-sample caveats from headline copy (fine-print footnote at most).
- The "~75% of the time Quiver called your better day" concordance stat is fair game — it already runs on `/forecast-accuracy`.
- Android reads as "coming — join the waitlist" (drives signups), not as a teardown.
- Trial/pricing terms are in flux — keep copy free of a specific trial length or price until confirmed (use "start free," not a number).

Only **two** hard guardrails remain — these protect the business, not correctness:

| Don't | Business risk | Sell this instead |
|---|---|---|
| "Free / no paywall / free forever" | Live RevenueCat subscription, and pricing is being changed right now. Apple rejects/pulls apps whose marketing misstates price, and it invites refund demands. | "Start free" · "Check any break free — no subscription to read a forecast." Matches the existing `/vs/surfline` "$0 today" framing and still reads as a free app. |
| Fabricated head-to-head MAE vs Surfline ("0.30 vs 0.35 m") | An unverifiable performance number against a **named, trademarked** competitor is the one claim that draws a legal complaint. | "Tuned to your break, not a regional average" · "ML-corrected per beach." Confident, defensible, still wins the comparison. |

Everything else: make it sell.

### Social-proof stats — what's real (verified against prod, 2026-06-23)

Lead with the one genuinely big number; do **not** print the early-stage ones — a "84 sessions" counter reads pre-launch and undercuts the app.

| Stat | Prod count today | Use it? |
|---|---|---|
| Forecasts crunched | **~2.5M** (tide + marine; ~2.7M incl. corrected/enhanced) | **Hero counter** — "2,500,000+ forecasts crunched" |
| Beaches covered | 280+ | Yes (already in copy) |
| Live cams | **73** (CA 38 · HI 9 · PNW 10 · East Coast 9 · FL 5 · TX 2) | **Yes** — stat *and* a listed cam wall (73 internal links) |
| Sessions logged | 84 live (1,393 rows, ~1,300 deleted/test) | No count — sell as a live capability |
| "Happy" sessions (4–5★) | 28 | No |
| Alerts / push sent | ~330 digests · 634 push | No count — sell as a live capability |
| Emails sent | 986 sent · 818 delivered · ~60% open | No count (open rate is an internal flex) |

- **Hero stat row** on `/vs/surfline/free`: `2.5M+ forecasts crunched · 280+ breaks · 70+ live cams` in Space Mono, sticker-badged.
- **Cam wall (do build):** 73 live cams grouped by coast, each linking to its beach forecast page — a proof block, 73 location-keyworded internal links, and a "watch any break, free" angle vs Surfline's login wall.
- **Sessions, alerts, emails → market as live *capabilities*, not counts.** Sessions copy: *"The forecast that learns your style — log a session, rate it, and Quiver calls the conditions you actually score."* Alerts: *"Dawn-patrol alerts when your break fires."* Emails: *"Morning digest in your inbox."* Roadmap: *"Vote on what we build next — built in the open."* No numbers — the session count is only 84 live (the 1,393 rows are ~1,300 soft-deleted test rows) and the roadmap has 34 items but only 9 votes, so any of these counts is either tiny or fabricated.
- **Verb:** we *generate* ~2.5M forecast records — "crunched/generated" is exact; "served" is looser (forecast-view events ≈ 88k). Acceptable for marketing.
- **Implementation:** hardcode "2.5M+" on these ISR-static pages (as `/forecast-accuracy` already does) and bump periodically, or wire a live counter to make it tick up. If an alerts/email number is required, the only presentable framing is a bundled "~2,000 alerts & morning emails sent" — but hold it until it's bigger.

---

## 4. Brand-vault treatment (shared across all surfaces)

Source: `Brand-Vault/style-guide/source-docs/`. Web pages, dark-on-cream marketing aesthetic for the comparison page; zine/paper for learn articles.

**Color (hex, not theme vars — these are fixed brand colors):**
- Deep Twilight `#252D6B` (canvas/ink panels) · Charming Orange `#F78E42` (the single brand accent — CTAs/active state only, never decorative) · Pacific Teal `#00D4AA` (YES verdicts + data highlights) · Paradise Gold `#FDB84B` (best-of flags only) · Cream `#F5EEDC` / page cream `#F4EBD8` (marketing surfaces only) · ink `#11100D`.

**Type:**
- **Headlines: Space Grotesk 800–900** (`.q-h-display` is 900, `.q-h1` is 800). *Correction from review: mockups used 700 and read too light — all headlines use the heavier display weight.*
- Eyebrows/labels/data: Space Mono 700, ALL CAPS, letter-spaced. Body: DM Sans 400/500. UI/controls: Inter 500. Zine accents (web only): Caveat (handwritten), Bowlby One (chunky display), Permanent Marker (marker scrawl).

**Sticker treatment (the signature texture):**
- Asymmetric radius `12px 4px 14px 6px` + **hard** offset shadow `2px 3px 0 rgba(0,0,0,0.35)` (no blur). Rotation one of `-3°, -0.8°, +1.4°, +3°` — **never 0°**.
- Sticker color: cream-on-twilight or orange-on-twilight; **never cream-on-orange**.
- **Never repeat the same sticker (`QuiverSticker` key or beach badge) twice on one card/page.** Production uses real PNGs via `components/zine/quiver-sticker.tsx` + `lib/ui/quiver-sticker-assets.ts`.
- Texture is **secondary to data** — low opacity, clipped placement; decorative texture is `aria-hidden`.

**Voice:** chill/reliable/smart, quiet confidence. Verdict words EPIC/GOOD/FAIR/RIDEABLE/MEH and YES/MAYBE/NO ("Go surf!"/"Might work"/"Skip it"). `~` prefix on estimates. Real glyphs (`·` `~` `°` `—`). No emoji. Honor `prefers-reduced-motion` (existing `ScrollReveal` / vs-page animations already do).

---

## 5. Linking requirements — BOTH internal + native-app *(per review)*

### 5a. Internal SEO interlinking (authority flow + AEO)
Mandatory link graph:
- `/vs/surfline` ⇄ `/vs/surfline/free` (reciprocal, both directions).
- Every learn surface → `/vs/surfline` (the converting category page) and → `/forecast-accuracy`.
- `how-to-read-surf-conditions` ⇄ `groundswell-vs-wind-swell` ⇄ `swell-period-explained` ⇄ `how-swell-direction-affects-surf` (topic cluster).
- Each surface → relevant money pages: regional forecast hubs (`/forecast/<region>`, e.g. `/forecast/san-diego`) and **individual beach pages** built via `buildBeachUrl({slug, city, state})` (`/<state>/<city>/<beachSlug>`) — **not** `/forecast/<beachSlug>` (that path is region-only; a beach slug there just 301-redirects).
- `/vs/surfline/free` → a "Keep reading" rail into the learn cluster.
- `/vs/surfline/free` → `/roadmap` (the community-voted roadmap) — links the page from a high-value surface and aids `/roadmap` indexing (its sitemap entry was deferred post-freeze).

### 5b. Native-app links (growth-first installs)
- iOS is **live** (App Store) — `app/app/page.tsx` `IOS_APP_STORE_URL`. Android is **waitlist** — `components/pricing/android-waitlist-cta.tsx` (`founding-offer-surface.tsx` "App Store live" / Android "Coming soon").
- **Comparison page (`/vs/surfline/free`):** a prominent "Get it on your phone" block — App Store badge/link + Android waitlist CTA — placed below the decision cards. Appropriate on a marketing surface.
- **Learn articles:** a **subtle** app line in the footer rail only (e.g. "Quiver runs in any browser — or get the iOS app"). Must **not** compete with the in-article `InlineSignupCta` (primary). App-download is not a pre-auth funnel event, so it doesn't need `useAuth()` gating, but keep it visually secondary so the article keeps one primary conversion action.
- App links are real outbound/store links — not signup CTAs — so they do **not** fire `signup_cta_*` events.

---

## 6. Surface A — `/vs/surfline/free` (net-new head-to-head)

**Target:** "free surfline alternative." **Render:** ISR static (mirror `/vs/surfline` `revalidate = 86400`). Clone the in-file architecture of `app/vs/surfline/page.tsx` (self-contained cream design, Tailwind arbitrary hex — **not** the dark theme or `ZineSurface`). Reuse its `DecisionCard` / `AnimatedFeatureRow` / `ProofRow` / `<details>` FAQ / disclosure components from `app/vs/surfline/animations.tsx`.

**Section order:**
1. **Hero** — eyebrow `QUIVER VS SURFLINE · THE FREE READ`; Space Grotesk **900** H1 "Looking for a free Surfline alternative?"; honest subhead; rotated "Updated Jun 2026" sticker; CTAs "Start free →" (orange) + "Browse forecasts." **Stat row beneath:** `2.5M+ forecasts crunched · 280+ breaks · 70+ live cams` (Space Mono, sticker-badged).
2. **The short answer** (AEO extractable, rotated card) — "Yes — Quiver is a free Surfline alternative for the US, Hawaii, Puerto Rico, and Baja. You read any beach's forecast, tide, and cams without paying. What's paid is the optional personalization that learns your logged sessions."
3. **Comparison in 60 seconds** — table (honest content below).
4. **Decision cards** — "Use Quiver if… / Use Surfline if…" (honest tradeoffs; Surfline wins international + biggest cam network).
5. **Live cam wall** — 70+ free live cams grouped by coast (San Diego · LA · OC · SF · OR · WA · HI · Outer Banks · Maine · FL · TX), each linking to its beach forecast page → 73 internal links + location keywords. Header: "Watch any break, free."
6. **The personal layer + built-with-you** — sessions / alerts / emails as live capabilities (§3 social-proof copy), no counts: "a forecast that learns your style" + "dawn-patrol alerts when your break fires" + "morning email digest." Plus a **"built in the open"** line: "Vote on what we build next — the roadmap is public and yours to shape" → links to `/roadmap`.
7. **Native-app block** (§5b) — App Store + Android waitlist.
8. **FAQ · no fluff** — PAA-shaped (questions below).
9. **Keep reading** rail (learn cluster) + beach quick-links.
10. **Disclosure** — "Surfline™ is a trademark of Surfline\Wavetrak. Quiver is not affiliated. Pricing checked Jun 2026."

**Comparison table content (honest):**

| Feature | Quiver | Surfline |
|---|---|---|
| Price to check a forecast | $0 — no subscription | Premium paywall |
| Coverage | 280+ US · HI · PR · Baja | Global |
| Personalization | Learns your logged sessions (Pro) | Regional star rating |
| Session journal + photos | Free | Premium |
| Live cams | Where streams exist | Large network |
| Public roadmap you vote on | Yes — vote + submit requests | No |

**FAQ (PAA-shaped):** "Is there a free alternative to Surfline?" · "What replaced Magic Seaweed?" · "Which surf forecast app is most accurate?" (answer in safe terms) · "Do I need a subscription to check surf on Quiver?"

---

## 7. Surface B — `/learn/how-to-read-surf-conditions` optimization

No new page. Edit the article object in `lib/data/learn-articles.ts`; renders inside `ZineSurface` (zine `.torn/.polaroid/.notebook/.circled/.label-black/.rot-*` utilities). Position 84.4 → on-page + linking lift.

- **Answer-first lead:** tighten the existing "The Short Answer" to a single clean extractable paragraph (period → direction → wind → tide → height).
- **FAQ → literal "People Also Ask" phrasings:** "What does period mean in a surf report?" · "Is wave height the most important number?" · "How do I read swell direction?" · "What's a good period for surfing?"
- **Key-takeaway cards** per major section (navy chip, teal eyebrow) — already supported by the `keyTakeaway` field.
- **Headlines to Space Grotesk 800.** One sticker max per surface.
- **Links (§5):** internal cluster + 2–4 beach pages; subtle app line in footer.
- `<title>`/H1 single-pass tightening (no iterative SEO churn — one change).

---

## 8. Surface C — `/learn/groundswell-vs-wind-swell` optimization

Same edit path and zine pattern as B. Its comparison framing is naturally AEO-citable:
- Lead with a one-sentence "groundswell vs wind swell" answer.
- Side-by-side trait block (origin, period, power, shape, where to find each).
- PAA FAQ: "What's the difference between groundswell and wind swell?" · "Is groundswell better for surfing?" · "How can I tell which one is in the forecast?"
- Links → `swell-period-explained`, `how-swell-direction-affects-surf`, `how-to-read-surf-conditions`, `/vs/surfline`, relevant beach pages; subtle app line.

---

## 9. Schema, metadata, deploy discipline

- **Metadata:** `buildPageMetadata()` in `lib/seo/meta.ts` for all; self-canonical on `/vs/surfline/free`; dynamic OG (`/api/og/guide`) for learn articles.
- **Structured data:** `/vs/surfline/free` → `SoftwareApplication` + `BreadcrumbList` (mirror the `@graph` on `/vs/surfline`). Learn → `Breadcrumb` + `WebPage` + `Article`. **`FAQSchema` is a deliberate no-op** (Google restricts FAQ rich results) — FAQ renders without JSON-LD; the Q&A *shape* still feeds AI Overviews directly. Don't expect FAQ rich results.
- **Deploy:** the SEO freeze ended 2026-05-14 (lifted). Still honor the one-deploy / 4-week-gap stability discipline — **all three surfaces in a single deploy**, then hold. Add `/vs/surfline/free` to the sitemap in the same deploy.
- **`main` ≠ prod:** these are SEO/Vercel surfaces — verify the deployed commit SHA on the `prod` branch before claiming live.

---

## 10. P1 — fix existing `/vs/surfline` drift (in-scope; `/free` forks from it)

- Refresh the hardcoded pricing-checked date and the hardcoded Surfline price ($69.99–$119.99 drifts).
- Soften "every beach" calibration language (only ~117/280 fully shoaling-calibrated).
- Confirm no curated MAE / concordance is presented as live measured fact.

---

## 11. Open follow-ups (not this deploy)
- Re-run the 30-query AEO audit post-deploy; track citation rate, GSC clicks/CTR for the three URLs, referral sessions.
- "Best AI surf forecast app" angle has **zero local keyword data** — do not build on it without validated demand.
- Reassess whether `/vs/surfline/free` should later expand into a small `/vs/` comparison cluster (e.g. vs Magicseaweed-legacy) once this one proves out.

---

## Visual reference
Two brand mockups were rendered in the originating session: (A) the `/vs/surfline/free` cream head-to-head page, (B) the learn-article zine + AEO pattern. Both demonstrate sticker radius/shadow, single orange accent, and the answer-first content shape described above (with the corrected heavier headline weight).
