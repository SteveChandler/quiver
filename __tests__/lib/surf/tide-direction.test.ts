import { getTideAlert } from "@/lib/surf/tide-direction";


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
});
