/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import * as route from "@/app/api/[...unknown]/route";

describe("unknown /api paths", () => {
  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const)(
    "answers %s with a no-store 404",
    async (method) => {
      const res = await route[method](new NextRequest(`https://x.test/api/nope/deeper`, { method }));
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
    }
  );
});
