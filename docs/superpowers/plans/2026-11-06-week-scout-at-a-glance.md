# Week Scout "At a glance" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Week Scout's cover/lead/turn with a regional "At a glance" paragraph, 1 to 6 sentences long and built by code from the cached region swell build. The PC model may reword sentences, and each reworded sentence is kept only while its facts still match. Home shows the first two sentences.

**Architecture:** quiver web adds three pure modules under `lib/services/discovery/`:
- **groups:** strip filter and grouping;
- **sentences:** sentence templates and fingerprints;
- **wording:** the wording check and binding.

`prepareStory` attaches `story.glance` to every story it serves for an active region, independent of whether the legacy edition binds. Editions gain `generation_version` `week-scout-story-3`, which carries `briefing.glance` (reworded sentences keyed by fingerprint) as well as everything `-2` carries. quiver-native parses `glance`, renders it where the lead/turn block sits and hides the cover, and Home reads its first two sentences.

**Tech Stack:** Next.js API routes, TypeScript, Jest (web, `npm run test:unit`); React Native/Expo, Jest with `TZ=America/Los_Angeles` (native).

**Spec:** `docs/superpowers/specs/2026-11-05-week-scout-at-a-glance-design.md` (quiver web). Read it before starting any task.

## Global Constraints

- No prod writes, edition publishes, PC worker runs, prod flag flips or OTA publishes without Steven's explicit yes.
- Don't touch the OTA lane `release/ota-main-20261105`.
- Competitor names stay out of user-facing copy, code comments, commit messages and release notes.
- **No digits in any glance sentence** except foot ranges. The code templates in this plan produce none.
- `WEEK_SCOUT_STORY_ENABLED` is unchanged: on in Preview, off in Production. With the flag off, the Week Scout response is byte-identical to today's.
- `story.glance` is additive. `cover`, `lead`, `turn` and `chapters` keep their current shape for installed builds.
- No new data sources, and no `buildRegionEvents`/WAM fetch on the Week Scout request path. Read only `loadRegionForecastEvents`.
- No migration. `briefing` is jsonb, and `generation_version` is unconstrained text (`supabase/migrations/20261027170000_week_scout_story_editions.sql`).
- Web jest runs on Node 22 (`nvm use 22`). Run only the named paths with `npx jest --runTestsByPath …`, never the full suite.
- Native jest: `TZ=America/Los_Angeles npx jest --runTestsByPath …` from the native worktree root.
- Model routing: implementers on Opus, reviewers and verification on Sonnet.

## Review Focus

1. **A region with no stored events.** If today is covered, the paragraph is exactly "No clear swell in the water today." If today isn't covered, `glance` is `null`. It is never an empty list. (Task 2 tests both.)
2. **A swell still in the water whose peak has passed.** It reads "is still in the water, easing by {day}". It never reads "peaks today", and never "from X into X". (Task 2.)
3. **An event near local midnight.** Every anchor uses the region's local date, not UTC. A peak at 23:30 PST Sunday reads "Sunday". (Task 2.)
4. **More than four coming groups, or more than six sentences.** The paragraph stops at the fourth group and drops the long-range sentence. (Task 2.)
5. **A reworded sentence whose fingerprint still matches after a size refresh moved its foot range.** It falls back to the code sentence through `checkWrittenSentence`. The other sentences keep their reworded text. (Task 3.)

---

## Workspace

- Web: one worktree, `git -C ~/Desktop/dev/quiver worktree add .worktrees/at-a-glance -b feat/week-scout-at-a-glance docs/week-scout-at-a-glance-spec`. It branches from the local docs branch so the spec and this plan are in the checkout, and they land with the web PR. Copy `.env*` from the main checkout. Remove the sparse `.worktrees/at-a-glance-spec` worktree once the web PR merges.
- Native implementers read the spec and plan from the web worktree by absolute path.
- Native: one worktree, `git -C ~/Desktop/dev/quiver-native worktree add .worktrees/at-a-glance -b feat/week-scout-at-a-glance origin/main`. Copy `.env*`. Push from `.worktrees/`, not `.claude/worktrees/`, because jest ignores the latter.
- Both run `npm ci` first. Stage by path; never `git add -A`.

## File map

