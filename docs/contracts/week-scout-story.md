# Week Scout story wire contract (schema 3)

`POST /api/surf/week-scout` keeps every existing field. When `WEEK_SCOUT_STORY_ENABLED` is not `true`, the complete response is byte-identical to the current response. When enabled, `data.story` is always present. Its narrative fields are nullable; its picks and directional cover come from the live Week Scout response. No age or freshness fields belong in `story`.

```ts
type WeekScoutStory = {
  schemaVersion: 3;
  region: string | null; // region of the user's home beach, never inferred from a pilot setting
  availability: 'ready' | 'pending' | 'outside_region' | 'unavailable';
  cover: {
    text: string | null; // selected regional narrative; published edition or deterministic live fallback
    swells: Array<{
      eventKey: string;
      directionDeg: number;
      directionLabel: string;
      periodS: number;
      arrivalAt: string; // ISO instant from live swells[]
      peakAt: string; // ISO instant from live swells[]
    }>;
  };
  lead: string | null;
  turn: string | null;
  chapters: Array<{
    slot: `swell:${string}` | `day:${string}` | `quiet:${string}`;
    text: string; // the regional candidate's text, or the edition's written sentence for it when that passes its claim check; gated against live data
  }>;
  days: Array<{
    localDate: string;
    pick: null | {
      windowId: string; beachId: string;
      bucket: 'morning' | 'midday' | 'evening';
      verdict: 'worth_it' | 'maybe' | 'skip' | null;
      personalVerdict?: 'go' | 'maybe' | 'no';
      personalLabel?: 'EPIC' | 'GOOD' | 'FAIR' | 'RIDEABLE' | 'MEH';
      conditionScore: number | null;
      displayWindowStart: string; displayWindowEnd: string;
      waveHeight: string | null;
    };
  }>; // projected from the first seven live days; no age or freshness fields
};
```

