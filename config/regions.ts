/**
 * Regional Configuration
 *
 * Defines beach-to-region mappings for NPC beach selection
 * and forecast aggregation.
 */

export interface RegionConfig {
  beaches: string[];
  timezone: string;
  forecastBeaches: string[];
}

export const REGIONS: Record<string, RegionConfig> = {
  'sf-bay-area': {
    beaches: ['ocean beach', 'pacifica', 'lindamar', 'bolinas', 'fort point', 'rockaway'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ocean beach', 'pacifica']
  },
  'central-coast': {
    beaches: ['steamer lane', 'pleasure point', 'cowell', 'morro bay', 'pismo', 'cayucos'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['steamer lane', 'pleasure point']
  },
  'north-san-diego': {
    beaches: ['scripps', 'blacks', 'cardiff', 'swamis', 'del mar', 'torrey pines'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['scripps', 'blacks']
  },
  'south-san-diego': {
    beaches: ['ob pier', 'sunset cliffs', 'coronado', 'imperial beach', 'mission beach'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['ob pier', 'sunset cliffs']
  },
  'orange-county': {
    beaches: ['huntington', 'trestles', 'san onofre', 'doheny', 'laguna', 'newport'],
    timezone: 'America/Los_Angeles',
    forecastBeaches: ['huntington', 'trestles']
  },
  'socal-visitor': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'norcal-visitor': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] },
  'all-regions': { beaches: [], timezone: 'America/Los_Angeles', forecastBeaches: [] }
};

export const FORECAST_REGIONS = {
  norcal: { name: 'NorCal', primaryBeach: 'ocean beach', regions: ['sf-bay-area'] },
  central: { name: 'Central Coast', primaryBeach: 'steamer lane', regions: ['central-coast'] },
  socal: { name: 'SoCal', primaryBeach: 'scripps', regions: ['north-san-diego', 'south-san-diego', 'orange-county'] }
};
