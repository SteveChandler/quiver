import {
  buildSessionShareDetails,
  formatShareWaveSize,
} from "@/lib/share/session-share-card-details";

describe("session share card details", () => {
  it("adds feet to the bare wave heights native sends", () => {
    expect(formatShareWaveSize("3")).toBe("3 ft");
    expect(formatShareWaveSize("3-4")).toBe("3-4 ft");
    expect(formatShareWaveSize("9+")).toBe("9+ ft");
    expect(formatShareWaveSize("Chest-Head")).toBe("Chest-Head");
    expect(formatShareWaveSize("4 ft")).toBe("4 ft");
  });

  it("leaves off details the surfer did not log instead of filling placeholders", () => {
    expect(buildSessionShareDetails({ size: "3", board: "", windSpeed: "", windLabel: null })).toEqual([
      { label: "Waves", value: "3 ft" },
    ]);
  });

  it("keeps every logged detail in order", () => {
    expect(
      buildSessionShareDetails({ size: "Chest-Head", board: "Fish", windSpeed: "7 mph", windLabel: "Offshore" }),
    ).toEqual([
      { label: "Waves", value: "Chest-Head" },
      { label: "Board", value: "Fish" },
      { label: "Wind", value: "7 mph Offshore" },
    ]);
  });
});
