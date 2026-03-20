import type { Beach } from "@/types/database";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

/**
 * Server-rendered prose summary for beach detail pages.
 *
 * Generates a natural-language description of current conditions
 * that is visible in the initial HTML for AI crawlers and search engines.
 * Designed for GEO (Generative Engine Optimization) — provides the kind
 * of answer-ready content that AI systems can directly cite.
 */
export function BeachProseSummary({
  beach,
  surfCallReport,
}: {
  beach: Beach;
  surfCallReport: SurfCallResult | null;
}) {
  const breakTypeLabel = formatBreakType(beach.break_type);
  const skillLabel = formatSkillLevel(beach.skill_level);
  const locationParts = [beach.city, beach.state].filter(Boolean).join(", ");

  // Build prose sentences conditionally based on available data
  const sentences: string[] = [];

  // Opening: beach identity
  if (locationParts && breakTypeLabel) {
    sentences.push(
      `${beach.name} in ${locationParts} is a ${breakTypeLabel} break${skillLabel ? `, ${skillLabel}` : ""}.`
    );
  } else if (locationParts) {
    sentences.push(
      `${beach.name} in ${locationParts} is a surf break${skillLabel ? ` ${skillLabel}` : ""} along the ${beach.state || "US"} coast.`
    );
  } else {
    sentences.push(`${beach.name} is a surf break${skillLabel ? ` ${skillLabel}` : ""}.`);
  }

  // Current conditions from surf call
  if (surfCallReport) {
    const conditionParts: string[] = [];

    if (surfCallReport.waveHeight) {
      conditionParts.push(`${surfCallReport.waveHeight} waves`);
    }

    if (surfCallReport.windDescription) {
      conditionParts.push(surfCallReport.windDescription.toLowerCase());
    } else if (surfCallReport.windSpeed && surfCallReport.windCompass) {
      conditionParts.push(
        `${surfCallReport.windSpeed} mph ${surfCallReport.windCompass} winds`
      );
    }

    if (surfCallReport.tideDescription) {
      conditionParts.push(surfCallReport.tideDescription.toLowerCase());
    }

    if (conditionParts.length > 0) {
      sentences.push(
        `Current conditions: ${conditionParts.join(", ")}.`
      );
    }

    // Surf call verdict
    if (surfCallReport.whySentence) {
      sentences.push(surfCallReport.whySentence);
    }
  }

  // Beach description (first sentence only)
  if (beach.description) {
    const firstSentence = beach.description.split(/\.(\s|$)/)[0];
    if (firstSentence && firstSentence.length > 20) {
      sentences.push(`${firstSentence}.`);
    }
  }

  // Wave tips
  if (beach.wave_tips) {
    sentences.push(beach.wave_tips);
  }

  // Data source attribution
  sentences.push(
    "Forecasts are updated every 3 hours using ML-corrected NOAA models with live buoy data from CDIP, NDBC, and IOOS stations."
  );

  return (
    <section
      className="sr-only"
      aria-label="Conditions summary"
    >
      <h2>{beach.name} Current Conditions Summary</h2>
      <p>{sentences.join(" ")}</p>
    </section>
  );
}

function formatBreakType(breakType: string | null | undefined): string | null {
  if (!breakType) return null;
  const labels: Record<string, string> = {
    beach_break: "beach",
    point_break: "point",
    reef_break: "reef",
    river_mouth: "river mouth",
    jetty: "jetty",
    pier: "pier",
  };
  return labels[breakType] || breakType.replace(/_/g, " ");
}

function formatSkillLevel(skillLevel: string | null | undefined): string | null {
  if (!skillLevel) return null;
  const labels: Record<string, string> = {
    beginner: "best suited for beginner surfers",
    intermediate: "suited for intermediate surfers",
    advanced: "suited for advanced surfers",
    expert: "for expert surfers only",
    all: "suitable for all skill levels",
  };
  return labels[skillLevel] || null;
}
