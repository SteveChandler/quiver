# Web repo: SEO→install handoff + independent session-prompt email opt-out

Two independent tasks in `/Users/stevenchandler/Desktop/dev/quiver` (Next.js, Yarn).
**One branch per task.** Do not combine them.

---

## Task 1 — Put a device-aware install CTA on the beach sub-pages

**Branch:** `growth/seo-install-handoff` off `main`.

### Why

Google search demand tripled (GSC clicks 328 → 1,050; Google-referred devices 488 → 2,054) while
App Store downloads halved (90 → 44). The pages taking that traffic — beach water-temp and tides
sub-pages — convert well, but only to **web email capture**. Nothing on them asks for an install.

### Where

There is exactly ONE renderer for all of these pages:
`lib/utils/beach-sub-page-utils.tsx` → `renderBeachSubPage()` (starts ~line 140).

It serves every water-temp and tides page across three route families:
- `app/beach/[slug]/{water-temp,tides}/page.tsx`
- `app/[intent]/[city]/[beachSlug]/{water-temp,tides}/page.tsx`
- `app/mexico/[region]/[city]/[beachSlug]/{water-temp,tides}/page.tsx`

It already renders (verified):
- `AlertCaptureCta` inline (~line 279) — email capture, `source={`${ctaSource}-inline`}`
- `StickySignupBar` (~line 324) — email capture, `source={ctaSource}`, `ctaText` from `SUB_PAGE_CTA_CONFIGS`
- `SeoFunnelNextSteps` — internal links

`SUB_PAGE_CTA_CONFIGS` is at ~line 86; `ctaSource = `${ctaConfig.sourcePrefix}-${beachSlug}``.

### The decision, already made — implement exactly this

**iPhone visitors get an install CTA. Everyone else keeps the existing email capture unchanged.**

Do NOT add a third always-on CTA — these pages already have two, and a third would cannibalise a
funnel that currently works.

Use the existing component `components/app-store/native-app-funnel-cta.tsx` (`NativeAppFunnelCta`).
Read it first — it is documented as "the single source of device-aware native routing… prevents CTA
logic from drifting per surface" and takes `source`, `surface`, `placement`. Do not hand-roll store
links; `lib/constants/app-store.ts` owns the URL and CTA text.

Attribution must be source-preserving and distinguishable per page type, so the funnel is readable
later: use a distinct `surface` (e.g. `beach-subpage`) and a `placement` that encodes the sub-page
type (`water-temp` / `tides`) and beach slug. Follow whatever the existing analytics helper expects
rather than inventing a scheme.

Also read `components/app-store/ARCHITECTURE.md` first. Note it records that `IphoneAppBanner`
already renders globally (mounted in `components/providers.tsx:230,262`) but **suppresses itself on
iPhone Safari** so Apple's native smart banner owns that surface. Your CTA must not double up with
the banner on non-Safari iPhone — decide and document the interaction, do not create two competing
install affordances on the same page.

Put it behind an env-var flag, default OFF, so it can be enabled and reverted without a deploy.

### Done when

`yarn typecheck` and `yarn lint` clean, `yarn test:unit` passes, and you can explain in the PR body
which visitors see which CTA on which device/browser.

---

## Task 2 — Let users mute session-prompt emails without killing forecast alerts

**Branch:** `fix/session-prompt-email-optout` off `main`.

### Why — a real user, twice

A founding-crew user (Van) asked on 2026-07-25: *"Is there anyway I can turn off this type of
notification? Without deleting all notifications? It seems kind of random to me that I get these
when I clearly didn't go surfing."* The founder confirmed on 2026-07-30: *"I also confirmed that the
current settings do not let you turn off only those emails while keeping forecast alerts on. That is
a gap on my end, not something you missed."*

He is still receiving them.

### Where

- Sender: `app/api/cron/session-prompt-email/route.ts`. Verified: the only recipient gating is
  `filterSuppressedRecipients` from `lib/email/suppression` (global suppression), and the
  unsubscribe URL is a bare `${baseUrl}/settings`. There is no per-type preference.
- Email type constants: `lib/email/email-types.ts`.
- Logging: `lib/services/email-logging-service.ts`.

### What to build

A per-type preference so a user can disable **session-prompt** emails while keeping forecast/condition
alert emails. Investigate how existing notification/email preferences are stored before designing —
do not invent a parallel system if one exists. If a migration is needed, follow
`docs/MIGRATION_SAFETY.md` and wrap in `BEGIN; … COMMIT;`.

Requirements:
- The cron must honour the preference at send time.
- Settings UI must expose it, worded so it is obvious which emails it controls.
- The unsubscribe link in the session-prompt email should land somewhere that actually turns *this*
  email off — today it dumps the user on a generic settings page.
- Default: session-prompt emails stay ON for existing users. This fixes control, not delivery policy.

### Done when

`yarn typecheck`, `yarn lint`, `yarn test:unit` pass, with a test proving the cron skips a user who
has opted out and still sends to one who hasn't.

---

## Hard constraints (both tasks)

- **Do NOT push. Do NOT deploy. Do NOT merge.** Commit to the named branches and stop.
- **Do NOT run any migration against production.** Production database changes need Steven's
  explicit approval. Write the migration file; do not apply it remotely.
- **Do NOT send any email**, and do not trigger the cron route against production.
- Read `CLAUDE.md` and the nearest `ARCHITECTURE.md` before editing a directory.
- Conventional commits, one logical change per commit.
- If a task turns out to be materially bigger than described, stop and write findings rather than
  half-implementing it.
