import type { Beach } from '@/types/database';
import { formatMonthRange } from '@/lib/utils/date-utils';
import { degreeToCardinal } from '@/lib/utils/geo-utils';

export interface EnrichedBeachContent {
  description: string;
  highlights: string[];
}

/**
 * Build enriched beach content from database fields.
 * Used when beach.description is sparse or null to provide
 * meaningful content for SEO and user experience.
 */
export function buildEnrichedBeachContent(beach: Beach & {
  wave_tips?: string | null;
  best_conditions_prose?: string | null;
  warnings?: string[];
  description?: string | null;
}): EnrichedBeachContent {
  const sentences: string[] = [];
  const highlights: string[] = [];

  // Opening: break type + skill level + location
  const location = beach.city && beach.state ? `in ${beach.city}, ${beach.state}` : beach.city ? `in ${beach.city}` : '';
  if (beach.break_type && beach.skill_level) {
    sentences.push(`${beach.name} is a ${beach.break_type} break ${location} suited for ${beach.skill_level} surfers.`);
  } else if (beach.break_type) {
    sentences.push(`${beach.name} is a ${beach.break_type} break ${location}.`);
  } else if (location) {
    sentences.push(`${beach.name} is a surf spot ${location}.`);
  }

  // Swell window
  if (beach.swell_window_min_deg != null && beach.swell_window_max_deg != null) {
    const minDir = degreeToCardinal(beach.swell_window_min_deg);
    const maxDir = degreeToCardinal(beach.swell_window_max_deg);
    sentences.push(`It picks up swells from ${minDir} to ${maxDir} (${beach.swell_window_min_deg}\u00B0-${beach.swell_window_max_deg}\u00B0).`);
  }

  // Tide preference
  if (beach.preferred_tide_ft_min != null && beach.preferred_tide_ft_max != null) {
    const dirStr = beach.preferred_tide_direction ? ` on a ${beach.preferred_tide_direction} tide` : '';
    sentences.push(`Best surfed at ${beach.preferred_tide_ft_min}-${beach.preferred_tide_ft_max}ft${dirStr}.`);
  } else if (beach.preferred_tide_direction) {
    sentences.push(`Works best on a ${beach.preferred_tide_direction} tide.`);
  }

  // Hazards
  if (beach.hazards && beach.hazards.length > 0) {
    sentences.push(`Hazards include ${beach.hazards.join(', ')}.`);
  }

  // Best months
  if (beach.best_months && beach.best_months.length > 0) {
    sentences.push(`Prime season runs ${formatMonthRange(beach.best_months)}.`);
  }

  // Crowd level
  if (beach.crowd_level) {
    sentences.push(`Expect ${beach.crowd_level.replace(/_/g, ' ')} crowds.`);
  }

  // Wind
  if (beach.wind_offshore_deg != null) {
    sentences.push(`Offshore winds come from ${degreeToCardinal(beach.wind_offshore_deg)} (${beach.wind_offshore_deg}\u00B0).`);
  }

  // Weave in existing description if present
  if (beach.description && beach.description.trim().length > 0) {
    sentences.push(beach.description.trim());
  }

  // Best conditions prose
  if (beach.best_conditions_prose) {
    sentences.push(beach.best_conditions_prose);
  }

  // Wave tips
  if (beach.wave_tips) {
    sentences.push(beach.wave_tips);
  }

  // Build highlights from real_takeaways
  if (beach.real_takeaways && beach.real_takeaways.length > 0) {
    highlights.push(...beach.real_takeaways);
  }

  return {
    description: sentences.join(' '),
    highlights,
  };
}

/**
 * Check if a beach description is "thin" (too short to be useful for SEO).
 */
export function isBeachDescriptionThin(description: string | null | undefined): boolean {
  if (!description) return true;
  return description.trim().split(/\s+/).length < 50;
}
