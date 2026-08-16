---
phase: 11
slug: pbsc-event-route-deploy-and-qr-verification
status: approved
shadcn_initialized: true
preset: default-neutral-css-variables
created: 2026-05-26
reviewed_at: 2026-05-26
---

# Phase 11 - UI Design Contract

Visual and interaction contract for the PBSC event scan route. This contract
keeps the existing event-page zine/sponsor-table look, but locks the CTA,
device-branching, copy, color, and verification expectations before planning.

## Source Decisions

| Source | Locked UI Decisions Used |
|--------|--------------------------|
| `11-CONTEXT.md` | iOS visitors get App Store primary, all non-iOS visitors get Android waitlist primary, web fallback removed, copy must not overpromise Tourmaline/web access |
| `11-RESEARCH.md` | Server user-agent split is preferred, reuse `IosAppStoreCta` and `AndroidWaitlistCta`, production `www` proof is required |
| `components.json` | shadcn config exists, Tailwind CSS variables enabled, icon library is lucide |
| `docs/STYLE_GUIDE.md` | Deep Twilight background, Space Grotesk headings, DM Sans body, Space Mono labels, semantic text tiers, no arbitrary shadows/z-index |

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn-style local component system |
| Preset | `default`, `neutral`, CSS variables |
| Component library | Radix primitives through `components/ui`; existing PBSC CTA primitives for this phase |
| Icon library | lucide |
| Font | DM Sans body, Space Grotesk headings, Space Mono event labels |

Implementation constraints:

- Reuse `components/app-store/ios-app-store-cta.tsx` for App Store actions.
- Reuse `components/pricing/android-waitlist-cta.tsx` for non-iOS actions.
- Do not add third-party component registries or new visual libraries.
- Do not add a landing-page redesign, pricing surface, checkout UI, or broader
  campaign rebuild.

## Interaction And Visual Hierarchy

Primary focal point:

- The first viewport centers on the PBSC event message and the OS-specific
  primary CTA.
- The hero photo remains supporting context, not the action target.
- The event date/location row stays secondary and below the CTA.

CTA hierarchy:

| Visitor | Primary Action | Secondary Action |
|---------|----------------|------------------|
| iOS | App Store CTA: `Open Quiver on iPhone` | No web fallback |
| Android | Android waitlist CTA: `Join Android waitlist` | No web fallback |
| Desktop/tablet/unknown non-iOS | Android waitlist CTA: `Join Android waitlist` | No web fallback |

State behavior:

- Server-render the correct primary action from request user agent.
- Do not render the wrong CTA first and swap it after hydration.
- If a client fallback is ever used, it must render no primary CTA until the OS
  branch is known.
- Anonymous Android waitlist clicks open signup and return to `/pbsc`.
- Signed-in Android waitlist clicks save immediately and show a confirmation
  label in place.

Accessibility:

- Primary CTAs must have visible text, not icon-only affordances.
- CTA focus rings must be visible on the Deep Twilight and Warm Paper surfaces.
- Event label and metadata text must maintain readable contrast.

## Spacing Scale

Declared values:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, tight inline metadata |
| sm | 8px | CTA icon gaps, badge padding |
| md | 16px | Default card padding, mobile section inner spacing |
| lg | 24px | CTA group gaps, compact section padding |
| xl | 32px | Hero content gaps, desktop card padding |
| 2xl | 48px | Major section breaks, minimum CTA touch height |
| 3xl | 64px | Hero top/bottom section spacing cap |

Exceptions: none.

## Typography

Use exactly these four sizes and two weights for new or changed PBSC route text.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 12px | 700 | 1.2 |
| Body | 16px | 400 | 1.5 |
| Heading | 24px | 700 | 1.2 |
| Display | 56px | 700 | 1.0 |

Typography constraints:

- Display text is reserved for the hero headline only.
- Label text uses Space Mono only for event labels, badges, and metadata.
- Body copy uses DM Sans.
- Headings and CTAs use Space Grotesk.
- Do not introduce additional font weights for this phase.

## Color

Use a 60/30/10 split for changed PBSC route surfaces.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#252D6B` | Page and hero background |
| Secondary (30%) | `#F4EBD8` | Warm paper content band and high-contrast panels |
| Accent (10%) | `#9E5010` | Primary CTA background, CTA focus ring, CTA icon accent |
| Destructive | `#FF5C5C` | Error-only states; no destructive actions planned |

Accent reserved for:

- OS-specific primary CTA
- CTA focus ring
- CTA arrow/icon accent
- Waitlist saved/error status affordance when needed

Color constraints:

- Do not use accent as the default color for every link or control.
- Existing decorative PBSC art colors may remain for non-interactive labels,
  texture, and photo framing, but they must not become new CTA colors.
- Use `text-white`, `text-high`, and `text-medium` tiers on dark surfaces.
- On Warm Paper surfaces, use dark text from the existing route palette.

## Copywriting Contract

| Element | Copy |
|---------|------|
| iOS primary CTA | `Open Quiver on iPhone` |
| Non-iOS primary CTA | `Join Android waitlist` |
| Signed-in waitlist confirmation | `Android updates are set` |
| Hero headline | `Tag your best days. Keep them on repeat.` |
| Hero body | `Quiver is a surf forecast that explains the call, remembers your sessions, and gets sharper when surfers tell it what actually happened.` |
| Non-iOS helper copy | `Android is not public yet. Join the waitlist and we will route updates back to this event page.` |
| Empty state heading | Not applicable; the PBSC route has no data-empty state |
| Empty state body | Not applicable; static route content should render without user data |
| Error state | `Could not save Android waitlist intent. Try again.` |
| Destructive confirmation | None; no destructive actions in scope |

Copy constraints:

- Do not keep `Use Quiver on web` on the PBSC scan route.
- Do not promise immediate Android install access.
- Do not imply desktop users can open the full product from this QR route.
- Review any printed or page copy that says `Open Tourmaline on Quiver` or
  `Scan Tourmaline live` before print approval.

## Responsive Contract

Mobile:

- Single-column hero.
- CTA group stacks vertically.
- Minimum CTA height: 48px.
- Hero photo appears below or after the copy without covering CTA text.

Tablet and desktop:

- Two-column hero can remain.
- Copy column remains the action leader.
- CTA group may sit horizontally only when both labels fit without wrapping.
- No button text may overflow its parent.

Browser proof required:

- iPhone user agent: App Store primary visible, Android waitlist primary absent,
  web fallback absent.
- Android user agent: Android waitlist primary visible, App Store primary
  absent, web fallback absent.
- Desktop/default user agent: Android waitlist primary visible, web fallback
  absent.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official/local | Existing `components/ui` primitives only; no new blocks required | Existing `components.json` present; no third-party registry introduced |
| third-party | none | not applicable |

Notes:

- `npx shadcn info` could not run in this environment because the current
  `shadcn@4.8.0` dependency chain requires Node `^22.22.2` while local Node is
  `v22.22.0`.
- The repository-level `components.json`, `tailwind.config.ts`, and
  `components/ui/*` files are sufficient to confirm the existing local design
  system for this phase.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

Approval: approved 2026-05-26

## UI-SPEC COMPLETE
