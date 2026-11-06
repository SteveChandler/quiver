# Week Scout "At a glance" — design (2026-11-05)

Status: draft for Steven's approval. Nothing is built.

## Intent

Steven wants Week Scout's story to read like a forecaster's regional summary of the coming weeks. The model is the "At a glance" paragraph of a regional SoCal surf report he reads. In his words, it "broke down the data. told me what was coming in the next few weeks." That report is a reference for shape only. None of its text, and none of its rain or weather calls, is copied or pulled into Quiver.

Today's story falls short in four ways (all seen on Nov 5 2026):

1. **Editions get dropped.** Written editions are pinned to swell event keys (`6-5-2026-11-05`), and those keys drift between forecast refreshes (6-3 → 6-5 in 45 minutes, W → WSW by evening). When the cover's key no longer matches, `bindStory` drops the whole edition, so the app shows plain fallback lines.
2. **The template has a same-day bug.** It produces "builds from Sunday into Sunday" when arrival and peak fall on the same day. This is live in today's San Diego input.
3. **Word salad got through.** A model sentence published "crumbly, crumbling, crumbles, spilling, soft, mushy, or peaky waves" and passed the fact check.
4. **The story is too short and too narrow.** It covers 7 days and leads with one swell. It never chains the swells together.

## What the surfer sees

One paragraph, regional (the same for everyone in the region, not personalised to their breaks), headed **AT A GLANCE · {REGION}**:

- It starts with what is in the water today.
- Then it gives one sentence per coming swell, or per group of swells that arrive together, in date order.
- Each sentence carries a time anchor relative to today: "today", "Sunday", "late next week", "around the 15th".
- The wording gets less certain the further out a swell is.
- It can end with a long-range sentence when the early-look scan has something.

Example built from real San Diego data on Nov 5 2026. The copy is illustrative; the facts are real.

> A west groundswell and a south-southwest groundswell both peak today, chest-high at most spots and overhead at the standouts, easing by Saturday. A fresh south-southwest groundswell arrives and peaks Sunday, chest-high at most spots. A west-northwest swell follows Monday, chest-high with head-high standouts. A week from Friday looks likely to bring a bigger mix of west and south-southwest, head-high at most spots.

(Shown to Steven during brainstorming as three sentences, with Sunday and Monday sharing one sentence and the last sentence ending "around Friday the 13th". The rules below make it one sentence per group with no digits, which gives the version above. The facts are the same.)

### Week Scout layout (story view)

1. The Swell Watch animation (15-day regional watch), unchanged. It moves to the top; today the story cover sits above it.
2. **At a glance**, which replaces the story cover title, the lead line and the turn line.
3. The week card (BEST TIME THIS WEEK plus the session energy/tide chart), unchanged.
4. Day chapters, unchanged.

### Home

The Days to watch card shows the **first two sentences** of At a glance where it now shows the story's lead and turn. Everything else on the card is unchanged.

## Decisions Steven made

- The shape is A: a paragraph only. There is no conditions roll-up (wind, rain, tide, water temp) in this design.
- The Swell Watch animation stays above the paragraph, and the week graph stays below it.
- It is regional, not personalised.
- Code writes the paragraph from live data on every request. The model only rewords individual sentences, and a reworded sentence is kept only while its facts still match the live data.
- Home shows the first two sentences.
- Nothing from the competitor's report is pulled into Quiver, including its rain note.

## Goals

- The paragraph is never dropped as a whole because forecast keys drift. The worst case is that one sentence falls back to its plain code wording.
- The paragraph and the Swell Watch animation describe the same swells, because both are built from the same regional event build.
- The paragraph covers the stored forecast horizon (about 10–12 days) plus the early look (out to about day 14), not just 7 days.
- Swells that hit together read as one system, not a list of near-duplicates.
- How certain each sentence sounds comes from data, not from the model.

## Non-goals

- No wind, rain, tide or water-temp line (shape B was not chosen).
- No storm origin, track or travel distance. We have no verified source geometry.
- No per-user personalisation of the paragraph. Day chapters and picks stay personal as they are today.
- No new data sources.

## Anti-goals (a failure even if it "works")

- The paragraph names a swell the animation doesn't show, or the animation shows a swell the paragraph skips while a later one is mentioned.
- A sentence is less certain or more certain than the data: for example, "on the way" for an early-look event.
- Repetitive or list-of-synonyms wording, as in problem 3.
- A blank or missing paragraph in a covered region when the region build has events.
- Any text, call or phrasing lifted from a competitor.

## How the paragraph is built (server, quiver web)

### Source

Use the cached regional event build the story already reads: `loadRegionForecastEvents` in `lib/alerts/swell-events/regional.ts`. It is the same detector and ratings behind `GET /api/beaches/[id]/swell-events`, which the native Swell Watch draws. It includes its GFS-tail early-look events. Do not use the Week Scout response's `swells[]`.

