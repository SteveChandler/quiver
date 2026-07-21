/**
 * @jest-environment node
 */

import type { ClientBoard } from "@/lib/data/client";

const TEST_BOARD: ClientBoard = {
  id: "board-1",
  user_id: "user-1",
  name: "Everyday Fish",
  board_type: "fish",
  color: null,
  dimensions: "5'8 x 20 x 2 1/2",
  description: null,
  fin_setup: null,
  image_url: null,
  model: null,
  size: null,
  volume: 34,
  session_count: 2,
  shaper: null,
  thickness: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
  width: null,
};

async function loadClientGateway(mockFetchWithAuthRetry: jest.Mock) {
  jest.resetModules();
  jest.doMock("@/lib/fetch-with-auth-retry", () => ({
    fetchWithAuthRetry: mockFetchWithAuthRetry,
  }));

  return import("@/lib/data/client");
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("client data gateway", () => {
  afterEach(() => {
    jest.dontMock("@/lib/fetch-with-auth-retry");
  });

  it("loads boards through the API route and caches the typed response", async () => {
    const fetchWithAuthRetry = jest.fn().mockResolvedValue(
      jsonResponse({
        data: {
          boards: [TEST_BOARD],
        },
      })
    );
    const { data } = await loadClientGateway(fetchWithAuthRetry);

    await expect(data.boards.list()).resolves.toEqual([TEST_BOARD]);
    await expect(data.boards.list()).resolves.toEqual([TEST_BOARD]);

    expect(fetchWithAuthRetry).toHaveBeenCalledTimes(1);
    expect(fetchWithAuthRetry).toHaveBeenCalledWith("/api/boards", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
  });

  it("always refreshes hold-aware daily intel instead of replaying a cached positive", async () => {
    const availableIntel = {
      beach_id: "beach-1",
      forecast_date: "2026-07-19",
      best_window_start: "06:00:00",
      best_window_end: "09:00:00",
      conditions_score: 8,
      recommendationAvailability: {
        state: "available",
        holdEpoch: "available-epoch",
      },
    };
    const heldIntel = {
      ...availableIntel,
      best_window_start: null,
      best_window_end: null,
      conditions_score: null,
      recommendationAvailability: {
        state: "none",
        reasonCode: "major_event_hold",
        holdEpoch: "held-epoch",
      },
    };
    const fetchWithAuthRetry = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { intel: availableIntel } }))
      .mockResolvedValueOnce(jsonResponse({ data: { intel: heldIntel } }));
    const { data } = await loadClientGateway(fetchWithAuthRetry);

    await expect(
      data.intel.getDaily("beach-1", "2026-07-19"),
    ).resolves.toEqual(availableIntel);
    await expect(
      data.intel.getDaily("beach-1", "2026-07-19"),
    ).resolves.toEqual(heldIntel);

    expect(fetchWithAuthRetry).toHaveBeenCalledTimes(2);
  });
});
