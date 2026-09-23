/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

const mockFrom = jest.fn();
const mockBoardsSelect = jest.fn();
const mockBoardsEq = jest.fn();
const mockBoardsOrder = jest.fn();
const mockSessionsSelect = jest.fn();
const mockSessionsEq = jest.fn();
const mockSessionsNot = jest.fn();
const mockSessionsOrder = jest.fn();
const mockSessionsLimit = jest.fn();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(),
  getAuthenticatedAPIClient: jest.fn(),
}));

import { getAuthenticatedAPIClient } from "@/lib/supabase/api-server-client";
import { GET } from "@/app/api/board-recommendations/route";

const mockGetAuthenticatedAPIClient =
  getAuthenticatedAPIClient as jest.MockedFunction<typeof getAuthenticatedAPIClient>;
type AuthenticatedClientResult = Awaited<
  ReturnType<typeof getAuthenticatedAPIClient>
>;

function setupAuthenticatedClient({
  boards = { data: [], error: null },
  sessions = { data: [], error: null },
}: {
  boards?: QueryResult;
  sessions?: QueryResult;
}) {
  const boardsBuilder = {
    select: mockBoardsSelect,
    eq: mockBoardsEq,
    order: mockBoardsOrder,
  };
  const sessionsBuilder = {
    select: mockSessionsSelect,
    eq: mockSessionsEq,
    not: mockSessionsNot,
    order: mockSessionsOrder,
    limit: mockSessionsLimit,
  };

  mockBoardsSelect.mockReturnValue(boardsBuilder);
  mockBoardsEq.mockReturnValue(boardsBuilder);
  mockBoardsOrder.mockResolvedValue(boards);

  mockSessionsSelect.mockReturnValue(sessionsBuilder);
  mockSessionsEq.mockReturnValue(sessionsBuilder);
  mockSessionsNot.mockReturnValue(sessionsBuilder);
  mockSessionsOrder.mockReturnValue(sessionsBuilder);
  mockSessionsLimit.mockResolvedValue(sessions);

  mockFrom.mockImplementation((table: string) => {
    if (table === "boards") return boardsBuilder;
    if (table === "sessions") return sessionsBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  mockGetAuthenticatedAPIClient.mockResolvedValue({
    supabase: { from: mockFrom },
    user: { id: "user-1" },
    error: null,
  } as unknown as AuthenticatedClientResult);
}

describe("GET /api/board-recommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient({});
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/board-recommendations/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("validates required and non-negative conditions before authentication", async () => {
    const missingResponse = await GET(
      new NextRequest("http://localhost:3000/api/board-recommendations?windSpeed=5")
    );
    const missingBody = await missingResponse.json();

    expect(missingResponse.status).toBe(400);
    expect(missingBody).toMatchObject({
      success: false,
      error: "Wave height and wind speed are required",
    });
    expect(mockGetAuthenticatedAPIClient).not.toHaveBeenCalled();

    const negativeResponse = await GET(
      new NextRequest(
        "http://localhost:3000/api/board-recommendations?waveHeight=-1&windSpeed=5"
      )
    );
    const negativeBody = await negativeResponse.json();

    expect(negativeResponse.status).toBe(400);
    expect(negativeBody).toMatchObject({
      success: false,
      error: "Wave height and wind speed must be non-negative values",
    });
    expect(mockGetAuthenticatedAPIClient).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mockGetAuthenticatedAPIClient.mockResolvedValue({
      supabase: null,
      user: null,
      error: "no session",
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/board-recommendations?waveHeight=3&windSpeed=5"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error: "Authentication required",
    });
  });

  it("returns board suggestions from the user's board catalog", async () => {
    setupAuthenticatedClient({
      boards: {
        data: [
          {
            id: "board-1",
            name: "Daily Fish",
            board_type: "Fish",
            dimensions: "5'8\" x 20\" x 2.5\"",
            description: "fast small-wave board",
            image_url: "/fish.jpg",
            created_at: "2026-05-01T00:00:00Z",
          },
        ],
        error: null,
      },
      sessions: { data: [], error: null },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/board-recommendations?waveHeight=3&windSpeed=5&beachId=beach-1"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("boards");
    expect(mockBoardsSelect).toHaveBeenCalledWith(
      "id, name, board_type, dimensions, description, image_url",
    );
    expect(mockBoardsEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockBoardsOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(mockFrom).toHaveBeenCalledWith("sessions");
    expect(mockSessionsLimit).toHaveBeenCalledWith(50);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      userId: "user-1",
      conditions: {
        waveHeight: 3,
        windSpeed: 5,
        beachId: "beach-1",
      },
      analysisResults: {
        totalSessions: 0,
        analyzedSessions: 0,
        recommendationBasis: "Board catalog only",
      },
    });
    expect(body.data.generatedAt).toEqual(expect.any(String));
    expect(body.data.suggestions).toEqual([
      expect.objectContaining({
        board: expect.objectContaining({
          id: "board-1",
          name: "Daily Fish",
          board_type: "Fish",
        }),
        score: 40,
        confidence: 0.3,
        reasons: expect.arrayContaining([
          "Fish recommended for 3ft waves",
          "Board size suitable for conditions",
        ]),
      }),
    ]);
  });

  it("wraps board query errors", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupAuthenticatedClient({
      boards: { data: null, error: { message: "boards failed" } },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/board-recommendations?waveHeight=3&windSpeed=5"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      error: "Failed to fetch user boards",
      details: "boards failed",
    });
    expect(consoleError).toHaveBeenCalledWith("Error fetching user boards:", {
      message: "boards failed",
    });

    consoleError.mockRestore();
  });
});
