import { buildSessionShareUrl, buildSurfCallShareUrl } from "@/lib/share/build-share-card-url";

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

describe("buildSurfCallShareUrl", () => {
  describe("legacy parameters (backward compatibility)", () => {
    it("builds a surf call OG URL with legacy params", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "Light offshore",
      });

      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/api/og/surf-call");
      expect(parsed.searchParams.get("beach")).toBe("Big Jetty");
      expect(parsed.searchParams.get("verdict")).toBe("YES");
      expect(parsed.searchParams.get("window")).toBe("7-10am");
      expect(parsed.searchParams.get("waveHeight")).toBe("3-5ft");
      expect(parsed.searchParams.get("wind")).toBe("Light offshore");
    });

    it("includes tags when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        tags: "Clean Swell,Offshore Winds,Rising Tide",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("tags")).toBe("Clean Swell,Offshore Winds,Rising Tide");
    });
  });

  describe("new parameters (redesigned card)", () => {
    it("includes score parameter when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        score: 81,
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("score")).toBe("81");
    });

    it("includes headline parameter when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        headline: "Tomorrow at Big Jetty",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("headline")).toBe("Tomorrow at Big Jetty");
    });

    it("includes conditionLabel parameter when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        conditionLabel: "Great Conditions",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("conditionLabel")).toBe("Great Conditions");
    });

    it("includes tideBadge parameter when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        tideBadge: "Falling Tide",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("tideBadge")).toBe("Falling Tide");
    });

    it("includes message parameter when provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        message: "Good wave size (3.9ft), Good swell energy.",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("message")).toBe("Good wave size (3.9ft), Good swell energy.");
    });

    it("includes all new parameters together", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3.5-4.5ft",
        wind: "",
        score: 81,
        headline: "Tomorrow at Big Jetty",
        conditionLabel: "Great Conditions",
        tideBadge: "Falling Tide",
        message: "Good wave size (3.9ft), Good swell energy.",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("score")).toBe("81");
      expect(parsed.searchParams.get("headline")).toBe("Tomorrow at Big Jetty");
      expect(parsed.searchParams.get("conditionLabel")).toBe("Great Conditions");
      expect(parsed.searchParams.get("tideBadge")).toBe("Falling Tide");
      expect(parsed.searchParams.get("message")).toBe("Good wave size (3.9ft), Good swell energy.");
    });

    it("omits new optional params when not provided", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.has("score")).toBe(false);
      expect(parsed.searchParams.has("headline")).toBe(false);
      expect(parsed.searchParams.has("conditionLabel")).toBe(false);
      expect(parsed.searchParams.has("tideBadge")).toBe(false);
      expect(parsed.searchParams.has("message")).toBe(false);
    });
  });

  describe("URL encoding", () => {
    it("properly encodes special characters in new parameters", () => {
      const url = buildSurfCallShareUrl({
        beach: "Ocean Beach & La Jolla",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        headline: "Tomorrow at Ocean Beach & La Jolla",
        message: "Waves are 3.9ft (above average), swell = good!",
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get("beach")).toBe("Ocean Beach & La Jolla");
      expect(parsed.searchParams.get("headline")).toBe("Tomorrow at Ocean Beach & La Jolla");
      expect(parsed.searchParams.get("message")).toBe("Waves are 3.9ft (above average), swell = good!");
    });

    it("handles score of 0 correctly", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "NO",
        window: "7-10am",
        waveHeight: "1-2ft",
        wind: "",
        score: 0,
      });

      const parsed = new URL(url);
      // Score of 0 should still be included (as "0")
      expect(parsed.searchParams.get("score")).toBe("0");
    });

    it("handles empty strings for optional parameters", () => {
      const url = buildSurfCallShareUrl({
        beach: "Big Jetty",
        verdict: "YES",
        window: "7-10am",
        waveHeight: "3-5ft",
        wind: "",
        conditionLabel: "",
        message: "",
      });

      const parsed = new URL(url);
      // Empty strings should not be included
      expect(parsed.searchParams.has("conditionLabel")).toBe(false);
      expect(parsed.searchParams.has("message")).toBe(false);
    });
  });
});
