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
    text: string; // server-reconstituted regional candidate, gated against live data
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

`availability: 'ready'` requires selected candidates to pass their gates against the live Week Scout response. A valid published edition wins. Without one, the server reads today's cached regional input or builds it from regional forecasts without persisting it, then chooses the lowest-rank passing candidate for each slot. Swell copy in the cover, lead, and swell chapters must name the first charted cover swell (the first live swell arriving or peaking in the seven days): same arrival and peak local dates, and the same 16-point direction as its `directionLabel`. When no regional cover or lead candidate does, because the regional beach sample dated or binned that swell differently from the user's chart, the fallback composes that slot from the charted swell itself, with every gate field taken from it and no region named. Regional events outside the seven days do not count toward the three-event limit, and regional periods are rounded to 0.1 s like `swells[].periodS` before banding. The serve-only input has a five-minute per-region/day memory cache; no fallback database write occurs. Slots whose gates fail are omitted; a fallback with no passing candidate is `unavailable`. `outside_region` covers a missing home beach or a home region absent from the active-region query. A quiet week can be `ready` only when every claimed day has complete safe forecast coverage; a missing or held day cannot become a quiet chapter. The directional cover never claims a storm source or travel distance until source geometry and track provenance are verified.

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

The worker API is separate: `GET /api/internal/week-scout-story/regions`, `GET /api/internal/week-scout-story/input?region=<URL-encoded beaches.region>`, `POST /api/internal/week-scout-story/editions`, and `GET /api/internal/week-scout-story/latest?region=<URL-encoded beaches.region>`. Region values are the original `beaches.region` strings, including spaces or accents. It uses the briefing publisher's Bearer authentication pattern with its own `WEEK_SCOUT_STORY_PUBLISHER_TOKEN` (at least 32 characters), schema 3, candidate IDs only, and a deterministic artifact ID. It never sends user data or prose supplied directly by the model to the reader.

Worker request and response shapes:

```ts
type RegionList = { schemaVersion: 3; regions: Array<{ region: string; timezone: string }> };
type StoryGate =
  | { kind: 'swell'; regionalEventKey: string; directionSector: number; directionIndex?: number; periodBand: number; periodClass?: 'long' | 'short'; arrivalLocalDate: string; peakLocalDate: string; fadeLocalDate: string | null; confidence: 'on_the_radar' | 'likely' | 'locked'; minimumBeaches: number }
  | { kind: 'origin'; regionalEventKey: string; sourceAreaId: string; sourceLat: number; sourceLon: number; trackRevision: string; arrivalOrder: number; confidence: 'likely' | 'locked' }
  | { kind: 'exposure'; regionalEventKey: string; directionSector: number; exposure: 'open' | 'partial' | 'shadowed'; minimumBeaches: number; beaches?: Array<{ beachId: string; exposure: 'open' | 'partial' | 'shadowed' }> }
  | { kind: 'wind'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; fromWindClass: 'offshore' | 'onshore'; windClass: 'offshore' | 'onshore'; forecastRevision: string; beachId?: string; fromBucket?: 'morning' | 'midday' | 'evening'; fromDirection?: string; toDirection?: string }
  | { kind: 'tide'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; tidePhase: string; windowOrder: 'opens' | 'closes'; forecastRevision: string; beachId?: string }
  | { kind: 'change'; fromDate: string; toDate: string; direction: 'better' | 'worse'; minimumScoreChange: number; sourceSeries: string }
  | { kind: 'day'; localDate: string; bucket: 'morning' | 'midday' | 'evening'; reason: 'light_wind' | 'rising_tide' | 'clean_window' }
  | { kind: 'quiet'; fromDate: string; toDate: string; completeDates: string[] };
type Candidate = { id: string; slot: 'cover' | 'story:lead' | 'story:turn' | `swell:${string}` | `day:${string}` | `quiet:${string}`; text: string; gate: StoryGate; rank?: number };
type StoryInput = {
  schemaVersion: 3; region: string; editionDate: string; sourcePublishedAt: string;
  validUntil: string; inputHash: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: [] };
  copyFacts: Candidate[];
  provenance: { sourceIds: string[]; sourceHashes: string[]; generationInputVersion: string;
    representativeBeachIds: string[]; coverageDates: string[];
    coverage?: Array<{ localDate: string; sampleBeaches: number; rows: number }>;
    fixture?: boolean };
};
type StoryArtifact = Omit<StoryInput, 'copyFacts' | 'briefing'> & {
  artifactId: string; generationVersion: 'week-scout-story-1'; model: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[] };
};
```

`GET /regions` returns `RegionList`. `GET /input` returns `StoryInput`; a sparse or stale region returns HTTP 409. The worker submits `StoryArtifact` to `POST /editions`; the server accepts only issued candidate IDs in issue order, requires `cover` and `story:lead` when offered, and rejects changed fields. `artifactId` is SHA-256 of canonical JSON with `artifactId` omitted, using the existing briefing hash rule. The response is `{ artifactId: string }`, HTTP 201 for first publish or 200 for an identical retry. `GET /latest` returns the stored `StoryArtifact` or HTTP 404. All four routes send `Cache-Control: private, no-store, no-cache, must-revalidate` through the publisher wrapper.
