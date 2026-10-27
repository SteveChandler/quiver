import { isTideSwingEnabled } from "@/lib/flags/tide-swing";

describe("isTideSwingEnabled", () => {
  const saved = { server: process.env.TIDE_SWING_ENABLED, browser: process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED };

  afterEach(() => {
    if (saved.server === undefined) delete process.env.TIDE_SWING_ENABLED;
    else process.env.TIDE_SWING_ENABLED = saved.server;
    if (saved.browser === undefined) delete process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED;
    else process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED = saved.browser;
  });

  it("is off when neither variable is set", () => {
    delete process.env.TIDE_SWING_ENABLED;
    delete process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED;
    expect(isTideSwingEnabled()).toBe(false);
  });

  it("turns on from the public variable the browser build sees", () => {
    delete process.env.TIDE_SWING_ENABLED;
    process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED = "true";
    expect(isTideSwingEnabled()).toBe(true);
  });

  it("still turns on from the server-only variable", () => {
    process.env.TIDE_SWING_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED;
    expect(isTideSwingEnabled()).toBe(true);
  });
});
