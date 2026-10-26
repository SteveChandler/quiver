import { describe, expect, it } from "@jest/globals";

import { selectCurrentEdition, type EditionRow } from "../swell-briefing-store";

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
