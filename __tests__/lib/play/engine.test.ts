/** @jest-environment node */

import {
  BREAKS,
  completeWave,
  createHeatState,
  createRideStats,
  createSimulationState,
  dailySeed,
  decodeChallenge,
  encodeChallenge,
  generateWaveSet,
  getNeedsScore,
  getProjectedHeatTotal,
  judgeWave,
  performManeuver,
  startHeat,
  stepSimulation,
  tickHeat,
  type SimulationInput,
} from "@/lib/play";

const IDLE_INPUT: SimulationInput = {
  vertical: 0,
  action: false,
  actionPressed: false,
  actionReleased: false,
};

describe("OUTSIDE engine", () => {
  it("defines the six ordered breaks with verified beach routes", () => {
    expect(BREAKS).toHaveLength(6);
    expect(BREAKS.map((definition) => definition.beachSlug)).toEqual([
      "cowell-beach-santa-cruz-ca",
      "steamer-lane-santa-cruz-ca",
      "lower-trestles",
      "ocean-beach-middle-san-francisco-ca",
      "pipeline",
      "mavericks-half-moon-bay-ca",
    ]);
    expect(BREAKS[0]).toMatchObject({ beachPath: "/beaches", usesBeachFallback: true });
    expect(BREAKS.slice(1).every((definition) => !definition.usesBeachFallback)).toBe(true);
  });

  it("lets the section catch a surfer at zero speed", () => {
    const wave = generateWaveSet(12, 0)[0];
    let state = { ...createSimulationState(wave), speed: 0, sectionDistance: 0.01 };

    for (let frame = 0; frame < 60 && state.phase === "riding"; frame += 1) {
      state = stepSimulation(state, IDLE_INPUT, BREAKS[0], wave);
    }

    expect(state.phase).toBe("wipeout");
    expect(state.stats.wipeout).toBe(true);
  });

  it("raises speed when pumping low on the face", () => {
    const wave = generateWaveSet(42, 0)[0];
    const initial = { ...createSimulationState(wave), facePosition: 0.3, previousFacePosition: 0.3 };
    const pumped = stepSimulation(
      initial,
      { ...IDLE_INPUT, action: true },
      BREAKS[0],
      wave,
      0.5,
    );

    expect(pumped.speed).toBeGreaterThan(initial.speed);
  });

  it("wipes out when an air misses its landing window", () => {
    const wave = generateWaveSet(9, 2)[0];
    const launch = stepSimulation(
      { ...createSimulationState(wave), facePosition: 0.95, previousFacePosition: 0.95, speed: 82 },
      { ...IDLE_INPUT, actionReleased: true },
      BREAKS[2],
      wave,
    );
    const missed = stepSimulation(launch, IDLE_INPUT, BREAKS[2], wave, 0.4);

    expect(launch.phase).toBe("airborne");
    expect(missed.phase).toBe("wipeout");
  });

  it("lands an air only when action is pressed inside the landing window", () => {
    const wave = generateWaveSet(9, 2)[0];
    const launch = stepSimulation(
      { ...createSimulationState(wave), facePosition: 0.95, previousFacePosition: 0.95, speed: 82 },
      { ...IDLE_INPUT, actionReleased: true },
      BREAKS[2],
      wave,
    );
    const landed = stepSimulation(
      launch,
      { ...IDLE_INPUT, action: true, actionPressed: true },
      BREAKS[2],
      wave,
      0.2,
    );

    expect(landed.phase).toBe("riding");
    expect(landed.stats.maneuvers.at(-1)?.type).toBe("air");
  });

  it("accrues barrel time and flow while the lip throws", () => {
    const wave = {
      ...generateWaveSet(7, 4)[0],
      throwWindows: [{ start: 0, end: 10 }],
    };
    const entered = stepSimulation(
      { ...createSimulationState(wave), facePosition: 0.2, previousFacePosition: 0.2 },
      IDLE_INPUT,
      BREAKS[4],
      wave,
      0.5,
    );
    const exited = stepSimulation(
      entered,
      { ...IDLE_INPUT, vertical: 1 },
      BREAKS[4],
      wave,
      0.5,
    );

    expect(entered.inBarrel).toBe(true);
    expect(entered.stats.barrelSeconds).toBe(0.5);
    expect(entered.stats.maxFlow).toBeGreaterThan(1);
    expect(exited.stats.maneuvers.at(-1)?.type).toBe("barrel");
  });

  it("halves a repeated maneuver for variety", () => {
    const first = performManeuver(createRideStats(), "snap", 1);
    const second = performManeuver(first, "snap", 2);
    const firstEvent = second.maneuvers[0];
    const secondEvent = second.maneuvers[1];

    expect(secondEvent.awardedPoints).toBeCloseTo(
      secondEvent.basePoints * secondEvent.flowMultiplier * 0.5,
    );
    expect(secondEvent.awardedPoints).toBeLessThan(
      firstEvent.basePoints * secondEvent.flowMultiplier,
    );
  });

  it("judges a scripted ride deterministically to two decimals", () => {
    let stats = { ...createRideStats(), peakSpeed: 86 };
    stats = performManeuver(stats, "bottom-turn", 2);
    stats = performManeuver(stats, "snap", 5);
    stats = performManeuver(stats, "air", 9);
    stats = performManeuver({ ...stats, barrelSeconds: 2.4 }, "barrel", 14);

    expect(judgeWave(stats).score).toBe(8.69);
    expect(judgeWave({ ...stats, wipeout: true }).score).toBe(6.95);
  });

  it("generates identical sets from the same seed", () => {
    expect(generateWaveSet(20260910, 4)).toEqual(generateWaveSet(20260910, 4));
    expect(generateWaveSet(20260910, 4)).not.toEqual(generateWaveSet(20260911, 4));
  });

  it("round-trips a URL-safe challenge code", () => {
    const challenge = { breakIndex: 4, seed: 0xfedcba98, heatTotal: 15.2, initials: "stv" };
    const code = encodeChallenge(challenge);

    expect(code).toMatch(/^[A-Za-z0-9.-]+$/);
    expect(decodeChallenge(code)).toEqual({ ...challenge, initials: "STV" });
    expect(decodeChallenge("not-a-code")).toBeNull();
  });

  it("uses best two scores and reports the score needed", () => {
    let heat = startHeat(createHeatState(2, 1));
    heat = completeWave(heat, 6.5, false);

    expect(getNeedsScore(heat)).toBe(6.5);
    heat = completeWave(heat, 5.25, false);
    expect(getProjectedHeatTotal(heat, 7.1)).toBe(13.6);
    heat = completeWave(heat, 7.1, false);

    expect(heat.heatTotal).toBe(13.6);
    expect(heat.status).toBe("passed");
  });

  it("scores Mavericks as a single 60-second wave", () => {
    let heat = startHeat(createHeatState(5, 1));
    expect(heat.secondsRemaining).toBe(60);
    expect(getNeedsScore(heat, 4.25)).toBe(4.75);

    heat = completeWave(heat, 9.1, false);
    expect(heat.heatTotal).toBe(9.1);
    expect(heat.status).toBe("passed");
  });

  it("fails a heat when its timer expires below the cut", () => {
    const heat = startHeat(createHeatState(0, 1));
    const expired = tickHeat(heat, 90);

    expect(expired.secondsRemaining).toBe(0);
    expect(expired.status).toBe("failed");
  });

  it("keeps the heat timer paused in practice mode", () => {
    let heat = startHeat(createHeatState(0, 1, true));
    heat = tickHeat(heat, 30);
    heat = completeWave(heat, 4.2, true);

    expect(heat.practice).toBe(true);
    expect(heat.secondsRemaining).toBe(90);
  });

  it("derives the daily seed from the UTC date", () => {
    expect(dailySeed(new Date("2026-09-10T00:05:00Z"))).toBe(
      dailySeed(new Date("2026-09-10T23:55:00Z")),
    );
    expect(dailySeed(new Date("2026-09-10T23:55:00Z"))).not.toBe(
      dailySeed(new Date("2026-09-11T00:05:00Z")),
    );
  });
});
