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

`availability: 'ready'` requires selected candidates to pass their gates. Swell, exposure, and beach gates are checked against the region build (`loadRegionForecastEvents`: every region beach, storms included, about 12 days), never against the live chart's `swells[]`; the other gates are checked against the live Week Scout response, without `CandidateFacts`. A swell gate holds while the build has an event with the same story key (direction sector, period band, local peak date, and `-s` for a storm) on the same arrival and peak local dates, the same fade date when the gate names one, the same 16-point direction and period class, at least the gate's confidence, and at least its `minimumBeaches`. An exposure gate also needs every named beach's exposure to that event unchanged; a beach gate needs its event (the first under the key) to keep the 16-point direction and period class the line names, and that beach's exposure, how squarely an open beach faces the swell (`direct` within the narrower of 22.5° and half its swell window's half-width of the window's centre, otherwise `angled`; `null` unless open) and its wind bucket (mean daylight wind on the gate's `localDate` inside the event's rating window: under 8 mph light, under 15 breezy, otherwise windy) unchanged. If the region build cannot be read, those gates fail and the story falls back. A valid published edition wins. In an edition day slot, a selected candidate whose gate and server sentence hold keeps the slot; its written sentence is used when it also passes the claim check, otherwise its server sentence is used. If that selected candidate fails or the edition did not select the slot, fallback tries a held `day_surf` candidate by rank, then the live pick line, then any other held non-day_surf candidate in ascending rank, including generic day gates. The server reads today's cached regional input or builds it from regional forecasts without persisting it when no valid edition exists. Swell copy in the cover, lead, and swell chapters must name the region build's first event in the seven days: same story key, arrival and peak local dates, and 16-point direction. When no cover or lead candidate does, because the input was built from an earlier build that dated or binned it differently, the fallback composes that slot from that event itself, with every gate field taken from it and no region named. If an arrival date is already past, cover, lead and chapter copy say the swell is already in the water. A cover may carry the regional size tail; a lead never does. `cover.swells` still lists the live chart's swells. Regional events outside the seven days do not count toward the three-event limit, and regional periods are rounded to 0.1 s like `swells[].periodS` before banding. The serve-only input has a five-minute per-region/day memory cache; no fallback database write occurs. Slots whose gates fail are omitted; a fallback with no passing candidate is `unavailable`. `outside_region` covers a missing home beach or a home region absent from the active-region query. A quiet week can be `ready` only when every claimed day has complete safe forecast coverage; a missing or held day cannot become a quiet chapter. The directional cover never claims a storm source or travel distance until source geometry and track provenance are verified.

Every selected server sentence and written sentence is also checked against current facts with `checkWrittenSentence`. Swell facts are recomputed by event key; beach facts by event key, beach ID and the gate's local date. A changed size, breaker or wind-timing claim refuses even when the structural gate still holds. Day-surf size facts are recomputed from the live pick's `waveHeight`; its wind hours and breaker come from the covering event's `beachDayFacts`. A failed written sentence uses its passing server sentence. A failed server sentence is omitted; cover and lead fallback can be composed from the current first event and its facts.

A `day_surf` candidate describes one of the day's top four regional beaches, with size, optional feel and optional wind timing. It holds only while that day's live `bestDayWindow` is safe, names the same beach, and its rounded face range is contained in `gate.faceFt`. Its size claims are checked against the live pick height; its own input wind hours are not rechecked from the live response's single bucket readings. A generated pick line is considered only for a `day:` slot that has at least one candidate, and on an edition path only for slots the edition selected. Its name comes from `StoryInput.beachNames`; names containing digits are filtered. It gets size words from `faceRangeFt([pick.forecast.waveHeight])` and `sizeWordsFor`, and wind hours and breaker from the covering event's `beachDayFacts` (the event with the largest `faceFt.max` when event windows cover the date). `dayFacts` returns facts only when an event window covers that beach's daylight rows on the date; without a covering event, no pick line is generated. Raw local-day rows never supply a pick line. The line uses its own synthetic `day_surf` gate for the picked beach and live face range, and must pass the claim checker. A selected candidate that fails its gate or server sentence does not serve; fallback tries held `day_surf` candidates by rank, then the generated pick line, then any other held non-day_surf candidate in ascending rank, including generic day gates. Day surf candidates rank 50–53, ahead of change (100+), tide (200+) and wind (300+) lines. The edition must still be for today and its input under 36 hours old.

