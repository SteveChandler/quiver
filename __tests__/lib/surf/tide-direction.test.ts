import { getTideAlert, type TideHeightContext } from "@/lib/surf/tide-direction";


describe("getTideAlert", () => {
  it("returns neutral status for null preference", () => {
    const alert = getTideAlert(null, "rising", 60);
    expect(alert.status).toBe("neutral");
    expect(alert.message).toBe("Good on any tide");
  });

  it("returns neutral status for 'either' preference", () => {
    const alert = getTideAlert("either", "rising", 60);
    expect(alert.status).toBe("neutral");
    expect(alert.message).toBe("Good on any tide");
  });

  it("returns optimal status when direction matches", () => {
    const alert = getTideAlert("rising", "rising", 60);
    expect(alert.status).toBe("optimal");
    expect(alert.message).toContain("Optimal now");
    expect(alert.message).toContain("rising");
  });

  it("returns waiting status with hours when direction mismatches", () => {
    const alert = getTideAlert("rising", "falling", 120); // 2 hours
    expect(alert.status).toBe("waiting");
    expect(alert.message).toContain("Better");
    expect(alert.message).toContain("2h");
    expect(alert.message).toContain("rising tide");
  });

  it("returns 'soon' when minutes to change is very small", () => {
    const alert = getTideAlert("rising", "falling", 15); // 15 minutes = 0h
    expect(alert.status).toBe("waiting");
    expect(alert.message).toContain("soon");
  });

  it("returns neutral status when current direction is null", () => {
    const alert = getTideAlert("rising", null, null);
    expect(alert.status).toBe("neutral");
    expect(alert.message).toBe("Tide data unavailable");
  });

  it("keeps the direction-only copy when the beach has no range", () => {
    const noRange: TideHeightContext = { range: null, heightFt: 0.4, nextGoodLabel: "Sun 2:50 AM" };
    expect(getTideAlert("rising", "rising", 60, noRange)).toEqual({
      status: "optimal",
      message: "Optimal now – tide is rising",
    });
    expect(getTideAlert("either", "rising", 60, noRange).message).toBe("Good on any tide");
  });

  describe("with a preferred height range (Laniakea, 1.0–3.0 ft rising)", () => {
    const range = { minFt: 1, maxFt: 3 };
    const ctx = (heightFt: number | null, nextGoodLabel: string | null = "Sun 2:50 AM"): TideHeightContext => ({
      range,
      heightFt,
      nextGoodLabel,
    });

    it("is optimal only when the direction and the height are both good", () => {
      expect(getTideAlert("rising", "rising", 60, ctx(1.6))).toEqual({
        status: "optimal",
        message: "Optimal now – rising, 1.6 ft",
      });
    });

    it("is not optimal when the tide is rising but below the range (Nov 14 4:25 PM HST)", () => {
      expect(getTideAlert("rising", "rising", 82, ctx(0.4))).toEqual({
        status: "waiting",
        message: "Too low at 0.4 ft – good from Sun 2:50 AM (1.0–3.0 ft, rising)",
      });
    });

    it("is not optimal when the tide is above the range", () => {
      expect(getTideAlert("rising", "rising", 60, ctx(3.4, "4:10 PM")).message).toBe(
        "Too high at 3.4 ft – good from 4:10 PM (1.0–3.0 ft, rising)"
      );
    });

    it("names the wrong direction when the height is in range", () => {
      expect(getTideAlert("rising", "falling", 240, ctx(1.6, "9:40 PM"))).toEqual({
        status: "waiting",
        message: "Falling now – good from 9:40 PM (1.0–3.0 ft, rising)",
      });
      expect(getTideAlert("rising", "slack", 20, ctx(1.4, "8:20 PM")).message).toBe(
        "Slack now – good from 8:20 PM (1.0–3.0 ft, rising)"
      );
    });

    it("says what the spot likes when no good tide comes in the next 24 h", () => {
      expect(getTideAlert("rising", "rising", 60, ctx(0.4, null)).message).toBe(
        "Too low at 0.4 ft – this spot likes 1.0–3.0 ft, rising"
      );
    });

    it("compares the height as the page prints it", () => {
      expect(getTideAlert("rising", "rising", 60, ctx(0.96)).message).toBe("Optimal now – rising, 1.0 ft");
      expect(getTideAlert("rising", "rising", 60, ctx(3.04)).status).toBe("optimal");
      expect(getTideAlert("rising", "rising", 60, ctx(0.94)).status).toBe("waiting");
    });

    it("rounds like the tide chart's toFixed(1) at a .x5 height", () => {
      // The chart prints 0.95 as "0.9ft"; Math.round would have printed 1.0 and said Optimal.
      expect((0.95).toFixed(1)).toBe("0.9");
      expect(getTideAlert("rising", "rising", 60, ctx(0.95)).message).toBe(
        "Too low at 0.9 ft – good from Sun 2:50 AM (1.0–3.0 ft, rising)"
      );
    });

    it("never says optimal without a height", () => {
      expect(getTideAlert("rising", "rising", 60, ctx(null))).toEqual({
        status: "neutral",
        message: "Tide is rising – this spot likes 1.0–3.0 ft",
      });
      expect(getTideAlert("rising", "rising", 60, ctx(Number.NaN)).status).toBe("neutral");
    });

    it("still says the tide data is missing when there is no direction", () => {
      expect(getTideAlert("rising", null, null, ctx(null)).message).toBe("Tide data unavailable");
    });

    it("judges an 'either' spot by height alone", () => {
      expect(getTideAlert("either", "falling", 60, ctx(1.6))).toEqual({
        status: "optimal",
        message: "Optimal now – 1.6 ft",
      });
      expect(getTideAlert("either", "rising", 60, ctx(0.4))).toEqual({
        status: "waiting",
        message: "Too low at 0.4 ft – good from Sun 2:50 AM (1.0–3.0 ft)",
      });
      expect(getTideAlert(null, null, null, ctx(null))).toEqual({
        status: "neutral",
        message: "This spot likes 1.0–3.0 ft",
      });
    });
  });
});
