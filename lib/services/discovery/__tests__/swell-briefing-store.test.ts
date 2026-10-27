import { describe, expect, it } from "@jest/globals";

import { briefingArtifactId } from "../swell-briefing-hash";
import { loadLatestBriefingEdition, loadLatestBriefingInput, selectCurrentEdition, toArtifact, type EditionRow } from "../swell-briefing-store";
import type { SwellBriefingArtifact } from "../swell-briefing-types";
import fixture from "./fixtures/python-worker-artifact.json";

function row(over: Partial<EditionRow> & { generatedAt: string }): EditionRow {
  const { generatedAt, ...rest } = over;
  return {
    artifact_id: "a",
    user_id: "u",
    region: "san-diego",
    edition_date: "2026-10-26",
    input_hash: "h",
    source_published_at: "2026-10-26T11:50:00+00:00",
    valid_until: "2026-10-28T06:59:59+00:00",
    generation_version: "1",
    model: "m",
    briefing: { generatedAt } as EditionRow["briefing"],
    provenance: null,
    ...rest,
  };
}

describe("selectCurrentEdition", () => {
  it("picks the latest generation even when an older one was inserted later", () => {
    // Rows arrive ordered newest insert first. The older generation landed
    // second, so it is first here - and must not win.
    const rows = [
      row({ artifact_id: "older-upload-landed-late", generatedAt: "2026-10-26T05:30:00+00:00" }),
      row({ artifact_id: "newer-generation", generatedAt: "2026-10-26T09:00:00+00:00" }),
    ];
    expect(selectCurrentEdition(rows).artifact_id).toBe("newer-generation");
  });

  it("only compares revisions of the newest day and source", () => {
    const rows = [
      row({ artifact_id: "current-source", generatedAt: "2026-10-26T05:30:00+00:00" }),
      row({
        artifact_id: "older-source",
        source_published_at: "2026-10-26T05:00:00+00:00",
        generatedAt: "2026-10-26T23:00:00+00:00",
      }),
    ];
    expect(selectCurrentEdition(rows).artifact_id).toBe("current-source");
  });

  it("keeps insert order as the tiebreak for equal generation times", () => {
    const rows = [
      row({ artifact_id: "inserted-last", generatedAt: "2026-10-26T05:30:00+00:00" }),
      row({ artifact_id: "inserted-first", generatedAt: "2026-10-26T05:30:00+00:00" }),
    ];
    expect(selectCurrentEdition(rows).artifact_id).toBe("inserted-last");
  });

  it("ranks an unreadable generation time last rather than failing", () => {
    const rows = [
      row({ artifact_id: "unreadable", generatedAt: "nope" }),
      row({ artifact_id: "readable", generatedAt: "2026-10-26T05:30:00+00:00" }),
    ];
    expect(selectCurrentEdition(rows).artifact_id).toBe("readable");
  });
});

describe("toArtifact", () => {
  it("reads back an artifact that still hashes to its own id", () => {
    const artifact = fixture.artifact as unknown as SwellBriefingArtifact;
    // How PostgREST returns the timestamptz columns the publish wrote.
    const stored: EditionRow = {
      artifact_id: artifact.artifactId,
      user_id: artifact.userId,
      region: artifact.region,
      edition_date: artifact.editionDate,
      input_hash: artifact.inputHash,
      source_published_at: "2026-10-26T11:50:00+00:00",
      valid_until: "2026-10-28T06:59:59+00:00",
      generation_version: artifact.generationVersion,
      model: artifact.model,
      briefing: artifact.briefing,
      provenance: artifact.provenance,
    };

    const readback = toArtifact(stored);

    expect(readback.sourcePublishedAt).toBe(artifact.sourcePublishedAt);
    expect(readback.validUntil).toBe(artifact.validUntil);
    expect(briefingArtifactId(readback as unknown as Record<string, unknown>)).toBe(artifact.artifactId);
  });
});

/** Records the filters a read applies; every read resolves empty. */
function recordingClient() {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
  return { client: { from: () => chain } as never, calls };
}

describe("reading one kind from the shared tables", () => {
  const USER = "23a9c100-dbee-4d1b-9178-3456a45935ad";

  it("filters editions by kind only when asked", async () => {
    const notes = recordingClient();
    await loadLatestBriefingEdition(notes.client, USER, "san-diego", { kind: "week_scout_notes" });
    expect(notes.calls).toContainEqual(["eq", ["briefing->>kind", "week_scout_notes"]]);

    const outlook = recordingClient();
    await loadLatestBriefingEdition(outlook.client, USER, "san-diego", { kind: "swell_outlook" });
    expect(outlook.calls).toContainEqual(["is", ["briefing->>kind", null]]);

    const any = recordingClient();
    await loadLatestBriefingEdition(any.client, USER, "san-diego");
    expect(any.calls.filter(([, args]) => args[0] === "briefing->>kind")).toEqual([]);
  });

  it("filters inputs by schema when asked", async () => {
    const { client, calls } = recordingClient();
    await loadLatestBriefingInput(client, USER, "san-diego", "2026-10-27", 1);
    expect(calls).toContainEqual(["eq", ["snapshot->>schemaVersion", "1"]]);
  });
});
