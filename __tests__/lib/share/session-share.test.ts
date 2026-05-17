import {
  buildSessionPageShareUrl,
  buildSessionShareImageUrl,
  buildSessionShareSheetData,
  clampSessionStars,
  getSessionBeachName,
} from "@/lib/share/session-share";
import type { SessionWithDetails } from "@/types/database";

const session = {
  id: "session-abc",
  status: "completed",
  rating: 4,
  wave_height_ft: 3,
  wave_quality: null,
  arrival_time: "2026-04-30T15:00:00.000Z",
  session_date: "2026-04-30T15:00:00.000Z",
  beach_name: "Ocean Beach",
  beach: { name: "Ocean Beach" },
  beaches: null,
  board: { name: "Shortboard" },
  boards: null,
  profiles: null,
  wind_direction: "Offshore",
  wind_speed_mph: 7,
  featured_photo_url: "https://example.com/session.jpg",
  description: "Clean morning waves",
} as unknown as SessionWithDetails;

describe("session share helpers", () => {
  it("clamps session stars", () => {
    expect(clampSessionStars(99)).toBe(5);
    expect(clampSessionStars(-1)).toBe(0);
    expect(clampSessionStars(3.6)).toBe(4);
  });

  it("resolves beach names from session joins", () => {
    expect(getSessionBeachName(session)).toBe("Ocean Beach");
  });

  it("builds the session share image URL from session data", () => {
    const url = buildSessionShareImageUrl(session);
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/api/og/session");
    expect(parsed.searchParams.get("beach")).toBe("Ocean Beach");
    expect(parsed.searchParams.get("stars")).toBe("4");
    expect(parsed.searchParams.get("size")).toBe("Chest-Head");
    expect(parsed.searchParams.get("board")).toBe("Shortboard");
    expect(parsed.searchParams.get("windLabel")).toBe("Offshore");
    expect(parsed.searchParams.get("tagline")).toBe("Clean morning waves");
    expect(parsed.searchParams.get("bg")).toBe("https://example.com/session.jpg");
  });

  it("uses the uploaded session image as the share-card background", () => {
    const url = buildSessionShareImageUrl({
      ...session,
      featured_photo_url: null,
      image_url: "https://cdn.quiversurf.app/uploaded-session.jpg",
    } as unknown as SessionWithDetails);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("bg")).toBe(
      "https://cdn.quiversurf.app/uploaded-session.jpg"
    );
  });

  it("omits device-local session images from the share-card background", () => {
    const url = buildSessionShareImageUrl({
      ...session,
      featured_photo_url: null,
      image_url: "file:///data/user/0/app.quiversurf.surf/cache/ImagePicker/photo.jpg",
    } as unknown as SessionWithDetails);
    const parsed = new URL(url);

    expect(parsed.searchParams.has("bg")).toBe(false);
  });

  it("falls back to uploaded image when featured photo is not remote", () => {
    const url = buildSessionShareImageUrl({
      ...session,
      featured_photo_url: "content://media/external/images/1",
      image_url: "https://cdn.quiversurf.app/uploaded-session.jpg",
    } as unknown as SessionWithDetails);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("bg")).toBe(
      "https://cdn.quiversurf.app/uploaded-session.jpg"
    );
  });

  it("builds share sheet data with image and session URL", () => {
    const data = buildSessionShareSheetData(session);

    expect(data.imageUrl).toContain("/api/og/session");
    expect(data.filename).toBe("quiver-session-session-abc");
    expect(data.text).toBe("Just logged a session at Ocean Beach on Quiver.");
    expect(new URL(data.shareUrl).pathname).toBe("/sessions/session-abc");
  });

  it("builds an absolute session page URL", () => {
    expect(new URL(buildSessionPageShareUrl("session-abc")).pathname).toBe(
      "/sessions/session-abc"
    );
  });
});
