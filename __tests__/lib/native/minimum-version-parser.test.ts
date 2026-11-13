import {
  parseMinimumBundleCreatedAt,
  parseMinimumVersion,
  parseNativePlatform,
} from "@/lib/native/minimum-version";

jest.mock("@/lib/supabase/server", () => ({ createPublicReadClient: jest.fn() }));

describe("native minimum-version parser", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it.each(["1", "1.0", "1.0.6", "1.2.3.4"])("accepts the version %s", (value) => {
    expect(parseMinimumVersion("f", value)).toBe(value);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["1.0.6-beta", "v1.0.6", "1.0.0.0.1", "1..0", "latest", "10.0.6x"])(
    "rejects the version %s with one warning that names the field only",
    (value) => {
      expect(parseMinimumVersion("native_app_minimums.minimum_version (ios)", value)).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = warn.mock.calls[0].map(String).join(" ");
      expect(logged).toContain("native_app_minimums.minimum_version (ios)");
      expect(logged).not.toContain(value);
    },
  );

  it("returns null without a warning for a null or blank value", () => {
    expect(parseMinimumVersion("f", null)).toBeNull();
    expect(parseMinimumVersion("f", "   ")).toBeNull();
    expect(parseMinimumBundleCreatedAt("f", null)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns for a value that is not a string", () => {
    expect(parseMinimumVersion("f", 106)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["2026-11-12T00:00:00Z", "2026-11-12T00:00:00.000Z"],
    ["2026-11-12T00:00:00+00:00", "2026-11-12T00:00:00.000Z"],
    ["2026-11-12T08:30:00-08:00", "2026-11-12T16:30:00.000Z"],
    ["2026-11-12", "2026-11-12T00:00:00.000Z"],
  ])("normalizes the bundle date %s", (value, expected) => {
    expect(parseMinimumBundleCreatedAt("f", value)).toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["not-a-date", "2026", "Nov 12 2026", "2026-11-12T00:00:00", "2026-13-45T00:00:00Z"])(
    "rejects the bundle date %s with one warning",
    (value) => {
      expect(parseMinimumBundleCreatedAt("f", value)).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a bundle date later than now", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(parseMinimumBundleCreatedAt("f", future)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("accepts only ios and android", () => {
    expect(parseNativePlatform("ios")).toBe("ios");
    expect(parseNativePlatform("android")).toBe("android");
    expect(parseNativePlatform("IOS")).toBeNull();
    expect(parseNativePlatform(null)).toBeNull();
  });
});
