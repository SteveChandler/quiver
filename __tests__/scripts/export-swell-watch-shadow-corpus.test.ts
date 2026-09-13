import {
  buildCorpusManifest,
  sanitizeSwellWatchCorpusRows,
  type CandidateCorpusRow,
} from "@/scripts/export-swell-watch-shadow-corpus";

const validRow: CandidateCorpusRow = {
  schema_version: "swell-watch-shadow-corpus.v1",
  dataset_hash: "dataset-hash-a",
  window_start: "2026-08-01T00:00:00.000Z",
  window_end: "2026-08-31T23:59:59.999Z",
  observed_at: "2026-08-01T00:00:00.000Z",
  forecast_region_id: "region-a",
  beach_pseudonym: "beach-pseudonym-a",
  provider: "noaa",
  source_slot: "primary",
  evaluation_id: "noaa-evaluation-a",
  evaluation_reason: "available",
  issued_at: "2026-08-01T00:00:00.000Z",
  issuance_reason: "available",
  forecast_at: "2026-08-04T00:00:00.000Z",
  primary_height_ft: 4,
  primary_period_s: 12,
  primary_direction_deg: 280,
  secondary_height_ft: null,
  secondary_period_s: null,
  secondary_direction_deg: null,
  seam_bucket: "72h",
  outcome: "candidate",
  outcome_reason: "available",
  audience_evaluated: null,
  audience_reason: "audience_unavailable",
  recipient_count: 0,
  projected_send_count: 0,
  delivery_outcome: null,
  delivery_outcome_reason: "delivery_outcome_unavailable",
  provenance: "fixture",
};

