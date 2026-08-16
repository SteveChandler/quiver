/**
 * @jest-environment node
 */

const mockServiceFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveNotificationMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/notification";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";

const CONFIGURED_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const ALTERNATIVE_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const FORECAST_AT = "2026-08-13T10:00:00.000Z";

function tableResult(data: unknown[]): Record<string, jest.Mock> {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    in: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockImplementation(async (_column: string, values: string[]) => ({
    data: data.filter((row) => {
      if (typeof row !== "object" || row === null || !("beach_id" in row)) {
        return true;
      }
      return values.includes(String(row.beach_id));
    }),
    error: null,
  }));
  return chain;
}

function configureHeldBeachStore(): void {
  (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
    from: mockServiceFrom,
  });
  mockServiceFrom.mockImplementation((table: string) =>
    table === "water_quality_held_beaches"
      ? tableResult([
          { beach_id: CONFIGURED_BEACH_ID },
          { beach_id: ALTERNATIVE_BEACH_ID },
        ])
      : tableResult([]),
  );
}

function policyContext(beachId: string): Record<string, string> {
  return {
    kind: "positive_session_recommendation",
    beach_id: beachId,
    starts_at: FORECAST_AT,
    ends_at: "2026-08-13T11:00:00.000Z",
  };
}

const evaluateWaterQualityOnly = async (
  input: Parameters<typeof evaluateMajorEventHoldCandidates>[0],
) => evaluateMajorEventHoldCandidates({ ...input, mode: "off" });

describe("notification water-quality provenance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureHeldBeachStore();
  });

  it("delivers the configured held beach but suppresses a held alternative in its notification provenance", async () => {
    const configuredAlert = await resolveNotificationMajorEventHold({
      eventId: "event-configured-held-beach",
      type: "forecast_alert",
      payload: {
        beach_id: CONFIGURED_BEACH_ID,
        configured_beach_id: CONFIGURED_BEACH_ID,
        forecast_at: FORECAST_AT,
        policy_context: policyContext(CONFIGURED_BEACH_ID),
      },
      profileExperience: "beginner",
      mode: "enforce",
    }, { evaluateCandidates: evaluateWaterQualityOnly });

    const suggestedAlternative = await resolveNotificationMajorEventHold({
      eventId: "event-suggested-alternative",
      type: "forecast_alert",
      payload: {
        beach_id: ALTERNATIVE_BEACH_ID,
        configured_beach_id: CONFIGURED_BEACH_ID,
        forecast_at: FORECAST_AT,
        policy_context: policyContext(ALTERNATIVE_BEACH_ID),
      },
      profileExperience: "beginner",
      mode: "enforce",
    }, { evaluateCandidates: evaluateWaterQualityOnly });

    expect(configuredAlert).toMatchObject({ status: "allowed" });
    expect(suggestedAlternative).toMatchObject({
      status: "suppressed",
      reasonCode: "water_quality_hold",
    });
  });
});
