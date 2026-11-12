/** @jest-environment node */
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

async function render(query: string): Promise<void> {
  const { GET } = await import("@/app/api/og/session/route");
  await GET(
    new Request(`http://localhost:3000/api/og/session?${query}`) as never,
  );
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
    expect(markup).not.toMatch(/Good|Fair|Epic| session<\/div>|rating/);
    expect(markup).not.toContain("<svg");
  });

  it("does not fill a missing size with a stand-in", async () => {
    await render("beach=La+Fonda");

    expect(cardProps().size).toBe("");
    expect(cardMarkup()).not.toContain("Waist-Chest");
  });

  it("labels stars on the native scale, whatever label text the URL carries", async () => {
    await render("beach=Del+Mar&rating=Epic&stars=4&size=3.5");

    const markup = cardMarkup();
    expect(markup).toContain("Good session");
    expect(markup).not.toContain("Epic");
  });

  it("uses the stored rating of a public session over the Fair/3 that installed native builds send", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: {
        rating: null,
        wave_height_ft: 4.5,
        wave_height_min_ft: null,
        wave_height_max_ft: null,
        board_id: null,
      },
      error: null,
    });

    await render(
      `beach=La+Fonda&rating=Fair&stars=3&size=4.5&board=&shareUrl=${SHARE_URL}`,
    );

    expect(mockQuery.eq).toHaveBeenCalledWith("id", SESSION_ID);
    expect(mockQuery.eq).toHaveBeenCalledWith("is_public", true);
    expect(mockQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(cardProps().stars).toBeNull();
    expect(cardMarkup()).not.toContain("Fair");
  });

  it("drops a size and board the stored public session never logged", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: {
        rating: 4,
        wave_height_ft: null,
        wave_height_min_ft: null,
        wave_height_max_ft: null,
        board_id: null,
      },
      error: null,
    });

    await render(
      `beach=Del+Mar&rating=Good&stars=4&size=Waist-Chest&board=Surfboard&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({ stars: 4, size: "", board: "" }),
    );
  });

  it("keeps the URL params when the session is private or the lookup fails", async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "timeout" },
    });

    await render(
      `beach=La+Fonda&rating=Good&stars=4&size=3&board=Fish&shareUrl=${SHARE_URL}`,
    );

    expect(cardProps()).toEqual(
      expect.objectContaining({ stars: 4, size: "3", board: "Fish" }),
    );
  });

  it("does not query the database for a share URL that is not a session page", async () => {
    await render(
      `beach=La+Fonda&stars=4&shareUrl=${encodeURIComponent("https://www.quiversurf.app/sessions/not-a-uuid")}`,
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(cardProps().stars).toBe(4);
  });
});
