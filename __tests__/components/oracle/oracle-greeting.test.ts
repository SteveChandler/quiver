import { getOracleGreeting, GreetingContext } from "@/lib/oracle/greeting";

const BASE: GreetingContext = {
  score: 5,
  hour: 9,
  swellPeriod: 10,
  windCondition: "offshore",
  userName: "Alex",
  beachName: "Blacks Beach",
  daysAbsent: 0,
};

describe("getOracleGreeting", () => {
  // Branch 1: score > 7 + hour < 7 → dawn patrol
  it("returns dawn patrol message when score > 7 and hour < 7", () => {
    const result = getOracleGreeting({ ...BASE, score: 8, hour: 5 });
    expect(result).toBe("It's going off. Dawn patrol, Alex.");
  });

  it("dawn patrol triggers at score exactly 7.1", () => {
    const result = getOracleGreeting({ ...BASE, score: 7.1, hour: 4 });
    expect(result).toBe("It's going off. Dawn patrol, Alex.");
  });

  it("dawn patrol triggers at hour 6 (< 7)", () => {
    const result = getOracleGreeting({ ...BASE, score: 9, hour: 6 });
    expect(result).toBe("It's going off. Dawn patrol, Alex.");
  });

  it("dawn patrol does NOT trigger at hour 7", () => {
    const result = getOracleGreeting({ ...BASE, score: 9, hour: 7 });
    expect(result).toContain("firing at");
  });

  // Branch 2: score > 7 (any hour) → firing
  it("returns firing message when score > 7 and hour >= 7", () => {
    const result = getOracleGreeting({ ...BASE, score: 8.5, hour: 10 });
    expect(result).toBe("It's firing at Blacks Beach. Don't sleep on this.");
  });

  it("uses 'out there' when beachName is null", () => {
    const result = getOracleGreeting({ ...BASE, score: 9, hour: 10, beachName: null });
    expect(result).toBe("It's firing out there. Don't sleep on this.");
  });

  it("score exactly 7 does NOT trigger firing message", () => {
    const result = getOracleGreeting({ ...BASE, score: 7, hour: 10 });
    // should fall through to a later branch
    expect(result).not.toContain("firing");
  });

  // Branch 3: swellPeriod > 12 → long period swell
  it("returns long-period swell message when swellPeriod > 12", () => {
    const result = getOracleGreeting({ ...BASE, score: 5, swellPeriod: 14 });
    expect(result).toBe("Long-period swell rolling in. Could be fun.");
  });

  it("long-period swell triggers at period exactly 13", () => {
    const result = getOracleGreeting({ ...BASE, score: 5, swellPeriod: 13 });
    expect(result).toBe("Long-period swell rolling in. Could be fun.");
  });

  it("swellPeriod exactly 12 does NOT trigger long-period message", () => {
    const result = getOracleGreeting({ ...BASE, score: 5, swellPeriod: 12 });
    expect(result).not.toContain("Long-period");
  });

  it("swellPeriod null does not trigger long-period message", () => {
    const result = getOracleGreeting({ ...BASE, score: 5, swellPeriod: null });
    expect(result).not.toContain("Long-period");
  });

  // Branch 4: score < 3 → flat
  it("returns flat message when score < 3", () => {
    const result = getOracleGreeting({ ...BASE, score: 2, swellPeriod: 8 });
    expect(result).toBe("Flat as a lake today. Good day for a coffee.");
  });

  it("flat message triggers at score 0", () => {
    const result = getOracleGreeting({ ...BASE, score: 0, swellPeriod: 8 });
    expect(result).toBe("Flat as a lake today. Good day for a coffee.");
  });

  it("score exactly 3 does NOT trigger flat message", () => {
    const result = getOracleGreeting({ ...BASE, score: 3, swellPeriod: 8 });
    expect(result).not.toContain("Flat as a lake");
  });

  it("score null does not trigger flat message", () => {
    const result = getOracleGreeting({ ...BASE, score: null, swellPeriod: 8 });
    expect(result).not.toContain("Flat as a lake");
  });

  // Branch 5: onshore wind → blown out
  it("returns blown out message when windCondition is onshore", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      swellPeriod: 8,
      windCondition: "onshore",
    });
    expect(result).toBe("Blown out. Rest day.");
  });

  it("blown out is case-insensitive", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      swellPeriod: 8,
      windCondition: "Onshore",
    });
    expect(result).toBe("Blown out. Rest day.");
  });

  it("offshore wind does NOT trigger blown out", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      swellPeriod: 8,
      windCondition: "offshore",
    });
    expect(result).not.toContain("Blown out");
  });

  it("cross-shore wind does NOT trigger blown out", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      swellPeriod: 8,
      windCondition: "cross-shore",
    });
    expect(result).not.toContain("Blown out");
  });

  it("null windCondition does not trigger blown out", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      swellPeriod: 8,
      windCondition: null,
    });
    expect(result).not.toContain("Blown out");
  });

  // Branch 6: hour < 6 → pre-dawn
  it("returns pre-dawn message when hour < 6 and no high-score conditions", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 4,
      swellPeriod: 8,
      windCondition: "offshore",
    });
    expect(result).toBe("You're up before the sun. Respect.");
  });

  it("pre-dawn triggers at hour 0", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 0,
      swellPeriod: 8,
    });
    expect(result).toBe("You're up before the sun. Respect.");
  });

  it("hour 6 does NOT trigger pre-dawn message", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 6,
      swellPeriod: 8,
      windCondition: "offshore",
    });
    expect(result).not.toContain("before the sun");
  });

  // Branch 7: daysAbsent > 3 → missed you
  it("returns missed-you message when daysAbsent > 3", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 10,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 7,
    });
    expect(result).toBe("Missed you out there. Here's what's been happening.");
  });

  it("daysAbsent exactly 4 triggers missed-you", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 10,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 4,
    });
    expect(result).toBe("Missed you out there. Here's what's been happening.");
  });

  it("daysAbsent exactly 3 does NOT trigger missed-you", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 10,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 3,
    });
    expect(result).not.toContain("Missed you");
  });

  // Branch 8: defaults — time of day
  it("returns Good morning before noon", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 9,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
    });
    expect(result).toBe("Good morning, Alex.");
  });

  it("returns Good morning at hour 0 when score > 3 and no other matches", () => {
    // hour 0 is pre-dawn (< 6), so this tests that pre-dawn takes priority over default
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 0,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
    });
    expect(result).toBe("You're up before the sun. Respect.");
  });

  it("returns Good afternoon from noon to 4:59pm", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 14,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
    });
    expect(result).toBe("Good afternoon, Alex.");
  });

  it("returns Good afternoon at hour 16 (4pm)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 16,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
    });
    expect(result).toBe("Good afternoon, Alex.");
  });

  it("returns Good evening at hour 17 and beyond", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 19,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
    });
    expect(result).toBe("Good evening, Alex.");
  });

  it("includes userName in default greeting", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 9,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 0,
      userName: "Jordan",
    });
    expect(result).toBe("Good morning, Jordan.");
  });

  // Priority order verification
  it("dawn patrol beats long-period swell (priority 1 over 3)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 9,
      hour: 5,
      swellPeriod: 18,
    });
    expect(result).toBe("It's going off. Dawn patrol, Alex.");
  });

  it("firing beats long-period swell (priority 2 over 3)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 9,
      hour: 10,
      swellPeriod: 18,
    });
    expect(result).toContain("firing at");
  });

  it("long-period swell beats flat score (priority 3 over 4)", () => {
    // score null won't trigger flat, but long period still applies
    const result = getOracleGreeting({
      ...BASE,
      score: null,
      swellPeriod: 16,
      windCondition: "onshore",
    });
    expect(result).toBe("Long-period swell rolling in. Could be fun.");
  });

  it("flat beats onshore wind (priority 4 over 5)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 1,
      swellPeriod: 8,
      windCondition: "onshore",
      hour: 10,
    });
    expect(result).toBe("Flat as a lake today. Good day for a coffee.");
  });

  it("onshore wind beats pre-dawn (priority 5 over 6)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 4,
      hour: 4,
      swellPeriod: 8,
      windCondition: "onshore",
    });
    expect(result).toBe("Blown out. Rest day.");
  });

  it("pre-dawn beats daysAbsent (priority 6 over 7)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 3,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 10,
    });
    expect(result).toBe("You're up before the sun. Respect.");
  });

  it("daysAbsent beats default (priority 7 over 8)", () => {
    const result = getOracleGreeting({
      ...BASE,
      score: 5,
      hour: 10,
      swellPeriod: 8,
      windCondition: "offshore",
      daysAbsent: 5,
    });
    expect(result).toBe("Missed you out there. Here's what's been happening.");
  });
});
