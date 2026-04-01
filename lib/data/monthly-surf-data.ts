/**
 * Monthly Surf Data
 *
 * Per-state monthly surf conditions for the best-time-to-surf pages.
 * Data sourced from regional surf knowledge and NOAA climatological averages.
 */

export interface MonthlyData {
  month: string;
  waveHeightRange: string;
  waterTemp: number;
  wetsuit: string;
  crowdLevel: "low" | "moderate" | "high";
  overallScore: number; // 0-100
  bestFor: string;
}

export interface StateSurfProfile {
  stateSlug: string;
  stateName: string;
  peakSeason: string;
  peakMonths: number[];
  monthly: MonthlyData[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * California — Best Aug-Oct (south swells), Dec-Feb (north swells).
 * Summer crowded. Water 55-72°F.
 */
const CA: StateSurfProfile = {
  stateSlug: "ca",
  stateName: "California",
  peakSeason: "August through February",
  peakMonths: [8, 9, 10, 11, 12, 1, 2],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "4-8 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 78, bestFor: "Big NW swells, uncrowded lineups" },
    { month: MONTHS[1], waveHeightRange: "4-8 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 80, bestFor: "Consistent NW groundswells" },
    { month: MONTHS[2], waveHeightRange: "3-6 ft", waterTemp: 57, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 65, bestFor: "Transitional swells, spring breaks" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 45, bestFor: "Small clean days, longboarding" },
    { month: MONTHS[4], waveHeightRange: "2-4 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 40, bestFor: "Glassy mornings, south swell teasers" },
    { month: MONTHS[5], waveHeightRange: "2-4 ft", waterTemp: 63, wetsuit: "3/2mm", crowdLevel: "high", overallScore: 50, bestFor: "June gloom glass, early south swells" },
    { month: MONTHS[6], waveHeightRange: "2-5 ft", waterTemp: 66, wetsuit: "spring suit", crowdLevel: "high", overallScore: 55, bestFor: "Summer south swells, warm water" },
    { month: MONTHS[7], waveHeightRange: "3-6 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "high", overallScore: 75, bestFor: "Peak south swells, warm water" },
    { month: MONTHS[8], waveHeightRange: "3-6 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "South swells + early NW, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 66, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Combo swells, Santa Ana offshore winds" },
    { month: MONTHS[10], waveHeightRange: "4-8 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 80, bestFor: "First big NW swells, Santa Anas" },
    { month: MONTHS[11], waveHeightRange: "4-10 ft", waterTemp: 58, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Big NW groundswells, holiday crowds" },
  ],
};

/**
 * Hawaii — Best Nov-Feb (north shore), May-Sep (south shore).
 * Warm year-round 73-80°F.
 */
const HI: StateSurfProfile = {
  stateSlug: "hi",
  stateName: "Hawaii",
  peakSeason: "November through February",
  peakMonths: [11, 12, 1, 2],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "8-15 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 92, bestFor: "Peak north shore season, big waves" },
    { month: MONTHS[1], waveHeightRange: "6-12 ft", waterTemp: 74, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 88, bestFor: "Consistent north swells, contests" },
    { month: MONTHS[2], waveHeightRange: "4-8 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 70, bestFor: "Transitional swells, fewer crowds" },
    { month: MONTHS[3], waveHeightRange: "2-5 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 50, bestFor: "Small days, exploring outer reefs" },
    { month: MONTHS[4], waveHeightRange: "2-4 ft", waterTemp: 77, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 55, bestFor: "South shore waking up, town surf" },
    { month: MONTHS[5], waveHeightRange: "3-6 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 70, bestFor: "South shore swells, warm water" },
    { month: MONTHS[6], waveHeightRange: "3-6 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 72, bestFor: "Peak south shore, Waikiki season" },
    { month: MONTHS[7], waveHeightRange: "3-6 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 70, bestFor: "South swells, warmest water" },
    { month: MONTHS[8], waveHeightRange: "2-5 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 60, bestFor: "Transition month, some south swells" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 65, bestFor: "Early north swells, low crowds" },
    { month: MONTHS[10], waveHeightRange: "6-12 ft", waterTemp: 77, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 90, bestFor: "North shore fires up, Triple Crown" },
    { month: MONTHS[11], waveHeightRange: "8-15 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 95, bestFor: "Peak north shore, Pipe Masters" },
  ],
};

/**
 * Florida — Best Sep-Nov (hurricane swells). Warm 65-85°F.
 */
const FL: StateSurfProfile = {
  stateSlug: "fl",
  stateName: "Florida",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "2-4 ft", waterTemp: 68, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 50, bestFor: "Cold fronts, occasional nor'easters" },
    { month: MONTHS[1], waveHeightRange: "2-4 ft", waterTemp: 67, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 48, bestFor: "Cold front swells, spring break approaching" },
    { month: MONTHS[2], waveHeightRange: "2-3 ft", waterTemp: 70, wetsuit: "spring suit", crowdLevel: "high", overallScore: 40, bestFor: "Spring break crowds, small surf" },
    { month: MONTHS[3], waveHeightRange: "1-3 ft", waterTemp: 74, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 30, bestFor: "Flat season begins, longboarding" },
    { month: MONTHS[4], waveHeightRange: "1-2 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 20, bestFor: "Mostly flat, enjoy the beach" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 30, bestFor: "Tropical storm teasers" },
    { month: MONTHS[6], waveHeightRange: "1-3 ft", waterTemp: 84, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 35, bestFor: "Warm water, occasional tropical swell" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 85, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 50, bestFor: "Hurricane season building" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 84, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 80, bestFor: "Peak hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-8 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 82, bestFor: "Hurricane + nor'easter overlap" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 75, wetsuit: "spring suit", crowdLevel: "low", overallScore: 75, bestFor: "Nor'easters, low crowds, warm water" },
    { month: MONTHS[11], waveHeightRange: "2-4 ft", waterTemp: 70, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 55, bestFor: "Cold fronts, holiday surfing" },
  ],
};

/**
 * New Jersey — Best Sep-Nov (hurricanes), winter nor'easters. Cold Oct-Apr.
 */
const NJ: StateSurfProfile = {
  stateSlug: "nj",
  stateName: "New Jersey",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-6 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Nor'easter swells, empty lineups" },
    { month: MONTHS[1], waveHeightRange: "3-6 ft", waterTemp: 38, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Winter storms, dedicated crew only" },
    { month: MONTHS[2], waveHeightRange: "3-5 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 50, bestFor: "Late winter swells, water warming" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 40, bestFor: "Spring swells, fewer crowds" },
    { month: MONTHS[4], waveHeightRange: "2-3 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 35, bestFor: "Small clean days" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "high", overallScore: 30, bestFor: "Summer begins, mostly small" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 72, wetsuit: "spring suit", crowdLevel: "high", overallScore: 25, bestFor: "Flat season, beach days" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Hurricane swell potential" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 72, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 65, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall swells, offshore winds" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 72, bestFor: "Nor'easters firing, thinning crowds" },
    { month: MONTHS[11], waveHeightRange: "3-6 ft", waterTemp: 45, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Winter begins, consistent storms" },
  ],
};

/**
 * North Carolina — Best Sep-Nov. Water 48-80°F.
 */
const NC: StateSurfProfile = {
  stateSlug: "nc",
  stateName: "North Carolina",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-5 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 55, bestFor: "Nor'easters, empty Outer Banks" },
    { month: MONTHS[1], waveHeightRange: "3-5 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 52, bestFor: "Winter storms, sandbar formation" },
    { month: MONTHS[2], waveHeightRange: "2-4 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 45, bestFor: "Transition swells" },
    { month: MONTHS[3], waveHeightRange: "2-3 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 38, bestFor: "Spring cleanup days" },
    { month: MONTHS[4], waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 30, bestFor: "Small but clean" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Summer begins, tourist season" },
    { month: MONTHS[6], waveHeightRange: "1-3 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Warm water, occasional tropical swell" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 50, bestFor: "Hurricane swell season begins" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 85, bestFor: "Peak hurricane swells" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 72, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall swells, crowds thin out" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 72, bestFor: "Nor'easters + hurricane tail-ends" },
    { month: MONTHS[11], waveHeightRange: "3-5 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 58, bestFor: "Winter storms setting in" },
  ],
};

/**
 * Oregon — Best Sep-Nov. Cold year-round 46-58°F.
 */
const OR: StateSurfProfile = {
  stateSlug: "or",
  stateName: "Oregon",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "6-12 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Big winter storms, raw power" },
    { month: MONTHS[1], waveHeightRange: "6-10 ft", waterTemp: 47, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Consistent large swells" },
    { month: MONTHS[2], waveHeightRange: "4-8 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Late winter swells fading" },
    { month: MONTHS[3], waveHeightRange: "3-6 ft", waterTemp: 49, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 48, bestFor: "Spring transitions" },
    { month: MONTHS[4], waveHeightRange: "2-4 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 40, bestFor: "Smaller swells, improving weather" },
    { month: MONTHS[5], waveHeightRange: "2-4 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 45, bestFor: "Glassy mornings, summer starting" },
    { month: MONTHS[6], waveHeightRange: "2-4 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 48, bestFor: "Small clean summer surf" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 58, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 50, bestFor: "Warmest water, small swells" },
    { month: MONTHS[8], waveHeightRange: "4-8 ft", waterTemp: 56, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Fall swell season begins, offshore winds" },
    { month: MONTHS[9], waveHeightRange: "4-8 ft", waterTemp: 54, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 80, bestFor: "Peak fall season, consistent swells" },
    { month: MONTHS[10], waveHeightRange: "5-10 ft", waterTemp: 52, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 72, bestFor: "Big swells return, heavy rubber" },
    { month: MONTHS[11], waveHeightRange: "6-12 ft", waterTemp: 50, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 65, bestFor: "Winter storms, big waves" },
  ],
};

/**
 * Washington — Best Sep-Nov. Cold year-round 44-56°F.
 */
const WA: StateSurfProfile = {
  stateSlug: "wa",
  stateName: "Washington",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "6-12 ft", waterTemp: 46, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Big storms, hardcore sessions" },
    { month: MONTHS[1], waveHeightRange: "6-10 ft", waterTemp: 45, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Consistent large swells" },
    { month: MONTHS[2], waveHeightRange: "4-8 ft", waterTemp: 46, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 50, bestFor: "Late winter energy" },
    { month: MONTHS[3], waveHeightRange: "3-5 ft", waterTemp: 47, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 42, bestFor: "Spring transitions" },
    { month: MONTHS[4], waveHeightRange: "2-4 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 35, bestFor: "Smaller days, longer daylight" },
    { month: MONTHS[5], waveHeightRange: "2-3 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "moderate", overallScore: 38, bestFor: "Summer starts, glassy mornings" },
    { month: MONTHS[6], waveHeightRange: "2-3 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 40, bestFor: "Small clean summer surf" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 45, bestFor: "Warmest water, small swells" },
    { month: MONTHS[8], waveHeightRange: "4-8 ft", waterTemp: 54, wetsuit: "4/3mm", crowdLevel: "moderate", overallScore: 78, bestFor: "Fall swell season fires up" },
    { month: MONTHS[9], waveHeightRange: "4-8 ft", waterTemp: 52, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 75, bestFor: "Consistent fall swells" },
    { month: MONTHS[10], waveHeightRange: "5-10 ft", waterTemp: 50, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 68, bestFor: "Big swells, heavy rubber" },
    { month: MONTHS[11], waveHeightRange: "6-12 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 60, bestFor: "Winter storms" },
  ],
};

/**
 * Texas — Best Sep-Nov. Water 58-82°F.
 */
const TX: StateSurfProfile = {
  stateSlug: "tx",
  stateName: "Texas",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "2-4 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 45, bestFor: "Cold front swells" },
    { month: MONTHS[1], waveHeightRange: "2-3 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 40, bestFor: "Occasional frontal swells" },
    { month: MONTHS[2], waveHeightRange: "1-3 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 35, bestFor: "Spring break surf" },
    { month: MONTHS[3], waveHeightRange: "1-2 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 25, bestFor: "Mostly flat" },
    { month: MONTHS[4], waveHeightRange: "1-2 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 20, bestFor: "Flat season" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 30, bestFor: "Tropical storm potential" },
    { month: MONTHS[6], waveHeightRange: "1-3 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 35, bestFor: "Warm water, hurricane teasers" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 50, bestFor: "Hurricane season building" },
    { month: MONTHS[8], waveHeightRange: "3-6 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 75, bestFor: "Peak hurricane swells" },
    { month: MONTHS[9], waveHeightRange: "3-5 ft", waterTemp: 76, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 70, bestFor: "Late hurricane + cold fronts" },
    { month: MONTHS[10], waveHeightRange: "2-4 ft", waterTemp: 68, wetsuit: "spring suit", crowdLevel: "low", overallScore: 55, bestFor: "Cold fronts, fewer crowds" },
    { month: MONTHS[11], waveHeightRange: "2-4 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 48, bestFor: "Winter frontal swells" },
  ],
};

/**
 * New York — Best Sep-Nov (hurricanes + nor'easters). Water 40-72°F.
 */
const NY: StateSurfProfile = {
  stateSlug: "ny",
  stateName: "New York",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-6 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Nor'easter swells, dedicated locals only" },
    { month: MONTHS[1], waveHeightRange: "3-5 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 50, bestFor: "Winter storm swells, iciest water" },
    { month: MONTHS[2], waveHeightRange: "2-5 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 48, bestFor: "Late winter swells, water slowly warms" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 40, bestFor: "Spring transitions, cleaner conditions" },
    { month: MONTHS[4], waveHeightRange: "2-3 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 35, bestFor: "Small clean days, Montauk crowd building" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "high", overallScore: 28, bestFor: "Beach season begins, mostly small" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 70, wetsuit: "spring suit", crowdLevel: "high", overallScore: 22, bestFor: "Flat Hamptons summer, occasional tropical" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 72, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 38, bestFor: "Hurricane season begins, warm water" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 70, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Peak hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 63, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall swells, offshore winds, thinning crowds" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 72, bestFor: "Nor'easters firing, empty lineups" },
    { month: MONTHS[11], waveHeightRange: "3-6 ft", waterTemp: 46, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Winter storms, hardcore crew" },
  ],
};

/**
 * New Hampshire — Best Sep-Nov. Cold year-round 38-68°F. Small coast, big storms.
 */
const NH: StateSurfProfile = {
  stateSlug: "nh",
  stateName: "New Hampshire",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-6 ft", waterTemp: 38, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Nor'easters, Hampton Beach deserted" },
    { month: MONTHS[1], waveHeightRange: "3-5 ft", waterTemp: 36, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Coldest water, committed surfers only" },
    { month: MONTHS[2], waveHeightRange: "2-5 ft", waterTemp: 38, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 48, bestFor: "Late winter storms" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 46, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 40, bestFor: "Spring swells, quiet beaches" },
    { month: MONTHS[4], waveHeightRange: "1-3 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 32, bestFor: "Small swells, warming up" },
    { month: MONTHS[5], waveHeightRange: "1-2 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "high", overallScore: 25, bestFor: "Summer begins, mostly flat" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "high", overallScore: 22, bestFor: "Flat season, beach season" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 32, bestFor: "Late summer, hurricane teasers" },
    { month: MONTHS[8], waveHeightRange: "3-7 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 82, bestFor: "Hurricane swells, still warm enough" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 78, bestFor: "Fall nor'easters, quiet lineups" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 68, bestFor: "Consistent fall storms" },
    { month: MONTHS[11], waveHeightRange: "3-5 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Winter storms return" },
  ],
};

/**
 * Massachusetts — Best Sep-Nov. Water 38-68°F. Cape Cod + South Shore.
 */
const MA: StateSurfProfile = {
  stateSlug: "ma",
  stateName: "Massachusetts",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-6 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Nor'easters, Nantucket Sound, Cape Cod" },
    { month: MONTHS[1], waveHeightRange: "3-6 ft", waterTemp: 38, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Winter storms, serious cold water surfers" },
    { month: MONTHS[2], waveHeightRange: "3-5 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 50, bestFor: "Late winter swells, water starts warming" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 42, bestFor: "Spring swells, fewer crowds" },
    { month: MONTHS[4], waveHeightRange: "1-3 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 35, bestFor: "Small clean days, Cape Cod wakes up" },
    { month: MONTHS[5], waveHeightRange: "1-2 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "high", overallScore: 28, bestFor: "Summer tourists, mostly small surf" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "high", overallScore: 25, bestFor: "Beach season peak, minimal swell" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Hurricane season building" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 66, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Hurricane swells, warm water, classic fall" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall nor'easters, crowds thin out" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 72, bestFor: "Consistent fall storms, empty beaches" },
    { month: MONTHS[11], waveHeightRange: "3-5 ft", waterTemp: 44, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Winter arrives, committed locals" },
  ],
};

/**
 * Rhode Island — Best Sep-Nov. Water 38-68°F. Narragansett, Ruggles Point.
 */
const RI: StateSurfProfile = {
  stateSlug: "ri",
  stateName: "Rhode Island",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "3-6 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Nor'easters, Narragansett empty" },
    { month: MONTHS[1], waveHeightRange: "3-5 ft", waterTemp: 38, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Cold water, consistent NE swells" },
    { month: MONTHS[2], waveHeightRange: "2-5 ft", waterTemp: 40, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 48, bestFor: "Late winter, uncrowded Ruggles" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 48, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 42, bestFor: "Spring swells arriving" },
    { month: MONTHS[4], waveHeightRange: "1-3 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 35, bestFor: "Small but clean, warming water" },
    { month: MONTHS[5], waveHeightRange: "1-2 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "high", overallScore: 28, bestFor: "Summer crowds, minimal swell" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "high", overallScore: 25, bestFor: "Peak summer, mostly flat" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 68, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 35, bestFor: "Hurricane swells building" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 66, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 85, bestFor: "Peak hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-6 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 80, bestFor: "Fall nor'easters, offshore winds" },
    { month: MONTHS[10], waveHeightRange: "3-6 ft", waterTemp: 52, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 72, bestFor: "Consistent storms, empty lineup" },
    { month: MONTHS[11], waveHeightRange: "3-5 ft", waterTemp: 44, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Winter sets in, hardcore crew" },
  ],
};

/**
 * South Carolina — Best Sep-Nov. Water 55-82°F. Warmer than NC.
 */
const SC: StateSurfProfile = {
  stateSlug: "sc",
  stateName: "South Carolina",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "2-4 ft", waterTemp: 57, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 52, bestFor: "Cold front swells, Folly Beach quiet" },
    { month: MONTHS[1], waveHeightRange: "2-4 ft", waterTemp: 55, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 48, bestFor: "Winter northeasters" },
    { month: MONTHS[2], waveHeightRange: "2-3 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 42, bestFor: "Spring transitions" },
    { month: MONTHS[3], waveHeightRange: "1-3 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 32, bestFor: "Small clean days" },
    { month: MONTHS[4], waveHeightRange: "1-2 ft", waterTemp: 72, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 22, bestFor: "Mostly flat, warm water" },
    { month: MONTHS[5], waveHeightRange: "1-3 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 28, bestFor: "Tourist season begins" },
    { month: MONTHS[6], waveHeightRange: "1-3 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 32, bestFor: "Warm water, occasional tropical" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 48, bestFor: "Hurricane season building" },
    { month: MONTHS[8], waveHeightRange: "3-7 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 82, bestFor: "Hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "3-5 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 78, bestFor: "Fall swells, crowds thin" },
    { month: MONTHS[10], waveHeightRange: "2-5 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "low", overallScore: 68, bestFor: "Nor'easters, fewer crowds" },
    { month: MONTHS[11], waveHeightRange: "2-4 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 52, bestFor: "Cold fronts, winter surf" },
  ],
};

/**
 * Georgia — Best Sep-Nov. Water 55-82°F. Tybee Island, Brunswick.
 */
const GA: StateSurfProfile = {
  stateSlug: "ga",
  stateName: "Georgia",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "2-4 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 48, bestFor: "Cold front swells, Tybee quiet" },
    { month: MONTHS[1], waveHeightRange: "2-3 ft", waterTemp: 56, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 45, bestFor: "Winter northeasters" },
    { month: MONTHS[2], waveHeightRange: "1-3 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 38, bestFor: "Spring clean days" },
    { month: MONTHS[3], waveHeightRange: "1-2 ft", waterTemp: 66, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 28, bestFor: "Small days, beach crowds arrive" },
    { month: MONTHS[4], waveHeightRange: "1-2 ft", waterTemp: 72, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 20, bestFor: "Flat season, warm water" },
    { month: MONTHS[5], waveHeightRange: "1-2 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 22, bestFor: "Summer flat, tourist season" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 25, bestFor: "Hot water, tropical teasers" },
    { month: MONTHS[7], waveHeightRange: "2-4 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 45, bestFor: "Hurricane season building" },
    { month: MONTHS[8], waveHeightRange: "3-7 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 80, bestFor: "Peak hurricane swells, warm water" },
    { month: MONTHS[9], waveHeightRange: "2-5 ft", waterTemp: 75, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 75, bestFor: "Fall swells, offshore winds" },
    { month: MONTHS[10], waveHeightRange: "2-4 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "low", overallScore: 62, bestFor: "Nor'easters, uncrowded Tybee" },
    { month: MONTHS[11], waveHeightRange: "2-4 ft", waterTemp: 60, wetsuit: "3/2mm", crowdLevel: "low", overallScore: 48, bestFor: "Cold fronts, winter surf" },
  ],
};

/**
 * Maine — Best Sep-Nov. Coldest East Coast water 32-65°F. Scarborough, York.
 */
const ME: StateSurfProfile = {
  stateSlug: "me",
  stateName: "Maine",
  peakSeason: "September through November",
  peakMonths: [9, 10, 11],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "4-8 ft", waterTemp: 34, wetsuit: "6/5mm + boots/gloves/hood", crowdLevel: "low", overallScore: 55, bestFor: "Massive nor'easters, near-freezing water" },
    { month: MONTHS[1], waveHeightRange: "4-7 ft", waterTemp: 32, wetsuit: "6/5mm + boots/gloves/hood", crowdLevel: "low", overallScore: 52, bestFor: "Coldest water of year, serious storms" },
    { month: MONTHS[2], waveHeightRange: "3-6 ft", waterTemp: 34, wetsuit: "6/5mm + boots/gloves/hood", crowdLevel: "low", overallScore: 50, bestFor: "Late winter storms, water starts to rise" },
    { month: MONTHS[3], waveHeightRange: "2-5 ft", waterTemp: 42, wetsuit: "5/4mm + boots/gloves", crowdLevel: "low", overallScore: 42, bestFor: "Spring transitions, lobster season opens" },
    { month: MONTHS[4], waveHeightRange: "1-3 ft", waterTemp: 50, wetsuit: "4/3mm + boots", crowdLevel: "low", overallScore: 35, bestFor: "Small swells, long days" },
    { month: MONTHS[5], waveHeightRange: "1-2 ft", waterTemp: 58, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 28, bestFor: "Summer starts, mostly small" },
    { month: MONTHS[6], waveHeightRange: "1-2 ft", waterTemp: 62, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 25, bestFor: "Tourist season, flat surf" },
    { month: MONTHS[7], waveHeightRange: "1-3 ft", waterTemp: 65, wetsuit: "spring suit", crowdLevel: "moderate", overallScore: 32, bestFor: "Warmest water, tropical teasers" },
    { month: MONTHS[8], waveHeightRange: "3-8 ft", waterTemp: 62, wetsuit: "3/2mm", crowdLevel: "moderate", overallScore: 82, bestFor: "Hurricane swells, still tolerable temps" },
    { month: MONTHS[9], waveHeightRange: "4-8 ft", waterTemp: 55, wetsuit: "4/3mm", crowdLevel: "low", overallScore: 80, bestFor: "Fall nor'easters, empty Scarborough" },
    { month: MONTHS[10], waveHeightRange: "4-8 ft", waterTemp: 48, wetsuit: "5/4mm + boots/gloves/hood", crowdLevel: "low", overallScore: 72, bestFor: "Big storms, almost no one out" },
    { month: MONTHS[11], waveHeightRange: "4-8 ft", waterTemp: 38, wetsuit: "6/5mm + boots/gloves/hood", crowdLevel: "low", overallScore: 58, bestFor: "Winter storms, truly hardcore only" },
  ],
};

/**
 * Puerto Rico — Best Nov-Feb (north swells), Jun-Aug (south swells). Warm year-round 77-84°F.
 */
const PR: StateSurfProfile = {
  stateSlug: "pr",
  stateName: "Puerto Rico",
  peakSeason: "November through February",
  peakMonths: [11, 12, 1, 2],
  monthly: [
    { month: MONTHS[0], waveHeightRange: "4-10 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 90, bestFor: "Peak north swells, Rincon world-class" },
    { month: MONTHS[1], waveHeightRange: "4-8 ft", waterTemp: 77, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 85, bestFor: "Consistent NW swells, warm water" },
    { month: MONTHS[2], waveHeightRange: "3-6 ft", waterTemp: 78, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 72, bestFor: "Transitional swells, warm water" },
    { month: MONTHS[3], waveHeightRange: "2-4 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 48, bestFor: "Spring transition, smaller waves" },
    { month: MONTHS[4], waveHeightRange: "2-4 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 45, bestFor: "Small south swell beginnings" },
    { month: MONTHS[5], waveHeightRange: "3-6 ft", waterTemp: 81, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 68, bestFor: "South swells firing, La Parguera" },
    { month: MONTHS[6], waveHeightRange: "4-7 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 75, bestFor: "Peak south shore, warm water" },
    { month: MONTHS[7], waveHeightRange: "3-6 ft", waterTemp: 84, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 70, bestFor: "South swells, hottest water" },
    { month: MONTHS[8], waveHeightRange: "2-5 ft", waterTemp: 83, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 55, bestFor: "Transition month, some south swell" },
    { month: MONTHS[9], waveHeightRange: "2-5 ft", waterTemp: 82, wetsuit: "boardshorts", crowdLevel: "low", overallScore: 58, bestFor: "North swell season teasing" },
    { month: MONTHS[10], waveHeightRange: "4-10 ft", waterTemp: 80, wetsuit: "boardshorts", crowdLevel: "moderate", overallScore: 88, bestFor: "North shore wakes up, less crowded than Dec-Jan" },
    { month: MONTHS[11], waveHeightRange: "5-12 ft", waterTemp: 79, wetsuit: "boardshorts", crowdLevel: "high", overallScore: 92, bestFor: "Peak north swells, Rincon contest season" },
  ],
};

const STATE_PROFILES: Record<string, StateSurfProfile> = {
  ca: CA, hi: HI, fl: FL, nj: NJ, nc: NC, or: OR, wa: WA, tx: TX,
  ny: NY, nh: NH, ma: MA, ri: RI, sc: SC, ga: GA, me: ME, pr: PR,
};

/**
 * Get monthly surf profile for a state.
 * Returns null if state has no profile data.
 */
export function getStateSurfProfile(stateSlug: string): StateSurfProfile | null {
  return STATE_PROFILES[stateSlug.toLowerCase()] ?? null;
}

/**
 * Get the best month entry for a state.
 */
function getBestMonth(stateSlug: string): MonthlyData | null {
  const profile = getStateSurfProfile(stateSlug);
  if (!profile) return null;
  return profile.monthly.reduce((best, entry) =>
    entry.overallScore > best.overallScore ? entry : best
  );
}

/**
 * Get all state slugs that have surf profile data.
 */
export function getAvailableStateProfiles(): string[] {
  return Object.keys(STATE_PROFILES);
}
