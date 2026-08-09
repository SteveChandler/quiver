# CTA Copy Overhaul

## Context

Signup CTA click rate is 0.50% (11 clicks / 2,218 views over 7 days). Investigation revealed two problems:

1. **Inflated denominator**: Multiple CTA components fire `signup_cta_view` per session (homepage fires 5). Real session-level click rate is ~1.6% — still below the 2% healthy floor.
2. **Copy-intent mismatch**: The dominant CTA copy ("Join Free" / "Log sessions, save your spots") pitches session logging to users who came to check conditions. The copy doesn't finish the sentence the user already started.

The best-performing CTAs in the system already follow a pattern: they name the specific thing the user was doing and offer to extend it. Examples: "Know when it's firing at {beachName}", "Find out by 5 AM if it's worth it." The underperforming CTAs introduce new concepts ("surf call", "save your spots") the user wasn't thinking about.

Data finding: `/ca` (395 anonymous visitors/week) is a pass-through — 99% click into a beach detail page. No CTA needed on `/ca` itself; the beach detail page is where conversion happens.

## Design

### Universal value prop: Alerts

"Alerts" is the CTA concept that works across all surfaces — beach pages, tide pages, tools, map. Every visitor wants to know when conditions are right. This replaces the fragmented mix of "Join Free", "See your forecast", and "Log sessions."

### Copy Map

Changes only — everything not listed below stays as-is (tide, dawn-patrol, water-temp, beginner search referral CTAs are already good).

#### 1. Navbar (all public pages)

**File**: `components/landing-page/navbar.tsx`

| | Before | After |
|---|--------|-------|
| Desktop CTA button | "See your forecast" | "Get alerts" |
| Mobile CTA button | "See your forecast" | "Get alerts" |
| Modal context title | "See Your Forecast" | "Get Alerts" |
| Modal context description | "Conditions explained clearly in 30 seconds" | "Know when conditions fire at your spots" |

#### 2. Beach detail StickySignupBar (default, non-search-referral)

**File**: `components/ui/sticky-signup-bar.tsx` (default props) + beach detail page instantiation

| | Before | After |
|---|--------|-------|
| ctaText | "Join Free" | "See the full forecast" |
| supportingText | "Log sessions, save your spots" | "Swell, wind, tide — what it means for {beachName}" |

The search referral variant ("Get Alerts" / "Know when it's firing at {beachName}") stays unchanged.

#### 3. StickySignupBar global defaults

**File**: `components/ui/sticky-signup-bar.tsx`

| | Before | After |
|---|--------|-------|
| Default ctaText | "Join Free" | "Get alerts" |
| Default supportingText | "Log sessions, save your spots" | "Know when conditions fire at your spots" |

This catches any surface that uses StickySignupBar without overriding props.

#### 4. Intent pages (generic default)

**File**: `app/[intent]/[city]/page.tsx` or wherever the default StickySignupBar is configured for intent pages

| | Before | After |
|---|--------|-------|
| ctaText | "Join Free" | "Get condition alerts" |
| supportingText | "Log sessions, save your spots" | "Know before you drive" |

Intent-specific overrides (tide, dawn-patrol, water-temp, beginner) remain unchanged.

#### 5. Tools pages

**File**: Tools page components (swell-analyzer, tide-clock)

Currently no CTA exists on tool pages. Add a `StickySignupBar` with:

| Prop | Value |
|------|-------|
| ctaText | "Get swell alerts" |
| supportingText | "We'll ping you when a swell like this is incoming" |
| source | `tools-{toolSlug}` |

#### 6. Map page (no beach selected)

**File**: `components/map/map-signup-prompt.tsx`

| | Before | After |
|---|--------|-------|
| Headline | "Save your favorite spots" | "Get alerts" |
| Description | "Create a free account to save spots and see conditions explained clearly." | "Know when conditions fire at your spots" |
| Modal context title | "Join the Quiver crew" | "Get Alerts" |
| Modal context description | "Sign up to save spots, track conditions, and connect with local surfers." | "We'll let you know when conditions are right at your spots." |

Map page with beach selected stays unchanged ("Get alerts for {beachName}").

### What's NOT changing

These CTAs are already well-calibrated and should not be touched:

- **BeachHeroCompact teaser** — dynamic, data-driven copy ("5ft swell hits Thursday"). Best CTA in the system.
- **Beach detail search referral** — "Get Alerts" / "Know when it's firing at {beachName}"
- **Tide pages** — "Get Tide Alerts" / "Know when the tide is right in {cityName}"
- **Dawn patrol** — "Dawn Patrol Alerts" / "Find out by 5 AM if it's worth it"
- **Water temp** — "Wetsuit Alert" / "Get gear recs for {cityName}"
- **Beginner** — "Mellow Session Alerts" / "Get notified when conditions are gentle"
- **Homepage hero button** — "Check your forecast" (17.65% CTR, working)
- **Homepage CTASection** — "See today's conditions at your beach" (bottom of page)
- **PublicContentGate** — parent-provided copy, varies by context
- **AlertCaptureCta** — context-driven alert copy, already good

### CTA density reduction (separate task)

The agents recommended reducing CTA views from ~5 per homepage session to ~1-2. This is a separate change from the copy overhaul — tracked separately. The copy changes here should be implemented first so we can measure the impact of better copy independently from density reduction.

## Verification

1. Run the app locally, visit each surface as an anonymous user:
   - Homepage: hero says "Check your forecast", navbar says "Get alerts"
   - Beach detail page (`/ca/san-diego/blacks`): StickySignupBar says "See the full forecast" with beach-specific supporting text
   - Tide page (`/tide/santa-cruz`): StickySignupBar says "Get Tide Alerts" (unchanged)
   - Tools page (`/tools/swell-analyzer`): StickySignupBar says "Get swell alerts"
   - Map page (no beach): prompt says "Get alerts"
2. Check that auth modal context messages match updated copy
3. Check that `signup_cta_view` events fire with correct source strings
4. Verify mobile StickySignupBar appears after scroll on beach detail and tools pages
5. Run `npx eslint --max-warnings=0` on changed files
6. Run `yarn typecheck`
