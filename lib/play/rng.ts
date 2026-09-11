export type RandomSource = () => number;

export function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0;
  return (): number => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(random: RandomSource, min: number, max: number): number {
  return min + (max - min) * random();
}
