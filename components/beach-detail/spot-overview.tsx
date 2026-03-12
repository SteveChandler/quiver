"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Images } from "lucide-react";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";
import { WaveTipsCard } from "@/components/beach-detail/wave-tips-card";
import { AmenitiesBadges } from "@/components/beach-detail/amenities-badges";
import { WaterQualityBadge } from "@/components/beach-detail/water-quality-badge";
import { deriveAmenitiesFromFeatures } from "@/lib/utils/amenity-fallback-utils";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";

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
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
}

export function SpotOverview({ beach, amenities, waterQuality }: SpotOverviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const fetchPhotos = useCallback(async () => {
    return await getBestBeachPhotos(beach.id, 12);
  }, [beach.id]);

  const { data: photos } = useDataFetcher(fetchPhotos, {
    immediate: true,
    initialData: [] as BestPhoto[],
  });

  const handleImageError = (photoId: string) => {
    console.warn("Beach photo failed to load:", photoId);
    setFailedImages((prev) => new Set(prev).add(photoId));
  };

  // Filter out failed images
  const validPhotos = photos?.filter((p) => !failedImages.has(p.id)) || [];
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

  // Prefer calibration → beach swell window → em dash
  const bestSwell =
    calibratedSwellCardinal ||
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
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 44, damping: 16 }}
      >
        <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-cyan-50/60 dark:from-card dark:to-card border-cyan-200/50 dark:border-cyan-500/20 shadow-lg noise-texture">
          <CardHeader className="pb-3 bg-gradient-to-r from-cyan-50/80 to-teal-50/80 dark:from-cyan-500/10 dark:to-cyan-500/5 border-b border-cyan-100/50 dark:border-cyan-500/20">
            <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800 dark:text-gray-100">
              <MapPin className="h-5 w-5 text-teal-600" /> Spot Summary
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
      </motion.div>

      {/* Wave Tips */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 44, damping: 16 }}
      >
        <WaveTipsCard tips={beach.wave_tips} />
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 44, damping: 16 }}
      >
        <WaterQualityBadge waterQuality={waterQuality ?? null} beachState={beach.state} />
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 44, damping: 16 }}
      >
        <AmenitiesBadges
          amenities={
            amenities ??
            deriveAmenitiesFromFeatures(
              (beach as any).features ?? null,
              (beach as any).amenities ?? null
            )
          }
        />
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 44, damping: 16 }}
      >
        <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-rose-50/60 dark:from-card dark:to-card border-rose-200/50 dark:border-rose-500/20 shadow-lg noise-texture">
          <CardHeader className="pb-3 bg-gradient-to-r from-rose-50/80 to-red-50/80 dark:from-rose-500/10 dark:to-rose-500/5 border-b border-rose-100/50 dark:border-rose-500/20">
            <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800 dark:text-gray-100">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Hazards
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
      </motion.div>

      {/* Best-of gallery — only render when photos exist */}
      {validPhotos.length > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 44, damping: 16 }}
        >
          <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-purple-50/60 dark:from-card dark:to-card border-purple-200/50 dark:border-purple-500/20 shadow-lg noise-texture">
            <CardHeader className="pb-3 bg-gradient-to-r from-purple-50/80 to-violet-50/80 dark:from-purple-500/10 dark:to-purple-500/5 border-b border-purple-100/50 dark:border-purple-500/20">
              <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800 dark:text-gray-100">
                <Images className="h-5 w-5 text-purple-600" /> Best-of Gallery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {validPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    <Image
                      src={p.public_url}
                      alt="Best of spot"
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover"
                      onError={() => handleImageError(p.id)}
                      // External Openverse/Flickr images bypass Next.js optimization due to CORS and rate limiting
                      unoptimized={p.public_url.includes("openverse") || p.public_url.includes("flickr")}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
