/**
 * Regional Surf Data
 *
 * Provides state-level water temperature ranges, wetsuit recommendations,
 * and climate zone classification for regionalizing intent page content.
 */

export interface RegionalSurfData {
  waterTempRange: string;
  summerWetsuit: string;
  winterWetsuit: string;
  warmestMonth: string;
  coldestMonth: string;
  trunksSeason: string | null;
}

export const REGIONAL_DATA: Record<string, RegionalSurfData> = {
  ca: { waterTempRange: "55-72", summerWetsuit: "spring suit or 3/2mm", winterWetsuit: "4/3mm", warmestMonth: "August-September", coldestMonth: "January-February", trunksSeason: null },
  hi: { waterTempRange: "73-80", summerWetsuit: "boardshorts or rashguard", winterWetsuit: "spring suit optional", warmestMonth: "September", coldestMonth: "February", trunksSeason: "year-round" },
  fl: { waterTempRange: "65-85", summerWetsuit: "boardshorts", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "May-October" },
  nj: { waterTempRange: "38-75", summerWetsuit: "spring suit", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  nc: { waterTempRange: "48-80", summerWetsuit: "spring suit or boardshorts", winterWetsuit: "4/3mm + boots", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  or: { waterTempRange: "46-58", summerWetsuit: "4/3mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "January", trunksSeason: null },
  wa: { waterTempRange: "44-56", summerWetsuit: "4/3mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "January", trunksSeason: null },
  tx: { waterTempRange: "58-82", summerWetsuit: "boardshorts or spring suit", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "June-September" },
  pr: { waterTempRange: "78-84", summerWetsuit: "boardshorts", winterWetsuit: "boardshorts", warmestMonth: "September", coldestMonth: "February", trunksSeason: "year-round" },
  sc: { waterTempRange: "52-82", summerWetsuit: "boardshorts or spring suit", winterWetsuit: "4/3mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "June-September" },
  me: { waterTempRange: "40-60", summerWetsuit: "3/2mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  ma: { waterTempRange: "40-68", summerWetsuit: "spring suit or 3/2mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  ri: { waterTempRange: "40-68", summerWetsuit: "spring suit or 3/2mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  ct: { waterTempRange: "38-72", summerWetsuit: "spring suit", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  ny: { waterTempRange: "38-75", summerWetsuit: "spring suit", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  de: { waterTempRange: "38-75", summerWetsuit: "spring suit", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
  md: { waterTempRange: "40-78", summerWetsuit: "spring suit or boardshorts", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "January", trunksSeason: null },
  va: { waterTempRange: "42-78", summerWetsuit: "spring suit or boardshorts", winterWetsuit: "4/3mm + boots", warmestMonth: "August", coldestMonth: "January", trunksSeason: null },
  ga: { waterTempRange: "55-82", summerWetsuit: "boardshorts or spring suit", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "June-September" },
  al: { waterTempRange: "55-84", summerWetsuit: "boardshorts", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "May-October" },
  ms: { waterTempRange: "55-84", summerWetsuit: "boardshorts", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "May-October" },
  la: { waterTempRange: "58-84", summerWetsuit: "boardshorts", winterWetsuit: "3/2mm", warmestMonth: "August", coldestMonth: "January", trunksSeason: "May-October" },
  nh: { waterTempRange: "40-62", summerWetsuit: "3/2mm", winterWetsuit: "5/4mm + boots/gloves/hood", warmestMonth: "August", coldestMonth: "February", trunksSeason: null },
};

export function getRegionalData(stateSlug: string): RegionalSurfData | null {
  return REGIONAL_DATA[stateSlug.toLowerCase()] || null;
}

/** Climate zone classification for intent intro regionalization */
export type ClimateZone = "tropical" | "warm-atlantic" | "cold-pacific" | "temperate-pacific" | "cold-atlantic";

export function getClimateZone(stateSlug: string): ClimateZone {
  const s = stateSlug.toLowerCase();
  if (["hi", "pr"].includes(s)) return "tropical";
  if (["fl", "tx", "sc", "ga", "al", "ms", "la"].includes(s)) return "warm-atlantic";
  if (["or", "wa"].includes(s)) return "cold-pacific";
  if (s === "ca") return "temperate-pacific";
  return "cold-atlantic";
}
