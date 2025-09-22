"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Waves, Anchor, AlertTriangle, Images } from "lucide-react";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { withServerAction } from "@/lib/server-action-utils";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";

interface BestPhoto {
  id: string;
  public_url: string;
  created_at: string;
}

async function getBestBeachPhotos(
  beachId: string,
  limit = 12
): Promise<BestPhoto[]> {
  const { getBestBeachPhotosAction } = await import(
    "@/actions/beach-media-actions"
  );
  const result = await getBestBeachPhotosAction(beachId, limit);
  if (!result.success) throw new Error(result.error || "Failed to load photos");
  return result.data as BestPhoto[];
}

interface SpotOverviewProps {
  beach: Beach;
}

export function SpotOverview({ beach }: SpotOverviewProps) {
  const fetchPhotos = useCallback(async () => {
    return await getBestBeachPhotos(beach.id, 12);
  }, [beach.id]);

  const { data: photos } = useDataFetcher(fetchPhotos, {
    immediate: true,
    initialData: [] as BestPhoto[],
  });
  // Fetch latest calibration row to derive best swell window
  const fetchCalibration = useCallback(async () => {
    const { getLatestBeachCalibrationAction } = await import(
      "@/actions/beach-calibration-actions"
    );
    const result = await getLatestBeachCalibrationAction(beach.id);
    if (!result.success) return null;
    return result.data as {
      best_swell_dir_deg_min: number | null;
      best_swell_dir_deg_max: number | null;
    } | null;
  }, [beach.id]);

  const { data: calibration } = useDataFetcher(fetchCalibration, {
    immediate: true,
    initialData: null,
  });

  const calibratedSwellCardinal = calibration
    ? degreeWindowToCardinal(
        calibration.best_swell_dir_deg_min,
        calibration.best_swell_dir_deg_max
      )
    : null;

  // Prefer calibration → explicit cardinals on beach → beach swell window → em dash
  const bestSwell =
    calibratedSwellCardinal ||
    beach.best_swell_cardinals?.join(", ") ||
    degreeWindowToCardinal(
      beach.swell_window_min_deg ?? null,
      beach.swell_window_max_deg ?? null
    ) ||
    "—";

  // Wind: build a window around offshore center using tolerance when available
  const calibratedWindCardinal = calibration
    ? degreeWindowToCardinal(
        (calibration as any).best_wind_offshore_deg != null &&
          (calibration as any).best_wind_tol_deg != null
          ? (calibration as any).best_wind_offshore_deg -
              (calibration as any).best_wind_tol_deg
          : null,
        (calibration as any).best_wind_offshore_deg != null &&
          (calibration as any).best_wind_tol_deg != null
          ? (calibration as any).best_wind_offshore_deg +
              (calibration as any).best_wind_tol_deg
          : null
      )
    : null;

  const beachWindCardinal = degreeWindowToCardinal(
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? beach.wind_offshore_deg - beach.wind_offshore_tol_deg
      : null,
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? beach.wind_offshore_deg + beach.wind_offshore_tol_deg
      : null
  );

  const bestWind =
    calibratedWindCardinal ||
    beach.best_wind_cardinals?.join(", ") ||
    beachWindCardinal ||
    "—";
  const tidePref = (() => {
    const min = beach.preferred_tide_ft_min;
    const max = beach.preferred_tide_ft_max;
    if (min == null && max == null) return "—";
    if (min != null && max != null) return `${min}–${max} ft`;
    if (min != null) return `${min}+ ft`;
    return `${max} ft or lower`;
  })();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
            <MapPin className="h-5 w-5 text-blue-600" /> Spot Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Break Type</div>
            <div className="text-base font-medium">
              {beach.break_type || "—"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Best Swell</div>
            <div className="text-base font-medium">{bestSwell}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Best Wind / Tide
            </div>
            <div className="text-base font-medium">
              {bestWind} / {tidePref}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
            <Waves className="h-5 w-5 text-blue-600" /> Amenities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* Placeholder badges - can be driven by structured fields later */}
            <Badge variant="secondary">Parking</Badge>
            <Badge variant="secondary">Restrooms</Badge>
            <Badge variant="secondary">Showers</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
            <AlertTriangle className="h-5 w-5 text-blue-600" /> Hazards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Rip currents</li>
            <li>Rocks near low tide</li>
            <li>Localism varies by peak</li>
          </ul>
        </CardContent>
      </Card>

      {/* Best-of gallery */}
      <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
            <Images className="h-5 w-5 text-blue-600" /> Best-of Gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!photos || photos.length === 0 ? (
            <div className="text-sm text-muted-foreground">No photos yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <Image
                    src={p.public_url}
                    alt="Best of spot"
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover"
                    priority={false}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
