import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { formatWaveHeight } from "@/lib/utils/wave-formatters";
import { ScoreBadge } from "./score-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Waves, Calendar } from "lucide-react";

/**
 * Props for the BeachConditionsGrid component
 */
export interface BeachConditionsGridProps {
  /** Array of beach condition summaries */
  beaches: BeachConditionSummary[];
  /** Region slug for constructing beach links */
  regionSlug: string;
  /** Maximum number of beaches to display (default: 12) */
  maxBeaches?: number;
  /** Whether to show "View all beaches" link when beaches exceed maxBeaches */
  showViewAll?: boolean;
  /** Optional className for customization */
  className?: string;
}

/**
 * Trend indicator configuration
 */
const trendConfig = {
  improving: {
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Improving",
  },
  steady: {
    icon: Minus,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    label: "Steady",
  },
  declining: {
    icon: TrendingDown,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Declining",
  },
} as const;

/**
 * Trend indicator component
 */
function TrendIndicator({ trend }: { trend: BeachConditionSummary["trend"] }) {
  const config = trendConfig[trend];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        config.bgColor,
        config.color
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}

/**
 * Individual beach row for desktop table view
 */
function BeachConditionRow({ beach }: { beach: BeachConditionSummary }) {
  const scoreColors = getScoreColorClasses(beach.currentScore);

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <Link
          href={`/beach/${beach.beachSlug}`}
          className="text-foreground hover:text-primary hover:underline transition-colors"
        >
          {beach.beachName}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ScoreBadge score={beach.currentScore} />
          <span className={cn("text-xs font-medium", scoreColors.text)}>
            {scoreColors.label}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Waves className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-foreground">
            {formatWaveHeight(beach.currentWaveHeight)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <TrendIndicator trend={beach.trend} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{beach.bestDay}</span>
          {beach.bestDayScore > 0 && (
            <span
              className={cn(
                "text-xs",
                getScoreColorClasses(beach.bestDayScore).text
              )}
            >
              ({beach.bestDayScore})
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Individual beach card for mobile view
 */
function BeachConditionCard({ beach }: { beach: BeachConditionSummary }) {
  const scoreColors = getScoreColorClasses(beach.currentScore);

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Score Badge */}
          <ScoreBadge score={beach.currentScore} />

          {/* Beach Info */}
          <div className="flex-1 min-w-0">
            {/* Beach Name */}
            <Link
              href={`/beach/${beach.beachSlug}`}
              className="font-semibold text-foreground hover:text-primary hover:underline transition-colors line-clamp-1"
            >
              {beach.beachName}
            </Link>

            {/* Score Label */}
            <p className={cn("text-xs font-medium mt-0.5", scoreColors.text)}>
              {scoreColors.label} conditions
            </p>

            {/* Quick Stats */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Waves className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium text-foreground">
                  {formatWaveHeight(beach.currentWaveHeight)}
                </span>
              </span>
              <TrendIndicator trend={beach.trend} />
            </div>

            {/* Best Day */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Best: <span className="font-medium">{beach.bestDay}</span>
              </span>
              {beach.bestDayScore > 0 && (
                <span
                  className={cn(
                    "font-medium",
                    getScoreColorClasses(beach.bestDayScore).text
                  )}
                >
                  ({beach.bestDayScore})
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * BeachConditionsGrid Component
 *
 * Displays a grid/table of beaches with their current conditions including
 * score, wave height, trend, and best day. Shows a responsive table on desktop
 * and cards on mobile.
 *
 * @example
 * ```tsx
 * <BeachConditionsGrid
 *   beaches={regionalSummary.beachConditions}
 *   regionSlug="san-diego"
 *   maxBeaches={12}
 *   showViewAll
 * />
 * ```
 */
export function BeachConditionsGrid({
  beaches,
  regionSlug,
  maxBeaches = 12,
  showViewAll = true,
  className,
}: BeachConditionsGridProps) {
  // Sort beaches by current score (highest first) and limit display
  const displayBeaches = beaches
    .slice()
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, maxBeaches);

  const hasMoreBeaches = beaches.length > maxBeaches;

  if (beaches.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <h2 className="text-2xl font-bold text-foreground">Beach Conditions</h2>
        <p className="text-muted-foreground">
          No beach condition data available for this region.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)}>
      {/* Section Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Beach Conditions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Current conditions ranked by surf quality
          </p>
        </div>
        {showViewAll && hasMoreBeaches && (
          <Link
            href={`/guides/surfing-${regionSlug}`}
            className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors whitespace-nowrap"
          >
            View all {beaches.length} beaches &rarr;
          </Link>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Beach</TableHead>
              <TableHead className="w-[20%]">Score</TableHead>
              <TableHead className="w-[15%]">Wave Height</TableHead>
              <TableHead className="w-[15%]">Trend</TableHead>
              <TableHead className="w-[20%]">Best Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayBeaches.map((beach) => (
              <BeachConditionRow key={beach.beachId} beach={beach} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {displayBeaches.map((beach) => (
          <BeachConditionCard key={beach.beachId} beach={beach} />
        ))}
      </div>

      {/* View All Link for Mobile */}
      {showViewAll && hasMoreBeaches && (
        <div className="md:hidden text-center pt-2">
          <Link
            href={`/guides/surfing-${regionSlug}`}
            className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
          >
            View all {beaches.length} beaches &rarr;
          </Link>
        </div>
      )}
    </section>
  );
}