- Do **not** add a `buildRegionEvents` / WAM-buoy fetch to the Week Scout request path. WAM buoy peaks are always the furthest-out items, so leaving them out never skips something before a named swell.
- Apply the Swell Watch's 15-day strip filter (`regional-swells-event-window.ts` on the native side, or its server equivalent) so the paragraph never names a swell the strip can't show.
- The region is resolved the way the story resolves it today: from the user's home beach (`profile.home_beach_id`).
- The paragraph shows even when the Swell Watch doesn't render, for example when its client flag is off or the home beach is hidden. It is the summary, and it does not depend on the animation.

### Sentence slots, in order

1. **Today.** Every event in the water on the region's local today (arrival ≤ today ≤ fade, or peak is today), grouped as below. It says when they peak and when they ease.
   - "Coverage for today" means the live Week Scout response's `coverage.days` entry for today, which the existing quiet-span check already uses (`week-scout-story-serve.ts`).
   - If nothing is in the water and today is covered, the slot says so briefly ("No clear swell in the water today.").
   - If today isn't covered, the slot is omitted. Missing data is never presented as a quiet day.
2. **Next swells.** The following groups from stored-forecast (`source: 'forecast'`) events, in date order, **at most four groups**, one sentence each.
   - Groups 10 or more days out carry `early_look` confidence and get its words ("an early look at…"). They keep the "most spots" size only, with no standouts clause.
3. **Long range.** At most one sentence for the first GFS-tail early-look event (`source: 'wam'`) after the last stored group.
   - It appears only when **every** stored group within the strip was named, so it never jumps past a skipped swell.
   - It needs a direction. It is worded as too early to call, with no sizes. The estimated face lives on per-beach ratings, not on the event, so there is none to use.
   - If there are more than four stored groups, the paragraph ends after the fourth and the long-range sentence is left out.

The total is 1–6 sentences.

### Grouping (my call)

A group is anchored on its earliest-peaking event, and takes in every later event whose peak falls within 36 hours of that **anchor**. The window is not chained. The existing 36-hour windows in the detectors dedupe one swell component. Here the same span is reused for a different job: treating different swells that land together as one system.

Each group names at most two directions, biggest first:
- Take each event's 16-point label.
- Fold any label within 22.5° of a bigger event's label into that bigger one (WNW folds into W).
- Name the top two that remain ("a mix of west and south-southwest").
- A one-event group uses its own label ("a west-northwest swell").

Each group also carries:
- **Size:** the group's largest "most spots" and "standouts" sizes.
- **Confidence:** the lowest confidence among its events.

On Nov 5, San Diego's input split Nov 13–14 into four events (WNW long, W mid, W storm, SSW). Grouping makes that one sentence. Sunday's SSW (peak Nov 8) and Monday's WNW (peak Nov 9) are about 24 hours apart and would be one group under this rule. The builder should replay the fixture. If peaks a day apart from different quadrants read better as two sentences, add a quadrant split (only fold events whose directions are within 45°) and record the choice.

### Time anchors (my call; builder may refine)

All anchors are in the region's local date. **No digits.** The claim checker refuses numerals outside foot ranges, candidates with digits are dropped, and the regional types promise "digits only in foot ranges". Keep that contract.

