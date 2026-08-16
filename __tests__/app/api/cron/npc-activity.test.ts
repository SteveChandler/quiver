/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/npc-activity/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchEligibleNPCs,
  selectNPCsForCurrentHour,
  getBeachesForNPC,
} from "@/lib/npc/npc-selection";
import { fetchRandomTemplate } from "@/lib/npc/template-hydration";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error, message) => ({
    json: async () => ({
      success: false,
      error: message,
      details: error instanceof Error ? error.message : String(error),
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/npc/npc-selection", () => ({
  fetchEligibleNPCs: jest.fn(),
  selectNPCsForCurrentHour: jest.fn(),
  getBeachesForNPC: jest.fn(),
}));

jest.mock("@/lib/npc/template-hydration", () => ({
  fetchSurfConditions: jest.fn(),
  buildTemplateVariables: jest.fn(),
  hydrateTemplate: jest.fn(),
  fetchRandomTemplate: jest.fn(),
}));

type NpcProfile = {
  id: string;
  full_name: string;
  personality_type: string;
};

type BeachRow = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
};

type IntelPostQuery = {
  insert: jest.Mock<
    Promise<{ error: { message: string } | null }>,
    [Record<string, unknown>]
  >;
};

type SupabaseMock = {
  from: jest.Mock<IntelPostQuery, [string]>;
};

const npcFixture: NpcProfile = {
  id: "npc-1",
  full_name: "Local Logger",
  personality_type: "local",
};

const beachFixture: BeachRow = {
  id: "beach-1",
  name: "Cardiff Reef",
  lat: 33.02,
  lon: -117.28,
};

describe("npc activity cron route", () => {
  const routeSource = readFileSync("app/api/cron/npc-activity/route.ts", "utf8");

  let supabase: SupabaseMock;
  let intelPostQuery: IntelPostQuery;
  let randomSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const originalPersonaFlag = process.env.NPC_PERSONA_POSTING_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    intelPostQuery = {
      insert: jest.fn<
        Promise<{ error: { message: string } | null }>,
        [Record<string, unknown>]
      >(() => Promise.resolve({ error: null })),
    };
    supabase = {
      from: jest.fn<IntelPostQuery, [string]>((table) => {
        if (table !== "intel_posts") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return intelPostQuery;
      }),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(supabase);
    (fetchEligibleNPCs as jest.Mock).mockResolvedValue([npcFixture]);
    (selectNPCsForCurrentHour as jest.Mock).mockReturnValue([npcFixture]);
    (getBeachesForNPC as jest.Mock).mockResolvedValue(beachFixture);
    (fetchRandomTemplate as jest.Mock).mockResolvedValue(null);
    process.env.NPC_PERSONA_POSTING_ENABLED = "true";
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.1);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    randomSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (originalPersonaFlag === undefined) {
      delete process.env.NPC_PERSONA_POSTING_ENABLED;
    } else {
      process.env.NPC_PERSONA_POSTING_ENABLED = originalPersonaFlag;
    }
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/npc-activity")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(fetchEligibleNPCs).not.toHaveBeenCalled();
  });

  it("pauses persona posting by default without touching profiles or posts", async () => {
    delete process.env.NPC_PERSONA_POSTING_ENABLED;

    const response = await GET(
      new Request("http://localhost/api/cron/npc-activity"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary).toMatchObject({ paused: true, successful: 0 });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(fetchEligibleNPCs).not.toHaveBeenCalled();
  });

  it("returns an empty summary when no NPCs are selected for the current hour", async () => {
    (selectNPCsForCurrentHour as jest.Mock).mockReturnValue([]);

    const response = await GET(
      new Request("http://localhost/api/cron/npc-activity")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetchEligibleNPCs).toHaveBeenCalledWith(supabase);
    expect(selectNPCsForCurrentHour).toHaveBeenCalledWith(
      [npcFixture],
      expect.any(Number),
      expect.any(Boolean)
    );
    expect(getBeachesForNPC).not.toHaveBeenCalled();
    expect(intelPostQuery.insert).not.toHaveBeenCalled();
    expect(data.success).toBe(true);
    expect(data.data.summary).toMatchObject({
      totalNpcs: 1,
      selectedNpcs: 0,
      processed: 0,
      successful: 0,
      failed: 0,
    });
    expect(typeof data.data.summary.ptHour).toBe("number");
    expect(typeof data.data.summary.isWeekend).toBe("boolean");
    expect(typeof data.data.summary.durationMs).toBe("number");
    expect(data.data.results).toEqual([]);
  });

  it("creates a fallback intel post for a selected NPC and beach", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/npc-activity")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getBeachesForNPC).toHaveBeenCalledWith(supabase, npcFixture);
    expect(fetchRandomTemplate).toHaveBeenCalledWith(supabase, "intel", "local");
    expect(supabase.from).toHaveBeenCalledWith("intel_posts");
    expect(intelPostQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "npc-1",
        beach_id: "beach-1",
        latitude: 33.02,
        longitude: -117.28,
        tag: "conditions",
        title:
          "Checked Cardiff Reef this morning. Conditions looking typical for the season.",
        description:
          "Checked Cardiff Reef this morning. Conditions looking typical for the season.",
        is_active: true,
        created_at: expect.any(String),
        expires_at: expect.any(String),
      })
    );
    expect(data.success).toBe(true);
    expect(data.data.summary).toMatchObject({
      totalNpcs: 1,
      selectedNpcs: 1,
      processed: 1,
      successful: 1,
      failed: 0,
    });
    expect(data.data.results).toEqual([
      {
        npcId: "npc-1",
        npcName: "Local Logger",
        beachId: "beach-1",
        beachName: "Cardiff Reef",
        contentType: "intel",
        success: true,
      },
    ]);
  });
});
