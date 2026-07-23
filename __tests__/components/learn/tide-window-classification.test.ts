import {
  classifyTideWindow,
  getTideRangeFeet,
  TIDE_CYCLE_HOURS,
} from "@/components/learn/figures/tide-window-classification";

describe("classifyTideWindow", () => {
  it("maps a semidiurnal cycle from low through high and back to low", () => {
    expect(classifyTideWindow(0, "average")).toMatchObject({
      stage: "low",
      stageLabel: "Low tide",
      heightFeet: 0,
    });
    expect(classifyTideWindow(TIDE_CYCLE_HOURS / 4, "average")).toMatchObject({
      stage: "rising",
      stageLabel: "Rising tide",
      heightFeet: 2.5,
    });
    expect(classifyTideWindow(TIDE_CYCLE_HOURS / 2, "average")).toMatchObject({
      stage: "high",
      stageLabel: "High tide",
      heightFeet: 5,
    });
    expect(
      classifyTideWindow((TIDE_CYCLE_HOURS * 3) / 4, "average"),
    ).toMatchObject({
      stage: "falling",
      stageLabel: "Falling tide",
      heightFeet: 2.5,
    });
    expect(classifyTideWindow(TIDE_CYCLE_HOURS, "average")).toMatchObject({
      stage: "low",
      stageLabel: "Low tide",
      heightFeet: 0,
    });
  });

  it("uses smaller neap and larger spring ranges", () => {
    expect(getTideRangeFeet("neap")).toBe(3.5);
    expect(getTideRangeFeet("average")).toBe(5);
    expect(getTideRangeFeet("spring")).toBe(7);
    expect(
      classifyTideWindow(TIDE_CYCLE_HOURS / 2, "spring").heightFeet,
    ).toBe(7);
  });
});
