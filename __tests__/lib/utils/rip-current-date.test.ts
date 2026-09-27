/**
 * @jest-environment node
 */
import { ripCurrentDateFor } from "@/lib/utils/rip-current-date";

const base = {
  dateParam: null,
  windowParam: null,
  forecastLocalDate: "2026-09-28",
  todayLocalDate: "2026-09-27",
  timezone: "America/Los_Angeles",
};

describe("ripCurrentDateFor", () => {
  it("prefers a selected date over the window and forecast", () => {
    expect(ripCurrentDateFor({
      ...base,
      dateParam: "2026-09-29",
      windowParam: "2026-09-28T06:30:00.000Z",
    })).toBe("2026-09-29");
  });

  it("uses the beach's local day for a selected window near UTC midnight", () => {
    expect(ripCurrentDateFor({ ...base, windowParam: "2026-09-29T06:30:00.000Z" })).toBe("2026-09-28");
  });

  it("uses the forecast date when no day is selected", () => {
    expect(ripCurrentDateFor(base)).toBe("2026-09-28");
  });

  it("uses today when there is no selection or forecast date", () => {
    expect(ripCurrentDateFor({ ...base, forecastLocalDate: null })).toBe("2026-09-27");
  });

  it("ignores invalid selections", () => {
    expect(ripCurrentDateFor({
      ...base,
      dateParam: "2026-09-31",
      windowParam: "2026-09-29T06:30:00",
    })).toBe("2026-09-28");
  });
});
