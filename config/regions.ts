/**
 * Regional Configuration
 *
 * Defines beach-to-region mappings for NPC beach selection
 * and forecast aggregation.
 *
 * IMPORTANT: `beachSlugs` must match the `slug` column in the `beaches` table.
 * The first 3-4 entries in each list are treated as "home" (most popular/iconic)
 * beaches for weighted NPC selection; the remainder are "secondary".
 */

export interface RegionConfig {
  /**
   * Beach slugs matching the `slug` column in the beaches table.
   * First 3-4 slugs = home beaches (highest posting weight).
   * Remaining slugs = secondary beaches.
   */
  beachSlugs: string[];
  timezone: string;
  forecastBeaches: string[];
}

export const REGIONS: Record<string, RegionConfig> = {
  'sf-bay-area': {
    beachSlugs: [
      // Home beaches (first 3)
      'ocean-beach',
      'linda-mar-pacifica',
      'stinson-beach',
      // Secondary beaches
      'fort-point',
      'rockaway-beach-pacifica',
      'bolinas',
    ],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ocean-beach', 'linda-mar-pacifica'],
  },
  'central-coast': {
    beachSlugs: [
      // Home beaches (first 3)
      'steamer-lane',
      'pleasure-point',
      'cowells',
      // Secondary beaches
      '38th-avenue',
      'waddell-creek',
      'mavericks',
      'half-moon-bay',
    ],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['steamer-lane', 'pleasure-point'],
  },
  'north-san-diego': {
    beachSlugs: [
      // Home beaches (first 4)
      'blacks',
      'scripps',
      'swamis',
      'cardiff-reef',
      // Secondary beaches
      'torrey-pines-state-beach',
      'del-mar',
      'beacons',
      'd-street',
      'moonlight-state-beach',
      'grandview',
      'seaside-reef',
      'solana-beach',
      'san-elijo-state-beach',
      'pipes',
      'georges',
    ],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['scripps', 'blacks'],
  },
  'south-san-diego': {
    beachSlugs: [
      // Home beaches (first 4)
      'sunset-cliffs-luscombs',
      'ocean-beach',
      'pacific-beach',
      'tourmaline-surf-park',
      // Secondary beaches
      'ocean-beach-pier',
      'sunset-cliffs-garbage',
      'mission-beach',
      'mission-beach-central',
      'crystal-pier',
      'pb-point',
      'tourmaline',
      'marine-street-beach',
      'coronado-north-jetty',
      'hotel-del-coronado',
      'silver-strand-state-beach',
      'imperial-beach',
      'imperial-beach-pier',
      'tijuana-sloughs',
      'new-break-nubes',
      'osprey-point',
      'avalanche',
      'big-jetty',
    ],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ocean-beach', 'sunset-cliffs-luscombs'],
  },
  'orange-county': {
    beachSlugs: [
      // Home beaches (first 3)
      'trestles',
      'huntington-beach',
      'the-wedge',
      // Secondary beaches
      'san-onofre',
      'doheny-state-beach',
      'thalia-street',
      'salt-creek',
      '52nd-street',
      'north-hb-streets',
      'bolsa-chica',
    ],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['huntington-beach', 'trestles'],
  },
  // Visitor regions merge beaches from multiple home regions (handled in getBeachesForNPC)
  'socal-visitor': { beachSlugs: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'norcal-visitor': { beachSlugs: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'all-regions': { beachSlugs: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
};

/** Number of slugs at the start of `beachSlugs` treated as "home" (high-weight) beaches. */
export const HOME_BEACH_COUNT = 4;

/** NPC/reporting coast sections; distinct from forecast route regions. */
export const COAST_SECTIONS = {
  norcal: { name: 'NorCal', primaryBeach: 'ocean beach', regions: ['sf-bay-area'] },
  central: { name: 'Central Coast', primaryBeach: 'steamer lane', regions: ['central-coast'] },
  socal: {
    name: 'SoCal',
    primaryBeach: 'scripps',
    regions: ['north-san-diego', 'south-san-diego', 'orange-county'],
  },
};

/** SoCal regions merged for visitor NPCs */
export const SOCAL_REGIONS = ['north-san-diego', 'south-san-diego', 'orange-county'] as const;

/** NorCal regions merged for visitor NPCs */
export const NORCAL_REGIONS = ['sf-bay-area', 'central-coast'] as const;
