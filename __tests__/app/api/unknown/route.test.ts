/**
 * @jest-environment node
 */
import * as route from "@/app/api/[...unknown]/route";

describe("unknown /api paths", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const)(
    "answers %s with a no-store 404",
    async (method) => {
      const res = await route[method]();
      expect(res.status).toBe(404);
      // Browsers and iOS never keep it; only Vercel's per-deployment CDN does.
      expect(res.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
      expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=300");
    }
  );
});
