/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import {
  createCountyFeedFetcher,
  CountyFeedError,
  normalizeCountyNotifications,
  runCountyAdvisoryIngest,
  type CountyAdvisoryRepository,
  type CountyBeachCandidate,
  type CountyFeedFetcher,
  type CountyIngestState,
  type CountyNotificationResponse,
} from "@/lib/services/county-beach-advisories";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(`__tests__/fixtures/county-sdbeachinfo/${name}.json`, "utf8"),
  ) as unknown;
}

const MANIFEST = {
  versionToken: "TEST-VERSION-TOKEN-AAAA",
  versionSequence: 6304,
};
const NOW = new Date("2026-08-14T01:30:00.000Z");

function response(
  eventTypeIdentifier: 1 | 2 | 3,
  advisoryType: "advisory" | "closure" | "warning",
  payload: unknown,
): CountyNotificationResponse {
  return {
    eventTypeIdentifier,
    advisoryType,
    sites: [],
    rawPayload: payload as CountyNotificationResponse["rawPayload"],
    rawPayloadHash: `${advisoryType}-hash`,
  };
}

function repositoryFor(options: {
  state?: CountyIngestState | null;
  beaches?: CountyBeachCandidate[];
}) {
  let state = options.state ?? null;
  const runs: unknown[] = [];
  const inserted: Array<{ runId: string; records: unknown[] }> = [];
  const repository: CountyAdvisoryRepository = {
    getState: jest.fn(async () => state),
    saveState: jest.fn(async (nextState) => {
      state = nextState;
    }),
    createRun: jest.fn(async (run) => {
      runs.push(run);
    }),
    insertAdvisories: jest.fn(async (records, runId) => {
      inserted.push({ runId, records });
    }),
    completeRun: jest.fn(async () => {}),
    failRun: jest.fn(async () => {}),
    listBeaches: jest.fn(async () => options.beaches ?? []),
  };
  return { repository, getState: () => state, runs, inserted };
}

describe("County sdbeachinfo fixture client", () => {
  it("parses the manifest and all three event payload shapes", async () => {
    const payloads = [
      fixture("advisory"),
      fixture("closure"),
      fixture("warning"),
    ];
    const fetchImpl = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) as { inputParameters?: { EventTypeIdentifier?: number } } : null;
      if (!body) return new Response(JSON.stringify(fixture("manifest")), { status: 200 });
      return new Response(
        JSON.stringify(payloads[(body.inputParameters?.EventTypeIdentifier ?? 1) - 1]),
        { status: 200 },
      );
    });
    const fetcher = createCountyFeedFetcher(fetchImpl);

    expect(await fetcher.fetchManifest()).toEqual(MANIFEST);
    const advisory = await fetcher.fetchNotifications(1, MANIFEST);
    const closure = await fetcher.fetchNotifications(2, MANIFEST);
    const warning = await fetcher.fetchNotifications(3, MANIFEST);

    expect(advisory.sites).toHaveLength(12);
    expect(closure.sites).toHaveLength(8);
    expect(warning.sites).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual(
      expect.objectContaining({
        "X-CSRFToken": "T6C+9iB49TLra4jEsMeSckDMNhQ=",
        "User-Agent": expect.stringContaining("Quiver"),
      }),
    );
  });

  it("fails safely on an OutSystems version signal or malformed shape", async () => {
    const versionChangedFetcher = createCountyFeedFetcher(
      jest.fn(async () =>
        new Response(
          JSON.stringify({
            versionInfo: { hasModuleVersionChanged: true },
            data: { Out1: { List: [] } },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(versionChangedFetcher.fetchNotifications(1, MANIFEST)).rejects.toMatchObject({
      kind: "version_mismatch",
    });

    const malformedFetcher = createCountyFeedFetcher(
      jest.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })),
    );
    await expect(malformedFetcher.fetchNotifications(1, MANIFEST)).rejects.toMatchObject({
      kind: "shape_change",
    });
  });
});

