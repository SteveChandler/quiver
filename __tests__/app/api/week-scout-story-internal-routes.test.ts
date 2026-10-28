/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({})) }));
const mockActiveRegions = jest.fn();
const mockLoadInput = jest.fn();
const mockPublish = jest.fn();
const mockLatest = jest.fn();
jest.mock("@/lib/services/discovery/week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadStoryInput: (...args: unknown[]) => mockLoadInput(...args),
  publishStoryEdition: (...args: unknown[]) => mockPublish(...args),
  loadLatestStoryEdition: (...args: unknown[]) => mockLatest(...args),
  StoryStoreError: class StoryStoreError extends Error {},
}));
const mockBuildInput = jest.fn();
jest.mock("@/lib/services/discovery/week-scout-story-source", () => ({
  buildStoryInput: (...args: unknown[]) => mockBuildInput(...args),
  StoryInputError: class StoryInputError extends Error {},
}));

import { NextRequest } from "next/server";
import { GET as regions } from "@/app/api/internal/week-scout-story/regions/route";
import { GET as input } from "@/app/api/internal/week-scout-story/input/route";
import { GET as latest } from "@/app/api/internal/week-scout-story/latest/route";
import { POST as editions } from "@/app/api/internal/week-scout-story/editions/route";
import { briefingArtifactId } from "@/lib/services/discovery/swell-briefing-hash";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "@/lib/services/discovery/week-scout-story-types";

const token = "regional-story-publisher-token-over-32-chars";
const url = "http://localhost/api/internal/week-scout-story";
const req = (path: string, method = "GET", body?: unknown, bearer = token): NextRequest => new NextRequest(`${url}/${path}`, {
  method, headers: { authorization: `Bearer ${bearer}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("Week Scout story worker routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEK_SCOUT_STORY_PUBLISHER_TOKEN = token;
  });
  afterEach(() => { delete process.env.WEEK_SCOUT_STORY_PUBLISHER_TOKEN; });

  it("uses the briefing publisher Bearer auth on all four routes", async () => {
    for (const call of [
      () => regions(req("regions", "GET", undefined, "wrong")),
      () => input(req("input?region=coast", "GET", undefined, "wrong")),
      () => latest(req("latest?region=coast", "GET", undefined, "wrong")),
      () => editions(req("editions", "POST", {}, "wrong")),
    ]) expect((await call()).status).toBe(401);
    expect(mockActiveRegions).not.toHaveBeenCalled();
    delete process.env.WEEK_SCOUT_STORY_PUBLISHER_TOKEN;
    expect((await regions(req("regions"))).status).toBe(404);
  });

  it("lists active regions, issues schema 3 input and reads the latest artifact", async () => {
    mockActiveRegions.mockResolvedValue([{ region: "coast", timezone: "America/Los_Angeles" }]);
    mockBuildInput.mockResolvedValue({ schemaVersion: 3, region: "coast" });
    mockLatest.mockResolvedValue({ artifactId: "saved", schemaVersion: 3 });
    expect((await (await regions(req("regions"))).json()).regions).toEqual([{ region: "coast", timezone: "America/Los_Angeles" }]);
    expect((await (await input(req("input?region=coast"))).json()).schemaVersion).toBe(3);
    expect((await (await latest(req("latest?region=coast"))).json()).artifactId).toBe("saved");
    expect((await input(req("input?region=San%20Diego"))).status).toBe(200);
    expect(mockBuildInput).toHaveBeenLastCalledWith(expect.objectContaining({ region: "San Diego" }));
  });

  it("publishes an issued candidate selection and returns 200 on idempotent retry", async () => {
    const issued: StoryInput = {
      schemaVersion: 3, region: "coast", editionDate: "2026-10-27", inputHash: "issued-hash",
      sourcePublishedAt: "2026-10-27T12:00:00Z", validUntil: "2026-10-29T06:59:59Z",
      briefing: { schemaVersion: 3, editionDate: "2026-10-27", generatedAt: "2026-10-27T12:00:00Z", selections: [] },
      copyFacts: [{ id: "cover", slot: "cover", text: "A west swell approaches.", gate: {
        kind: "swell", regionalEventKey: "6-5-2026-10-28", directionSector: 6, periodBand: 5,
        arrivalLocalDate: "2026-10-27", peakLocalDate: "2026-10-28", fadeLocalDate: null,
        confidence: "likely", minimumBeaches: 2,
      } }],
      provenance: { sourceIds: ["source"], sourceHashes: ["hash"], generationInputVersion: "1",
        representativeBeachIds: ["beach"], coverageDates: ["2026-10-27"] },
    };
    const artifact: StoryArtifact = {
      artifactId: "", schemaVersion: 3, region: issued.region, editionDate: issued.editionDate,
      inputHash: issued.inputHash, sourcePublishedAt: issued.sourcePublishedAt, validUntil: issued.validUntil,
      generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: "local",
      briefing: { ...issued.briefing, generatedAt: new Date().toISOString(), selections: ["cover"] },
      provenance: issued.provenance,
    };
    artifact.artifactId = briefingArtifactId(artifact as unknown as Record<string, unknown>);
    mockLoadInput.mockResolvedValue(issued);
    mockPublish.mockResolvedValueOnce({ artifactId: artifact.artifactId, created: true })
      .mockResolvedValueOnce({ artifactId: artifact.artifactId, created: false });
    expect((await editions(req("editions", "POST", artifact))).status).toBe(201);
    expect((await editions(req("editions", "POST", artifact))).status).toBe(200);
    const tampered = { ...artifact, briefing: { ...artifact.briefing, selections: ["invented"] } };
    expect((await editions(req("editions", "POST", tampered))).status).toBe(400);
    expect(mockPublish).toHaveBeenCalledTimes(2);
  });
});