`availability: 'ready'` requires selected candidates to pass their gates. Swell, exposure, and beach gates are checked against the region build (`loadRegionForecastEvents`: every region beach, storms included, about 12 days), never against the live chart's `swells[]`; the other gates are checked against the live Week Scout response. A swell gate holds while the build has an event with the same story key (direction sector, period band, local peak date, and `-s` for a storm) on the same arrival and peak local dates, the same fade date when the gate names one, the same 16-point direction and period class, at least the gate's confidence, and at least its `minimumBeaches`. An exposure gate also needs every named beach's exposure to that event unchanged; a beach gate needs its event (the first under the key) to keep the 16-point direction and period class the line names, and that beach's exposure, how squarely an open beach faces the swell (`direct` within the narrower of 22.5° and half its swell window's half-width of the window's centre, otherwise `angled`; `null` unless open) and its wind bucket (mean daylight wind in the event's rating window: under 8 mph light, under 15 breezy, otherwise windy) unchanged. If the region build cannot be read, those gates fail and the story falls back. A valid published edition wins. Without one, the server reads today's cached regional input or builds it from regional forecasts without persisting it, then chooses the lowest-rank passing candidate for each slot. Swell copy in the cover, lead, and swell chapters must name the region build's first event in the seven days: same story key, arrival and peak local dates, and 16-point direction. When no cover or lead candidate does, because the input was built from an earlier build that dated or binned it differently, the fallback composes that slot from that event itself, with every gate field taken from it and no region named. `cover.swells` still lists the live chart's swells. Regional events outside the seven days do not count toward the three-event limit, and regional periods are rounded to 0.1 s like `swells[].periodS` before banding. The serve-only input has a five-minute per-region/day memory cache; no fallback database write occurs. Slots whose gates fail are omitted; a fallback with no passing candidate is `unavailable`. `outside_region` covers a missing home beach or a home region absent from the active-region query. A quiet week can be `ready` only when every claimed day has complete safe forecast coverage; a missing or held day cannot become a quiet chapter. The directional cover never claims a storm source or travel distance until source geometry and track provenance are verified.

Exposure beach names are ranked within each exposure class by peak-day quality score, highest first, with beach name as the stable tie-break. This ranking uses existing forecast and live-window data and requires no active-home-beach RPC or new database migration.

Covered example (inside the existing `{ success: true, data: ... }` envelope; other existing data fields omitted):

```json
{"story":{"schemaVersion":3,"region":"San Diego","availability":"ready","cover":{"text":"A long-period groundswell from the west reaches San Diego Wednesday and peaks Thursday.","swells":[{"eventKey":"live-west-pulse","directionDeg":270,"directionLabel":"W","periodS":15,"arrivalAt":"2026-10-28T12:00:00Z","peakAt":"2026-10-29T18:00:00Z"}]},"lead":"Thursday carries the strongest west pulse of the week.","turn":null,"chapters":[{"slot":"swell:6-5-2026-10-29","text":"The long-period groundswell arrives Wednesday, builds into Thursday, then eases."}],"days":[{"localDate":"2026-10-28","pick":null}]}}
```

Uncovered example (a live pick is projected from `days[].bestDayWindow`):

```json
{"story":{"schemaVersion":3,"region":null,"availability":"outside_region","cover":{"text":null,"swells":[]},"lead":null,"turn":null,"chapters":[],"days":[{"localDate":"2026-10-28","pick":null}]}}
```

Quiet-week example (no recommendable regional event and complete coverage for every claimed day):

```json
{"story":{"schemaVersion":3,"region":"San Diego","availability":"ready","cover":{"text":"A quieter stretch along the coast.","swells":[]},"lead":null,"turn":null,"chapters":[{"slot":"quiet:2026-10-28..2026-11-03","text":"No clear regional pulse through this stretch."}],"days":[{"localDate":"2026-10-28","pick":null},{"localDate":"2026-10-29","pick":null},{"localDate":"2026-10-30","pick":null},{"localDate":"2026-10-31","pick":null},{"localDate":"2026-11-01","pick":null},{"localDate":"2026-11-02","pick":null},{"localDate":"2026-11-03","pick":null}]}}
```

The worker API is separate: `GET /api/internal/week-scout-story/regions`, `GET /api/internal/week-scout-story/input?region=<URL-encoded beaches.region>`, `POST /api/internal/week-scout-story/editions`, and `GET /api/internal/week-scout-story/latest?region=<URL-encoded beaches.region>`. Region values are the original `beaches.region` strings, including spaces or accents. It uses the briefing publisher's Bearer authentication pattern with its own `WEEK_SCOUT_STORY_PUBLISHER_TOKEN` (at least 32 characters), schema 3, candidate IDs (plus, under `week-scout-story-2`, sentences written for them), and a deterministic artifact ID. It never sends user data to the reader, and model prose reaches the reader only as a written sentence that passed its claim check for a selected candidate whose gate holds.

Worker request and response shapes:

```ts
type RegionList = { schemaVersion: 3; regions: Array<{ region: string; timezone: string }> };
type StoryGate =
  | { kind: 'swell'; regionalEventKey: string; directionSector: number; directionIndex?: number; periodBand: number; periodClass?: 'long' | 'mid' | 'short'; arrivalLocalDate: string; peakLocalDate: string; fadeLocalDate: string | null; confidence: 'on_the_radar' | 'likely' | 'locked'; minimumBeaches: number }
  | { kind: 'origin'; regionalEventKey: string; sourceAreaId: string; sourceLat: number; sourceLon: number; trackRevision: string; arrivalOrder: number; confidence: 'likely' | 'locked' }
  | { kind: 'exposure'; regionalEventKey: string; directionSector: number; exposure: 'open' | 'partial' | 'shadowed'; minimumBeaches: number; beaches?: Array<{ beachId: string; exposure: 'open' | 'partial' | 'shadowed' }> }
  | { kind: 'beach'; regionalEventKey: string; beachId: string; directionIndex: number; periodClass: 'long' | 'mid' | 'short'; exposure: 'open' | 'partial' | 'shadowed'; facing: 'direct' | 'angled' | null; wind: 'light' | 'breezy' | 'windy' }
  | { kind: 'wind'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; fromWindClass: 'offshore' | 'onshore'; windClass: 'offshore' | 'onshore'; forecastRevision: string; beachId?: string; fromBucket?: 'morning' | 'midday' | 'evening'; fromDirection?: string; toDirection?: string }
  | { kind: 'tide'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; tidePhase: string; windowOrder: 'opens' | 'closes'; forecastRevision: string; beachId?: string }
  | { kind: 'change'; fromDate: string; toDate: string; direction: 'better' | 'worse'; minimumScoreChange: number; sourceSeries: string }
  | { kind: 'day'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; reason: 'light_wind' | 'rising_tide' | 'clean_window' }
  | { kind: 'quiet'; fromDate: string; toDate: string; completeDates: string[] };
type Candidate = { id: string; slot: 'cover' | 'story:lead' | 'story:turn' | `swell:${string}` | `day:${string}` | `quiet:${string}` | `event:${string}`; text: string; gate: StoryGate; rank?: number };
type StoryInput = {
  schemaVersion: 3; region: string; editionDate: string; sourcePublishedAt: string;
  validUntil: string; inputHash: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: [] };
  copyFacts: Candidate[];
  beachNames: Record<string, string>; // every region beach, id to name
  provenance: { sourceIds: string[]; sourceHashes: string[]; generationInputVersion: string;
    representativeBeachIds: string[]; coverageDates: string[];
    coverage?: Array<{ localDate: string; sampleBeaches: number; rows: number }>;
    fixture?: boolean };
};
type StoryArtifact = Omit<StoryInput, 'copyFacts' | 'beachNames' | 'briefing'> & {
  artifactId: string; generationVersion: 'week-scout-story-1' | 'week-scout-story-2'; model: string;
  briefing: {
    schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[];
    written?: Array<{ slot: string; basedOn: string; text: string }>; // week-scout-story-2 only
  };
};
```

`GET /regions` returns `RegionList`. `GET /input` returns `StoryInput`; a sparse or stale region returns HTTP 409. The worker submits `StoryArtifact` to `POST /editions`; the server accepts only issued candidate IDs in issue order (at most 200, one per slot), requires `cover` and `story:lead` when offered, and rejects changed fields. `event:<storyKey>:story` and `event:<storyKey>:beach:<beachId>` candidates are the regional swells card's lines (one per forecast event and one per beach the card lists for it); the Week Scout story never serves them. `GET /api/beaches/[id]/swell-events` serves them as each forecast event's `story` and each listed beach's `why`: the written sentence for that slot when the region's edition is today's `week-scout-story-2`, still valid, selected the slot, passes the claim check and its gate holds against the request's region build; otherwise the server line from that build, for any beach the card lists. A beach's server line takes its wind bucket from its rating's own hours (`windowStartAt` to `windowEndAt`; the event's rating window only when the rating has none), and a rating whose reason is `blown out` always reads as windy; a written beach sentence serves only when its gate's wind bucket equals that own-hours bucket and the reason is not `blown out`. Early looks carry `story: null` and `why: null`, as does a beach with no swell window or no wind in its hours. The route reads the edition only when the region build has a stored-forecast event, never serves an edition whose input is a fixture, keeps up to 16 loaded inputs in memory by `inputHash` (inputs are content-addressed), and if building the narrative throws it logs once and returns the rated events with `story` and `why` null. `artifactId` is SHA-256 of canonical JSON with `artifactId` omitted, using the existing briefing hash rule. The response is `{ artifactId: string }`, HTTP 201 for first publish or 200 for an identical retry. `GET /latest` returns the stored `StoryArtifact` or HTTP 404. All four routes send `Cache-Control: private, no-store, no-cache, must-revalidate` through the publisher wrapper.

`week-scout-story-1` editions select candidates only. A `week-scout-story-2` edition may also carry `briefing.written`: sentences the worker wrote for some of its selections, with no table or schema change (the wire stays schema 3). At publish the server checks their shape only and rejects the artifact with HTTP 400 and a specific code: `written_not_allowed` (`written` under `week-scout-story-1`), `written_invalid` (not an array of `{ slot, basedOn, text }` strings, or extra keys), `written_too_long` (over 240 characters), `written_not_selected` (`basedOn` is not in `selections`), `written_slot_mismatch` (`slot` is not that candidate's slot), `written_duplicate_slot`. The briefing equality check ignores `written`. Claims are checked when the story is served, by `checkWrittenSentence` in `week-scout-story-claims.ts`. Every list below is an exported constant there, and the PC worker mirrors them. A slot shows its written sentence only when its candidate's gate holds and the sentence passes every check below, in order. The checks read claim words only: any word outside these lists is free prose. The first failed check is the refusal reason. That slot then shows the candidate's own text, and the other slots keep their written sentences.

The rules, for the worker to copy:

- **Matching.** Phrase lists match whole phrases, case-insensitively and longest first; spaces and hyphens match each other and apostrophes are optional (`head-on` is `head on`, `south-southwest` is one direction). Region beach names (`StoryInput.beachNames`) and the region's name are blanked out (replaced by as many spaces) in both texts first, so a name lends no direction, day or size: `North Beach` is no north swell, and naming the region is no beach claim.
- **Days.** A day unit is a `WEEK_FROM_DAYS` unit (`a week from today`, `a week from <Weekday>`; each one claim, read before bare weekdays, so `a week from Saturday` is neither `Saturday` nor `a week from Thursday`) or a weekday (plural allowed). In the sentence only, `WEEKDAY_ABBREVIATIONS` (`Sun`, `Mon`, `Tue`/`Tues`, `Wed`, `Thu`/`Thur`/`Thurs`, `Fri`, `Sat`) written Capitalised or ALL-CAPS count as their weekday, so "the sun" and "we sat" are plain words.
- **Directions.** The 16 `COMPASS` words, also with `-erly`, `-ern` or `-ward(s)` (`westerly`, `southern`). In the sentence only, `COMPASS_ABBREVIATIONS` (`N` through `NNW`) as whole uppercase tokens count as the full word (`SSW` is `south-southwest`).

The checks, in order:

1. `empty` (blank), `too_long` (over 240 characters), `digit` (any numeral), `verdict_word` (whole uppercase `YES`, `MAYBE` or `NO`), `the_call` ("the call").
2. `number`: a `NUMBER_WORDS` word (two through twenty, thirty through ninety, hundred(s), dozen(s), half, hyphenated forms included, and feet, foot, ft, seconds, mph, knots, meter(s)/metre(s), inch(es)). `size`: a `SIZE_ADJECTIVES` word (knee-, waist-, chest-, shoulder- and head-high, overhead, double overhead, big, huge, pumping, flat).
3. `weekday`: a day unit the candidate doesn't name. `weekday_order`: the sentence's day units, each once in first-appearance order, are not in the candidate's order (it may leave days out, never swap them).
4. `direction`: a direction the candidate doesn't name.
5. `beach`: a region beach the candidate doesn't name, or the sentence's beaches (each once, first appearance) out of the candidate's order.
6. `timing`: the sentence's `TIME_QUALIFIERS` (`a week from`, `next week`, `earlier in the week`, `later on`, `peaked`, `faded`, `arrived`, `reached`, `eased`, `today`, `tonight`, `tomorrow`) are not exactly the candidate's, or it uses a `RELATIVE_TIME_WORDS` word (`same day`, `next day`, `day after`, `weekend`, `overnight`, `midweek`, `morning`, `midday`, `afternoon`, `evening`, `night`, plurals included) the candidate doesn't. A phase verb's past form is a time claim, so it is kept exactly too.
7. `weekday_order` (day–verb binding): the sentence pairs a day with a phase verb the candidate doesn't. The units are the day units plus `DAY_PHRASES` (`next week`, `earlier in the week`, `later on`, `today`, `tonight`, `tomorrow`). Each unit pairs with every `PHASE_VERBS` form between it and the previous unit in its clause, or the clause's start; a clause ends at `,` `;` `:` `.` `!` `?` `(` `)` `…`, an en or em dash, or a hyphen with spaces around it. A unit with no phase verb before it in its clause pairs with none. Every sentence pair must be one of the candidate's pairs: against "arrives Thursday, peaks Friday and fades Saturday", "arrives Thursday and fades Friday" fails, and "arrives and peaks Friday" fails because it pairs arrives with Friday too. `PHASE_VERBS`, each phase with its forms: `arrives` (arrive, arriving, arrived, reaches, reach, reaching, reached), `peaks` (peak, peaking, peaked, most), `fades` (fade, fading, faded), `comes and goes` (come and go, coming and going, came and went), `builds` (build, building, built), `eases` (ease, easing, eased). `reaches` is the cover's arrival and `most` the cover's peak ("with the most swell Thursday"). These forms only bind days; a sentence may use any of them.
8. Closed sets, each refused under its own name, when the sentence makes a claim from the set that the candidate doesn't (any form counts as its entry's first form): `wind` (offshore, onshore), `comparison` (better, worse), `tide` (low, high, rising, falling), `period` (long-period, mid-period, short-period, groundswell, windswell, storm/stormy), `exposure` (sheltered/shelter, shadow/shadowed, partly/partially, faces/face/facing/faced, head on, straight on, dead on, at an angle/angled) and `wind_strength` (light, glassy, calm, breezy, windy/the wind is up). Every claim word in a card beach line comes from these sets.
9. `exposure` (degree): the sentence's `DEGREE_WORDS` claims (partly/partially, dead on, at an angle/angled, head on, straight on) are not exactly the candidate's. "Sheltered from…" fails against "Partly sheltered from…".
