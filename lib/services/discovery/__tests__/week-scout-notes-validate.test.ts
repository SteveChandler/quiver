import { describe, expect, it } from "@jest/globals";

import { briefingInputHash } from "../swell-briefing-hash";
import {
  BriefingValidationError,
  assertBriefingArtifactMatchesInput,
  assertNotesArtifactMatchesInput,
} from "../swell-briefing-validate";
import type {
  BriefingArtifact,
  WeekScoutNoteCopyFact,
  WeekScoutNotesArtifact,
  WeekScoutNotesInputSnapshot,
} from "../swell-briefing-types";

const USER = "23a9c100-dbee-4d1b-9178-3456a45935ad";
const BLACKS = "6f1c1f3e-2b8a-4a55-9a43-0d1f3e1d6a01";
const NOW = new Date("2026-10-27T13:00:00.000Z");

const dayGate = { localDate: "2026-10-28", beachId: BLACKS, verdict: "worth_it" as const, bucket: "evening" as const };
const swellGate = { eventKey: "swell-a", confidence: "likely" as const };

const FACTS: WeekScoutNoteCopyFact[] = [
  { id: "headline-worth", slot: "headline", text: "Wednesday looks worth it.", gate: { days: [dayGate], swells: [] } },
  { id: "day-a-0", slot: "day:2026-10-28", text: "Blacks in the evening looks worth it.", gate: { days: [dayGate], swells: [] } },
  { id: "day-a-1", slot: "day:2026-10-28", text: "Worth it in the evening.", gate: { days: [dayGate], swells: [] } },
  { id: "swell-0-0", slot: "swell:swell-a", text: "Likely, and still firming up.", gate: { days: [], swells: [swellGate] } },
];

function input(): WeekScoutNotesInputSnapshot {
  const snapshot: WeekScoutNotesInputSnapshot = {
    schemaVersion: 2,
    userId: USER,
    region: "san-diego",
    editionDate: "2026-10-27",
    sourcePublishedAt: "2026-10-27T12:30:00.000Z",
    validUntil: "2026-10-29T06:59:59.000Z",
    briefing: { schemaVersion: 2, kind: "week_scout_notes", editionDate: "2026-10-27", generatedAt: "2026-10-27T12:30:00.000Z", notes: [] },
    copyFacts: FACTS,
    provenance: { sourceIds: ["week_scout:san-diego:2026-10-27"], sourceHashes: ["rev"], generationInputVersion: "notes-1" },
    inputHash: "",
  };
  snapshot.inputHash = briefingInputHash(snapshot as unknown as Record<string, unknown>);
  return snapshot;
}

/** What the worker's `merge_copy` uploads for these picks, in issue order. */
function artifact(picks: number[] = [0, 2, 3]): WeekScoutNotesArtifact {
  const issued = input();
  return {
    artifactId: "ignored-here",
    schemaVersion: 2,
    userId: USER,
    region: issued.region,
    editionDate: issued.editionDate,
    inputHash: issued.inputHash,
    sourcePublishedAt: issued.sourcePublishedAt,
    validUntil: issued.validUntil,
    generationVersion: "week-scout-notes-1",
    model: "gemma4:12b-32k",
    briefing: {
      ...issued.briefing,
      generatedAt: "2026-10-27T12:45:00.123456+00:00",
      notes: picks.map((index) => ({ slot: FACTS[index].slot, text: FACTS[index].text, gate: JSON.parse(JSON.stringify(FACTS[index].gate)) })),
    },
    provenance: issued.provenance,
  };
}

function refusal(mutate: (value: WeekScoutNotesArtifact) => void, issued = input()): string {
  const value = artifact();
  mutate(value);
  try {
    assertNotesArtifactMatchesInput(value, issued, NOW);
  } catch (error) {
    expect(error).toBeInstanceOf(BriefingValidationError);
    return (error as Error).message;
  }
  throw new Error("expected a refusal");
}

describe("assertNotesArtifactMatchesInput", () => {
  it("accepts the issued candidates the worker picked, gates and all", () => {
    expect(() => assertNotesArtifactMatchesInput(artifact(), input(), NOW)).not.toThrow();
    expect(() => assertNotesArtifactMatchesInput(artifact([1]), input(), NOW)).not.toThrow();
  });

  it("refuses rewritten text", () => {
    expect(refusal((value) => { value.briefing.notes[1].text = "Six foot and pumping."; })).toBe("copy_not_offered");
  });

  it("refuses a loosened gate even when the text was offered", () => {
    expect(refusal((value) => { value.briefing.notes[0].gate.days[0].verdict = "maybe"; })).toBe("copy_not_offered");
    expect(refusal((value) => { value.briefing.notes[2].gate.swells = []; })).toBe("copy_not_offered");
  });

  it("refuses text moved to another slot", () => {
    expect(refusal((value) => { value.briefing.notes[1].slot = "day:2026-10-29"; })).toBe("copy_not_offered");
  });

  it("refuses two notes in one slot", () => {
    expect(refusal((value) => {
      value.briefing.notes.splice(2, 0, { slot: FACTS[1].slot, text: FACTS[1].text, gate: JSON.parse(JSON.stringify(FACTS[1].gate)) });
    })).toBe("duplicate_copy_slot");
  });

  it("refuses an empty edition", () => {
    expect(refusal((value) => { value.briefing.notes = []; })).toBe("notes_empty");
  });

  it("refuses notes out of issue order and added fields", () => {
    expect(refusal((value) => { value.briefing.notes.reverse(); })).toBe("briefing_values_altered");
    expect(refusal((value) => { (value.briefing as unknown as Record<string, unknown>).dataAt = "2026-10-27T12:00:00Z"; }))
      .toBe("briefing_values_altered");
  });

  it("refuses a malformed note before reading it", () => {
    expect(refusal((value) => { (value.briefing.notes as unknown[])[0] = "headline"; })).toBe("briefing_malformed:notes");
    expect(refusal((value) => { delete (value.briefing.notes[0] as Partial<typeof value.briefing.notes[0]>).gate; }))
      .toBe("briefing_malformed:notes");
  });

  it("refuses another account, another generation version, and a fixture input", () => {
    expect(refusal((value) => { value.userId = "f4a664aa-596c-4988-a268-9abe4a59c938"; })).toBe("user_mismatch");
    expect(refusal((value) => { value.generationVersion = "swell-briefing-1"; })).toBe("generation_version_unsupported");
    const fixture = input();
    fixture.provenance.fixture = true;
    expect(refusal(() => undefined, fixture)).toBe("fixture_not_publishable");
  });

  it("bounds the generation time the same way as the Outlook briefing", () => {
    expect(refusal((value) => { value.briefing.generatedAt = "2026-10-28T00:00:00Z"; })).toBe("generated_in_future");
    expect(refusal((value) => { value.briefing.generatedAt = "yesterday"; })).toBe("generated_at_invalid");
  });
});

describe("assertBriefingArtifactMatchesInput", () => {
  it("dispatches on the input's schema and refuses a mismatch", () => {
    expect(() => assertBriefingArtifactMatchesInput(artifact(), input(), NOW)).not.toThrow();
    const v1 = { ...artifact(), schemaVersion: 1 } as unknown as BriefingArtifact;
    expect(() => assertBriefingArtifactMatchesInput(v1, input(), NOW)).toThrow("schema_version_mismatch");
  });
});
