import { getDirectionMultiplier, getTideAlert } from "@/lib/surf/tide-direction";

describe("getDirectionMultiplier", () => {
  it("returns 1.0 when beach preference is null", () => {
    expect(getDirectionMultiplier(null, "rising")).toBe(1.0);
  });

  it("returns 1.0 when beach preference is 'either'", () => {
    expect(getDirectionMultiplier("either", "rising")).toBe(1.0);
    expect(getDirectionMultiplier("either", "falling")).toBe(1.0);
  });

  it("returns 1.0 when direction matches preference", () => {
    expect(getDirectionMultiplier("rising", "rising")).toBe(1.0);
    expect(getDirectionMultiplier("falling", "falling")).toBe(1.0);
  });

  it("returns 0.7 when direction mismatches preference", () => {
    expect(getDirectionMultiplier("rising", "falling")).toBe(0.7);
    expect(getDirectionMultiplier("falling", "rising")).toBe(0.7);
  });

  it("returns 0.85 for slack preference when not slack", () => {
    expect(getDirectionMultiplier("slack", "rising")).toBe(0.85);
    expect(getDirectionMultiplier("slack", "falling")).toBe(0.85);
  });

  it("returns 1.0 for slack preference when slack", () => {
    expect(getDirectionMultiplier("slack", "slack")).toBe(1.0);
  });

  it("returns 1.0 when current direction is null", () => {
    expect(getDirectionMultiplier("rising", null)).toBe(1.0);
  });
});

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
