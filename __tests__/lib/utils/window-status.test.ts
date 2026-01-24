import { getWindowStatus } from "@/lib/utils/window-status";

describe("getWindowStatus", () => {
  const forecastDate = "2025-01-15";

  it('returns "unknown" when window start is null', () => {
    const result = getWindowStatus(null, "14:00", forecastDate);
    expect(result.status).toBe("unknown");
  });

  it('returns "unknown" when window end is null', () => {
    const result = getWindowStatus("08:00", null, forecastDate);
    expect(result.status).toBe("unknown");
  });

  it('returns "upcoming" when now is before window start', () => {
    const now = new Date("2025-01-15T06:00:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("upcoming");
    expect(result.message).toBe("Starts in 2 hours");
  });

  it('returns "upcoming" with minutes when less than 1 hour away', () => {
    const now = new Date("2025-01-15T07:45:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("upcoming");
    expect(result.message).toBe("Starts in 15 minutes");
  });

  it('returns "current" when now is within the window', () => {
    const now = new Date("2025-01-15T09:00:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("current");
    expect(result.message).toContain("remaining");
  });

  it('returns "current" with hours format when > 60 mins remaining', () => {
    const now = new Date("2025-01-15T08:30:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("current");
    expect(result.message).toMatch(/\dh \d+m remaining/);
  });

  it('returns "passed" when now is after window end', () => {
    const now = new Date("2025-01-15T12:00:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("passed");
    expect(result.message).toBe("Window has passed");
  });

  it("handles singular hour", () => {
    const now = new Date("2025-01-15T07:00:00");
    const result = getWindowStatus("08:00", "11:00", forecastDate, now);
    expect(result.status).toBe("upcoming");
    expect(result.message).toBe("Starts in 1 hour");
  });
});