| Days from today | Anchor |
|---|---|
| 0 | today |
| 1 | tomorrow |
| 2–6 | the weekday ("Sunday") |
| 7–13 | "a week from {weekday}" (the existing template's phrase), or "early next week" / "late next week" for a span |
| beyond the strip's stored days | "the week after next" / "further out" |

- Arrival and peak on the same day reads "arrives and peaks Sunday". It never reads "builds from Sunday into Sunday". This fixes problem 2 and covers every slot, including the legacy lead.
- A past arrival reads as already in the water.

### Certainty words

These come from the event's data, never from the model:

| State | Words |
|---|---|
| In the water | "peaks today", "easing by Saturday" |
| `on_the_way` | "on the way", "due" |
| `likely` | "looks likely" |
| `early_look` | "an early look at…", "too early to call" |

Use the existing `STORY_CONFIDENCE` mapping in `week-scout-story-candidates.ts`, which works from lead days, so the paragraph and the gates agree. "In the water" comes from the arrival date being today or earlier.

### Sizes

Use the existing regional size tail and `sizePhrase` rules ("chest-high at most spots, overhead at the standouts"). Use the same size words as everywhere else. Add no new size vocabulary.

## Model wording (PC worker)

- The worker receives each code sentence together with its **fact fingerprint**: slot role, the named direction labels, period class (long/mid/short, not the 3 s band), kind (swell/storm), arrival/peak/fade local dates, and confidence tier.
  - **Size is not in the fingerprint.** Sizes move with every forecast refresh. Size claims in a reworded sentence are re-checked against live size facts by `checkWrittenSentence`, as today.
- It returns one reworded sentence per slot.
- This means a new `generation_version` (`week-scout-story-3`) and an updated worker prompt and output schema.
- A `-3` edition is a **superset of `-2`**: it still carries the Swell Watch card's `event:` and `beach:` written lines. `loadLatestStoryEdition` returns one edition per region, so a `-3` edition without them would silently strip the card's written lines.
- Update `regional-narrative.ts` (`WRITTEN_GENERATION_VERSION`) and `week-scout-story-validate.ts` to accept `-2` and `-3`. Allow `written` under both.
- The worker lives on Steven's Windows PC (branch `feat/swell-briefing-pc-worker` in a local checkout), not on either repo's `main`, and mirrors the claim lists in Python.
  - The builder writes the worker change as a patch and updates the Python mirror of the new wording check.
  - Steven runs and schedules it.
- Reworded sentences are stored against the fingerprint, **not** the event key.
- At serve time, the server rebuilds the code paragraph from live data. For each slot, it uses the stored reworded sentence only if the edition is today's and the fingerprint still matches exactly, and the sentence passes:
  - the existing claim checker (`checkWrittenSentence`);
  - a new wording check (my call): at most one breaking-wave feel word; no word stem repeated; no list of three or more adjectives; no direction, size, day or certainty word that differs from the fingerprint.
- Otherwise that slot uses its code sentence. Other slots are unaffected.
- When a direction really changes (W → WSW), the fingerprint changes and only that sentence falls back. That is the correct outcome, since the reworded sentence would now be wrong.

## Wire contract

- Additive: `story.glance: { sentences: string[]; source: Array<'code' | 'written'> } | null`.
  - The server splits the sentences, so Home takes the first two without parsing prose.
  - `source` records, per sentence, whether it is the code version or a reworded one, for telemetry and debugging.
- Keep `cover`, `lead`, `turn` and `chapters` exactly as they are for installed builds (#677 ships dark in the current OTA). Fix the same-day wording bug in the legacy lead too.
- Behind `WEEK_SCOUT_STORY_ENABLED`, as today. It is on in Preview and off in Production; this design does not change that.
- When the region build can't be read, or the region is outside coverage, `glance` is `null` and native shows no paragraph. No fallback prose is invented.

## Native (quiver-native)

- **Week Scout:**
  - Render order in story view: Swell Watch, then At a glance, then the week card, then chapters.
  - `WeekScoutStoryCover` is not rendered when `glance` is present.
  - The lead/turn "read" block is replaced by the paragraph.
  - When `glance` is null, today's layout is kept.
- **Home:** Days to watch narrative = `glance.sentences.slice(0, 2).join(' ')`. If `glance` is null, it falls back to today's lead/turn behaviour.
- Use the existing typography and theme (`Eyebrow` + `Body`), in line with `docs/DESIGN_SYSTEM.md`.

## Constraints

- No prod writes, edition publishes, PC worker runs, prod flag flips or OTA publishes without Steven's explicit yes.
- Don't touch the OTA lane `release/ota-main-20261105`.
- Web reaches prod through the daily release pool. Native ships through the normal OTA path, with Steven's approval.
- Competitor names stay out of user-facing copy and release notes.

## Acceptance checks (use Nov 5 2026 San Diego as the fixture)

- The paragraph matches the example's facts: two groundswells peak today and ease by Saturday; SSW Sunday; WNW Monday; one sentence for the Nov 13–14 mix, worded "likely".
- No sentence anywhere says "from X into X", and no sentence has a digit outside a foot range.
- Changing one event's direction or period class between edition time and serve time falls back that sentence only. The paragraph still renders.
- A size change alone keeps a reworded sentence only if `checkWrittenSentence` still passes it.
- Publishing a `-3` edition leaves the Swell Watch card's written lines in place.
- The Nov 5 word-salad sentence is rejected by the wording check.
- Every swell named in the paragraph is in the Swell Watch events for the same region and date.
- Home shows exactly the first two sentences.
- With the flag off, the Week Scout response is byte-identical to today's.

## Left to the builder

- The exact sentence templates and connective wording, within the rules above.
- Fingerprint encoding, storage shape for reworded sentences, and the migration, if one is needed. Any migration needs Steven's approval before it is applied.
- Tuning the 36-hour grouping window and the quadrant split against a week of stored inputs.
- How the legacy cover/lead keep working until installed builds age out.

## Calls made without Steven (check these)

1. Size is left out of the fingerprint. The claim checker guards size instead, so a refresh doesn't knock out every reworded sentence.
2. No digits in any sentence. "A week from Friday" replaces "around the 13th".
3. One sentence per group, groups anchored on the first peak within 36 hours, at most two directions named.
4. Up to four groups. The long-range sentence appears only when no stored group was skipped.
5. Long range uses the GFS-tail early look already in the cached build. No WAM-buoy fetch on the request path.
6. The paragraph shows even when the Swell Watch animation doesn't render.
7. `-3` editions are a superset of `-2`, so the Swell Watch card keeps its written lines.

## Follow-ups (out of scope, found during the Nov 5 data check)

- **Trestles water temperature.** Lower Trestles, Middles, Trails and Upper Trestles carry 53°F while seven nearshore buoys read 74.8–76.5°F. This looks like a wrong station mapping.
- **Rain.** Our only rain-ahead signal is the NWS short-forecast text in `weather_condition` (about 7 days, no probability or amount). A future conditions line would want precipitation probability and amount from our weather source.
- **Long range in the story input.** The early look (days 11–14) is not in today's story input; it is only in the Swell Watch build. This design reads the region build directly, which covers it.
