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
  shaper: null,
  thickness: null,
  volume: 34,
  width: null,
  session_count: 2,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
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
});
