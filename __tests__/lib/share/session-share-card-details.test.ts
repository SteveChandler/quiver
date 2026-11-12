import {
  buildSessionShareDetails,
  formatShareWaveSize,
} from "@/lib/share/session-share-card-details";

describe("session share card details", () => {
  it("adds feet to the bare wave heights native sends", () => {
    expect(formatShareWaveSize("3")).toBe("3 ft");
    expect(formatShareWaveSize("3-4")).toBe("3-4 ft");
    expect(formatShareWaveSize("9+")).toBe("9+ ft");
    // Intended change: only heights in feet; a bucket name or metres is not a logged height.
    expect(formatShareWaveSize("Chest-Head")).toBe("");
    expect(formatShareWaveSize("3-4m")).toBe("");
    expect(formatShareWaveSize("4 ft")).toBe("4 ft");
  });

  it("leaves off details the surfer did not log instead of filling placeholders", () => {
    expect(buildSessionShareDetails({ size: "3", board: "", windSpeed: "", windLabel: null })).toEqual([
      { label: "Waves", value: "3 ft" },
    ]);
  });

  it("keeps every logged detail in order", () => {
    expect(
      buildSessionShareDetails({
        size: "4 ft",
        board: "Fish",
        windSpeed: "7 mph",
        windLabel: "Offshore",
      }),
    ).toEqual([
      { label: "Waves", value: "4 ft" },
      { label: "Board", value: "Fish" },
      { label: "Wind", value: "7 mph Offshore" },
    ]);
  });
});
