/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

import { GET } from "@/app/app-store/route";

describe("GET /app-store", () => {
  it.each(["web", "email", "partner_qr"])(
    "redirects the %s campaign through the tracked handoff",
    (campaign) => {
      const response = GET(
        new NextRequest(
          `https://www.quiversurf.app/app-store?ct=${campaign}&source=plans&surface=plans-page&placement=plans_primary`,
        ),
      );
      const destination = new URL(response.headers.get("location") ?? "");

      expect(response.status).toBe(307);
      expect(destination.origin).toBe("https://go.quiversurf.app");
      expect(destination.pathname).toBe("/app/handoff");
      expect(destination.searchParams.get("source")).toBe("plans");
      expect(destination.searchParams.get("surface")).toBe("plans-page");
      expect(destination.searchParams.get("placement")).toBe("plans_primary");
      expect(destination.searchParams.get("utm_campaign")).toBe(campaign);
      expect(destination.searchParams.get("handoff_id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    },
  );

  it("normalizes unknown campaigns to web", () => {
    const response = GET(
      new NextRequest("https://www.quiversurf.app/app-store?ct=one-off"),
    );
    const destination = new URL(response.headers.get("location") ?? "");

    expect(destination.searchParams.get("utm_campaign")).toBe("web");
  });
});