For the Python port, mirror `sizePhrase(range, sizes)` exactly. It returns null without a range or size words, drops `shoulder` when `chest` is also present, and consumes the remaining words in their supplied order (`sizeWordsFor` supplies `SIZE_BUCKETS` order). Before `sizeWordsFor`, `faceRangeFt` rounds the parsed minimum and maximum to whole feet; this is the shared bucket rule for the card, checker and worker. One body bucket prints as `word-high`; one overhead bucket keeps its name (`overhead` or `double overhead`). A body-to-body pair prints `low-to-high`, such as `waist-to-chest`; append `-high` only when the high endpoint is `head`, as in `waist-to-head-high`. If the high endpoint is overhead, print `single(low) to single(high)`, as in `knee-high to overhead`; a wide `0–8 ft` range therefore prints `knee-high to overhead` after shoulder is dropped.

`windTimingPhrase` checks sampled beach-local rows; it does not require every hour in a span to be present, but every sampled row there must match. Its branches run in this order: (1) `offshore all day`, (2) `offshore all morning, sea breeze after lunch`, (3) `offshore early, onshore by H`, (4) `glassy early, sea breeze after lunch`, (5) `offshore early`, (6) `glassy early`, and (7) `onshore by H`; the first matching branch wins. `early` is `[0, 9)`, `all morning` is `[0, 12)`, `all day` is `[0, 24)`, and `sea breeze after lunch` is `[13, 24)`. An all-day offshore phrase also needs sampled rows within two hours of both daylight edges (at or before 08:00 and at or after 16:00); the all-morning offshore phrase needs a sample at or before 08:00 and one at or after 10:00. `offshore early` requires all sampled rows in `[0, 9)` to be offshore; `glassy early` requires each to have non-null wind speed below 8 mph. The timed `offshore early, onshore by H` branch requires offshore in `[0, 9)`, takes H from the earliest onshore sample in the full input (which must be at hours 9–12), and requires every sample in `[H, 13)` to be onshore. The final `onshore by H` branch likewise uses the earliest onshore sample in the full input, requires it to be at hours 9–12, requires at least one earlier sample with a relation other than onshore, and requires every sample in `[H, 13)` to be onshore. Hour 12 prints as `noon`; other H values print as their hour. The glassy-early sea-breeze branch combines the same early light-wind condition with onshore samples throughout `[13, 24)`.

Only the cover uses the regional size tail: `{size} at most spots`, with an `at the standouts` clause only when its phrase differs from the main size and its maximum is larger. The lead reads `The {direction} pulse builds from {arrival} into {peak}.` (or says the pulse is already in the water for a past arrival). A listed beach line omits feel when size is unavailable. A shadowed beach says `Sheltered from the {swell}{, wind}.` without size or feel; partial and open lines keep their exposure wording. If exposure is null, the line has no exposure lead and starts with the capitalized size-and-feel phrase, or its wind phrase when size is null. A beach timing phrase is used only when the window's wind bucket is light or the phrase itself includes an onshore period (`onshore by` or `sea breeze`); otherwise its bucket clause remains. A working beach with forecast rows does not lose its `why` only because exposure, size or wind facts are missing.

