import { buildSessionShareUrl } from "@/lib/share/build-share-card-url";

describe("buildSessionShareUrl", () => {
  it("builds a session OG URL with required params", () => {
    const url = buildSessionShareUrl({
      beach: "Ocean Beach",
      rating: "Good",
      stars: 4,
      size: "Waist-Chest",
      board: "Surfboard",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/og/session");
    expect(parsed.searchParams.get("beach")).toBe("Ocean Beach");
    expect(parsed.searchParams.get("rating")).toBe("Good");
    expect(parsed.searchParams.get("stars")).toBe("4");
    expect(parsed.searchParams.get("size")).toBe("Waist-Chest");
    expect(parsed.searchParams.get("board")).toBe("Surfboard");
  });

  it("omits optional params when not provided", () => {
    const url = buildSessionShareUrl({
      beach: "Ocean Beach",
      rating: "Fair",
      stars: 3,
      size: "Waist-Chest",
      board: "Surfboard",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.has("date")).toBe(false);
    expect(parsed.searchParams.has("windLabel")).toBe(false);
    expect(parsed.searchParams.has("windSpeed")).toBe(false);
    expect(parsed.searchParams.has("tagline")).toBe(false);
    expect(parsed.searchParams.has("footer")).toBe(false);
    expect(parsed.searchParams.has("bg")).toBe(false);
  });

  it("includes and encodes optional params when provided", () => {
    const url = buildSessionShareUrl({
      beach: "Ocean Beach",
      rating: "Epic",
      stars: 5,
      size: "Overhead",
      board: `6'2" Shortboard`,
      date: "December 23, 2025",
      windLabel: "Light Offshore",
      windSpeed: "7 mph",
      tagline: "Solid Snake: Smooth walls, long rights...",
      footer: "Similar to your best Ocean Beach sessions",
      bg: "https://example.com/bg.jpg?x=1&y=2",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("date")).toBe("December 23, 2025");
    expect(parsed.searchParams.get("windLabel")).toBe("Light Offshore");
    expect(parsed.searchParams.get("windSpeed")).toBe("7 mph");
    expect(parsed.searchParams.get("tagline")).toBe(
      "Solid Snake: Smooth walls, long rights..."
    );
    expect(parsed.searchParams.get("footer")).toBe(
      "Similar to your best Ocean Beach sessions"
    );
    expect(parsed.searchParams.get("bg")).toBe("https://example.com/bg.jpg?x=1&y=2");
    expect(parsed.searchParams.get("board")).toBe(`6'2" Shortboard`);
  });
});


