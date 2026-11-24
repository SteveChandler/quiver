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
  retired_at: null,
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

  it("shares session requests and cached metadata across legacy and metadata callers", async () => {
    let finish!: (response: Response) => void;
    const fetchWithAuthRetry = jest.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const { data } = await loadClientGateway(fetchWithAuthRetry);
    const legacy = data.users.sessions.list("user-1", 5);
    const metadata = data.users.sessions.list("user-1", 5, { includeMetadata: true });
    expect(fetchWithAuthRetry).toHaveBeenCalledTimes(1);
    const result = { sessions: [{ id: "surf-1" }], sessionImportsEnabled: false, garminWatchEnabled: true };
    finish(jsonResponse({ success: true, data: result }));
    await expect(legacy).resolves.toEqual(result.sessions);
    await expect(metadata).resolves.toEqual(result);
    await expect(data.users.sessions.list("user-1", 5, { includeMetadata: true })).resolves.toEqual(result);
    await expect(data.users.sessions.list("user-1", 5)).resolves.toEqual(result.sessions);
    expect(fetchWithAuthRetry).toHaveBeenCalledTimes(1);
  });

  it("keys session metadata by user and limit and expires it after thirty seconds", async () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
    const fetchWithAuthRetry = jest.fn().mockResolvedValue(jsonResponse({ success: true, data: { sessions: [] } }));
    try {
      const { data } = await loadClientGateway(fetchWithAuthRetry);
      await expect(data.users.sessions.list("user-1", 5, { includeMetadata: true })).resolves.toEqual({
        sessions: [], sessionImportsEnabled: false, garminWatchEnabled: false,
      });
      await data.users.sessions.list("user-1", 20, { includeMetadata: true });
      await data.users.sessions.list("user-2", 5, { includeMetadata: true });
      await data.users.sessions.list("user-1", 5, { includeMetadata: true });
      expect(fetchWithAuthRetry).toHaveBeenCalledTimes(3);
      clock.mockReturnValue(31000);
      await data.users.sessions.list("user-1", 5, { includeMetadata: true });
      expect(fetchWithAuthRetry).toHaveBeenCalledTimes(4);
    } finally { clock.mockRestore(); }
  });

  it("clears failed session requests so a retry can load metadata", async () => {
    const fetchWithAuthRetry = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ success: false }, 500))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { sessions: [], garminWatchEnabled: true } }));
    const { data } = await loadClientGateway(fetchWithAuthRetry);
    await expect(data.users.sessions.list("user-1", 5, { includeMetadata: true })).rejects.toThrow("Failed to load user sessions: 500");
    await expect(data.users.sessions.list("user-1", 5, { includeMetadata: true })).resolves.toMatchObject({ garminWatchEnabled: true });
    expect(fetchWithAuthRetry).toHaveBeenCalledTimes(2);
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