Event stories precede all event beach lines in the input budget, preserving every event's story when the 200-candidate cap trims beach lines.

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
  | { kind: 'beach'; localDate: string; regionalEventKey: string; beachId: string; directionIndex: number; periodClass: 'long' | 'mid' | 'short'; exposure: 'open' | 'partial' | 'shadowed' | null; facing: 'direct' | 'angled' | null; wind: 'light' | 'breezy' | 'windy' | null }
  | { kind: 'wind'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; fromWindClass: 'offshore' | 'onshore'; windClass: 'offshore' | 'onshore'; forecastRevision: string; beachId?: string; fromBucket?: 'morning' | 'midday' | 'evening'; fromDirection?: string; toDirection?: string }
  | { kind: 'tide'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; tidePhase: string; windowOrder: 'opens' | 'closes'; forecastRevision: string; beachId?: string }
  | { kind: 'change'; fromDate: string; toDate: string; direction: 'better' | 'worse'; minimumScoreChange: number; sourceSeries: string }
  | { kind: 'day_surf'; localDate: string; beachId: string; faceFt: { min: number; max: number } }
  | { kind: 'day'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; reason: 'light_wind' | 'rising_tide' | 'clean_window' }
  | { kind: 'quiet'; fromDate: string; toDate: string; completeDates: string[] };
type CandidateFacts = {
  faceFt: { min: number; max: number } | null;
  sizes: Array<'knee' | 'waist' | 'chest' | 'shoulder' | 'head' | 'overhead' | 'double overhead'>;
  standoutFt?: { min: number; max: number };
  standoutSizes?: CandidateFacts['sizes'];
  windHours?: Array<{ hour: number; relation: 'offshore' | 'onshore' | 'cross' | null; mph: number | null }>;
  breaker: { character: 'pitching' | 'crumbly' | null; feel: 'punchy' | 'soft' | null; closingOut: boolean } | null;
};
type Candidate = { id: string; slot: 'cover' | 'story:lead' | 'story:turn' | `swell:${string}` | `day:${string}` | `quiet:${string}` | `event:${string}`; text: string; gate: StoryGate; rank?: number; facts?: CandidateFacts };
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

