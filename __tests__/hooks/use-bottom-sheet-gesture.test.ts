import { getSnapTranslateY, findNearestSnapIndex } from "@/hooks/use-bottom-sheet-gesture";

// Set window.innerHeight for snap math
beforeAll(() => {
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: 800,
  });
});

describe("getSnapTranslateY", () => {
  it("returns full height for snap fraction 0 (collapsed)", () => {
    expect(getSnapTranslateY(0)).toBe(800);
  });

  it("returns 0 for snap fraction 1 (fully open)", () => {
    expect(getSnapTranslateY(1)).toBe(0);
  });

  it("returns correct value for 10% peek snap", () => {
    // 10% snap -> (1 - 0.1) * 800 = 720
    expect(getSnapTranslateY(0.1)).toBe(720);
  });

  it("returns correct value for 40% detail snap", () => {
    // 40% snap -> (1 - 0.4) * 800 = 480
    expect(getSnapTranslateY(0.4)).toBe(480);
  });

  it("returns correct value for 90% full snap", () => {
    // 90% snap -> (1 - 0.9) * 800 = 80
    expect(getSnapTranslateY(0.9)).toBeCloseTo(80);
  });
});

describe("findNearestSnapIndex", () => {
  const snapPoints = [0.1, 0.4, 0.9]; // peek=720, detail=480, full=80

  it("returns peek (0) when position is near peek snap", () => {
    expect(findNearestSnapIndex(710, snapPoints)).toBe(0);
  });

  it("returns detail (1) when position is near detail snap", () => {
    expect(findNearestSnapIndex(490, snapPoints)).toBe(1);
  });

  it("returns full (2) when position is near full snap", () => {
    expect(findNearestSnapIndex(90, snapPoints)).toBe(2);
  });

  it("picks the closer snap when between two points", () => {
    // Midpoint between peek (720) and detail (480) is 600
    // 590 is closer to detail (480)
    expect(findNearestSnapIndex(590, snapPoints)).toBe(1);
    // 610 is closer to peek (720)
    expect(findNearestSnapIndex(610, snapPoints)).toBe(0);
  });

  it("returns first snap for position at screen bottom", () => {
    expect(findNearestSnapIndex(800, snapPoints)).toBe(0);
  });

  it("returns last snap for position at top", () => {
    expect(findNearestSnapIndex(0, snapPoints)).toBe(2);
  });

  it("handles single snap point", () => {
    expect(findNearestSnapIndex(400, [0.5])).toBe(0);
  });

  it("handles two snap points", () => {
    const twoPoints = [0.2, 0.8]; // 640 and 160
    expect(findNearestSnapIndex(600, twoPoints)).toBe(0);
    expect(findNearestSnapIndex(200, twoPoints)).toBe(1);
  });
});

describe("velocity-based snap direction", () => {
  const snapPoints = [0.1, 0.4, 0.9];
  const FLICK_VELOCITY_THRESHOLD = 0.5;

  // Simulates the endDrag logic from the hook
  function computeTargetIndex(
    currentTranslateY: number,
    velocity: number
  ): number {
    if (Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD) {
      const currentNearest = findNearestSnapIndex(
        currentTranslateY,
        snapPoints
      );
      if (velocity > 0) {
        return Math.max(0, currentNearest - 1);
      } else {
        return Math.min(snapPoints.length - 1, currentNearest + 1);
      }
    }
    return findNearestSnapIndex(currentTranslateY, snapPoints);
  }

  it("flick down from detail snaps to peek", () => {
    // Near detail (480), flicking down (positive velocity)
    expect(computeTargetIndex(480, 0.8)).toBe(0);
  });

  it("flick up from detail snaps to full", () => {
    // Near detail (480), flicking up (negative velocity)
    expect(computeTargetIndex(480, -0.8)).toBe(2);
  });

  it("flick up from peek snaps to detail", () => {
    // Near peek (720), flicking up
    expect(computeTargetIndex(720, -0.8)).toBe(1);
  });

  it("flick down from peek stays at peek (clamped)", () => {
    // Near peek (720), flicking down — can't go below 0
    expect(computeTargetIndex(720, 0.8)).toBe(0);
  });

  it("flick up from full stays at full (clamped)", () => {
    // Near full (80), flicking up — can't go above 2
    expect(computeTargetIndex(80, -0.8)).toBe(2);
  });

  it("slow drag snaps to nearest without velocity bias", () => {
    // Low velocity, near detail
    expect(computeTargetIndex(490, 0.3)).toBe(1);
    expect(computeTargetIndex(490, -0.3)).toBe(1);
  });
});
