"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BuoyStationLinkProps {
  /**
   * Unique identifier for the buoy station (e.g., "220" for CDIP 220)
   */
  stationId: string;

  /**
   * Human-readable name of the buoy station (e.g., "Scripps Pier")
   */
  stationName: string;

  /**
   * Distance from beach to buoy in kilometers
   */
  distance?: number;

  /**
   * Beach location coordinates for distance calculation reference
   */
  beachLocation?: {
    latitude: number;
    longitude: number;
  };

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Display variant
   */
  variant?: "default" | "compact" | "inline";

  /**
   * Show external link icon
   */
  showIcon?: boolean;
}

/**
 * BuoyStationLink - Displays a link to buoy station details with distance
 *
 * Part of the forecast transparency feature set. Shows which buoy station
 * provided the forecast data and allows users to view detailed buoy information.
 *
 * @example
 * ```tsx
 * <BuoyStationLink
 *   stationId="220"
 *   stationName="Scripps Pier"
 *   distance={2.3}
 *   variant="default"
 * />
 * // Renders: "CDIP 220 - Scripps Pier (2.3 km)"
 * ```
 */
export function BuoyStationLink({
  stationId,
  stationName,
  distance,
  beachLocation,
  className,
  variant = "default",
  showIcon = true,
}: BuoyStationLinkProps) {
  // Format distance with appropriate unit and precision
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  };

  // Build display text
  const displayText = `CDIP ${stationId} - ${stationName}`;
  const distanceText = distance !== undefined ? ` (${formatDistance(distance)})` : "";
  const fullText = `${displayText}${distanceText}`;

  // Tooltip content with additional information
  const tooltipContent = (
    <div className="text-xs space-y-1">
      <p className="font-medium">Buoy Station Details</p>
      <p>Station ID: CDIP {stationId}</p>
      <p>Location: {stationName}</p>
      {distance !== undefined && <p>Distance: {formatDistance(distance)} away</p>}
      {beachLocation && (
        <p className="text-gray-400 text-[10px]">
          From {beachLocation.latitude.toFixed(4)}°N,{" "}
          {Math.abs(beachLocation.longitude).toFixed(4)}°W
        </p>
      )}
      <p className="text-blue-400 mt-2">Click to view station data →</p>
    </div>
  );

  // Compact variant - minimal badge style
  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/buoys/${stationId}`}
              className={cn(
                "inline-flex items-center gap-1 text-xs hover:underline text-blue-600 hover:text-blue-800 transition-colors",
                className
              )}
              data-testid={`buoy-link-${stationId}`}
              aria-label={`View buoy station ${stationId} - ${stationName}${
                distance !== undefined ? `, ${formatDistance(distance)} away` : ""
              }`}
            >
              <MapPin className="h-3 w-3" />
              <span>CDIP {stationId}</span>
              {distance !== undefined && (
                <span className="text-gray-500">({formatDistance(distance)})</span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Inline variant - plain text link
  if (variant === "inline") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/buoys/${stationId}`}
              className={cn(
                "inline-flex items-center gap-1 text-sm text-gray-700 hover:text-blue-600 hover:underline transition-colors",
                className
              )}
              data-testid={`buoy-link-${stationId}`}
              aria-label={`View buoy station ${stationId} - ${stationName}${
                distance !== undefined ? `, ${formatDistance(distance)} away` : ""
              }`}
            >
              {fullText}
              {showIcon && <ExternalLink className="h-3 w-3 ml-1" />}
            </Link>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default variant - badge style with icon
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/buoys/${stationId}`}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-colors group",
              className
            )}
            data-testid={`buoy-link-${stationId}`}
            aria-label={`View buoy station ${stationId} - ${stationName}${
              distance !== undefined ? `, ${formatDistance(distance)} away` : ""
            }`}
          >
            <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-blue-900">
                {displayText}
              </span>
              {distance !== undefined && (
                <span className="text-xs text-blue-600">
                  {formatDistance(distance)} away
                </span>
              )}
            </div>
            {showIcon && (
              <ExternalLink className="h-3 w-3 text-blue-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
