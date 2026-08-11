/**
 * @jest-environment node
 */

import { metadata } from "@/app/layout";

describe("root App Store metadata", () => {
  it("emits the Apple Smart App Banner app id and attributed app argument", () => {
    const content = String(metadata.other?.["apple-itunes-app"]);
    const appArgumentValue = content.match(/app-argument=([^,]+)/)?.[1];
    const appArgument = new URL(String(appArgumentValue));

    expect(content).toContain("app-id=6759300320");
    expect(appArgument.origin + appArgument.pathname).toBe(
      "https://www.quiversurf.app/app",
    );
    expect(appArgument.searchParams.get("source")).toBe("ios_smart_app_banner");
    expect(appArgument.searchParams.get("utm_campaign")).toBe("app_first_v1");
  });
});
