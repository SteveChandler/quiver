"use client";

import Link from "next/link";
import { SURF_INTENTS, type SurfIntentSlug } from "@/lib/data/surf-spots";
import type { BeachWithMetrics } from "@/types/location";
import { getIntentSlug } from "@/lib/utils/slug-helpers";

interface GuidesByIntentGridProps {
  cityName: string;
  citySlug: string;
  stateSlug?: string;
  featuredIntents: string[];
  beaches: BeachWithMetrics[];
}

/**
 * Filter beaches by intent tag (derived from skill level and crowd level)
 */
function getBeachesForIntent(
  beaches: BeachWithMetrics[],
  intent: SurfIntentSlug
): BeachWithMetrics[] {
  return beaches.filter((beach) => {
    const skillLevel = (beach.skill_level ?? "").toLowerCase();
    const crowdLevel = (beach.crowd_level ?? "").toLowerCase();

    switch (intent) {
      case "beginner":
        return (
          skillLevel.includes("beginner") || skillLevel.includes("longboard")
        );
      case "least-crowded":
        return crowdLevel.includes("light") || crowdLevel.includes("low");
      case "tide":
        // All spots are relevant to tide timing
        return true;
      case "water-temp":
        // All spots are relevant to water temp
        return true;
      default:
        return false;
    }
  });
}

/**
 * Guides by Intent Grid Component
 *
 * Displays a 2x2 grid of intent-based guides (beginner, less-crowded, tide, water-temp)
 * with top spots for each intent linked to the full playbook page.
 */
export function GuidesByIntentGrid({
  cityName,
  citySlug,
  stateSlug,
  featuredIntents,
  beaches,
}: GuidesByIntentGridProps) {
  if (!featuredIntents || featuredIntents.length === 0) return null;

  const intentSlug = getIntentSlug(citySlug, stateSlug);

  // Filter to valid intent slugs
  const validIntents = featuredIntents.filter(
    (intent): intent is SurfIntentSlug => intent in SURF_INTENTS
  );

  if (validIntents.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">
        Guides by Intent
      </h2>
      <p className="text-sm text-slate-600 mb-6">
        Choose the objective that matches your session and we&apos;ll filter
        the best peaks.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {validIntents.map((intent) => {
          const definition = SURF_INTENTS[intent];
          const intentBeaches = getBeachesForIntent(beaches, intent).slice(0, 4);

          return (
            <div
              key={intent}
              className="rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {definition.heading({ cityName })}
              </h3>
              <p className="mt-2 text-sm text-slate-700">
                {definition.intro({ cityName })}
              </p>

              {intentBeaches.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-sky-700">
                  {intentBeaches.map((beach) => (
                    <li key={beach.slug}>
                      <Link
                        href={`/${intent}/${intentSlug}#${beach.slug}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {beach.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={`/${intent}/${intentSlug}`}
                className="mt-4 inline-flex text-sm font-semibold text-sky-700 underline-offset-2 hover:underline"
              >
                View the full {definition.label.toLowerCase()} playbook
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
