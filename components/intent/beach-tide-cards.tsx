import Link from "next/link";
import { Waves, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTideHeight } from "@/lib/formatters/surf-data";
import type { BeachTidePreference } from "@/actions/forecast/intent-forecast-actions";

interface BeachTideCardsProps {
  beaches: BeachTidePreference[];
  citySlug: string;
  stateSlug: string;
}

function DirectionIcon({ direction }: { direction: string | null }) {
  if (!direction) return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  const lower = direction.toLowerCase();
  if (lower.includes("rising")) return <ArrowUp className="h-3.5 w-3.5 text-blue-600" />;
  if (lower.includes("falling")) return <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

function skillLevelColor(level: string | null): string {
  if (!level) return "bg-gray-100 text-gray-600";
  const lower = level.toLowerCase();
  if (lower.includes("beginner")) return "bg-green-100 text-green-800";
  if (lower.includes("intermediate")) return "bg-yellow-100 text-yellow-800";
  if (lower.includes("advanced")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

/**
 * BeachTideCards - Grid of per-beach tide preferences
 *
 * Shows each beach's preferred tide range and direction.
 * Links to beach detail pages. 1-col mobile, 2-col desktop.
 */
export function BeachTideCards({
  beaches,
  citySlug,
  stateSlug,
}: BeachTideCardsProps) {
  if (beaches.length === 0) {
    return null;
  }

  // Only show beaches that have at least some tide preference data
  const beachesWithPrefs = beaches.filter(
    (b) =>
      b.preferredTideMin != null ||
      b.preferredTideMax != null ||
      b.preferredDirection != null
  );

  if (beachesWithPrefs.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Beach Tide Preferences
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Each beach performs best at a specific tide range and direction. Plan
        your session around these windows.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {beachesWithPrefs.map((beach) => {
          const hasRange =
            beach.preferredTideMin != null && beach.preferredTideMax != null;

          const beachHref = beach.beachSlug
            ? `/${stateSlug}/${citySlug}/${beach.beachSlug}`
            : null;

          const cardContent = (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <h3 className="font-medium text-gray-800">
                    {beach.beachName}
                  </h3>
                </div>
                {beach.skillLevel && (
                  <Badge
                    variant="secondary"
                    className={`text-xs ${skillLevelColor(beach.skillLevel)}`}
                  >
                    {beach.skillLevel}
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {hasRange && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-blue-800 font-medium">
                    {formatTideHeight(beach.preferredTideMin!)}&ndash;
                    {formatTideHeight(beach.preferredTideMax!)}
                  </span>
                )}
                {beach.preferredDirection && (
                  <span className="inline-flex items-center gap-1 text-gray-700">
                    <DirectionIcon direction={beach.preferredDirection} />
                    {beach.preferredDirection}
                  </span>
                )}
                {!hasRange && !beach.preferredDirection && (
                  <span className="text-gray-400 text-xs">
                    Works on most tides
                  </span>
                )}
              </div>
            </div>
          );

          const uniqueKey = beach.beachSlug || beach.beachName;

          if (beachHref) {
            return (
              <Link key={uniqueKey} href={beachHref} className="block">
                {cardContent}
              </Link>
            );
          }

          return (
            <div key={uniqueKey}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </section>
  );
}
