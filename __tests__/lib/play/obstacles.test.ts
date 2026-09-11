/** @jest-environment node */

import {
  BREAKS,
  completeWave,
  createHeatState,
  createSimulationState,
  generateObstacleSchedule,
  generateWaveSet,
  getObstacleCollision,
  getPierWarning,
  startHeat,
  stepSimulation,
  type Obstacle,
  type PierObstacle,
  type SimulationState,
} from "@/lib/play";

function obstacle<T extends Obstacle>(value: T): T {
  return value;
}

function state(overrides: Partial<SimulationState> = {}): SimulationState {
  const wave = generateWaveSet(12, 0)[0];
  return { ...createSimulationState(wave), elapsed: 10, ...overrides };
}

describe("ONE MORE WAVE obstacles", () => {
  it("generates a deterministic schedule from the wave seed", () => {
    const first = generateObstacleSchedule(20260911, 4, 1, 24);
    expect(first).toEqual(generateObstacleSchedule(20260911, 4, 1, 24));
    expect(first).not.toEqual(generateObstacleSchedule(20260912, 4, 1, 24));
    expect(first.every((item) => item.hitAt - item.cueAt >= 2)).toBe(true);
  });

  it("scales density and obstacle character by break", () => {
    const cowells = generateObstacleSchedule(7, 0, 0, 24);
    const oceanBeach = generateObstacleSchedule(7, 3, 0, 24);
    const pipeline = generateObstacleSchedule(7, 4, 0, 24);
    const mavericks = generateObstacleSchedule(7, 5, 0, 38);

    expect(cowells.length).toBeLessThan(oceanBeach.length);
    expect(oceanBeach.some((item) => item.kind === "swimmer" || item.kind === "bodyboarder")).toBe(true);
    expect(oceanBeach.some((item) => item.kind === "debris")).toBe(true);
    expect(pipeline.some((item) => item.kind === "pier")).toBe(true);
    expect(pipeline.some((item) => item.kind === "seagull")).toBe(true);
    expect(mavericks).toHaveLength(0);
  });

  it("hits a high rider or an airborne rider with a gull", () => {
    const gull = obstacle({ id: "g", kind: "seagull", lane: "upper", cueAt: 7, hitAt: 10, endAt: 10.4 });
    expect(getObstacleCollision(gull, state({ facePosition: 0.8 }))).toBe("Took a gull to the face");
    expect(getObstacleCollision(gull, state({ phase: "airborne", facePosition: 0.4 }))).toBe("Took a gull to the face");
    expect(getObstacleCollision(gull, state({ facePosition: 0.3 }))).toBeNull();
  });

  it("hits during the fish arc but not during either splash", () => {
    const fish = obstacle({ id: "f", kind: "fish", lane: "mid", cueAt: 7, hitAt: 10, endAt: 10.6 });
    expect(getObstacleCollision(fish, state({ elapsed: 9.9 }))).toBeNull();
    expect(getObstacleCollision(fish, state({ elapsed: 10.2 }))).toBe("Bad landing");
    expect(getObstacleCollision(fish, state({ elapsed: 10.7 }))).toBeNull();
  });

  it("applies low debris and mid-water human hit rules", () => {
    const debris = obstacle({ id: "d", kind: "debris", lane: "low", cueAt: 7, hitAt: 10, endAt: 10.4, variant: "crate" });
    const swimmer = obstacle({ id: "s", kind: "swimmer", lane: "mid", cueAt: 7, hitAt: 10, endAt: 10.4 });
    expect(getObstacleCollision(debris, state({ facePosition: 0.2 }))).toBe("Clipped by debris");
    expect(getObstacleCollision(debris, state({ facePosition: 0.6 }))).toBeNull();
    expect(getObstacleCollision(swimmer, state({ facePosition: 0.5 }))).toBe("Hit a swimmer");
    expect(getObstacleCollision(swimmer, state({ facePosition: 0.78 }))).toBeNull();

    const cutback = state({ facePosition: 0.5 });
    cutback.stats.maneuvers = [
      { type: "snap", at: 9.2, basePoints: 1, awardedPoints: 1, flowMultiplier: 1 },
      { type: "snap", at: 9.8, basePoints: 1, awardedPoints: 1, flowMultiplier: 1 },
    ];
    expect(getObstacleCollision(swimmer, cutback)).toBeNull();
  });

  it("never collides with a buoy", () => {
    const buoy = obstacle({ id: "b", kind: "buoy", lane: "low", cueAt: 7, hitAt: 10, endAt: 10.4 });
    expect(getObstacleCollision(buoy, state({ facePosition: 0.2 }))).toBeNull();
  });

  it("keeps an explicit pier gap passable", () => {
    const pier: PierObstacle = {
      id: "p",
      kind: "pier",
      lane: "mid",
      cueAt: 5,
      hitAt: 10,
      endAt: 10.5,
      pattern: "double-post-gap",
      posts: [{ lane: "upper", width: 0.18 }, { lane: "low", width: 0.18 }],
      gaps: ["mid"],
    };
    expect(getObstacleCollision(pier, state({ facePosition: 0.52 }))).toBeNull();
    expect(getObstacleCollision(pier, state({ facePosition: 0.85 }))).toBe("Hit the pier");
  });

  it("warns at least four seconds before the first pier hit", () => {
    const wave = generateWaveSet(99, 4)[0];
    const pier = wave.obstacles.find((item): item is PierObstacle => item.kind === "pier");
    expect(pier).toBeDefined();
    expect((pier?.hitAt ?? 0) - (pier?.cueAt ?? 0)).toBeGreaterThanOrEqual(4);
    expect(getPierWarning(wave.obstacles, (pier?.cueAt ?? 0) + 0.1)).toEqual(pier);
  });

  it("ends a wave with an obstacle reason", () => {
    const wave = {
      ...generateWaveSet(1, 0)[0],
      obstacles: [{ id: "d", kind: "debris", lane: "low", cueAt: 0, hitAt: 0.01, endAt: 1, variant: "plank" }] as Obstacle[],
    };
    const wiped = stepSimulation(
      { ...createSimulationState(wave), facePosition: 0.2, previousFacePosition: 0.2 },
      { vertical: 0, action: false, actionPressed: false, actionReleased: false },
      BREAKS[0],
      wave,
    );
    expect(wiped.phase).toBe("wipeout");
    expect(wiped.wipeoutReason).toBe("Clipped by debris");
  });

  it("aggregates tricks, longest ride, and closest pier pass per heat", () => {
    let heat = startHeat(createHeatState(4, 1));
    heat = completeWave(heat, 6, false, {
      ...state().stats,
      maneuvers: [
        { type: "air", at: 2, basePoints: 3, awardedPoints: 3, flowMultiplier: 1 },
        { type: "snap", at: 4, basePoints: 2, awardedPoints: 2, flowMultiplier: 1 },
      ],
      rideSeconds: 18.4,
      closestPierPass: 0.22,
    });
    heat = completeWave(heat, 7, false, { ...state().stats, rideSeconds: 21.7, closestPierPass: 0.14 });

    expect(heat.stats).toEqual({ tricksLanded: 2, longestRideSeconds: 21.7, closestPierPass: 0.14 });
  });
});