| File | Change |
|---|---|
| `lib/services/discovery/week-scout-glance-groups.ts` | **Create.** Strip filter, grouping. |
| `lib/services/discovery/week-scout-glance.ts` | **Create.** Day anchors, size clause, sentence templates, fingerprints, `buildGlance`, `glanceFromBuild`. |
| `lib/services/discovery/week-scout-glance-wording.ts` | **Create.** `checkGlanceWording`, `bindGlance`. |
| `lib/services/discovery/__tests__/fixtures/glance-san-diego-2026-11-05.ts` | **Create.** The Nov 5 fixture. |
| `lib/services/discovery/__tests__/week-scout-glance-groups.test.ts`, `week-scout-glance.test.ts`, `week-scout-glance-wording.test.ts` | **Create.** |
| `lib/services/discovery/week-scout-story-claims.ts` | `checkWrittenSentence` takes `Pick<StoryCandidate, "text" \| "facts">`. |
| `lib/services/discovery/week-scout-story-candidates.ts` | Same-day cover/lead fix. |
| `lib/services/discovery/week-scout-story-types.ts` | `-3`, glance types, `StoryWire.glance`, `StoryInput.glance`, `briefing.glance`. |
| `lib/services/discovery/week-scout-story-validate.ts` | Accept `-3`, `written` under `-2`/`-3`, `glance` under `-3`. |
| `lib/services/discovery/week-scout-story-source.ts` | Offer the code glance in the story input. |
| `lib/services/discovery/week-scout-story-serve.ts` | Attach `glance` in `prepareStory`; `bindStory` emits `glance: null`. |
| `lib/alerts/swell-events/regional-narrative.ts` | Card written lines from `-2` and `-3`. |
| `docs/contracts/week-scout-story.md` | `glance` wire field, `-3`, PC worker contract and the Python wording mirror. |
| native `src/lib/week-scout/story.ts` | `glance` type and parser. |
| native `src/features/week-scout-story/week-scout-story.tsx` | At a glance block in place of the read block. |
| native `src/screens/week-scout.tsx` | Hide the cover when `glance` is present. |
| native `src/screens/home.tsx` | Days to watch narrative from `glance`. |

---

### Task 1: Strip filter and grouping (web)

**Files:**
- Create: `lib/services/discovery/week-scout-glance-groups.ts`
- Create: `lib/services/discovery/__tests__/fixtures/glance-san-diego-2026-11-05.ts`
- Test: `lib/services/discovery/__tests__/week-scout-glance-groups.test.ts`

**Interfaces:**
- Consumes:
  - `RegionalSwellEvent`, `COMPASS`, `directionIndex`, `periodClass` from `week-scout-story-candidates`;
  - `CandidateFacts`, `sizeWordsFor` from `week-scout-story-facts`;
  - `angleDifference` from `@/lib/domains/shared/angle-utils`;
  - `localDayDiff` from `@/lib/alerts/swell-events/regional-rating`;
  - `getLocalDateStr` from `./window-selector/time-slot-utils`.
- Produces:

```ts
export const GROUP_PEAK_WINDOW_MS = 36 * 60 * 60 * 1000;
export const GROUP_DIRECTION_DEG = 45;
export const STRIP_DAYS = 15;
export type GlanceNoun = "groundswell" | "mid-period swell" | "windswell" | "storm swell" | "swell";
export interface GlanceGroup {
  events: RegionalSwellEvent[];      // anchor first, then by peak
  lead: RegionalSwellEvent;          // the biggest event; names the group
  label: string;                     // COMPASS[directionIndex(lead.directionDeg)]
  noun: GlanceNoun;
  arrivalDate: string;               // earliest arrival, region-local
  peakDate: string;                  // the anchor's peak, region-local
  fadeDate: string | null;           // latest fade, null when no event has one
  confidence: RegionalSwellEvent["confidence"]; // lowest: on_the_radar < likely < locked
  facts: CandidateFacts | null;      // the lead's facts, standoutFt/standoutSizes from the event with the biggest standoutFt.max
}
export function onGlanceStrip(event: { arrivalAt: string | null; peakAt: string; fadeAt: string | null }, today: string, timezone: string): boolean;
export function groupGlanceEvents(events: readonly RegionalSwellEvent[], timezone: string,
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null): GlanceGroup[];
```

The rules are:
- **Grouping.** Sort by peak. Take the earliest ungrouped event as the anchor; on a tie, the event with the bigger `factsFor(e)?.faceFt?.max` anchors. Then add every later ungrouped event whose peak is within `GROUP_PEAK_WINDOW_MS` of the anchor's peak and whose direction is within `GROUP_DIRECTION_DEG` of it. Repeat until every event is grouped.
- **Biggest event.** Largest `faceFt.max` (null counts as −1), then the longer period, then the earlier peak.
- **Noun.** If every event has the same kind and period class, use the noun for that class: storm swell, long → groundswell, mid → mid-period swell, short → windswell. Otherwise use `"swell"`.
- **Strip.** The event's span overlaps local days 0–14 counted from `today`. The span starts at the arrival date (or the peak date when there is no arrival) and ends at the fade date (or the peak date when there is no fade).

- [ ] **Step 1: Write the fixture.** `glanceSanDiego` exports `today = "2026-11-05"`, `timezone = "America/Los_Angeles"`, `stored: RegionalSwellEvent[]` and `factsFor`. Facts come from `{ faceFt, sizes: sizeWordsFor(faceFt), breaker: null }`, plus `standoutFt` and `standoutSizes` where listed. All events have `minimumBeaches: 3`, `timezone` as above, and `regionalKey` equal to the id.

