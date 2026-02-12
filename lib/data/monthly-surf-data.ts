/**
 * Monthly Surf Data
 *
 * Per-state monthly surf conditions data for "Best Time to Surf" pages.
 * Combines regional surf data with seasonal swell/crowd patterns.
 */

export interface MonthlyData {
  month: string;
  waveHeightRange: string;
  waterTemp: number;
  wetsuit: string;
  crowdLevel: "low" | "moderate" | "high";
  overallScore: number;
  bestFor: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * California monthly data — south swells peak Aug-Oct, NW swells Dec-Feb.
 * Water cold year-round (55-72 F). Summer = crowded.
 */
const CA_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "4-8 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 78, bestFor: "NW winter swells, uncrowded" },
  { month: "February", waveHeightRange: "4-8 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 80, bestFor: "Consistent NW swells" },
  { month: "March", waveHeightRange: "3-6 ft", waterTemp: 57, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 72, bestFor: "Late-season NW swells" },
  { month: "April", waveHeightRange: "2-5 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 60, bestFor: "Transition month, variable conditions" },
  { month: "May", waveHeightRange: "2-4 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 55, bestFor: "Early south swell pulses" },
  { month: "June", waveHeightRange: "2-4 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "high", overallScore: 50, bestFor: "Glassy mornings, small south swells" },
  { month: "July", waveHeightRange: "2-5 ft", waterTemp: 65, wetsuit: "3/2mm", crowdLevel: "high", overallScore: 58, bestFor: "South swells building" },
  { month: "August", waveHeightRange: "3-6 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "high", overallScore: 72, bestFor: "Peak south swell season" },
  { month: "September", waveHeightRange: "3-7 ft", waterTemp: 70, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Best combo: warm water + south swells" },
  { month: "October", waveHeightRange: "3-7 ft", waterTemp: 67, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 88, bestFor: "Santa Ana winds, south + NW overlap" },
  { month: "November", waveHeightRange: "3-6 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 75, bestFor: "First NW swells, offshore winds" },
  { month: "December", waveHeightRange: "4-8 ft", waterTemp: 58, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Big NW swells arrive" },
];

/**
 * Hawaii monthly data — North shore Nov-Feb, south shore May-Sep.
 * Warm year-round. Crowd varies by shore.
 */
const HI_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "6-15 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 90, bestFor: "Peak north shore season" },
  { month: "February", waveHeightRange: "6-15 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 88, bestFor: "Big winter swells continue" },
  { month: "March", waveHeightRange: "4-10 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 78, bestFor: "Transition month, less crowded" },
  { month: "April", waveHeightRange: "3-6 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 65, bestFor: "Smaller swells, warm water" },
  { month: "May", waveHeightRange: "2-5 ft", waterTemp: 77, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 60, bestFor: "South shore picking up" },
  { month: "June", waveHeightRange: "2-5 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 62, bestFor: "South shore summer swells" },
  { month: "July", waveHeightRange: "3-6 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 70, bestFor: "Consistent south shore" },
  { month: "August", waveHeightRange: "3-6 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 72, bestFor: "Peak south shore, warmest water" },
  { month: "September", waveHeightRange: "3-6 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 74, bestFor: "South swells + early north pulses" },
  { month: "October", waveHeightRange: "4-8 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 80, bestFor: "North shore waking up" },
  { month: "November", waveHeightRange: "5-12 ft", waterTemp: 77, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 85, bestFor: "First big north swells" },
  { month: "December", waveHeightRange: "6-15 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 92, bestFor: "Peak season, Pipeline firing" },
];

/**
 * Florida monthly data — hurricane swells Sep-Nov, cold fronts winter.
 * Warm water Jun-Oct.
 */
const FL_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "2-5 ft", waterTemp: 66, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 62, bestFor: "Cold front swells" },
  { month: "February", waveHeightRange: "2-5 ft", waterTemp: 65, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 60, bestFor: "Nor'easter leftovers" },
  { month: "March", waveHeightRange: "2-4 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "high", overallScore: 55, bestFor: "Spring break crowds, variable swells" },
  { month: "April", waveHeightRange: "1-3 ft", waterTemp: 72, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 40, bestFor: "Small swells, warming water" },
  { month: "May", waveHeightRange: "1-3 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 35, bestFor: "Flat spells, summer warmth" },
  { month: "June", waveHeightRange: "1-3 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 38, bestFor: "Tropical disturbance swells" },
  { month: "July", waveHeightRange: "1-3 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Small summer surf" },
  { month: "August", waveHeightRange: "2-4 ft", waterTemp: 84, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 50, bestFor: "Early hurricane season" },
  { month: "September", waveHeightRange: "3-8 ft", waterTemp: 83, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 82, bestFor: "Peak hurricane swell season" },
  { month: "October", waveHeightRange: "3-7 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 80, bestFor: "Late hurricane swells" },
  { month: "November", waveHeightRange: "2-5 ft", waterTemp: 74, wetsuit: "spring suit", crowdLevel: "low", overallScore: 70, bestFor: "Cold front + hurricane season overlap" },
  { month: "December", waveHeightRange: "2-5 ft", waterTemp: 68, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 65, bestFor: "Cold front swells, uncrowded" },
];

/**
 * Oregon monthly data — best Sep-Nov, cold year-round.
 */
const OR_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "6-12 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Big winter storms, advanced only" },
  { month: "February", waveHeightRange: "6-12 ft", waterTemp: 47, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Powerful winter swells" },
  { month: "March", waveHeightRange: "5-10 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 62, bestFor: "Late winter, slightly cleaner" },
  { month: "April", waveHeightRange: "4-8 ft", waterTemp: 49, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 65, bestFor: "Spring swells, less wind" },
  { month: "May", waveHeightRange: "3-6 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "moderate", overallScore: 62, bestFor: "Cleaning up, still consistent" },
  { month: "June", waveHeightRange: "2-5 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 55, bestFor: "Smaller waves, glassy mornings" },
  { month: "July", waveHeightRange: "2-4 ft", waterTemp: 54, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 50, bestFor: "Summer lull, warmest water" },
  { month: "August", waveHeightRange: "2-5 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 58, bestFor: "South swell pulses" },
  { month: "September", waveHeightRange: "3-7 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall season begins, clean swells" },
  { month: "October", waveHeightRange: "4-8 ft", waterTemp: 54, wetsuit: "4/3mm + boots", crowdLevel: "moderate", overallScore: 82, bestFor: "Best month, consistent + manageable" },
  { month: "November", waveHeightRange: "5-10 ft", waterTemp: 51, wetsuit: "5/4mm + boots/gloves", crowdLevel: "low", overallScore: 75, bestFor: "Fall swells intensify" },
  { month: "December", waveHeightRange: "6-12 ft", waterTemp: 49, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 65, bestFor: "Winter storms, heavy surf" },
];

/**
 * Washington monthly data — similar to Oregon but colder.
 */
const WA_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "6-12 ft", waterTemp: 46, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Big storm surf" },
  { month: "February", waveHeightRange: "6-12 ft", waterTemp: 45, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Powerful winter swells" },
  { month: "March", waveHeightRange: "5-10 ft", waterTemp: 46, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Late winter, improving conditions" },
  { month: "April", waveHeightRange: "4-8 ft", waterTemp: 47, wetsuit: "5/4mm + boots/gloves", crowdLevel: "low", overallScore: 62, bestFor: "Spring swells" },
  { month: "May", waveHeightRange: "3-6 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 60, bestFor: "Cleaning up" },
  { month: "June", waveHeightRange: "2-5 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "moderate", overallScore: 52, bestFor: "Smaller but cleaner" },
  { month: "July", waveHeightRange: "2-4 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 48, bestFor: "Summer lull" },
  { month: "August", waveHeightRange: "2-5 ft", waterTemp: 54, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 55, bestFor: "Warmest water, south pulses" },
  { month: "September", waveHeightRange: "3-7 ft", waterTemp: 54, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 78, bestFor: "Fall season starts" },
  { month: "October", waveHeightRange: "4-8 ft", waterTemp: 52, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 80, bestFor: "Best month, clean fall swells" },
  { month: "November", waveHeightRange: "5-10 ft", waterTemp: 49, wetsuit: "5/4mm + boots/gloves", crowdLevel: "low", overallScore: 70, bestFor: "Fall intensifies" },
  { month: "December", waveHeightRange: "6-12 ft", waterTemp: 47, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Winter storms arrive" },
];

/**
 * East Coast monthly data — shared baseline for NJ, NY, NC, SC, MA, ME, NH, RI, GA.
 * Hurricane season Sep-Nov, winter nor'easters.
 */
const EAST_COAST_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "3-7 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 65, bestFor: "Nor'easter swells, uncrowded" },
  { month: "February", waveHeightRange: "3-7 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 62, bestFor: "Coldest water, consistent nor'easters" },
  { month: "March", waveHeightRange: "3-6 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Late winter swells" },
  { month: "April", waveHeightRange: "2-5 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "moderate", overallScore: 50, bestFor: "Spring lull, warming trend" },
  { month: "May", waveHeightRange: "2-4 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 45, bestFor: "Small swells, warmer water" },
  { month: "June", waveHeightRange: "1-3 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "high", overallScore: 38, bestFor: "Summer begins, mostly flat" },
  { month: "July", waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "high", overallScore: 35, bestFor: "Summer flat spells" },
  { month: "August", waveHeightRange: "2-4 ft", waterTemp: 72, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 48, bestFor: "Tropical swell pulses" },
  { month: "September", waveHeightRange: "3-8 ft", waterTemp: 70, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Hurricane swells, warm water" },
  { month: "October", waveHeightRange: "3-7 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Best combo: swells + warmth" },
  { month: "November", waveHeightRange: "3-6 ft", waterTemp: 52, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 72, bestFor: "Nor'easters begin, crowds thin" },
  { month: "December", waveHeightRange: "3-7 ft", waterTemp: 45, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 68, bestFor: "Winter nor'easters ramp up" },
];

/**
 * Texas monthly data — warm water, hurricane swells best.
 */
const TX_MONTHLY: MonthlyData[] = [
  { month: "January", waveHeightRange: "2-4 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 45, bestFor: "Cold front swells" },
  { month: "February", waveHeightRange: "2-4 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 42, bestFor: "Winter cold fronts" },
  { month: "March", waveHeightRange: "2-4 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 45, bestFor: "Spring swells" },
  { month: "April", waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 35, bestFor: "Variable conditions" },
  { month: "May", waveHeightRange: "1-3 ft", waterTemp: 74, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 32, bestFor: "Mostly flat" },
  { month: "June", waveHeightRange: "1-3 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 35, bestFor: "Tropical storms possible" },
  { month: "July", waveHeightRange: "1-3 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 30, bestFor: "Summer flat spell" },
  { month: "August", waveHeightRange: "2-4 ft", waterTemp: 84, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 50, bestFor: "Early hurricane season" },
  { month: "September", waveHeightRange: "3-6 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 78, bestFor: "Peak hurricane swell season" },
  { month: "October", waveHeightRange: "3-5 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 72, bestFor: "Late hurricane swells" },
  { month: "November", waveHeightRange: "2-4 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "low", overallScore: 55, bestFor: "Transition month" },
  { month: "December", waveHeightRange: "2-4 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 50, bestFor: "Cold front swells" },
];

/**
 * State slug to monthly data mapping.
 * East Coast states share a baseline; adjust water temps for warmer/colder states.
 */
const STATE_MONTHLY_DATA: Record<string, MonthlyData[]> = {
  ca: CA_MONTHLY,
  hi: HI_MONTHLY,
  fl: FL_MONTHLY,
  or: OR_MONTHLY,
  wa: WA_MONTHLY,
  tx: TX_MONTHLY,
  // East Coast states share baseline data
  nj: EAST_COAST_MONTHLY,
  ny: EAST_COAST_MONTHLY,
  nc: adjustWaterTemp(EAST_COAST_MONTHLY, 8),
  sc: adjustWaterTemp(EAST_COAST_MONTHLY, 12),
  ga: adjustWaterTemp(EAST_COAST_MONTHLY, 14),
  ma: EAST_COAST_MONTHLY,
  me: adjustWaterTemp(EAST_COAST_MONTHLY, -4),
  nh: adjustWaterTemp(EAST_COAST_MONTHLY, -2),
  ri: EAST_COAST_MONTHLY,
  pr: HI_MONTHLY.map((m) => ({
    ...m,
    waterTemp: m.waterTemp + 2,
    bestFor: m.bestFor.replace("Pipeline firing", "Rincon firing"),
  })),
};

/**
 * Adjust water temperatures for a state variant of a baseline dataset.
 */
function adjustWaterTemp(baseline: MonthlyData[], offset: number): MonthlyData[] {
  return baseline.map((m) => ({
    ...m,
    waterTemp: m.waterTemp + offset,
    wetsuit: getWetsuitForTemp(m.waterTemp + offset),
  }));
}

/**
 * Get wetsuit recommendation based on water temperature.
 */
function getWetsuitForTemp(tempF: number): string {
  if (tempF >= 75) return "boardshorts";
  if (tempF >= 68) return "spring suit";
  if (tempF >= 62) return "3/2mm";
  if (tempF >= 55) return "4/3mm";
  if (tempF >= 48) return "4/3mm + boots";
  return "5/4mm + boots/gloves/hood";
}

/**
 * Get monthly surf data for a given state.
 * Falls back to California data for unsupported states.
 */
export function getMonthlyDataForState(stateSlug: string): MonthlyData[] {
  return STATE_MONTHLY_DATA[stateSlug.toLowerCase()] || CA_MONTHLY;
}

/**
 * Get the best month for a given state based on overall score.
 */
export function getBestMonth(stateSlug: string): MonthlyData {
  const data = getMonthlyDataForState(stateSlug);
  return data.reduce((best, current) =>
    current.overallScore > best.overallScore ? current : best
  );
}

/**
 * Get the month index (0-11) for a month name.
 */
export function getMonthIndex(monthName: string): number {
  return MONTH_NAMES.indexOf(monthName);
}
