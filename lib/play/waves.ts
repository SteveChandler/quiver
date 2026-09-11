import { getBreak } from "./breaks";
import { mulberry32, randomBetween } from "./rng";
import type { ThrowCadence, ThrowWindow, WaveDefinition } from "./types";

function makeThrowWindows(
  cadence: ThrowCadence,
  duration: number,
  random: () => number,
): ThrowWindow[] {
  if (cadence === "never") return [];

  const counts: Record<Exclude<ThrowCadence, "never">, number> = {
    rare: random() > 0.45 ? 1 : 0,
    sometimes: random() > 0.2 ? 1 : 0,
    often: 2,
    once: 1,
  };
  const count = counts[cadence];

  return Array.from({ length: count }, (_, index) => {
    const spread = duration / (count + 1);
    const center = spread * (index + 1) + randomBetween(random, -1.5, 1.5);
    const length = cadence === "once" ? 6 : randomBetween(random, 2.4, 4.2);
    return {
      start: Math.max(2, center - length / 2),
      end: Math.min(duration - 1, center + length / 2),
    };
  });
}

export function generateWaveSet(seed: number, breakIndex: number): WaveDefinition[] {
  const definition = getBreak(breakIndex);
  const random = mulberry32((seed ^ Math.imul(breakIndex + 1, 0x9e3779b9)) >>> 0);

  return Array.from({ length: definition.maxWaves }, (_, index) => {
    const duration = randomBetween(random, definition.index === 5 ? 34 : 20, definition.index === 5 ? 42 : 27);
    return {
      id: index + 1,
      height: randomBetween(random, 0.72, 1.08) + definition.index * 0.09,
      duration,
      sectionStart: randomBetween(random, 0.82, 1),
      textureSeed: Math.floor(random() * 1_000_000),
      throwWindows: makeThrowWindows(definition.throwCadence, duration, random),
    };
  });
}
