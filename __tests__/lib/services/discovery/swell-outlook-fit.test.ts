// __tests__/lib/services/discovery/swell-outlook-fit.test.ts
import { swellFitFor } from "@/lib/services/discovery/swell-outlook-fit";
import type { BoardClass, RideabilityBand } from "@/lib/domains/rideability";
import type { SkillLevel } from "@/lib/domains/user-preferences";
import type { SwellFit } from "@/lib/services/discovery/swell-outlook-types";

describe("swellFitFor", () => {
  it("advanced, shortboard only: 2.5 ft is rideable, not in range (spec worked example)", () => {
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "advanced", boardClasses: ["shortboard"] }))
      .toEqual({ status: "rideable", boards: [] });
  });

  it("advanced with a longboard too: 2.5 ft is in range on the longboard", () => {
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "advanced", boardClasses: ["shortboard", "longboard"] }))
      .toEqual({ status: "in_range", boards: ["longboard"] });
  });

  it("Steven's quiver: 1.2 ft is longboard-only, 2.5 ft fits all three", () => {
    const boardClasses = ["shortboard", "fish", "longboard"] as const;
    expect(swellFitFor({ faceHeightFt: 1.2, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "in_range", boards: ["longboard"] });
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "in_range", boards: ["shortboard", "fish", "longboard"] });
  });

  it("is below range under every acceptable band and above range over every one", () => {
    expect(swellFitFor({ faceHeightFt: 1, skillLevel: "advanced", boardClasses: ["shortboard"] }).status).toBe("below_range");
    expect(swellFitFor({ faceHeightFt: 14, skillLevel: "advanced", boardClasses: ["shortboard"] }).status).toBe("above_range");
  });

  it("uses the skill level's default band when no boards are recorded", () => {
    expect(swellFitFor({ faceHeightFt: 1, skillLevel: "beginner", boardClasses: [] })).toEqual({ status: "in_range", boards: [] });
    expect(swellFitFor({ faceHeightFt: 0.4, skillLevel: "beginner", boardClasses: [] }).status).toBe("below_range");
  });

  it("is unknown without a skill level or a size, but never throws", () => {
    expect(swellFitFor({ faceHeightFt: 3, skillLevel: null, boardClasses: ["shortboard"] })).toEqual({ status: "unknown", boards: [] });
    expect(swellFitFor({ faceHeightFt: null, skillLevel: "advanced", boardClasses: [] })).toEqual({ status: "unknown", boards: [] });
    expect(swellFitFor({ faceHeightFt: Number.NaN, skillLevel: "advanced", boardClasses: [] }).status).toBe("unknown");
  });

  it("is above range when the size exceeds both boards' acceptable bands", () => {
    // beginner: longboard acceptable 0.3-2.8, shortboard acceptable 0.6-4.2; 4.5 ft is above both.
    expect(swellFitFor({ faceHeightFt: 4.5, skillLevel: "beginner", boardClasses: ["longboard", "shortboard"] }).status).toBe("above_range");
  });

  it.each<[number, BoardClass[]]>([
    [1.0, ["longboard"]],
    [1.6, ["longboard"]],
    [1.7, ["fish", "longboard"]],
    [2.3, ["shortboard", "fish", "longboard"]],
    [3.5, ["shortboard", "fish", "longboard"]],
    [3.6, ["shortboard", "fish"]],
    [4.8, ["shortboard", "fish"]],
    [4.9, ["shortboard"]],
    [5.3, ["shortboard"]],
  ])("intermediate quiver: %s ft matches the ideal boards", (faceHeightFt, boards) => {
    expect(swellFitFor({
      faceHeightFt,
      skillLevel: "intermediate",
      boardClasses: ["shortboard", "fish", "longboard"],
    })).toEqual({ status: "in_range", boards });
  });

  it.each<[number, SwellFit]>([
    [2.29, { status: "below_range", boards: [] }],
    [2.3, { status: "rideable", boards: [] }],
    [3.5, { status: "in_range", boards: ["shortboard"] }],
    [8.4, { status: "in_range", boards: ["shortboard"] }],
    [8.41, { status: "rideable", boards: [] }],
    [12.6, { status: "rideable", boards: [] }],
    [12.61, { status: "above_range", boards: [] }],
  ])("advanced shortboard: %s ft respects inclusive band edges", (faceHeightFt, fit) => {
    expect(swellFitFor({ faceHeightFt, skillLevel: "advanced", boardClasses: ["shortboard"] }))
      .toEqual(fit);
  });

  it("is rideable just outside the intermediate quiver's combined ideal range", () => {
    const boardClasses = ["shortboard", "fish", "longboard"] as const;
    expect(swellFitFor({ faceHeightFt: 0.99, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "rideable", boards: [] });
    expect(swellFitFor({ faceHeightFt: 5.31, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "rideable", boards: [] });
  });

  it("deduplicates board classes in input order without mutating a readonly quiver", () => {
    const boardClasses = Object.freeze(["longboard", "shortboard", "longboard", "fish"] as const);
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "in_range", boards: ["longboard", "shortboard", "fish"] });
    expect(boardClasses).toEqual(["longboard", "shortboard", "longboard", "fish"]);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("is unknown for non-finite size %s", (faceHeightFt) => {
    expect(swellFitFor({ faceHeightFt, skillLevel: "advanced", boardClasses: ["shortboard"] }))
      .toEqual({ status: "unknown", boards: [] });
  });

  it.each<[number, SwellFit["status"]]>([
    [0.5, "rideable"], [3, "in_range"], [4, "rideable"], [4.01, "above_range"],
  ])("no boards: %s ft uses the skill's ideal and acceptable bands", (faceHeightFt, status) => {
    expect(swellFitFor({ faceHeightFt, skillLevel: "beginner", boardClasses: [] }))
      .toEqual({ status, boards: [] });
  });
});

describe("swellFitFor with separated acceptable bands", () => {
  let fitWithSeparatedBands: typeof swellFitFor;

  beforeEach(() => {
    // Current board bands overlap; separated fixtures exercise the specified gap rule.
    jest.isolateModules(() => {
      jest.doMock("@/lib/domains/rideability", () => ({
        ...jest.requireActual("@/lib/domains/rideability"),
        getRideabilityBand: (_skill: SkillLevel, board: BoardClass | null): RideabilityBand => ({
          ideal: board === "longboard" ? { min: 1.2, max: 1.8 } : { min: 6.2, max: 6.8 },
          acceptable: board === "longboard" ? { min: 1, max: 2 } : { min: 6, max: 7 },
          prefersClean: false,
          powerBias: 0,
        }),
      }));
      fitWithSeparatedBands = require("@/lib/services/discovery/swell-outlook-fit").swellFitFor;
    });
  });

  afterEach(() => {
    jest.dontMock("@/lib/domains/rideability");
  });

  it.each<[number, SwellFit["status"], readonly BoardClass[]]>([
    [3, "above_range", ["longboard", "shortboard"]],
    [4, "above_range", ["longboard", "shortboard"]],
    [5, "below_range", ["longboard", "shortboard"]],
    [3, "above_range", ["shortboard", "longboard"]],
    [4, "above_range", ["shortboard", "longboard"]],
    [5, "below_range", ["shortboard", "longboard"]],
  ])("%s ft chooses %s by the nearest edge for board order %s", (faceHeightFt, status, boardClasses) => {
    expect(fitWithSeparatedBands({ faceHeightFt, skillLevel: "beginner", boardClasses }))
      .toEqual({ status, boards: [] });
  });
});
