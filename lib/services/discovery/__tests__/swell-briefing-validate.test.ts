import { describe, expect, it } from "@jest/globals";

import { briefingArtifactId, briefingInputHash } from "../swell-briefing-hash";
import workerFixture from "./fixtures/python-worker-artifact.json";
import {
  BriefingValidationError,
  assertArtifactMatchesInput,
} from "../swell-briefing-validate";
import type {
  SwellBriefing,
  SwellBriefingArtifact,
  SwellBriefingInputSnapshot,
} from "../swell-briefing-types";

const CARDIFF = "80efa1c0-37a2-4879-819b-647ae3c3d749";
const LA_JOLLA = "d291411d-d331-4bf1-ad1a-302da3c69de0";

function briefing(): SwellBriefing {
  return {
    editionDate: "2026-10-25",
    regionLabel: "San Diego",
    headline: "Small now. SW builds late week.",
    generatedAt: "2026-10-25T12:55:00.000Z",
    dataAt: "2026-10-25T12:00:00.000Z",
    freshness: "fresh",
    photo: { beachId: CARDIFF, beachName: "Cardiff Reef", imageUrl: null },
    today: {
      date: "2026-10-25",
      exposures: [
        {
          exposure: "south_facing",
          label: "South-facing",
          surfFt: { min: 2, max: 3.5 },
          surfLabel: "waist – chest",
          beach: { id: CARDIFF, name: "Cardiff Reef" },
        },
      ],
      primaryDirectionDeg: 215,
      primaryDirectionLabel: "SW SWELL",
      primaryPeriodS: 15,
      call: "Worth a dawn check at south-facing breaks.",
    },
    next48: [
      {
        date: "2026-10-26",
        note: "Clean until mid-morning.",
        periods: [
          {
            period: "am",
            kind: "offshore",
            label: "OFFSHORE",
            speedLabel: "5 – 10 mph",
            speedMph: 10,
            directionDeg: 65,
            surfFt: { min: 2, max: 3 },
            surfLabel: "waist high",
          },
        ],
      },
    ],
    week: [
      {
        date: "2026-10-25",
        surfFt: { min: 2, max: 3.5 },
        trend: "small",
        label: "Small early",
        uncertain: false,
        highlightLabel: null,
        caveat: null,
        beach: null,
      },
    ],
    advisories: [],
  };
}

function input(overrides: Partial<SwellBriefingInputSnapshot> = {}): SwellBriefingInputSnapshot {
  const snapshot = {
    schemaVersion: 1 as const,
    userId: "11111111-1111-4111-8111-111111111111",
    region: "san-diego",
    editionDate: "2026-10-25",
    sourcePublishedAt: "2026-10-25T12:00:00.000Z",
    validUntil: "2026-10-26T12:00:00.000Z",
    briefing: briefing(),
    copyFacts: [
      { id: "headline-small", slot: "headline", text: "Small surf; watch the later swell." },
      { id: "today-qualified", slot: "todayCall", text: "An early check may be worthwhile." },
    ],
    provenance: { sourceIds: ["edition-1"], sourceHashes: ["abc"], generationInputVersion: "1" },
    inputHash: "",
    ...overrides,
  };
  snapshot.inputHash = briefingInputHash(snapshot as unknown as Record<string, unknown>);
  return snapshot;
}

function artifactFor(
  snapshot: SwellBriefingInputSnapshot,
  mutate: (briefing: SwellBriefing) => SwellBriefing = (value) => value,
): SwellBriefingArtifact {
  const content = {
    schemaVersion: 1 as const,
    userId: snapshot.userId,
    region: snapshot.region,
    editionDate: snapshot.editionDate,
    inputHash: snapshot.inputHash,
    sourcePublishedAt: snapshot.sourcePublishedAt,
    validUntil: snapshot.validUntil,
    generationVersion: "1",
    model: "gemma4:12b-32k",
    briefing: mutate(JSON.parse(JSON.stringify(snapshot.briefing)) as SwellBriefing),
    provenance: snapshot.provenance,
  };
  return { ...content, artifactId: briefingArtifactId(content as unknown as Record<string, unknown>) };
}

function reason(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof BriefingValidationError) return error.message;
    throw error;
  }
  return "no_error";
}

