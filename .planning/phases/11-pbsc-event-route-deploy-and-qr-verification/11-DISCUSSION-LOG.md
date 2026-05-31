# Phase 11: PBSC Event Route Deploy And QR Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 11-pbsc-event-route-deploy-and-qr-verification
**Areas discussed:** QR scan destination outcome

---

## QR Scan Destination Outcome

| Option | Description | Selected |
|--------|-------------|----------|
| App Store first | Keep the current iPhone-first Quiver open path, with web as fallback. | |
| Tourmaline forecast first | Make the scan feel like "open Tourmaline live," then offer App Store from there. | |
| Split by device | iPhone visitors get App Store first; everyone else gets web/Tourmaline first. | Partial |
| Other | User clarified that everyone else should go to the Android waitlist. | ✓ |

**User's choice:** Split by device, with iOS/App Store first and all non-iOS visitors routed to Android waitlist.
**Notes:** User clarified: "everyone else should go to the android waitlist".

---

## Android Waitlist Placement

| Option | Description | Selected |
|--------|-------------|----------|
| In-page CTA | Use the existing `AndroidWaitlistCta` on the PBSC page so the scan stays event-specific. | ✓ |
| Route to `/plans` | Send non-iOS visitors to the existing plans/pricing surface where Android waitlist already exists. | |
| Both | Primary in-page Android waitlist CTA, with `/plans` as a secondary link. | |
| Other | Freeform flow. | |

**User's choice:** In-page CTA.
**Notes:** `/pbsc` should use the existing waitlist action/pending-intent path instead of sending non-iOS visitors away first.

---

## Non-iOS Device Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All non-iOS gets Android waitlist | Desktop, tablet, Android phone, and other non-iOS visitors get Android waitlist primary. | ✓ |
| Android phones only | Desktop/tablet get web/Tourmaline fallback first. | |
| Desktop/tablet get both | Android waitlist primary, web/Tourmaline secondary. | |
| Other | Freeform device split. | |

**User's choice:** All non-iOS gets Android waitlist.
**Notes:** The scan path should be simple: iOS/App Store, non-iOS/Android waitlist.

---

## Secondary Web Access

| Option | Description | Selected |
|--------|-------------|----------|
| Keep web fallback | Keep a secondary "Use Quiver on web" link for anyone who wants to inspect the app immediately. | |
| Remove web fallback | Keep the page focused only on App Store or Android waitlist. | ✓ |
| Keep only for non-iOS | Show Android waitlist primary and web fallback secondary on non-iOS, but iOS gets App Store only. | |
| Other | Freeform secondary action behavior. | |

**User's choice:** Remove web fallback.
**Notes:** `/pbsc` should be focused on OS-specific conversion only.

---

## the agent's Discretion

- Production deploy boundary, verification proof depth, and exact PBSC copy
  consistency were not discussed in detail. Planner should choose conservative
  defaults, preserve approval gates, and avoid unrelated copy rewrites.

## Deferred Ideas

None.
