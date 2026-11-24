import { isTideSwingEnabled } from "@/lib/flags/tide-swing";

describe("isTideSwingEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is off when the public variable is unset", () => {
    delete process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED;
    expect(isTideSwingEnabled()).toBe(false);
  });

  it("turns on from the public variable the browser build sees", () => {
    process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED = "true";
    expect(isTideSwingEnabled()).toBe(true);
  });

  it("ignores the server-only variable when the public variable is unset", () => {
    process.env.TIDE_SWING_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED;
    expect(isTideSwingEnabled()).toBe(false);
  });
});