describe("swell-watch shadow corpus export", () => {
  const scope = {
    inventory_id: "independent-scope-v1",
    inventory_hash: "independent-scope-hash",
    active_beach_pseudonyms: ["beach-pseudonym-a"],
    active_region_ids: ["region-a"],
  };

  function coverageCompleteRows(): CandidateCorpusRow[] {
    return Array.from({ length: 30 }, (_, day) =>
      (["noaa", "open_meteo"] as const).map((provider) => ({
        ...validRow,
        provenance: "retained" as const,
        provider,
        evaluation_id: `${provider}-evaluation-${day}`,
        observed_at: `2026-08-${String(day + 1).padStart(2, "0")}T12:00:00.000Z`,
        issued_at: `2026-08-${String(day + 1).padStart(2, "0")}T11:00:00.000Z`,
        seam_bucket: (["69h", "72h", "75h"] as const)[day % 3],
        outcome: (day % 2 === 0 ? "candidate" : "regional_event") as
          | "candidate"
          | "regional_event",
        audience_evaluated: true,
        audience_reason: "available" as const,
        recipient_count: 1,
        projected_send_count: 1,
        delivery_outcome: "success" as const,
        delivery_outcome_reason: "available" as const,
      })),
    ).flat();
  }

  it("keeps only the allowlisted, evaluation-safe row schema", () => {
    expect(sanitizeSwellWatchCorpusRows([validRow])).toEqual([validRow]);
  });

  it("rejects PII, raw payloads, untrusted providers, partial tuples, and reused issuance IDs", () => {
    expect(() =>
      sanitizeSwellWatchCorpusRows([{ ...validRow, user_id: "not-allowed" }]),
    ).toThrow("unsupported field: user_id");
    expect(() =>
      sanitizeSwellWatchCorpusRows([
        { ...validRow, raw_payload: "not-allowed" },
      ]),
    ).toThrow("unsupported field: raw_payload");
    expect(() =>
      sanitizeSwellWatchCorpusRows([{ ...validRow, email: "not-allowed" }]),
    ).toThrow("unsupported field: email");
    expect(() =>
      sanitizeSwellWatchCorpusRows([{ ...validRow, provider: "unknown" }]),
    ).toThrow("unsupported provider");
    expect(() =>
      sanitizeSwellWatchCorpusRows([{ ...validRow, secondary_height_ft: 1 }]),
    ).toThrow("complete tuple");
    expect(() => sanitizeSwellWatchCorpusRows([validRow, validRow])).toThrow(
      "duplicate evaluation record",
    );
    expect(() =>
      sanitizeSwellWatchCorpusRows([
        { ...validRow, audience_evaluated: "yes" },
      ]),
    ).toThrow("audience_evaluated must be boolean or null");
  });

  it("creates a deterministic manifest that cannot treat fixtures as calibration evidence", () => {
    const fixture = validRow;
    const manifest = buildCorpusManifest([fixture], {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      active_scope: {
        inventory_id: "fixture-scope",
        inventory_hash: "fixture-scope-hash",
        active_beach_pseudonyms: ["beach-pseudonym-a"],
        active_region_ids: ["region-a"],
      },
    });

    expect(manifest).toMatchObject({
      status: "blocked",
      row_count: 1,
      corpus_hash: expect.any(String),
      coverage: {
        fixture_rows_present: true,
        eligible_for_calibration: false,
      },
    });
    expect(
      buildCorpusManifest([fixture], {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-31T23:59:59.999Z",
        active_scope: {
          inventory_id: "fixture-scope",
          inventory_hash: "fixture-scope-hash",
          active_beach_pseudonyms: ["beach-pseudonym-a"],
          active_region_ids: ["region-a"],
        },
      }),
    ).toEqual(manifest);
  });

  it("derives retained days from observed rows and rejects missing provenance, scope, or window membership", () => {
    const retained = {
      ...validRow,
      provenance: "retained" as const,
      observed_at: "2026-08-02T00:00:00.000Z",
    };
    const scope = {
      inventory_id: "independent-scope-v1",
      inventory_hash: "independent-scope-hash",
      active_beach_pseudonyms: ["beach-pseudonym-a", "beach-pseudonym-b"],
      active_region_ids: ["region-a"],
    };

    expect(
      buildCorpusManifest([retained], {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-31T23:59:59.999Z",
        active_scope: scope,
      }),
    ).toMatchObject({
      retained_days: 1,
      active_beach_count: 2,
      covered_beach_count: 1,
      status: "blocked",
    });
    expect(() =>
      sanitizeSwellWatchCorpusRows([{ ...retained, provenance: undefined }]),
    ).toThrow("unsupported provenance");
    expect(() =>
      buildCorpusManifest(
        [{ ...retained, observed_at: "2026-09-01T00:00:00.000Z" }],
        {
          from: "2026-08-01T00:00:00.000Z",
          to: "2026-08-31T23:59:59.999Z",
          active_scope: scope,
        },
      ),
    ).toThrow("outside the declared observation window");
    expect(() =>
      buildCorpusManifest([retained], {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-31T23:59:59.999Z",
        active_scope: { ...scope, inventory_hash: "" },
      }),
    ).toThrow("independently declared active scope inventory");
  });

  it("keeps absent audience and delivery outcomes unknown rather than aliases or zeroes", () => {
    const retained = { ...validRow, provenance: "retained" as const };
    const manifest = buildCorpusManifest([retained], {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      active_scope: {
        inventory_id: "independent-scope-v1",
        inventory_hash: "independent-scope-hash",
        active_beach_pseudonyms: ["beach-pseudonym-a"],
        active_region_ids: ["region-a"],
      },
    });

    expect(manifest).toMatchObject({
      candidate_count: 1,
      audience_evaluated_candidate_count: null,
      delivery_outcome_counts: null,
      recipient_count: 0,
      projected_send_count: 0,
    });
    expect(manifest.unavailable_coverage).toEqual(
      expect.arrayContaining([
        "audience outcome unavailable",
        "delivery outcome unavailable",
      ]),
    );
  });

  it("does not let repeated snapshot rows become independent genuine evaluations", () => {
    const first = { ...validRow, provenance: "retained" as const };
    const second = {
      ...first,
      source_slot: "secondary" as const,
      secondary_height_ft: 2,
      secondary_period_s: 11,
      secondary_direction_deg: 275,
    };
    const manifest = buildCorpusManifest([first, second], {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      active_scope: {
        inventory_id: "independent-scope-v1",
        inventory_hash: "independent-scope-hash",
        active_beach_pseudonyms: ["beach-pseudonym-a"],
        active_region_ids: ["region-a"],
      },
    });

    expect(manifest.distinct_evaluations_by_beach_provider).toEqual({
      "beach-pseudonym-a:noaa": 1,
    });
    expect(
      manifest.coverage.assertions.two_distinct_evaluations_per_beach_provider,
    ).toBe(false);
  });

  it("blocks otherwise-complete coverage when issuance, counts, or outcome evidence is unavailable", () => {
    const complete = coverageCompleteRows();
    const options = {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-30T23:59:59.999Z",
      active_scope: scope,
    };

    expect(buildCorpusManifest(complete, options).status).toBe("ready");
    const missingIssuance = complete.map((row, index) =>
      index === 0
        ? {
            ...row,
            issued_at: null,
            issuance_reason: "immutable_issuance_unavailable" as const,
          }
        : row,
    );
    const missingCounts = complete.map((row, index) =>
      index === 0 ? { ...row, recipient_count: null } : row,
    );
    const missingOutcome = complete.map((row, index) =>
      index === 0
        ? {
            ...row,
            outcome: null,
            outcome_reason: "outcome_unavailable" as const,
          }
        : row,
    );

    expect(buildCorpusManifest(missingIssuance, options)).toMatchObject({
      status: "blocked",
      coverage: {
        assertions: { immutable_issuance_identity_available: false },
      },
    });
    expect(buildCorpusManifest(missingCounts, options)).toMatchObject({
      status: "blocked",
      coverage: { assertions: { recipient_counts_available: false } },
    });
    expect(buildCorpusManifest(missingOutcome, options)).toMatchObject({
      status: "blocked",
      coverage: {
        assertions: { candidate_and_regional_outcomes_available: false },
      },
    });
  });

  it("normalizes observed dates to UTC before counting retained days", () => {
    const first = {
      ...validRow,
      provenance: "retained" as const,
      observed_at: "2026-08-01T23:30:00.000Z",
    };
    const sameUtcDay = {
      ...first,
      evaluation_id: "noaa-evaluation-b",
      observed_at: "2026-08-02T00:30:00.000+01:00",
    };
    const manifest = buildCorpusManifest([first, sameUtcDay], {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-02T23:59:59.999Z",
      active_scope: scope,
    });

    expect(manifest.retained_days).toBe(1);
  });
});
