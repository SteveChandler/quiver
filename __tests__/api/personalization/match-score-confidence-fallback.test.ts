/** @jest-environment node */

// Route -> real recommendBoard -> real forecastToSnapshot -> tracker. The route test mocks
// recommendBoard, so it cannot catch the flag being dropped on the way to the tracker.
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/personalization/match-score/route";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";

const rpc = jest.fn();

jest.mock("@/lib/monitoring/fallback-tracker", () => ({ trackFallback: jest.fn() }));
jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  fetchUserBoardContext: async () => ({
    boardsForPicks: [{ id: "board-1", name: "Twin pin", board_type: "shortboard", sessions: [] }],
  }),
}));
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: async () => "advanced",
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: any) =>
      async (request: NextRequest): Promise<Response> =>
        handler(request, {
          user: { id: "user-1" },
          supabase: {
            rpc,
            from: (table: string) => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: table === "beaches"
                      ? { id: "beach-1", break_type: "beach", preferred_tide_ft_min: 1, preferred_tide_ft_max: 5 }
                      : { is_pro: true },
                    error: null,
                  }),
                }),
              }),
            }),
          },
          params: {},
        }),
  };
});

describe("GET /api/personalization/match-score confidence fallback", () => {
  it("does not raise a high-severity discovery.confidence_score alert for its request-built forecast", async () => {
    rpc.mockResolvedValue({
      data: { state: "learned", score: 8.4, sessions_in_profile: 15, reason_bullets: [] },
      error: null,
    });

    const response = await GET(new NextRequest(
      "https://www.quiversurf.app/api/personalization/match-score?beach_id=beach-1&wave_height=3&wave_period=12&wind_speed=4&wind_direction=210&tide_height=3",
    ));
    expect(response.status).toBe(200);

    const confidenceEvents = (trackFallback as jest.Mock).mock.calls
      .map(([event]) => event)
      .filter((event) => event.domain === "discovery" && event.field === "confidence_score");
    expect(confidenceEvents).toEqual([
      expect.objectContaining({ severity: "low", reason: "request_derived_forecast" }),
    ]);
  });
});