| id | dir° | period s | kind | arrivalAt | peakAt | fadeAt | confidence | faceFt | standoutFt |
|---|---|---|---|---|---|---|---|---|---|
| w-today | 270 | 16 | swell | 2026-11-04T14:00:00Z | 2026-11-05T18:00:00Z | 2026-11-07T18:00:00Z | locked | 3–5 | 8–10 |
| ssw-today | 202 | 14 | swell | 2026-11-04T20:00:00Z | 2026-11-05T20:00:00Z | 2026-11-07T20:00:00Z | locked | 3–5 | 8–10 |
| ssw-sun | 200 | 14 | swell | 2026-11-08T16:00:00Z | 2026-11-08T23:00:00Z | 2026-11-09T23:00:00Z | locked | 3–5 | — |
| wnw-mon | 292 | 11 | swell | 2026-11-09T16:00:00Z | 2026-11-09T22:00:00Z | 2026-11-10T22:00:00Z | locked | 3–5 | — |
| wnw-fri | 292 | 16 | swell | 2026-11-12T16:00:00Z | 2026-11-13T17:00:00Z | 2026-11-15T17:00:00Z | likely | 4–5 | — |
| w-fri | 270 | 10 | swell | 2026-11-12T20:00:00Z | 2026-11-13T22:00:00Z | 2026-11-15T00:00:00Z | likely | 5–6 | 8–10 |
| w-storm-sat | 268 | 10 | storm | 2026-11-13T12:00:00Z | 2026-11-14T14:00:00Z | 2026-11-15T14:00:00Z | likely | 4–5 | — |
| ssw-sat | 205 | 14 | swell | 2026-11-13T16:00:00Z | 2026-11-14T20:00:00Z | 2026-11-16T20:00:00Z | likely | 4–5 | — |

- [ ] **Step 2: Write the failing tests.**

```ts
it("groups the Nov 13–14 west events as one system and keeps the SSW apart", () => {
  const groups = groupGlanceEvents(stored.filter((e) => e.peakAt >= "2026-11-13"), timezone, factsFor);
  expect(groups.map((g) => g.events.map((e) => e.regionalKey))).toEqual([["wnw-fri", "w-fri", "w-storm-sat"], ["ssw-sat"]]);
  expect(groups[0]).toMatchObject({ label: "west", noun: "swell", peakDate: "2026-11-13", fadeDate: "2026-11-15", confidence: "likely" });
  expect(groups[0].facts?.faceFt).toEqual({ min: 5, max: 6 });
  expect(groups[1]).toMatchObject({ label: "south-southwest", noun: "groundswell" });
});
it("keeps today's west and SSW apart (68° apart)", () => {
  expect(groupGlanceEvents(stored.slice(0, 2), timezone, factsFor)).toHaveLength(2);
});
it("does not chain: an event 30 h after a member but 40 h after the anchor starts its own group", () => { /* anchor peak T, member T+10h, third T+40h, same direction → [[anchor, member], [third]] */ });
it("onGlanceStrip keeps day 14 and drops day 15 and a swell that faded yesterday", () => { /* peak 2026-11-19 → true; 2026-11-20 → false; fade 2026-11-04 → false */ });
it("names the group by its biggest event, not its anchor", () => { /* covered by groups[0].label === "west" above */ });
```