describe("assertArtifactMatchesInput", () => {
  it("accepts an artifact that changed nothing", () => {
    const snapshot = input();
    expect(() => assertArtifactMatchesInput(artifactFor(snapshot), snapshot)).not.toThrow();
  });

  it("accepts copy the server offered for that slot", () => {
    const snapshot = input();
    const artifact = artifactFor(snapshot, (value) => ({
      ...value,
      headline: "Small surf; watch the later swell.",
    }));

    expect(() => assertArtifactMatchesInput(artifact, snapshot)).not.toThrow();
  });

  it("refuses copy that was never offered", () => {
    const snapshot = input();
    const artifact = artifactFor(snapshot, (value) => ({ ...value, headline: "Pumping all week!" }));

    expect(reason(() => assertArtifactMatchesInput(artifact, snapshot))).toBe("copy_not_offered");
  });

  it("refuses an offered phrase placed in the wrong slot", () => {
    const snapshot = input();
    // `headline-small` is a headline candidate, not a today call.
    const artifact = artifactFor(snapshot, (value) => ({
      ...value,
      today: { ...value.today, call: "Small surf; watch the later swell." },
    }));

    expect(reason(() => assertArtifactMatchesInput(artifact, snapshot))).toBe("copy_not_offered");
  });

  describe("code-owned values survive generation", () => {
    const cases: Array<[string, (value: SwellBriefing) => SwellBriefing]> = [
      ["a surf height", (value) => ({
        ...value,
        today: {
          ...value.today,
          exposures: [{ ...value.today.exposures[0], surfFt: { min: 6, max: 9 } }],
        },
      })],
      ["a wind speed", (value) => ({
        ...value,
        next48: [{
          ...value.next48[0],
          periods: [{ ...value.next48[0].periods[0], speedMph: 40, speedLabel: "40 mph" }],
        }],
      })],
      ["a beach reference", (value) => ({
        ...value,
        today: {
          ...value.today,
          exposures: [{
            ...value.today.exposures[0],
            beach: { id: LA_JOLLA, name: "La Jolla Shores" },
          }],
        },
      })],
      ["the swell direction", (value) => ({
        ...value,
        today: { ...value.today, primaryDirectionDeg: 300 },
      })],
      ["the uncertainty flag", (value) => ({
        ...value,
        week: [{ ...value.week[0], uncertain: true }],
      })],
      ["an added advisory", (value) => ({
        ...value,
        advisories: [{ id: "x", kind: "hazard", title: "SHARK", body: "Invented.", beach: null }],
      })],
      ["the edition date", (value) => ({ ...value, editionDate: "2026-10-26" })],
      ["the data timestamp", (value) => ({ ...value, dataAt: "2026-10-26T12:00:00.000Z" })],
    ];

    for (const [name, mutate] of cases) {
      it(`rejects ${name}`, () => {
        const snapshot = input();
        expect(reason(() => assertArtifactMatchesInput(artifactFor(snapshot, mutate), snapshot)))
          .toBe("briefing_values_altered");
      });
    }
  });

  it("rejects a beach id that is not a UUID", () => {
    const snapshot = input({
      briefing: {
        ...briefing(),
        photo: { beachId: "beach-cardiff-reef", beachName: "Cardiff Reef", imageUrl: null },
      },
    });

    expect(reason(() => assertArtifactMatchesInput(artifactFor(snapshot), snapshot)))
      .toBe("beach_id_not_uuid");
  });

  it("rejects publishing a development fixture", () => {
    const snapshot = input({
      provenance: {
        sourceIds: ["fixture"],
        sourceHashes: ["x"],
        generationInputVersion: "1",
        fixture: true,
      },
    });

    expect(reason(() => assertArtifactMatchesInput(artifactFor(snapshot), snapshot)))
      .toBe("fixture_not_publishable");
  });

  it("reports a malformed briefing as a bad request, not a crash", () => {
    const snapshot = input();
    for (const bad of [null, "nope", 42, [], { today: "nope" }, { today: {}, week: "nope" }]) {
      const artifact = { ...artifactFor(snapshot), briefing: bad } as unknown as SwellBriefingArtifact;
      const code = reason(() => assertArtifactMatchesInput(artifact, snapshot));
      expect(code).toMatch(/^briefing_malformed/);
    }
  });

  it("rejects an artifact bound to another account", () => {
    const snapshot = input();
    const artifact = { ...artifactFor(snapshot), userId: "22222222-2222-4222-8222-222222222222" };

    expect(reason(() => assertArtifactMatchesInput(artifact, snapshot))).toBe("user_mismatch");
  });

  it("refuses a re-dated source, so regenerating cannot make an old edition fresh", () => {
    const snapshot = input();
    const artifact = { ...artifactFor(snapshot), sourcePublishedAt: "2026-10-26T12:00:00.000Z" };

    expect(reason(() => assertArtifactMatchesInput(artifact, snapshot)))
      .toBe("source_published_at_mismatch");
  });
});

