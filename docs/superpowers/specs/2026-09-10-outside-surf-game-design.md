# OUTSIDE — browser surf game with Quiver lead capture

Status: approved design, 2026-09-10. Implemented by Codex packets A and B.

## Why

Growth-first. A shareable browser game is a top-of-funnel asset: it gets sent
between friends, it puts real Quiver break names and forecast language in front
of non-users, and it ends on a lead capture that ties the game result to the
real product (the forecast for the break you just surfed).

## Product

Route: `/play` in the Next.js app. Title: **OUTSIDE**. Tagline: "Sets are
coming. Get to the peak." Single page, no auth. Mobile-first (portrait touch)
and desktop (keyboard). Canvas 2D, zero new npm dependencies. Everything in
`lib/play/` (pure TS engine, testable with Jest, no DOM imports) and
`components/play/` (React shell, canvas host, HUD, overlays). Zine tokens from
`app/styles/zine.css` for the shell; the canvas paints its own dawn palette.

Inspiration to actually use, not just cite:

- Kelly Slater's Pro Surfer: trick scoring with variety, commitment, and flow;
  a heat scoreboard with two-decimal scores.
- Point Break: the final break is a once-in-fifty-years swell. Big, slow,
  terrifying, and the whole game builds to it.
- Surf's Up: personality in copy. The judge and the announcer have voice.
- Deep-water aquatic film language: when you wipe out you go under, sound
  muffles, the screen goes navy with bioluminescent particles, and you surface
  gasping. The ocean is beautiful and indifferent.

## Core mechanic

Side-on wave riding. The wave scrolls right-to-left. The surfer holds an
x-position near the left third of the screen and moves vertically on the wave
face between the trough and the lip.

- **Face position** (up/down keys, or touch drag vertical). Higher on the face
  is slower but sets up maneuvers; the bottom of the face is fastest.
- **Pump** (hold action key or touch-hold): converts face drops into speed.
  Pumping high on the face bleeds speed. Speed decays constantly.
- **The section**: a closeout wall advances from the left at a rate set by the
  break. If the section reaches the surfer they are closed out: wipeout. Speed
  is the only thing that keeps you ahead of it. This is the tension.
- **Maneuvers**, triggered by releasing the action key at a face position:
  - Bottom turn (low face, high speed): small score, resets flow, refills a
    little speed.
  - Snap / top turn (top third of the face): medium score, costs speed.
  - Air (release at the lip with speed above a threshold): big score, a landing
    window of a few frames; miss the window and you wipe out.
  - Barrel: when the break "throws" (breaks have a throw cadence), dropping
    into the bottom of the face under the lip enters the tube. Points accrue per
    second in the tube, the multiplier grows, but the section accelerates while
    you are in it. Exit by climbing. Stay too long and it closes out.
- **Flow**: consecutive maneuvers without a bobble build a flow multiplier.
  Repeating the same maneuver back to back halves its value (variety).

## Heat format (progression and failure)

One break = one heat. A heat is a 90 second timer (scaled per break) and up to
three waves. Best two wave scores count, each out of 10.00. The judge scores a
wave on completion from: commitment (peak speed), variety (unique maneuvers),
difficulty (air and barrel weight), and flow (multiplier reached). A wipeout
ends the wave with the score earned so far minus 20 percent, and costs heat
time (the hold-down and paddle back).

Advancing requires a heat total at or above the break threshold. Failing shows
"Didn't make the heat. Needed X.XX." with a retry, and the WSL-style "needs a
Y.YY on the next wave" line during the heat whenever it is relevant.

Breaks, in order, each with a real Quiver beach slug (verify the slug resolves
in the beaches data or SEO page set; fall back to `/beaches` if not):

| Break | Size copy | Section speed | Throw | Threshold |
| --- | --- | --- | --- | --- |
| Cowell's | 2-3 ft, mellow | slow | never | 8.00 |
| Steamer Lane | 4-6 ft, long walls | medium | rare | 11.00 |
| Trestles | 4-6 ft, rippable | medium, ramps | rare | 13.00 |
| Ocean Beach | 6-8 ft, heavy | fast | sometimes | 14.50 |
| Pipeline | 8-10 ft, hollow | fast | often | 16.00 |
| Mavericks | 25 ft, the fifty-year swell | very fast, one wave only, 60 s | once, huge | 9.00 on that single wave |

Progress persists in `localStorage` (`quiver.play.outside.v1`): unlocked
break index, best heat total per break, mute preference. No account required.

## Polish (required)

- Fixed-timestep simulation (60 Hz) with render interpolation; rAF loop; pause
  on tab hidden; `prefers-reduced-motion` disables shake and reduces particles.
