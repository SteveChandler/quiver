/** @jest-environment node */
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

let mockCapturedImageElement: unknown = null;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown) => {
    mockCapturedImageElement = element;
    return new Response(new Uint8Array([0]), {
      headers: { "content-type": "image/png" },
    });
  }),
}));

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  abortSignal: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};
const mockFrom = jest.fn(() => mockQuery);

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => ({ from: mockFrom })),
}));

const SESSION_ID = "17eb5501-1905-44ff-bfa9-67c90b375ed6";
const SHARE_URL = encodeURIComponent(
  `https://www.quiversurf.app/sessions/${SESSION_ID}?utm_source=quiver_native`,
);
const DAY_CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const SESSION_CACHE =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";

const storedRow = {
  rating: null,
  beach_name: "La Fonda",
  arrival_time: "2026-11-08T01:35:18+00:00",
  wave_height_ft: 4.5,
  wave_height_min_ft: null,
  wave_height_max_ft: null,
  wind_direction: "ENE",
  wind_speed_mph: 11,
  notes: "4-5ft, Fun",
  description: null,
  board_id: null,
  beach: { name: "La Fonda", timezone: "America/Tijuana" },
};

function cardMarkup(): string {
  if (!isValidElement(mockCapturedImageElement)) {
    throw new Error("Expected captured ImageResponse element");
  }
  return renderToStaticMarkup(mockCapturedImageElement as ReactElement);
}

function cardProps(): Record<string, unknown> {
  if (!isValidElement(mockCapturedImageElement)) {
    throw new Error("Expected captured ImageResponse element");
  }
  return mockCapturedImageElement.props as Record<string, unknown>;
}

