# Week Scout story wire contract (schema 3)

`POST /api/surf/week-scout` keeps every existing field. When `WEEK_SCOUT_STORY_ENABLED` is not `true`, the complete response is byte-identical to the current response. When enabled, `data.story` is always present. Its narrative fields are nullable; its picks and directional cover come from the live Week Scout response. No age or freshness fields belong in `story`.

```ts
type WeekScoutStory = {
  schemaVersion: 3;
  region: string | null; // region of the user's home beach, never inferred from a pilot setting
  availability: 'ready' | 'pending' | 'outside_region' | 'unavailable';
  cover: {
    text: string | null; // selected regional narrative; null without a valid edition
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
    pick: WeekScoutDay['bestDayWindow']; // exact live object, including verdict, score, call and times
  }>; // first seven live days only; existing days[] remains authoritative
};
```

`availability: 'ready'` requires a valid region edition with every selected candidate still passing its gate. If it fails, omit all regional prose and use `pending` or `unavailable`. `outside_region` covers a missing home beach or a home region absent from the active-region query. A quiet week can be `ready` only when every claimed day has complete safe forecast coverage; a missing or held day cannot become a quiet chapter. The directional cover never claims a storm source or travel distance until source geometry and track provenance are verified.

Covered example (inside the existing `{ success: true, data: ... }` envelope; other existing data fields omitted):

```json
{"story":{"schemaVersion":3,"region":"san-diego","availability":"ready","cover":{"text":"A west swell lines up the coast.","swells":[{"eventKey":"west-pulse","directionDeg":270,"directionLabel":"W","periodS":15,"arrivalAt":"2026-10-28T12:00:00Z","peakAt":"2026-10-29T18:00:00Z"}]},"lead":"The week builds after the first pulse.","turn":null,"chapters":[{"slot":"swell:west-pulse","text":"West-facing breaks feel the pulse first."}],"days":[{"localDate":"2026-10-28","pick":null}]}}
```

Uncovered example (the real `pick` is the exact `days[].bestDayWindow` object):

```json
{"story":{"schemaVersion":3,"region":null,"availability":"outside_region","cover":{"text":null,"swells":[]},"lead":null,"turn":null,"chapters":[],"days":[{"localDate":"2026-10-28","pick":null}]}}
```

Quiet-week example (no recommendable regional event and complete coverage for every claimed day):

```json
{"story":{"schemaVersion":3,"region":"san-diego","availability":"ready","cover":{"text":"A quieter stretch along the coast.","swells":[]},"lead":null,"turn":null,"chapters":[{"slot":"quiet:2026-10-28..2026-10-30","text":"No clear surf window through this stretch."}],"days":[{"localDate":"2026-10-28","pick":null},{"localDate":"2026-10-29","pick":null},{"localDate":"2026-10-30","pick":null}]}}
```

The worker API is separate: `GET /api/internal/week-scout-story/regions`, `GET /api/internal/week-scout-story/input?region=<slug>`, `POST /api/internal/week-scout-story/editions`, and `GET /api/internal/week-scout-story/latest?region=<slug>`. It uses the briefing publisher Bearer credential, schema 3, candidate IDs only, and a deterministic artifact ID. It never sends user data or prose supplied directly by the model to the reader.