- Parallax dawn sky per break (Cowell's pink, Ocean Beach grey-green,
  Pipeline gold, Mavericks slate with rain).
- Spray particles on maneuvers, wake trail, lip foam. Screen shake and a
  low thump on wipeout.
- Wipeout sequence: fade to navy, muffled audio (low-pass), bioluminescent
  particles drifting, a breath meter that fills while the heat timer keeps
  running, then a surface gasp and the paddle-back.
- Score popups per maneuver, judge card that flips in with the two-decimal
  score, announcer line with voice ("That is a proper snap." "Closed out. The
  ocean does not care.").
- Audio is WebAudio synthesised only (no asset files): wave bed noise, pump
  whoosh, maneuver ping, wipeout thump. Mute toggle, remembered. Audio context
  is created only after the first user gesture.
- Touch controls: drag vertically on the left half to move on the face,
  hold the right half to pump, release to trigger the maneuver. One-time
  control primer.
- Loading state, error boundary, no layout shift.

## The reason to send it (viral loop)

**Challenge links.** The wave set for a heat is generated from a seed. When a
heat ends, the result card offers "Send this heat to a friend." It builds
`/play?c=<code>` where the code encodes: break index, seed, heat total, and a
three-character initials tag (optional). Opening a challenge link starts that
exact heat on that exact set, and the HUD shows the challenger's total as a
ghost bar to beat. Beating it shows "You beat STV's 15.20." and offers a
counter-challenge. Uses the Web Share API when available, copy-to-clipboard
otherwise. Share text: "I scored a 15.20 heat at Pipeline in OUTSIDE. Same
set, same waves. Beat it: <url>".

Also a **daily set**: with no challenge code, the seed is derived from the UTC
date, so everyone surfs the same waves today. Show "Today's set" on the start
screen.

## Lead capture (ties to Quiver)

After every heat (pass or fail), below the score card, a capture card:

> **Pipeline is real.** Quiver tells you the morning it is actually working.
> Get this week's Pipeline forecast and the app.

Fields: email, or mobile number (E.164 normalised, US default) when the SMS
flag is on; one consent checkbox ("Send me the forecast for this break and
Quiver updates. Unsubscribe any time."); submit. Copy adapts to the break.

- `POST /api/play/leads` mirrors `app/api/android-beta/leads/route.ts`:
  `withErrorHandler(withBotBlockingAndRateLimit(withAuth(...)))`, zod schema in
  `lib/validation/schemas.ts`, service-role insert.
- New table `play_leads` (migration wrapped in `BEGIN;...COMMIT;`, RLS on, no
  client access): `id`, `email` (nullable, unique where not null), `phone`
  (nullable, unique where not null), `consent_marketing boolean not null`,
  `consented_at timestamptz`, `break_slug`, `heat_total numeric(5,2)`,
  `challenge_code`, `session_id`, `source` default `play_outside`,
  `forecast_email_sent_at timestamptz`, `created_at`. Check constraint: email
  or phone present.
- On email capture, send exactly one requested email via `lib/mailer/`
  (Resend, same shape as the android-beta mailer): the heat result, a link to
  the real break page, and the app download link. This is a user-requested
  single message, not a managed drip; it must not enrol the address in any
  managed campaign and is never retried automatically (see
  `docs/EMAIL_CONTACT_POLICY.md`). Claim with the same update-then-send
  pattern android-beta uses for `instructions_sent_at`.
- On phone capture: store with consent, send nothing. There is no SMS
  provider in the repo. The phone field renders only when
  `NEXT_PUBLIC_PLAY_SMS_ENABLED=true`; the API rejects phone-only submissions
  when `PLAY_SMS_ENABLED` is not `true`. Default off.
- Record `user_events` `play_lead_captured` with `cta_family: play_outside`,
  the break, and the heat total, following the event tracking guards in
  `CLAUDE.md`.
- Start and result screens carry a small "Made by Quiver" link to `/`.

## Testing

- Jest units for the engine: section catches the surfer at zero speed; pump
  raises speed; air outside the landing window wipes out; variety halves a
  repeated maneuver; judge score is deterministic for a scripted ride; a seed
  produces identical sets; challenge code round-trips.
- Jest for the API route: invalid email rejected, consent required, phone
  rejected when the flag is off, duplicate email upserts.
- Playwright smoke (skippable without local Supabase): `/play` renders the
  start screen, a challenge URL shows the ghost score.

## Out of scope

Accounts, global leaderboard, SMS sending, native app port, dynamic OG images.
