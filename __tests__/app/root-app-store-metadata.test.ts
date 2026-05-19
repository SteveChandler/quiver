/**
 * @jest-environment node
 */

import { metadata } from "@/app/layout";

describe("root App Store metadata", () => {
  it("emits the Apple Smart App Banner app id", () => {
    expect(metadata.itunes).toEqual({
      appId: "6759300320",
      appArgument: "https://www.quiversurf.app",
    });
  });
});