`GET /regions` returns `RegionList`. `GET /input` returns `StoryInput`; a sparse or stale region returns HTTP 409. The worker submits `StoryArtifact` to `POST /editions`; the server accepts only issued candidate IDs in issue order (at most 200, one per slot), requires `cover` and `story:lead` when offered, and rejects changed fields. `event:<storyKey>:story` and `event:<storyKey>:beach:<beachId>` candidates are the regional swells card's lines (one per forecast event and one per beach the card lists for it); the Week Scout story never serves them. `GET /api/beaches/[id]/swell-events` serves them as each forecast event's `story` and each listed beach's `why`: the written sentence for that slot when the region's edition is today's `week-scout-story-2`, still valid, selected the slot, passes the claim check and its gate holds against the request's region build; otherwise the server line from that build, for any beach the card lists. A beach's server line takes its wind bucket from its rating's own hours (`windowStartAt` to `windowEndAt`; the event's rating window only when the rating has none), and a rating whose reason is `blown out` always reads as windy; a written beach sentence serves only when its gate's wind bucket equals that own-hours bucket and the reason is not `blown out`. On a shadowed beach, the line says it is sheltered from the swell and keeps wind without size or feel. With null exposure, it has no exposure lead and starts with its capitalized size/feel phrase or wind phrase. Early looks carry `story: null` and `why: null`; a beach with no swell window still receives a line when it has size or wind facts. The route reads the edition only when the region build has a stored-forecast event, never serves an edition whose input is a fixture, keeps up to 16 loaded inputs in memory by `inputHash` (inputs are content-addressed), and if building the narrative throws it logs once and returns the rated events with `story` and `why` null. `artifactId` is SHA-256 of canonical JSON with `artifactId` omitted, using the existing briefing hash rule. The response is `{ artifactId: string }`, HTTP 201 for first publish or 200 for an identical retry. `GET /latest` returns the stored `StoryArtifact` or HTTP 404. All four routes send `Cache-Control: private, no-store, no-cache, must-revalidate` through the publisher wrapper.

`week-scout-story-1` editions select candidates only. A `week-scout-story-2` edition may also carry `briefing.written`: sentences the worker wrote for some of its selections, with no table or schema change (the wire stays schema 3). At publish the server checks their shape only and rejects the artifact with HTTP 400 and a specific code: `written_not_allowed` (`written` under `week-scout-story-1`), `written_invalid` (not an array of `{ slot, basedOn, text }` strings, or extra keys), `written_too_long` (over 240 characters), `written_not_selected` (`basedOn` is not in `selections`), `written_slot_mismatch` (`slot` is not that candidate's slot), `written_duplicate_slot`. The briefing equality check ignores `written`. Claims are checked when the story is served, by `checkWrittenSentence` in `week-scout-story-claims.ts`. Every list it reads is in the `json claims` block below, equal string for string to the exported constant of the same name (`COMPASS` and `WEEKDAY` come from `week-scout-story-candidates.ts`), and the PC worker mirrors them. A slot shows its written sentence only when its candidate's gate holds and the sentence passes every check below, in order. The checks read claim words only: any word outside these lists is free prose. The first failed check is the refusal reason. That slot then shows the candidate's own text, and the other slots keep their written sentences.

The rules, for the worker to copy:

- **Matching.** Phrase lists match whole phrases, case-insensitively and longest first; words in a phrase are separated by `[\s-]+`, and apostrophes are optional (`head-on` is `head on`, `south-southwest` is one direction). Whole-token boundaries treat Unicode letters (category `L`) and numerals (category `N`) as token characters; the Python port uses `unicodedata.category(ch)[0] in ("L", "N")`. Region beach names (`StoryInput.beachNames`) and the region's name are blanked out (replaced by as many spaces) in both texts first, so a name lends no direction, day or size: `North Beach` is no north swell, `Seven Mile Beach` no distance, and naming the region is no beach claim. Foot ranges, wind-timing phrases, size phrases and breaker phrases are then blanked in both texts before reading days, directions, closed sets or relative times. Thus "offshore early" lends no closed `wind` claim and "glassy mornings" lends no relative `morning` claim, on either side. Day units (`WEEK_FROM_DAYS`, `NEXT_WEEKDAYS`) are blanked next, before any later list is read (weekdays, directions, `TIME_QUALIFIERS`, `DAY_PHRASES`, `RELATIVE_TIME_WORDS`, closed sets, `DEGREE_WORDS`, `PHASE_VERBS`), so "a week from Friday" lends no bare `Friday` and no `a week from` qualifier. `NUMBER_WORDS` and size claims are checked in the order below, before day units are read. `CLOSED_WORD_SETS.wind_strength` is read before the other closed sets and `DEGREE_WORDS`, and its matches are blanked for them, so a wind phrase ("the wind picks up") never counts toward another set. "picks up" alone is no claim: "San Diego picks up a west groundswell" names a region receiving one.
- **Claims with forms.** Each entry of `CLOSED_WORD_SETS`, `DEGREE_WORDS`, `PHASE_VERBS` and `RELATIVE_TIME_WORDS` is one claim: its first form names it, and every form makes that claim ("stormy" is "storm", "catches" and "wide open" are "faces", "cleaner" is "clean", "noon" is "midday"). A comparative no candidate writes is its own claim, so "lighter" is not "light".
- **Days.** A day unit is a `WEEK_FROM_DAYS` or `NEXT_WEEKDAYS` unit (each one claim, read before bare weekdays, so `a week from Saturday` is neither `Saturday` nor `a week from Thursday`, and `next Friday` is not `Friday`) or a `WEEKDAY` (plural allowed). In the sentence only, `WEEKDAY_ABBREVIATIONS` written Capitalised or ALL-CAPS count as their weekday, so "the sun" and "we sat" are plain words, and `next` before one makes it that `NEXT_WEEKDAYS` unit (`next Fri` is `next Friday`).
- **Directions.** The `COMPASS` words, also with `-erly`, `-ern` or `-ward(s)` (`westerly`, `southern`). In the sentence only, `COMPASS_ABBREVIATIONS` as whole uppercase tokens count as the `COMPASS` word at the same index (`SSW` is `south-southwest`).

**Missing facts.** With no `facts`, or a missing field needed by a claim, that claim refuses (`size`, `wind_timing` or `breaker`). Candidate text alone never licenses these fact claims.

The checks, in order:

1. `empty` (blank), `too_long` (over 240 characters), `verdict_word` (a whole UPPERCASE `VERDICT_WORDS` word: native's `YES`, `MAYBE` and `NO`, and the card's labels; matched case-sensitively, with only whitespace between the words of `EARLY LOOK`, never a hyphen, so lowercase "good" or "no wind" stays prose), `the_call` (the existing prohibited phrase).
2. Blank region and beach names.
3. `size` (foot ranges): case-insensitively match `([0-9]{1,2})(?:\s*(?:-|–|—|to)\s*([0-9]{1,2}))?[\s-]*(ft|foot|feet)` with whole-token boundaries, using `FOOT_UNITS`. Foot ranges match ASCII `[0-9]` only. A single value uses the same low and high; a leading zero refuses as `digit` before the range check. Keep matched ranges in the working text through checks 3, 4, and 7; blank them only together with wind phrases after check 4 and before check 5. For standout attribution, a size claim is a body or overhead claim, foot range, `bigger`, any `SMALL_SIZES` word, or any `SIZE_ADJECTIVES` word. Size claims joined only by `to`, `and`, `or`, `&`, a hyphen, or whitespace form one chain; any other word between claims breaks the chain. A chain reads against standout facts only when an `at [the]` followed by a `STANDOUT_WORDS` form follows its last claim in the same clause, before any other size claim. Free prose between the chain and that phrase does not break attribution. The range must be ordered and satisfy `low >= faceFt.min && high <= faceFt.max`, or the same against `standoutFt` under that chain rule. For clause boundaries, blank foot ranges and wind phrases in a position-preserving view so punctuation inside either does not split the clause. Clauses otherwise split on the punctuation listed under day–verb binding.
4. `wind_timing`: case-insensitively match `<kind form> <span form>`, `<kind form> by <hour>[ AM suffix]` (ASCII `[0-9]` hours 7–12), or `<kind form> by noon`, from `WIND_TIMING`; `[\s-]+` separates words, and the AM suffix can attach without a space (`10am`). The suffix keys are `clock.suffixes` (AM) and `clock.pmSuffixes`; a PM suffix, with or without a space, refuses. A span covers `[from, to)`; "by H" covers `[H, 13)` and noon is 12. There must be at least one `windHours` row in those hours and every such row must have `relation === kind`; for `light`, every row needs non-null `mph < 8`. The `light` prefix can precede any wind kind form; before an offshore or onshore form ("light offshore early") it requires both the relation and non-null `mph < 8` for every row. The `all day`, `all morning` and `all afternoon` spans also need an hour at or before `max(from, daylightFrom) + edgeHours` and an hour at or after `min(to, daylightTo) - edgeHours`, where `WIND_TIMING.cover` sets daylight 6–18 and a two-hour edge. The fourth element of each `WIND_TIMING.spans` entry marks its "all" forms, which need this coverage. Keep matched wind phrases in the working text until check 4 completes; then blank them together with foot ranges before check 5.
5. `digit`: any Unicode numeral (category `N`) left after foot ranges and wind phrases are blanked; this includes ASCII digits. Foot ranges and clock hours themselves match ASCII `[0-9]` only.
6. `number`: a `NUMBER_WORDS` word, hyphenated forms included ("six-foot").
7. `size` (size words): `<body>[\s-]+(high|height)` claims that `BODY_SIZES` body; `<body>[\s-]+to[\s-]+<body-or-overhead>([\s-]+high)?` and `<body>[\s-]+and[\s-]+<body>[\s-]+high` claim the named buckets. `<body-or-overhead>` means `BODY_SIZES` plus "double overhead" and "overhead". `OVERHEAD_SIZES` forms claim their first form, longest first. The fact's `sizes` are read as given, with `SIZE_BUCKETS` half-open `[lo, hi)` ranges: a face range licenses buckets where `lo < max && hi > min`; a single face value licenses the bucket that holds it. For standout attribution, a size claim is a body or overhead claim, foot range, `bigger`, any `SMALL_SIZES` word, or any `SIZE_ADJECTIVES` word. Size claims joined only by `to`, `and`, `or`, `&`, a hyphen, or whitespace form one chain; any other word between claims breaks the chain. A body or overhead claim chain reads against standout facts only when an `at [the]` followed by a `STANDOUT_WORDS` form follows its last claim in the same clause, before any other size claim. Free prose between the chain and that phrase does not break attribution. Foot ranges use the same chain rule. The clause boundary view blanks foot ranges and wind phrases, preserving positions so punctuation inside them does not split the clause. After recognized size claims are blanked, a remaining bare `knee`, `waist` or `chest` refuses as `size`; `head` and `shoulder` remain prose. `SMALL_SIZES` words require `faceFt.max <=` their value. If `bigger` and any standout form occur anywhere in the sentence, `standoutFt` is required; for this rule only, the standout form also includes singular "standout". Any remaining `SIZE_ADJECTIVES` word refuses (including triple and quadruple overhead forms). Relative words ("runs biggest Thursday") stay prose. Blank these phrases after checking them.
8. `breaker`: `BREAKER_WORDS` forms claim their first form. `pitching` requires character pitching; `hollow` requires character pitching and feel punchy; `punchy` requires feel punchy; `crumbly` requires character crumbly; `soft` requires feel soft, or feel null and character crumbly; `peaky` requires character crumbly; `lined up` requires character pitching; the closing-out forms, including `closeout`, `close-out`, `close outs`, `close-outs`, `closed out` and `closed-out`, require `closingOut: true`. Blank matched phrases.
9. `weekday`: a day unit the candidate doesn't name. `weekday_order`: the sentence's day units, each once in first-appearance order, are not in the candidate's order (it may leave days out, never swap them).
10. `direction`: a direction the candidate doesn't name.
11. `beach`: a region beach the candidate doesn't name, or the sentence's beaches (each once, first appearance) out of the candidate's order.
12. `timing`: the sentence's `TIME_QUALIFIERS` are not exactly the candidate's, or it makes a `RELATIVE_TIME_WORDS` claim (plurals included) the candidate doesn't. Every past form in `PHASE_VERBS` is a time qualifier, so "arrived" and "showed up" are kept exactly, like "peaked".
13. `weekday_order` (day–verb binding): the sentence pairs a day with a phase verb the candidate doesn't. The units are the day units plus `DAY_PHRASES` (bare `earlier` included: the card writes "peaked earlier" for a day more than six days back, so `earlier` is a time qualifier too, and "earlier this week" is not "earlier in the week"). Each unit pairs with every `PHASE_VERBS` form between it and the previous unit in its clause, or the clause's start; a clause ends at `,` `;` `:` `.` `!` `?` `(` `)` `…`, an en or em dash, or a hyphen with spaces around it. A unit with no phase verb between it and the previous unit in its clause takes that unit's phase verbs instead, so "peaks Friday and Saturday" pairs peaks with both days and "builds from Thursday into Friday" pairs builds with both. Units are *listed* when only commas and `LIST_JOINERS` stand between them. A phase verb with no unit after it in its clause pairs with the clause's last unit before it and with every unit listed before that one, so "Thursday peaks" and "a Thursday peak" pair peaks with Thursday and "Thursday and Friday both peak" pairs it with both; a verb alone in its clause pairs with none. Across a comma, units are listed only when the clause the verb doesn't reach holds nothing but units and joiners. So "peaks Friday, Saturday" gives Saturday Friday's verbs, and "Thursday, Friday and Saturday all peak" reaches Thursday, but "arrives Thursday, peaks Friday" and "arrives Thursday, Friday it peaks" keep each clause's own verbs. Every sentence pair must be one of the candidate's pairs: against "arrives Thursday, peaks Friday and fades Saturday", "arrives Thursday and fades Friday" fails, "arrives and peaks Friday" fails because it pairs arrives with Friday too, and "rolls in Friday" fails while "shows up Thursday" passes. `reaches` is the cover's arrival and `most` the cover's peak ("with the most swell Thursday"). These forms only bind days; a sentence may use any of them. "starts" is no phase verb: the lead's "Thursday starts the west swell's run toward a Friday peak" would pair it with Friday. Nor is "fills in": the wind lines' "the onshore fills in" names wind, so "The onshore fills in Friday after a cleaner morning" passes against "On Friday, the onshore fills in after the cleaner morning".
14. Closed sets: the sentence makes a `CLOSED_WORD_SETS` claim the candidate doesn't. The refusal reason is the set's name: `wind`, `comparison`, `tide`, `period`, `exposure` or `wind_strength`. Remaining closed-set words in a card beach line follow these sets. On the candidate's side only, a `wind_strength` claim also licenses the claims `WIND_STRENGTH_IMPLIES` lists for it, so a light-wind line allows "clean" and "glassy" and a windy one allows "choppy" (never "blown out", which stays the rating's own reason), but "clean" never licenses "light". Then `wind` again: the sentence's `wind` claims, each once in first-appearance order, are not in the candidate's order, so "starts offshore, then turns onshore" never reads "starts onshore, then turns offshore".
15. `exposure` (degree): the sentence's `DEGREE_WORDS` claims are not exactly the candidate's. "Sheltered from…" fails against "Partly sheltered from…", and "Wide open to the west groundswell" fails against "Faces the west groundswell dead on" because it drops "dead on".

Any other word is free prose: against "Faces the west groundswell dead on, with light wind in its window", "Takes the west groundswell dead on, and the wind stays light" passes.

```json claims
{
  "COMPASS": ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"],
  "WEEKDAY": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "CLOSED_WORD_SETS": {
    "wind": [["offshore", "offshores"], ["onshore", "onshores", "sea breeze", "sea breezes"]],
    "comparison": [["better"], ["worse"]],
    "tide": [["low"], ["high"], ["rising"], ["falling"]],
    "period": [["long-period"], ["mid-period"], ["short-period"], ["groundswell", "groundswells"], ["windswell", "windswells"], ["storm", "stormy", "storms"]],
    "exposure": [["sheltered", "shelter", "shelters", "sheltering"], ["shadow", "shadowed", "shadows"], ["partly", "partially"], ["faces", "face", "facing", "faced", "catches", "catching", "exposed", "wide open"], ["head on"], ["straight on"], ["dead on"], ["at an angle", "angled"]],
    "wind_strength": [["light"], ["glassy"], ["calm"], ["breezy"], ["windy", "wind is up", "wind's up", "wind up", "wind still up", "wind is still up", "wind picks up", "wind comes up"], ["blown out"], ["gusty"], ["lighter"], ["calmer"], ["clean", "cleans", "cleaned", "cleaning", "cleaner"], ["choppy"], ["bumpy"], ["messy"]]
  },
  "WIND_STRENGTH_IMPLIES": {
    "light": ["clean", "glassy", "calm"],
    "windy": ["choppy", "bumpy", "messy", "gusty"],
    "breezy": ["bumpy"]
  },
  "DEGREE_WORDS": [["partly", "partially"], ["dead on"], ["at an angle", "angled"], ["head on"], ["straight on"]],
  "PHASE_VERBS": {
    "arrives": ["arrives", "arrive", "arriving", "arrived", "reaches", "reach", "reaching", "reached", "pushes in", "push in", "pushing in", "pushed in", "shows up", "show up", "showing up", "showed up", "rolls in", "roll in", "rolling in", "rolled in"],
    "peaks": ["peaks", "peak", "peaking", "peaked", "most"],
    "fades": ["fades", "fade", "fading", "faded"],
    "comes and goes": ["comes and goes", "come and go", "coming and going", "came and went"],
    "builds": ["builds", "build", "building", "built"],
    "eases": ["eases", "ease", "easing", "eased"]
  },
  "TIME_QUALIFIERS": ["a week from", "next week", "earlier in the week", "earlier", "later on", "peaked", "faded", "arrived", "reached", "pushed in", "showed up", "rolled in", "eased", "built", "came and went", "today", "tonight", "tomorrow"],
  "DAY_PHRASES": ["next week", "earlier in the week", "earlier", "later on", "today", "tonight", "tomorrow"],
  "WEEK_FROM_DAYS": ["a week from today", "a week from Sunday", "a week from Monday", "a week from Tuesday", "a week from Wednesday", "a week from Thursday", "a week from Friday", "a week from Saturday"],
  "NEXT_WEEKDAYS": ["next Sunday", "next Monday", "next Tuesday", "next Wednesday", "next Thursday", "next Friday", "next Saturday"],
  "LIST_JOINERS": ["and", "or", "&"],
  "RELATIVE_TIME_WORDS": [["same day"], ["next day"], ["day after"], ["following day"], ["weekend"], ["overnight"], ["midweek"], ["dawn"], ["sunrise"], ["morning"], ["midday", "noon"], ["afternoon"], ["evening"], ["sunset"], ["dusk"], ["night"], ["midnight"]],
  "NUMBER_WORDS": ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "hundreds", "dozen", "dozens", "half", "feet", "foot", "ft", "seconds", "mph", "knots", "meter", "meters", "metre", "metres", "inch", "inches", "mile", "miles"],
  "SIZE_ADJECTIVES": ["big", "huge", "massive", "solid", "pumping", "firing", "epic", "triple overhead", "triple-overhead", "quadruple overhead", "quadruple-overhead"],
  "SIZE_BUCKETS": [["knee", 0, 2], ["waist", 2, 3], ["chest", 3, 5], ["shoulder", 4, 5], ["head", 5, 7], ["overhead", 7, 12], ["double overhead", 12, 100]],
  "BODY_SIZES": ["knee", "waist", "chest", "shoulder", "head"],
  "OVERHEAD_SIZES": [["double overhead", "double-overhead"], ["overhead"]],
  "SMALL_SIZES": {"small": 3, "tiny": 2, "flat": 1},
  "STANDOUT_WORDS": ["standouts", "best spots", "best breaks", "best reefs", "swell magnets"],
  "FOOT_UNITS": ["ft", "foot", "feet"],
  "WIND_TIMING": {
    "kinds": {"offshore": ["offshore", "offshores", "offshore wind", "offshore winds"],
              "onshore": ["onshore", "onshores", "onshore wind", "onshore winds", "sea breeze", "sea breezes"],
              "light": ["light wind", "light winds", "glassy", "calm"]},
    "spans": {"early": [0, 9, ["early", "at dawn", "first thing"]], "morning": [0, 12, ["all morning", "in the morning", "mornings"], ["all morning"]],
              "afternoon": [12, 24, ["in the afternoon", "afternoons", "all afternoon"], ["all afternoon"]], "after lunch": [13, 24, ["after lunch"]],
              "all day": [0, 24, ["all day"], ["all day"]]},
    "clock": {"firstHour": 7, "lastHour": 12, "untilHour": 13, "suffixes": ["AM", "am", "a.m."], "pmSuffixes": ["PM", "pm", "p.m.", "P.M.", "p.m", "P.M"], "noon": "noon"},
    "cover": {"daylightFrom": 6, "daylightTo": 18, "edgeHours": 2},
    "lightPrefix": "light",
    "lightBelowMph": 8
  },
  "BREAKER_WORDS": [["pitching", "pitches", "throwing", "throws"], ["hollow"], ["punchy"], ["crumbly", "crumbling", "crumbles", "spilling"],
                    ["soft", "mushy"], ["peaky"], ["lined up", "lined-up", "lines up", "lining up"], ["closing out", "closes out", "close out", "closeouts", "closeout", "close-out", "close outs", "close-outs", "closed out", "closed-out"]],
  "VERDICT_WORDS": ["YES", "MAYBE", "NO", "EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH", "LIKELY", "EARLY LOOK"],
  "COMPASS_ABBREVIATIONS": ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
  "WEEKDAY_ABBREVIATIONS": ["Sun", "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat"]
}
```