- [ ] **Step 3: Run the tests and see them fail.** `npx jest --runTestsByPath lib/services/discovery/__tests__/week-scout-glance-groups.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 4: Implement** `onGlanceStrip` and `groupGlanceEvents` to the rules above.
- [ ] **Step 5: Run the tests and see them pass.** Same command. Expected: PASS.
- [ ] **Step 6: Commit.** `git add` the three files, then `git commit -m "feat(week-scout): group regional swells for At a glance"`.

### Task 2: Sentences, anchors and fingerprints (web)

**Files:**
- Create: `lib/services/discovery/week-scout-glance.ts`
- Modify: `lib/services/discovery/week-scout-story-claims.ts:524`. The signature becomes `checkWrittenSentence(text: string, fact: Pick<StoryCandidate, "text" | "facts">, …)`. The body already reads only `fact.text` and `fact.facts`.
- Test: `lib/services/discovery/__tests__/week-scout-glance.test.ts`

**Interfaces:**
- Consumes: Task 1's `GlanceGroup`, `groupGlanceEvents`, `onGlanceStrip`; `sizePhrase`, `WEEKDAY`, `storyEventsFromRegion` from `week-scout-story-candidates`; `eventFactsFromBuild` from `week-scout-story-facts`; `RegionBuild`, `InternalRegionEvent` from `@/lib/alerts/swell-events/regional`.
- Produces:

```ts
export type GlanceRole = "today" | "next" | "long_range";
export interface GlanceSentence { role: GlanceRole; text: string; fingerprint: string; facts: CandidateFacts | null; eventKeys: string[] }
export const MAX_GLANCE_SENTENCES = 6;
export const MAX_NEXT_GROUPS = 4;
export function glanceDay(date: string, today: string): string;
export function buildGlance(args: {
  stored: readonly RegionalSwellEvent[];
  tail: ReadonlyArray<Pick<InternalRegionEvent, "key" | "directionDeg" | "arrivalAt" | "peakAt" | "fadeAt">>;
  timezone: string; today: string; todayCovered: boolean;
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null;
}): GlanceSentence[];
/** stored = storyEventsFromRegion(build, today).all; tail = build.events with source "wam"; factsFor = eventFactsFromBuild(build, ·). */
export function glanceFromBuild(build: RegionBuild, today: string, todayCovered: boolean): GlanceSentence[];
```

**Day anchors.** `glanceDay` gives the lead in days from `today`:

| Lead | Anchor |
|---|---|
| 0 | "today" |
| 1 | "tomorrow" |
| 2–6 | the weekday |
| 7 | "a week from today" |
| 8–13 | "a week from {weekday}" |
| ≥ 14 | "the week after next" |

Capitalise the first letter when the anchor opens a sentence.

**Size clause.** `size(facts, standouts)` is `"{most} at most spots"`, plus `" and {standout} at the standouts"` when `standouts` is true and the standout phrase is not null and differs from the "most spots" phrase. Both phrases come from `sizePhrase`. The clause is null when `facts` or the "most spots" phrase is null. `on_the_radar` groups never take the standouts part.

**Noun phrase.** `np(g)` is `withArticle([fresh] [bigger] {label} {noun})`.
- "fresh" applies only to a sentence's first group, when an earlier sentence named a group with the same `label`.
- "bigger" applies only to a sentence's first group, when its `facts.faceFt.max` is greater than that of every group named before it.
- "bigger" and "fresh" never appear together. When both rules apply, "bigger" wins. In the fixture, S[2]'s west group would qualify for both and gets only "bigger"; S[1] gets "fresh", because its maximum of 5 is not greater than 5.

**Slots, in order.**
1. **Today.**
   - The groups come from `groupGlanceEvents` over the stored events whose arrival date is on or before today and that are still on the strip.
   - Each group's predicate depends on its peak:
     - peak today: "peaks today";
     - peak later: "is already in the water and peaks {glanceDay(peak)}";
     - peak earlier: "is still in the water".
   - The ease clause is `", easing by {glanceDay(fade)}"` when the fade date is after today.
   - The sentence is `"{NP} {predicate}, {size}{ease}."`, leaving out ", {size}" when the size clause is null.
   - Two adjacent today groups share one sentence only when both peak today and their size clauses are equal: `"{NP1} and {np2} both peak today, {size}{ease from the later fade}."`
   - Today groups are written whenever they exist, whatever `todayCovered` says. `todayCovered` only decides the empty case: with no today groups, it gives "No clear swell in the water today." when true and no today sentence when false.
2. **Next.**
   - The groups come from stored events with arrival after today, on the strip, in anchor-peak order. Name at most `MAX_NEXT_GROUPS`.
   - **Pairing.** Pair greedily. Two adjacent groups share a sentence when their peak dates are the same or one day apart and they have the same confidence.
   - **`locked`, one group:** `"{NP} {arrival}, {size}."` The arrival is "arrives and peaks {P}" when the arrival and peak days are the same, otherwise "arrives {A} and peaks {P}".
   - **`locked`, pair:** `"{NP1} {arrival1}, then {np2} follows {P2}, {pairSize}."` The pair size is `"both {size}"` when the two size clauses are equal. Otherwise each group carries its own clause, so the sentence reads `"{NP1} {arrival1}, {size1}, then {np2} follows {P2}, {size2}."`
   - **`likely`, one group:** `"{P} looks likely to bring {np}, {size}."` With a second group: `"{P} looks likely to bring {np1} with {np2} behind it, {size1}."`
   - **`on_the_radar`, one group:** `"{P} brings an early look at {np}, {size without standouts}."` With a second group: `"{P} brings an early look at {np1} with {np2} behind it, {size1 without standouts}."`
3. **Long range.**
   - The event is the first tail event that has a direction, is on the strip, and peaks after the last stored next group's peak (or after today when there are none).
   - The sentence appears only when no stored next group was left out and fewer than `MAX_GLANCE_SENTENCES` sentences exist.
   - Text: `"Further out, a {label} swell is on the radar for {glanceDay(peak)}, too early to call."`

**Sentence cap.** Stop adding sentences at `MAX_GLANCE_SENTENCES`. A group that doesn't fit counts as left out.

**Fingerprint.** `JSON.stringify(["glance-1", role, ...groups.map((g) => [g.label, g.noun, g.arrivalDate, g.peakDate, g.fadeDate, g.confidence, fresh])])`. "bigger" is left out because it depends on size; Task 3's wording check guards it instead. For the long-range sentence, use `["glance-1", "long_range", label, peakDate]`.

`facts` is the first group's facts, which is the group whose size the sentence states. `eventKeys` lists every event's `regionalKey` (`key` for the tail event).

- [ ] **Step 1: Write the failing tests.**

```ts
const S = [
  "A west groundswell and a south-southwest groundswell both peak today, chest-high at most spots and overhead at the standouts, easing by Saturday.",
  "A fresh south-southwest groundswell arrives and peaks Sunday, then a west-northwest mid-period swell follows Monday, both chest-high at most spots.",
  "A week from Friday looks likely to bring a bigger west swell with a south-southwest groundswell behind it, head-high at most spots and overhead at the standouts.",
];
it("reproduces the Nov 5 San Diego paragraph", () => {
  const glance = buildGlance({ stored, tail: [], timezone, today, todayCovered: true, factsFor });
  expect(glance.map((s) => s.text)).toEqual(S);
  expect(glance.map((s) => s.role)).toEqual(["today", "next", "next"]);
});
it("every code sentence passes the claim checker against itself and has no stray digit or 'from X into X'", () => {
  for (const s of buildGlance({ stored, tail: [], timezone, today, todayCovered: true, factsFor })) {
    expect(checkWrittenSentence(s.text, { text: s.text, facts: s.facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
    expect(s.text).not.toMatch(/\bfrom (\w+) into \1\b/);
    expect(s.text.replace(/\d+(?:-\d+)? ?ft/g, "")).not.toMatch(/\d/);
  }
});
it("adds the long-range sentence when nothing was skipped", () => { /* tail [{ key: "tail", directionDeg: 292, arrivalAt: null, peakAt: "2026-11-18T18:00:00Z", fadeAt: null }] → last text "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call." */ });
it("stops at four next groups and drops the long range", () => { /* add a fifth group (dir 180, peak 2026-11-17) plus the tail → 4 next groups named, no long_range sentence */ });
it("says so when nothing is in the water and today is covered", () => { /* stored = next events only → first text "No clear swell in the water today." */ });
it("returns [] for no events and an uncovered today", () => { expect(buildGlance({ stored: [], tail: [], timezone, today, todayCovered: false, factsFor })).toEqual([]); });
it("reads a swell past its peak as still in the water", () => { /* arrival 11-03, peak 11-04, fade 11-06 → "… is still in the water, chest-high at most spots, easing by Friday." */ });
it("dates by the region's local day near midnight", () => { /* peakAt 2026-11-09T07:30:00Z (Sun 23:30 PST), arrival same day → "arrives and peaks Sunday" */ });
it("fingerprints ignore size", () => { /* same events, factsFor returning 4–6 for every event → identical fingerprints, different text */ });
```

- [ ] **Step 2: Run the tests and see them fail.** `npx jest --runTestsByPath lib/services/discovery/__tests__/week-scout-glance.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement** the claims signature change, `glanceDay`, `buildGlance` and `glanceFromBuild`.
  - If the self-check test refuses "bigger" (reason `size`), drop the "bigger" rule and the word from `S[2]`. Leave everything else unchanged.
- [ ] **Step 4: Run the tests** above plus `lib/services/discovery/__tests__/week-scout-story-claims.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(week-scout): write At a glance sentences from the region build"`

### Task 3: Wording check and binding (web)

**Files:**
- Create: `lib/services/discovery/week-scout-glance-wording.ts`
- Test: `lib/services/discovery/__tests__/week-scout-glance-wording.test.ts`

**Interfaces:**
- Consumes: Task 2's `GlanceSentence`; `BREAKER_WORDS` and `checkWrittenSentence` from `week-scout-story-claims`.
- Produces:

```ts
export interface GlanceWritten { fingerprint: string; text: string }
export interface StoryGlance { sentences: string[]; source: Array<"code" | "written"> }
export type GlanceWordingCheck = { ok: true } | { ok: false; reason: "feel_words" | "repeated_word" | "adjective_list" | "certainty" | "bigger" };
export const CERTAINTY_PHRASES: readonly string[];   // exact list below
export function checkGlanceWording(text: string, codeText: string): GlanceWordingCheck;
export function bindGlance(sentences: readonly GlanceSentence[], written: readonly GlanceWritten[] | undefined,
  beachNames: readonly string[], region: string): StoryGlance | null;
```

Rules (Task 6 mirrors them exactly in Python):
- **feel_words:** refuse when the text matches more than one `BREAKER_WORDS` entry. Each entry is one claim; match whole words, case-insensitively.
- **repeated_word:** take lowercase letter runs (`/\p{L}+/gu`) of four or more letters. To stem a token, strip the first suffix from `["ing", "es", "ed", "ly", "y", "s"]` that leaves at least four letters. Refuse when any stem appears more often in `text` than `max(1, its count in codeText)`.
- **adjective_list:** refuse on `/(?:[\p{L}-]+,\s+){2,}(?:(?:and|or)\s+)?[\p{L}-]+/u`.
- **certainty:** `CERTAINTY_PHRASES = ["too early to call", "already in the water", "still in the water", "looks likely", "early look", "on the radar", "on the way", "likely", "due"]`. Match longest first, blanking each match before trying the next phrase. Refuse when the set of phrases in `text` differs from the set in `codeText`.
- **bigger:** refuse when the whole word "bigger" appears in `text` but not in `codeText`.

`bindGlance`:
- It returns null when there are no sentences.
- For each sentence it uses the written entry with an identical fingerprint, but only when both `checkWrittenSentence(entry.text, { text: s.text, facts: s.facts ?? undefined }, beachNames, [region]).ok` and `checkGlanceWording(entry.text, s.text).ok` pass. Otherwise it uses `s.text`.
- `source` records which version was used for each sentence.

- [ ] **Step 1: Write the failing tests.**

```ts
const salad = "Expect crumbly, crumbling, crumbles, spilling, soft, mushy, or peaky waves.";
it("refuses the Nov 5 word salad", () => { expect(checkGlanceWording(salad, S[0]).ok).toBe(false); });
it("accepts a plain rewording of S[1]", () => {
  expect(checkGlanceWording("A fresh south-southwest groundswell arrives and peaks Sunday, and a west-northwest mid-period swell follows Monday, both chest-high at most spots.", S[1])).toEqual({ ok: true });
});
it("refuses a certainty change", () => { expect(checkGlanceWording(S[2].replace("looks likely to bring", "brings"), S[2])).toEqual({ ok: false, reason: "certainty" }); });
it("keeps a matching rewording, falls back one sentence when its fingerprint changed", () => { /* written for S[1] and S[2]; rebuild with wnw-mon at 250° → S[1] source "code", S[2] "written" */ });
it("falls back when a size refresh breaks the written foot range", () => { /* written S[0] variant says "3-5 ft"; factsFor now 4–6 → source[0] === "code" */ });
it("refuses 'bigger' the code sentence no longer says", () => { expect(checkGlanceWording(S[1].replace("A fresh", "A bigger, fresh"), S[1])).toEqual({ ok: false, reason: "bigger" }); });
it("returns null for no sentences", () => { expect(bindGlance([], undefined, [], "San Diego")).toBeNull(); });
```

- [ ] **Step 2: Run the tests and see them fail.** `npx jest --runTestsByPath lib/services/discovery/__tests__/week-scout-glance-wording.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `checkGlanceWording` and `bindGlance` to the rules above.
- [ ] **Step 4: Run the tests and see them pass.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(week-scout): check and bind reworded At a glance sentences"`

### Task 4: Same-day wording in the legacy cover and lead (web)

**Files:**
- Modify: `lib/services/discovery/week-scout-story-candidates.ts:181-201` (`addSwellHeadlines`)
- Test: `lib/services/discovery/__tests__/week-scout-story-candidates.test.ts`

When `arrival === peakDay` and the arrival is not past, change the templates as follows:

| Template | Same-day text |
|---|---|
| region cover | "A {period} from the {direction} reaches {region} and peaks {peakDay}." |
| no-region cover | "A {period} from the {direction} arrives and peaks {peakDay}." |
| lead | "The {direction} pulse arrives and peaks {peakDay}." |
| `pulse-alt` cover | add nothing |
| `pulse-alt` lead | add nothing |

- [ ] **Step 1: Write the failing test.** Run `buildStoryCandidates` with one event that arrives and peaks on day 3. Expect no candidate text to match `/from (\w+) into \1|(\w+) starts .* toward a \2 peak/`, and expect a `story:lead` candidate to equal `"The south-southwest pulse arrives and peaks Sunday."` (adjust the direction and weekday to the test's own event).
- [ ] **Step 2: Run the test and see it fail.** `npx jest --runTestsByPath lib/services/discovery/__tests__/week-scout-story-candidates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the template changes.
- [ ] **Step 4: Run** that test file plus `week-scout-story-serve.test.ts`. Expected: PASS. Update any serve snapshot that asserted the old same-day text.
- [ ] **Step 5: Commit.** `git commit -m "fix(week-scout): say 'arrives and peaks' when a swell lands and peaks the same day"`

### Task 5: Edition `-3`, the input offer and serving (web)

**Files:**
- Modify: `lib/services/discovery/week-scout-story-types.ts`
- Modify: `lib/services/discovery/week-scout-story-validate.ts`
- Modify: `lib/services/discovery/week-scout-story-source.ts`
- Modify: `lib/services/discovery/week-scout-story-serve.ts`
- Modify: `lib/alerts/swell-events/regional-narrative.ts:34,62`
- Test:
  - `lib/services/discovery/__tests__/week-scout-story-serve.test.ts`
  - `__tests__/app/api/week-scout-story-internal-routes.test.ts`
  - `__tests__/lib/alerts/swell-events/regional-narrative.test.ts`
  - `__tests__/app/api/surf-week-scout-story-route.test.ts`

**Interfaces:**
- Consumes: Task 2's `glanceFromBuild`, `GlanceSentence`, `GlanceRole`; Task 3's `bindGlance`, `GlanceWritten`, `StoryGlance`.
- Produces:
  - `WEEK_SCOUT_STORY_GENERATION_VERSIONS = ["week-scout-story-1", "week-scout-story-2", "week-scout-story-3"]`.
  - `StoryInput.glance?: Array<{ role: GlanceRole; fingerprint: string; text: string }>`.
  - `StoryArtifact.briefing.glance?: GlanceWritten[]`.
  - `StoryWire.glance: StoryGlance | null`.

Changes:
- **Validate.**
  - `written` is allowed only under `-2` and `-3`; otherwise throw `written_not_allowed`.
  - `glance` is allowed only under `-3`; otherwise throw `glance_not_allowed`.
  - Glance shape: an array of at most 6 entries; each entry has exactly the keys `fingerprint` and `text`; `text` is a string of at most 240 characters. Otherwise throw `glance_invalid`.
  - Every fingerprint must be in `input.glance`; otherwise throw `glance_not_offered`. A repeated fingerprint throws `glance_duplicate`.
  - Destructure `{ written, glance, ...briefing }` before the `briefing_values_altered` comparison.
- **Source.**
  - In `buildStoryInput`, set `glance = glanceFromBuild(build, editionDate, signals[0].complete).map(({ role, fingerprint, text }) => ({ role, fingerprint, text }))`.
  - Add `glance` to the `sourceHash` payload, so an unchanged source still yields a new input that carries the offer.
  - Do not bump `STORY_SAMPLE_VERSION`.
- **Serve.**
  - `bindStory` returns `glance: null` in both of its return shapes.
  - In `prepareStory`, `regionRead` resolves to `{ regional: StoryRegion; build: RegionBuild | null }`. `CLOSED_REGION` pairs with `build: null`.
  - The binder computes:
    - `todayCovered`: the `live.coverage?.days` entry for `editionDate` has `eligible > 0 && missing === 0`;
    - `written`: `edition.briefing.glance` when `edition.generationVersion === "week-scout-story-3"`, `edition.editionDate === editionDate`, `validUntil` ≥ now and `sourcePublishedAt` ≤ now;
    - `glance = build ? bindGlance(glanceFromBuild(build, editionDate, todayCovered), written, build.beaches.map((b) => b.name), region) : null`, inside try/catch, so a throw yields `null` and logs `[week-scout-story] glance failed`.
  - Every story the binder returns is `{ ...story, glance }`. The unbound paths (no home beach, outside region) keep `glance: null`.
- **Narrative.** Replace `WRITTEN_GENERATION_VERSION` with `WRITTEN_GENERATION_VERSIONS = new Set(["week-scout-story-2", "week-scout-story-3"])`, and use `.has(...)` in `isCurrentEdition`.

- [ ] **Step 1: Write the failing tests.**
  - `serve`: with a region build (reuse the file's existing build helper) and an active region, `glance.sentences.length` is ≥ 1 and the source entries are all `"code"`.
  - `serve`: a story whose edition fails its gates is `availability: "unavailable"` but still carries the same `glance`.
  - `serve`: with no home beach, `glance` is null.
  - `serve`: a `-3` edition whose `briefing.glance` holds a valid rewording for sentence 0 serves it with `source[0] === "written"`.
  - `internal-routes`: a `-3` artifact with `written` and `glance` passes. `glance` under `-2` returns `glance_not_allowed`. A fingerprint that wasn't offered returns `glance_not_offered`.
  - `regional-narrative`: a `-3` edition's `event:` written lines are served, exactly as a `-2` edition's are.
  - `route`: with the story flag off, the response has no `story` key and is otherwise unchanged.
- [ ] **Step 2: Run the tests and see them fail.** `npx jest --runTestsByPath` on the four test files. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run the tests.** Run the four files plus Tasks 1–4's tests and `lib/services/discovery/__tests__/week-scout-story-source.test.ts`, then `npm run typecheck`. Expected: PASS, with 0 type errors.
- [ ] **Step 5: Commit.** `git commit -m "feat(week-scout): serve story.glance and accept week-scout-story-3 editions"`

### Task 6: Contract and PC worker handoff (web docs)

**Files:**
- Modify: `docs/contracts/week-scout-story.md`

Add three sections:
1. **`story.glance` on the wire.** The shape, null rules, and the line "Home takes `sentences.slice(0, 2)`".
2. **Generation `week-scout-story-3`.** It is a superset of `-2`. The input offers `glance[]` as `{ role, fingerprint, text }`. The worker returns `briefing.glance[]` as `{ fingerprint, text }`, one entry per offered fingerprint it rewords. It copies each fingerprint verbatim and must keep `selections` and `written` exactly as it does for `-2`.
3. **Worker prompt rules and the Python mirror.** Prompt rules: reword one sentence at a time; keep every direction, day, size phrase and certainty phrase; at most one wave-feel word; no lists of adjectives; no digits except the foot ranges already present.

   The Python mirror is a `check_glance_wording(text, code_text)` code block with the five rules from Task 3. Copy the regex, the suffix list and `CERTAINTY_PHRASES` verbatim from `week-scout-glance-wording.ts`, and use `regex` (PyPI) for `\p{L}`.

   End with the sentence: "Steven applies this to `feat/swell-briefing-pc-worker` on the PC and runs a dry run (no publish) before scheduling."

- [ ] **Step 1: Write the three sections.**
- [ ] **Step 2: Check the mirror.** Compare the Python constants with the TypeScript ones using `rg -n "CERTAINTY_PHRASES|ing\", \"es\"" lib/services/discovery/week-scout-glance-wording.ts docs/contracts/week-scout-story.md`. Expected: the values match exactly.
- [ ] **Step 3: Commit.** `git commit -m "docs(week-scout): At a glance wire field and -3 worker contract"`

### Task 7: Parse `glance` (native)

**Files:**
- Modify: `src/lib/week-scout/story.ts`
- Test: `src/lib/week-scout/__tests__/story.test.ts`

**Interfaces:**
- Produces:
  - `export interface WeekScoutStoryGlance { sentences: string[]; source: ('code' | 'written')[] }`;
  - `WeekScoutStory.glance?: WeekScoutStoryGlance | null`. It is optional so existing fixtures still type-check, and `parseWeekScoutStory` always sets it.

The parse rule:
- `glance` is null unless `sentences` is an array of 1–6 strings, every one of which passes `narrativeText`, and `source` has the same length with only `'code'` or `'written'` values.
- One bad sentence makes the whole glance null.
- `glance` is parsed whatever the availability is. A malformed `glance` never makes the story `undefined`.

- [ ] **Step 1: Write the failing tests.**
  - A ready story with the fixture's three sentences parses to `glance.sentences` equal to them.
  - An `unavailable` story with `glance` keeps it.
  - `glance` with "YES" in a sentence parses to `glance: null` with the story still defined.
  - `source` of the wrong length gives `glance: null`.
  - A missing `glance` gives `glance: null`.
- [ ] **Step 2: Run the tests and see them fail.** `TZ=America/Los_Angeles npx jest --runTestsByPath src/lib/week-scout/__tests__/story.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseGlance(value: unknown): WeekScoutStoryGlance | null` and call it in `parseWeekScoutStory`.
- [ ] **Step 4: Run the tests and see them pass.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(week-scout): parse the story's At a glance paragraph"`

### Task 8: Render At a glance on Week Scout and Home (native)

**Files:**
- Modify: `src/features/week-scout-story/week-scout-story.tsx:142-147`
- Modify: `src/screens/week-scout.tsx:1276-1279`
- Modify: `src/screens/home.tsx:2529-2534`
- Test: `src/__tests__/week-scout-screen.test.tsx`, `src/__tests__/home-screen.test.tsx`

Changes:
- **`WeekScoutStoryView`.**
  - When `story.glance` is set, render `<View style={[styles.paper, styles.read]} testID="week-scout-story-glance">` in place of the read block. It holds an `<Eyebrow style={styles.coverKicker}>` with `AT A GLANCE` plus `· {REGION}` when the region is known, and one `<Body style={styles.readText}>{glance.sentences.join(' ')}</Body>`.
  - When `glance` is null, keep the read block exactly as it is today.
- **`week-scout.tsx`.** Render `WeekScoutStoryCover` only when `!story.glance`. Update the comment above it: with a glance, the watch leads and the paragraph follows it inside the story view.
- **`home.tsx`.** Set `daysToWatchNarrative` as follows:
  - return null when there are no `daysToWatchPicks`;
  - otherwise use `story.glance.sentences.slice(0, 2).join(' ')` when `story?.glance` is set;
  - otherwise use today's ready lead/turn rule.

- [ ] **Step 1: Write the failing tests.**
  - `week-scout-screen`: with `story = { ...story, glance: { sentences: S, source: ['code', 'code', 'code'] } }`, `getByTestId('week-scout-story-glance')` has the text `AT A GLANCE` and `S.join(' ')`; `queryByTestId('week-scout-story-cover')` and `queryByTestId('week-scout-story-read')` are null; and the week card `week-scout-story-week` still renders. With the cover gone, Swell Watch is the first story element, so the order needs no separate assertion.
  - `home-screen`: next to "leads with the written read of the week", the `story.glance` sentences give a `days-to-watch-narrative` of exactly `S[0] + ' ' + S[1]`, while `lead` and `turn` are also set.
  - Run the existing tests unchanged: "shows the covered narrative…" (no glance) still passes.
- [ ] **Step 2: Run the tests and see them fail.** `TZ=America/Los_Angeles npx jest --runTestsByPath src/__tests__/week-scout-screen.test.tsx src/__tests__/home-screen.test.tsx`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the three changes.
- [ ] **Step 4: Run the tests** above plus `story.test.ts`, then `npm run typecheck` and `npx eslint` on the changed files. Expected: PASS, with 0 errors.
- [ ] **Step 5: Commit.** `git commit -m "feat(week-scout): show At a glance under Swell Watch and on Home"`

### Task 9: Verify and land

- [ ] **Step 1: Web gate.** Run every test file touched in Tasks 1–5 in one `--runTestsByPath` call, plus `npm run typecheck` and `npm run lint`. Expected: all pass.
- [ ] **Step 2: Preview check (read-only).**
  - Push the web branch and open a PR to `main`.
  - On its Preview deploy, where the story flag is on, call `POST /api/surf/week-scout` as the test user from `.maestro/env/local.env` with a San Diego home beach.
  - Confirm that `story.glance.sentences` exists. Confirm that every direction it names appears among the events from `GET /api/beaches/{homeBeachId}/swell-events`, for the same region and day.
  - Write nothing to prod.
- [ ] **Step 3: Review and auto-merge (web).**
  - This touches swell-watch and story logic, so run `/code-review high` on the web PR first.
  - Fix confirmed findings and re-run Step 1.
  - Then turn on Auto-fix and run `gh pr merge --auto --squash`.
  - No release-pool line is needed: prod's story flag is off, so the change ships dark.
- [ ] **Step 4: Native gate.**
  - Run the Task 7–8 test files, `npm run typecheck` and `npm run lint`.
  - Push from `.worktrees/at-a-glance` and open a PR to `main`.
  - Merge with `gh pr merge --squash` after the gate passes. Native PRs don't use auto-merge.
- [ ] **Step 5: Hand back to Steven.**
  - Report the two merged PRs.
  - Report that the worker contract is in `docs/contracts/week-scout-story.md` for him to apply on the PC.
  - Report that native reaches phones only through an OTA he approves.
  - The grouping thresholds were checked only on the Nov 5 fixture. Stored story inputs keep candidates, not raw events, so a week-long replay would need fresh region builds.