/**
 * The fixture is produced by the worker's own `merge_copy` and `run()` stamping,
 * not hand-written here. The previous suite passed while every real upload was
 * refused, because its helper copied the briefing verbatim instead of doing
 * what the worker does. These cases pin the contract to the worker's code.
 */
describe("assertArtifactMatchesInput against a real worker artifact", () => {
  type Fixture = {
    snapshot: SwellBriefingInputSnapshot;
    artifact: SwellBriefingArtifact;
    serverNow: string;
  };
  const fixture = workerFixture as unknown as Fixture;
  const now = new Date(fixture.serverNow);

  function mutated(change: (briefing: SwellBriefing) => void): SwellBriefingArtifact {
    const copy = JSON.parse(JSON.stringify(fixture.artifact)) as SwellBriefingArtifact;
    change(copy.briefing);
    return copy;
  }

  it("accepts the worker's artifact as uploaded", () => {
    expect(() => assertArtifactMatchesInput(fixture.artifact, fixture.snapshot, now)).not.toThrow();
  });

  it("agrees with the worker's artifact id, microsecond timestamp included", () => {
    expect(briefingArtifactId(fixture.artifact as unknown as Record<string, unknown>))
      .toBe(fixture.artifact.artifactId);
  });

  describe("generation time is the worker's, within bounds", () => {
    it("rejects a time before the input was issued", () => {
      const artifact = mutated((b) => { b.generatedAt = "2026-10-26T10:00:00.000Z"; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
        .toBe("generated_before_input");
    });

    it("rejects a time in the future", () => {
      const artifact = mutated((b) => { b.generatedAt = "2026-10-26T13:00:00.000Z"; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
        .toBe("generated_in_future");
    });

    it("rejects a time after the input expired", () => {
      const late = new Date("2026-10-28T08:00:00.000Z");
      const artifact = mutated((b) => { b.generatedAt = "2026-10-28T07:30:00.000Z"; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, late)))
        .toBe("generated_after_expiry");
    });

    it("rejects a missing or unreadable time", () => {
      for (const value of [null, 42, "not a time"]) {
        const artifact = mutated((b) => { (b as unknown as { generatedAt: unknown }).generatedAt = value; });
        expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
          .toBe("generated_at_invalid");
      }
    });

    it("still refuses a moved data timestamp, which stays the server's", () => {
      const artifact = mutated((b) => { b.dataAt = "2026-10-26T12:30:00.000Z"; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
        .toBe("briefing_values_altered");
    });
  });

  describe("copy follows the worker's slot rules", () => {
    it("leaves backend copy alone where no candidate was offered", () => {
      const cleared = mutated((b) => { b.next48[1].note = null; });
      expect(reason(() => assertArtifactMatchesInput(cleared, fixture.snapshot, now)))
        .toBe("copy_slot_not_writable");

      const rewritten = mutated((b) => { b.next48[1].note = "Cleanest early."; });
      expect(reason(() => assertArtifactMatchesInput(rewritten, fixture.snapshot, now)))
        .toBe("copy_slot_not_writable");
    });

    it("keeps the week label code-owned; week copy is the caveat", () => {
      const artifact = mutated((b) => { b.week[1].label = "More size arriving."; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
        .toBe("briefing_values_altered");
    });

    it("always requires a headline", () => {
      const artifact = mutated((b) => { (b as unknown as { headline: unknown }).headline = null; });
      expect(reason(() => assertArtifactMatchesInput(artifact, fixture.snapshot, now)))
        .toBe("headline_missing");
    });
  });
});