async function render(query: string): Promise<Response> {
  const { GET } = await import("@/app/api/og/session/route");
  return GET(new NextRequest(`http://localhost:3000/api/og/session?${query}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCapturedImageElement = null;
  mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("session share card shows only the surfer's own rating", () => {
  it("shows no rating pill, stars or label when the card has no rating", async () => {
    await render("beach=La+Fonda&size=4.5&windSpeed=11+mph&windLabel=ENE");

    expect(cardProps().stars).toBeNull();
    const markup = cardMarkup();
    expect(markup).not.toMatch(
      /Rough|Meh|Fun|Great|Epic|Poor|Fair|Good|rating/,
    );
    expect(markup).not.toContain("<svg");
  });

  it("does not fill a missing size with a stand-in", async () => {
    await render("beach=La+Fonda");

    expect(cardProps().size).toBe("");
    expect(cardMarkup()).not.toContain("Waist-Chest");
  });

  it("names the rating from the star number only, never from the URL text", async () => {
    await render("beach=Del+Mar&rating=Fair&stars=4&size=3.5");

    const markup = cardMarkup();
    expect(markup).toContain("Great session");
    expect(markup).not.toContain("Fair");
  });

  it("shows no stand-in beach and no doubled word when the beach is missing", async () => {
    await render("stars=4&size=3");

    const markup = cardMarkup();
    expect(markup).not.toContain("Your surf session");
    expect(markup).not.toMatch(/session session/i);
  });

  it("shows only wave heights in feet", async () => {
    await render("beach=La+Fonda&size=3-4m");

    expect(cardMarkup()).not.toContain("3-4m");
  });
});

describe("session share card for a stored session", () => {
  it("uses the stored rating of a public session over the Fair/3 that installed native builds send", async () => {
    mockQuery.maybeSingle.mockResolvedValue({ data: storedRow, error: null });

    const response = await render(
      `beach=La+Fonda&rating=Fair&stars=3&size=4.5&board=&shareUrl=${SHARE_URL}`,
    );

    expect(mockQuery.eq).toHaveBeenCalledWith("id", SESSION_ID);
    expect(mockQuery.eq).toHaveBeenCalledWith("is_public", true);
    expect(mockQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(cardProps().stars).toBeNull();
    expect(cardMarkup()).not.toContain("Fair");
    expect(response.headers.get("Cache-Control")).toBe(SESSION_CACHE);
  });

  it("takes every stored field over the URL and keeps only the board name RLS hides", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: { ...storedRow, rating: 5, board_id: "board-1" },
      error: null,
    });

    await render(
      `beach=Elsewhere&stars=1&size=9&board=Ghombra&windLabel=W&windSpeed=30+mph&tagline=Other&date=January+1%2C+2020&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({
        beach: "La Fonda",
        stars: 5,
        size: "4.5",
        board: "Ghombra",
        windLabel: "ENE",
        windSpeed: "11 mph",
        tagline: "4-5ft, Fun",
        date: "November 7, 2026",
      }),
    );
  });

  it("reads only columns the public session page already shows to any visitor", async () => {
    await render(`beach=La+Fonda&shareUrl=${SHARE_URL}`);

    // The public page reads the session through getSessionMetadata; the card may not read more.
    const source = readFileSync(
      join(process.cwd(), "actions/session-actions.ts"),
      "utf8",
    );
    const start = source.indexOf("export async function getSessionMetadata");
    const pageSelect = source.slice(start, source.indexOf(".eq(", start));
    const cardColumns = String(mockQuery.select.mock.calls[0][0])
      .replace(/beach:beaches\([^)]*\)/, "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean)
      // board_id only decides whether the caller's board name stays; the page joins the board.
      .filter((column) => column !== "board_id");

    for (const column of cardColumns) {
      expect(pageSelect).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("shows the logged wave height, not the range the public page does not show", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: {
        ...storedRow,
        wave_height_ft: 3.5,
        wave_height_min_ft: 3,
        wave_height_max_ft: 4,
      },
      error: null,
    });

    await render(`beach=La+Fonda&shareUrl=${SHARE_URL}`);

    expect(cardProps().size).toBe("3.5");
  });

  it("drops a size and board the stored public session never logged", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: { ...storedRow, rating: 4, wave_height_ft: null },
      error: null,
    });

    await render(
      `beach=Del+Mar&stars=4&size=3&board=Surfboard&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({ stars: 4, size: "", board: "" }),
    );
  });

  it("keeps the URL params, with a short cache, when the session is private or deleted", async () => {
    mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await render(
      `beach=La+Fonda&stars=4&size=3&board=Fish&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({ stars: 4, size: "3", board: "Fish" }),
    );
    expect(response.headers.get("Cache-Control")).toBe(SESSION_CACHE);
  });

  it("shows no rating and is not cached when the lookup fails", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "canceling statement due to statement timeout" },
    });

    const response = await render(
      `beach=La+Fonda&rating=Fair&stars=3&size=3&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({ stars: null, size: "3" }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("retries a failed lookup once before giving up on the rating", async () => {
    mockQuery.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: "AbortError" } })
      .mockResolvedValueOnce({
        data: { ...storedRow, rating: 4 },
        error: null,
      });

    const response = await render(
      `beach=La+Fonda&stars=1&shareUrl=${SHARE_URL}`,
    );

    expect(mockQuery.maybeSingle).toHaveBeenCalledTimes(2);
    expect(cardProps().stars).toBe(4);
    expect(response.headers.get("Cache-Control")).toBe(SESSION_CACHE);
  });

  it("does not use a session id from a share URL on another host", async () => {
    const response = await render(
      `beach=La+Fonda&stars=4&shareUrl=${encodeURIComponent(`https://evil.example/sessions/${SESSION_ID}`)}`,
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(cardProps().stars).toBe(4);
    expect(response.headers.get("Cache-Control")).toBe(DAY_CACHE);
  });

  it("runs behind the public rate limit", async () => {
    const response = await render("beach=La+Fonda&stars=4");

    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
  });

  it("does not query the database for a share URL that is not a session page", async () => {
    await render(
      `beach=La+Fonda&stars=4&shareUrl=${encodeURIComponent("https://www.quiversurf.app/sessions/not-a-uuid")}`,
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(cardProps().stars).toBe(4);
  });
});
