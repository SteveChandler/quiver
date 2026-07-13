import type { Beach } from "@/types/database";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { EditorialSource } from "@/lib/seo/indexability";

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
  editorialSources = [],
}: {
  beach: Beach;
  surfCallReport: SurfCallResult | null;
  editorialSources?: EditorialSource[];
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

  if (beach.crowd_tips) {
    sentences.push(beach.crowd_tips);
  }

  if (beach.best_conditions_prose) {
    sentences.push(beach.best_conditions_prose);
  }

  // Data source attribution
  sentences.push(
    "Forecasts are updated every 3 hours using ML-corrected NOAA models with live buoy data from CDIP, NDBC, and IOOS stations."
  );

  return (
    <section
      className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8"
      aria-label="Conditions summary"
    >
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Surf report snapshot
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          {beach.name} current conditions and local guidance
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {sentences.join(" ")}
        </p>
        {editorialSources.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Local guidance reviewed against {editorialSources.map((source) => source.publisher).filter(Boolean).join(", ")}.
          </p>
        )}
      </div>
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
