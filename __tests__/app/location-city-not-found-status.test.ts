/**
 * @jest-environment node
 */

import { existsSync } from "fs";
import type { Metadata } from "next";
import { join } from "path";

import { generateMetadata } from "@/app/beaches/[country]/[state]/[city]/city-page-metadata";
import { getLocationPageData } from "@/actions/beach/beach-location-list-actions";

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getLocationPageData: jest.fn(),
}));

const SEGMENT = join(process.cwd(), "app/beaches/[country]/[state]/[city]");

describe("unknown /{state}/{city} returns a real 404", () => {
  it("has no loading.tsx, whose streamed shell pins the status at 200 before notFound()", () => {
    expect(existsSync(join(SEGMENT, "not-found.tsx"))).toBe(true);
    expect(existsSync(join(SEGMENT, "loading.tsx"))).toBe(false);
  });

  it("emits noindex metadata for an unknown city instead of inheriting index, follow", async () => {
    (getLocationPageData as jest.Mock).mockResolvedValue({ success: false, data: null });

    const metadata: Metadata = await generateMetadata({
      params: Promise.resolve({ country: "usa", state: "ca", city: "zzzz-not-a-city" }),
    } as never);

    expect(metadata.title).toBe("Location Not Found");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
