/**
 * RankingBadge Component
 *
 * Displays a visual badge indicating the ranking tier of a beach based on its composite score.
 * Used on location listing pages to help users quickly identify top-rated beaches.
 *
 * Tiers:
 * - Top Rated (≥0.8): Gold/yellow styling
 * - Highly Rated (0.6-0.79): Blue styling
 * - Popular (0.4-0.59): Green styling
 * - Standard (<0.4): No badge displayed
 */

import { cn } from "@/lib/utils";
import type { RankingTier } from "@/types/location";

interface RankingBadgeProps {
  tier: RankingTier;
  label: string;
  className?: string;
}

export function RankingBadge({ tier, label, className }: RankingBadgeProps) {
  // Don't render badge for standard tier
  if (tier === "standard" || !label) {
    return null;
  }

  // Tier-specific styling
  const tierStyles = {
    top: "bg-yellow-100 text-yellow-800 border-yellow-300",
    "highly-rated": "bg-blue-100 text-blue-800 border-blue-300",
    popular: "bg-green-100 text-green-800 border-green-300",
    standard: "", // Not rendered
  };

  // Accessibility: Different icons for each tier
  const tierIcons = {
    top: "⭐",
    "highly-rated": "🌟",
    popular: "👍",
    standard: "",
  };

  return (
    <span
      data-testid="ranking-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
        tierStyles[tier],
        className
      )}
      role="status"
      aria-label={`${label} beach`}
    >
      <span aria-hidden="true">{tierIcons[tier]}</span>
      {label}
    </span>
  );
}
