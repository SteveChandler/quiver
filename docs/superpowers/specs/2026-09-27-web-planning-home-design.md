# Web planning home: design

- **Date:** 2026-09-27
- **Status:** Draft, awaiting Steven's review
- **Surface:** signed-in `/` on web (`components/oracle/`)
- **Mockups:** [page](2026-09-27-web-planning-home/desktop.jpg), [actions](2026-09-27-web-planning-home/actions.jpg), [watch ticket](2026-09-27-web-planning-home/ticket.jpg). Photos are repo placeholders and numbers are illustrative.

## Why

Steven's read of today's signed-in web home: it names one beach and stops. You "can't really plan anything", and asking to "log a session" makes no sense on the website. People open the web to plan where and when to surf, at every horizon: tomorrow morning, this week or weekend, and trips. They want to get what they're looking at onto their phone, send it to friends, and be told if it's on.

## Goals

1. The signed-in web home answers "where and when do I surf" for today, the next 7 days, and a chosen area.
2. **Visual first.** Photos, cams and the swell field are the interface; numbers are captions. It's built for surfers who plan by looking, not by reading tables.
3. Every action says what it does. Two buttons, each with a one-line subtitle.
4. The page fills itself: once you watch a window, your own plans sit at the top.

## Non-goals

- Session logging on the home page. The only log prompt left is "How was it?" on a watch ticket after its window ends.
- "Looks like your good days", which matches a forecast to a past session. It's in the mockup as a later idea and is not built here.
- A spots × days comparison grid. Possible later as a toggle.
- Changing the app's Pro gate or renaming anything in the app.
- Photo curation and fixing broken photos. These are prerequisites, tracked separately (see [Photos](#photos)).

## Decisions made in the brainstorm

| Topic | Decision |
|---|---|
| Layout | A strip of 7 day posters drives a full-width hero. "Other spots that day" appear below as photo tiles. |
| Spots in the week | Everything in the user's drive range. Users can hide any spot. |
| Actions | Two buttons: **Watch *(day) (window)*** and **Share this window**. "Send to my phone" and "Wake me" are part of Watch. |
| Name | "Watch" on both web and app, matching the app's existing Watch button. |
| Free vs Pro | The web shows the full 7 days free. This deliberately differs from the app, where `FREE_WEEK_SCOUT_DAY_LIMIT = 2` in `quiver-native/src/lib/free-tier-gate.ts`. |
| Today's call | Unchanged. It comes from `/api/surf/discover`, like the app's home screen, and keeps its hold and recheck behavior. |

## Page, top to bottom

On desktop it's a single column, max width about 1240px. On mobile the same order stacks and the day strip scrolls sideways.

1. **Area bar.** "Planning from *Ocean Beach* · 45 min drive ▾", with *Use my location* and a search box, "Plan a trip somewhere else…". Picking another beach re-centers everything below, which is how trips work.
2. **Watching.** Up to 3 upcoming watch tickets with a link to all of them; see [Watch](#watch). Hidden when there are none.
3. **Hero.** A full-width media card for the selected day's best spot.
   - **Viewpoints:** keeps Swell, Sat, Photo and Cam.
   - **Overlays:** day and window, beach name, the call word ("Good · Worth planning"), a one-line reason, four condition tiles (size, swell period and direction, wind, tide), and the day's morning, midday and evening windows as a strip along the bottom.
4. **Action row.** Watch and Share, each with a subtitle.
5. **The week.**
   - **The swell line:** a drawn line of wave size across the 7 days, labeled in feet.
   - **The day posters:** each is a photo with the day, the call stamped on it, the spot name and the size.
   - **Selected day:** its poster is taped and lifted.
   - **The 5th poster onward, and any "early" confidence band:** faded, with an **Early** tag.
   - **Days with nothing worth surfing:** show **Skip** and the reason, including a hazard hold.
6. **Other spots *(day)*.** Photo tiles showing the call, the spot name, the window, the drive time and the size. A cam badge appears when the spot has a cam. The ⋯ menu offers *Hide from my week* and *Open forecast*. The header reads "14 in your drive range · 2 hidden".
7. **Activity.** The existing feed, moved to the bottom.

The ask card (`contextual-cta.tsx`) goes away on web:
- **"Set your home beach":** becomes the first-run step (see [States](#states)).
- **"Log a session":** survives only as "How was it?" on a finished watch.
- **"Invite a friend":** leaves the home page.

## Data

### Today

The hero for Today and the Today poster read the existing canonical decision from `/api/surf/discover` through `useOracleData`. Nothing changes there: projection, holds, recheck on tab return, and the `home_call_rendered` metric all stay.

### The week

- **One request:** a single `POST /api/surf/week-scout` with `candidateScope: { kind: 'complete-radius' }`, `dayCount: 7`, the browser's timezone, and today's local date.
- **Centering without GPS:** complete-radius needs a location snapshot under 15 minutes old, or map bounds. The web home never asks for GPS on its own. Add an **optional, additive** `centerBeachId` (uuid) to `CompleteRadiusScopeSchema`:
  - **What the server does with it:** loads that beach's `lat`/`lon`, uses it as the candidate origin, and uses `driveRadiusMiles(profiles.max_drive_minutes)` as the radius.
  - **Distances:** `distanceMiles` stays null unless there's a fresh user location, the same rule the route already applies to map-centered scopes.
  - **Defaults and trips:** it defaults to the home beach. *Change area* sends a different beach.
  - **The app:** it never sends this field, so it's unaffected.
- **Use my location:** follows whatever path the app uses to write `user_location_snapshots`, then sends no `centerBeachId`. The implementation plan must confirm that write path before building this.
- **Days 2–7:** each day's poster is that day's `bestDayWindow`. When one of these days is selected, the hero's Swell view draws that window's `forecast.components` entry `swell_1`, the primary swell only, as today's hero does.
- **Other spots:** the selected window's `rankedSpots`, minus hidden spots and minus the hero spot.

### Wording

Map week-scout's verdict to the canonical one: `worth_it → go`, `maybe → maybe`, `skip → no`. Pass that verdict and the window's `conditionScore` through `getCanonicalVerdictCall` (`components/forecast/score-band-call.ts`). Every day then reads Epic, Good, Fair, Rideable or Meh/Skip. Never show `worth_it`.

### Confidence

Map the window's `confidence` to the app's bands (`quiver-native/src/lib/week-scout/confidence-band.ts`): strong ≥70, workable ≥40, otherwise early. A poster is faded and tagged *Early* when its band is early or it's 4 or more days out (the 5th poster onward).

### Hidden spots

- **Reading:** load `user_beach_exclusions` for the user (RLS covers own select, insert and delete) and filter in the browser, as the app does.
- **Hiding and unhiding:** an authenticated server action inserts or deletes the row. The list syncs with the app because it's the same table.

### Pictures for posters and tiles

The week-scout response has no images, so don't change that contract. Add a server action `getBeachVisuals(beachIds)` that returns one photo and one cam thumbnail per beach:
- **Photo:** the newest approved, non-deleted `beach_photos` row, the same rule as `enrichWithPhotos`.
- **Cam thumbnail:** from `beach_sources.thumbnail_url` / `camera_url`.

Fallback order for every poster and tile: **real photo of that beach → cam thumbnail → Swell view**. The Swell view works for any spot because it needs only the primary swell. Never a stock ocean photo; this keeps the existing photo rule.

## Watch

### Button

"**Watch Sunday dawn**", with the subtitle "Shows here and on your phone. We recheck overnight and tell you if it changes."

### Mechanism

Watch reuses the app's watched call. There's no new table, and `saved_windows` is not used; it's the older, email-only table.

- **Creating a watch:** `POST /api/alerts/rules` with `preset_type: 'watched_call'` and `conditions.watched_call`, built the way `quiver-native/src/components/watch-spot-button.tsx` builds it. The object must pass `isWatchedCall` in `lib/alerts/condition-validation.ts`. Required fields:
  - `version: 1` and the ids `recommendationId`, `beachId` and `dedupeKey` (which starts with `watched-call.v1:`)
  - the window times `windowStart`, `windowEnd` and `forecastAt`
  - the labels `sourceSurface`, `mode`, `recommendationState` and `reasonType`
  - the scores `conditionScore`, `personalMatchScore` and `overallScore`
- **Allowed-value additions:** today `sourceSurface` must be one of `home_hero`, `home_also_worth_it`, `explore_for_you`, `beach_detail` or `surf_window_adjacent`, and `mode` must be `now`, `best`, `my-spots` or `beach-detail`.
  - **Today's hero:** watches from it use `home_hero` / `now` or `best`.
  - **Days 2–7 and other spots:** watches from these need a new `sourceSurface: 'web_week'`, which is an additive change to the validator.
  - **Before shipping:** confirm the app's alert center and `use-alert-rules` render a rule with an unknown `sourceSurface`.
- **Which ids to send:**
  - **Today:** the canonical recommendation id.
  - **Week-scout windows:** the plan must pin down which ids they can supply. Native matches `sessionDecision.selection.beachId` to reuse `decisionId`; otherwise it uses the window id.
- **Rechecks:** `condition-alert-evaluate` runs daily at 09:00 UTC (2am PT) and sends `watched_call_update` (push and in-app) in four categories:
  - `still_on`
  - `call_changed`
  - `better_nearby`
  - `post_window`
- **Delivery:** runs hourly and respects quiet hours. The app already opens the exact window when the push is tapped.
- **Notification rules:** the April consolidation rule (informational pushes go into one 6am digest) does not apply. `watched_call_update` is its own type and keeps its push channel.

### Tickets under "Watching"

- **Which ones:** rules from `GET /api/alerts/rules` with `preset_type = 'watched_call'` and `windowEnd` later than 24 hours ago, sorted by `windowStart`.
- **Status:** the newest `watched_call_update` for each rule from `/api/alerts/activity`. The ticket pill and the phone push always say the same thing because they come from the same update.

| State | Source | Ticket shows |
|---|---|---|
| Watching | no update yet | "Watching · first recheck tonight" |
| Still on | `still_on` | teal pill, size, one line |
| Changed | `call_changed` | amber "Dropped to fair" or red "Called off", and why |
| Better nearby | `better_nearby` | "La Jolla Shores is Good in the same window" and *Watch this instead*, which creates the new watch and removes the old one |
| Window over | `post_window` | faded, "How was it?" linking to session logging; drops off the home page after 24h |

Any day that has a watch gets a pin on its poster in the week strip.

### No app installed

The watch still saves and shows on the web. The ticket offers a QR code that opens the app handoff (`buildAppHandoffUrl`).

## Share

- **The link:** "Share this window" uses the link the app already builds: `/app/spot/<slug>?window=<forecastAt>` from `lib/share/forecast-window-share.ts`. Its preview image comes from `/api/og/forecast-window`, and hazard holds are already handled. On mobile it opens the system share sheet through `components/share/share-sheet.tsx`; on desktop it copies the link.
- **Page upgrade (in scope):** `app/app/spot/[slug]/page.tsx` today is mostly an "open in the app" page. Friends without the app should first see the window itself: photo, call, size and time. The app offer moves below. If the call for that window has changed since it was shared, the page says so.

## Photos

Findings from 2026-09-27, read-only on production:

- **Coverage in users' drive ranges:** high on the West Coast. San Diego 90%, Orange County 87%, Los Angeles 84%. It's low on the East Coast and in Hawaii: Long Island 27%, Jersey Shore 18%, Oahu 46%.
- **Quality of the photo actually shown**, for the 71 beaches real users most often choose as home or favorite:
  - about 36 usable
  - 14 weak: no surf visible, or a structure, black-and-white, or grey sky
  - 11 wrong: seagulls, an aquarium fish tank, a park tree, the wrong place
  - 7 missing
  - 3 broken
- **Broken Openverse images:** 11 of the 97 displayed Openverse photos return HTTP 424, including Windansea, San Elijo and Beacons. This is tracked as a separate task.
- **Community photos:** 1 in total, so they don't help yet.

**Before launch:** hand-curate the photos for those ~70 beaches. They cover most users, and the rest fall back to cam, then Swell.

## States

- **No home beach** (138 of 508 real users, 27%): the page opens with one step, "Where do you surf?", offering search and *Use my location*. There's no week until it's answered.
- **Loading:**
  - The hero keeps its existing loading states ("Checking the buoy", "Updating surf call").
  - The day posters and spot tiles render as skeletons in their final size, so nothing jumps.
- **Week-scout fails** (including its 503 for incomplete coverage): the strip says "Couldn't load the week" with a Retry button. The Today hero keeps working. No made-up days.
- **No spots in range, or all hidden:** "Nothing in your drive range", with links to change area or unhide spots.
- **Reduced motion:** the swell line and the hero's Swell view show a still frame.

## Analytics

Keep emitters, server allowlists, TypeScript unions and database constraints aligned (`soul.md`).

- **Reused:** `watched_call_created` and `watched_call_already_exists`, with `sourceSurface` identifying web, plus the existing share-link open tracking on `/app/spot`.
- **New, client, consent-gated:**
  - `home_week_day_selected` (day offset)
  - `home_spot_hidden` / `home_spot_unhidden`
  - `home_window_shared` (day offset, `is_today`)

## Success measure

The status stays shipped but unvalidated until these move. Capture the baseline for the 4 weeks before launch, measure 4 weeks after, and look at monthly numbers rather than week over week because the sample is small.

- Signed-in web users who return to `/` within 7 days.
- Watches created from web per signed-in web user.
- Opens of shared window links from web.

## Tests

Mocked unit tests only; no paid APIs or live Supabase.

- week-scout verdict and score → call word, including hold and skip days
- confidence → Early fading
- the poster and tile fallback order
- filtering out hidden spots, and hide/unhide
- each watch update category → ticket state, including roll-off after 24h
- building the watch payload so it passes `isWatchedCall`
- the `centerBeachId` path in the week-scout route: accepted, sets the origin, rejects an unknown beach, leaves other requests unchanged

Plus one opt-in end-to-end run of the page against dev.

Update `components/oracle/ARCHITECTURE.md` in the same change.

## Check before the implementation plan

1. Is `FORECAST_ALERT_DELIVERY_ENABLED` on in production? Do `watched_call_update` pushes actually send? The copy promises "on your phone too", and that's only honest if they do.
2. How often does week-scout's pick for today differ from discover's canonical pick? If it's often, fix where week-scout picks today; don't paper over it on the page.
3. Does the app render watches with `sourceSurface: 'web_week'`?
4. How does the app write `user_location_snapshots` for *Use my location*?
5. Which ids can a week-scout window supply for a watch?