describe("County advisory ingest safety controls", () => {
  function fetcherThatFails(error: Error): CountyFeedFetcher {
    return {
      fetchManifest: jest.fn().mockRejectedValue(error),
      fetchNotifications: jest.fn(),
    };
  }

  it("backs off and opens after three failures, then stops calling the County", async () => {
    const { repository, getState } = repositoryFor({});
    const fetcher = fetcherThatFails(new CountyFeedError("transient", "timeout"));
    const run = (minutes: number) =>
      runCountyAdvisoryIngest({
        fetcher,
        repository,
        now: new Date(NOW.getTime() + minutes * 60_000),
      });

    expect((await run(0)).status).toBe("error");
    expect((await run(30)).status).toBe("error");
    expect((await run(90)).status).toBe("error");
    const stopped = await run(91);

    expect(stopped).toMatchObject({ status: "skipped", reason: "circuit_open" });
    expect(fetcher.fetchManifest).toHaveBeenCalledTimes(3);
    expect(getState()).toMatchObject({ circuit_open: true, consecutive_failures: 3 });
  });

  it("opens permanently on a version mismatch without requesting event types", async () => {
    const { repository } = repositoryFor({
      state: {
        source_identifier: "county-san-diego-dehq-sdbeachinfo",
        accepted_version_token: "old-token",
        accepted_version_sequence: 6303,
        observed_version_token: "old-token",
        observed_version_sequence: 6303,
        consecutive_failures: 0,
        circuit_open: false,
        next_attempt_at: null,
        last_request_at: null,
        last_success_at: null,
        last_failure_at: null,
        last_error: null,
        updated_at: null,
      },
    });
    const fetcher: CountyFeedFetcher = {
      fetchManifest: jest.fn().mockResolvedValue(MANIFEST),
      fetchNotifications: jest.fn(),
    };

    const result = await runCountyAdvisoryIngest({ fetcher, repository, now: NOW });
    const retry = await runCountyAdvisoryIngest({
      fetcher,
      repository,
      now: new Date(NOW.getTime() + 60 * 60_000),
    });

    expect(result).toMatchObject({ status: "error", errorKind: "version_mismatch", circuitOpen: true });
    expect(retry).toMatchObject({ status: "skipped", reason: "circuit_open" });
    expect(fetcher.fetchManifest).toHaveBeenCalledTimes(1);
    expect(fetcher.fetchNotifications).not.toHaveBeenCalled();
  });

  it("stores unmatched County sites and exposes the match rate", async () => {
    const responses = [
      response(1, "advisory", fixture("advisory")),
      response(2, "closure", fixture("closure")),
      response(3, "warning", fixture("warning")),
    ];
    responses[0].sites = [
      { latitude: 32.8475, longitude: -117.2782, sourceSiteIdentifier: "32.847500,-117.278200" },
      { latitude: 33.5, longitude: -118.5, sourceSiteIdentifier: "33.500000,-118.500000" },
    ];
    const normalized = normalizeCountyNotifications(
      responses,
      [{ id: "11111111-1111-4111-8111-111111111111", name: "Matched Beach", lat: 32.8475, lon: -117.2782 }],
      NOW.toISOString(),
    );

    expect(normalized.totalSites).toBe(2);
    expect(normalized.matchedSites).toBe(1);
    expect(normalized.unmatchedSites).toBe(1);
    expect(normalized.matchRate).toBe(0.5);
    expect(normalized.records).toContainEqual(
      expect.objectContaining({ beachId: null }),
    );
  });

  it("deduplicates repeated sites within an advisory type before persistence", () => {
    const duplicateSite = {
      latitude: 32.805,
      longitude: -117.2628,
      sourceSiteIdentifier: "32.805000,-117.262800",
    };
    const advisory = response(1, "advisory", fixture("advisory"));
    const closure = response(2, "closure", fixture("closure"));
    advisory.sites = [duplicateSite, duplicateSite];
    closure.sites = [duplicateSite];

    const normalized = normalizeCountyNotifications(
      [advisory, closure],
      [],
      NOW.toISOString(),
    );

    expect(normalized.records).toHaveLength(2);
    expect(normalized.countsByType).toMatchObject({ advisory: 1, closure: 1 });
  });
});
