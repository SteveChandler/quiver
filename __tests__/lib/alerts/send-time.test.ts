import {
  isSendHour,
  parseDailyCallTime,
  resolveSendInstant,
} from "@/lib/alerts/send-time";

describe("daily call send time", () => {
  it("matches the configured local hour", () => {
    const args = {
      pref: "06:00" as const,
      timezone: "America/Los_Angeles",
      sunrise: null,
    };

    expect(isSendHour({
      ...args,
      now: new Date("2026-09-16T13:10:00Z"),
    })).toBe(true);
    expect(isSendHour({
      ...args,
      now: new Date("2026-09-16T14:10:00Z"),
    })).toBe(false);
  });

  it("uses the supplied sunrise instant", () => {
    expect(isSendHour({
      now: new Date("2026-09-16T13:50:00Z"),
      pref: "sunrise",
      timezone: "America/Los_Angeles",
      sunrise: new Date("2026-09-16T13:41:00Z"),
    })).toBe(true);
  });

  it("falls back to 06:00 for invalid preferences", () => {
    expect(parseDailyCallTime("garbage")).toBe("06:00");
  });

  it("resolves a local preference to its UTC instant", () => {
    expect(resolveSendInstant({
      pref: "06:30",
      localDate: "2026-09-16",
      timezone: "America/Los_Angeles",
      sunrise: null,
    }).toISOString()).toBe("2026-09-16T13:30:00.000Z");
  });

  it("uses the post-transition offset on the DST fallback day", () => {
    expect(resolveSendInstant({
      pref: "06:00",
      localDate: "2026-11-01",
      timezone: "America/Los_Angeles",
      sunrise: null,
    }).toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
});
