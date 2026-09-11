import type { Challenge } from "./types";

const CODE_VERSION = "o1";

export function encodeChallenge(challenge: Challenge): string {
  const initials = challenge.initials?.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  const parts = [
    CODE_VERSION,
    challenge.breakIndex.toString(36),
    (challenge.seed >>> 0).toString(36),
    Math.round(challenge.heatTotal * 100).toString(36),
  ];
  if (initials) parts.push(initials);
  return parts.join(".");
}

export function decodeChallenge(code: string): Challenge | null {
  const [version, breakPart, seedPart, totalPart, initialsPart, ...extra] = code.split(".");
  if (version !== CODE_VERSION || extra.length > 0) return null;
  if (!breakPart || !seedPart || !totalPart) return null;
  if (![breakPart, seedPart, totalPart].every((part) => /^[0-9a-z]+$/i.test(part))) return null;

  const breakIndex = Number.parseInt(breakPart, 36);
  const seed = Number.parseInt(seedPart, 36);
  const heatTotal = Number.parseInt(totalPart, 36) / 100;
  if (!Number.isInteger(breakIndex) || breakIndex < 0 || breakIndex > 5) return null;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  if (!Number.isFinite(heatTotal) || heatTotal < 0 || heatTotal > 20) return null;
  if (initialsPart && !/^[A-Z0-9]{1,3}$/i.test(initialsPart)) return null;

  return {
    breakIndex,
    seed: seed >>> 0,
    heatTotal: Number(heatTotal.toFixed(2)),
    ...(initialsPart ? { initials: initialsPart.toUpperCase() } : {}),
  };
}

export function dailySeed(date: Date = new Date()): number {
  const utcDate = date.toISOString().slice(0, 10);
  let hash = 2166136261;
  for (const character of utcDate) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
