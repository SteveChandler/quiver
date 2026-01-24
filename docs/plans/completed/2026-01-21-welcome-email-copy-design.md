# Welcome Email Copy Redesign

**Date:** 2026-01-21
**Status:** Approved

## Problem

The current welcome email copy has two issues:

1. **Tone feels off** — Too salesy/pitch-y, reads like marketing copy, feels generic (could be any app)
2. **Value doesn't land** — Feels flat, lacks personality and energy

## Goal

Rewrite the email with a "chill surfer friend" tone — like a buddy texting about conditions, informal and real.

## New Email Copy

**Subject:** You're in

---

You know that 5am moment — alarm goes off, and you're still not sure if it's actually worth it.

Quiver just tells you. Yes or no. Best window. That's it.

To dial it in, I just need a few things:

**When do you usually surf?**
[Dawn patrol] [After work] [Weekends]

**What's your level?**
[Beginner] [Intermediate] [Advanced]

**How often should I email?**
[Daily] [Only when it's good]

**Home break?**
[Set it here →]

Or just [check out the app →]

— Steven

---

## Changes from Current Version

| Aspect | Before | After |
|--------|--------|-------|
| Opening | "Hey — quick intro to Quiver" + feature list | Relatable 5am moment hook |
| Tone | Marketing/pitch-y | Conversational, first-person |
| Value prop | Bullet list of features | One punchy line: "Yes or no. Best window. That's it." |
| Ask framing | Formal numbered list | Conversational "I just need a few things" |
| New element | — | "Or just check out the app" escape hatch |
| Sign-off | "— Steven @ Quiver" | "— Steven" |

## Files to Update

1. `lib/email/templates/welcome-email-html.ts` — Canonical source
2. `supabase/functions/on-auth-user-created/index.ts` — Edge Function copy (sync with lib)

## Bug Fix (Already Applied)

During this session, we also fixed a URL bug where `APP_URL` had trailing spaces causing broken links (`quiversurf.app%20%20/prefs/set`). Added defensive `.trim()` calls in:

- `supabase/functions/on-auth-user-created/index.ts` (line 8, APP_URL)
- `lib/email/templates/welcome-email-html.ts` (generateWelcomeEmailHtml, generateWelcomeEmailText)

**Note:** The `APP_URL` environment variable in Supabase dashboard still needs trailing spaces removed.

## Implementation Notes

- Keep existing button styling (BUTTON_STYLE constant)
- Keep existing color scheme (COLORS constant)
- Add new link for "check out the app" pointing to baseUrl (home page)
- Remove emoji from h1 (current: "Welcome to Quiver")
- Subject line can be revisited separately
