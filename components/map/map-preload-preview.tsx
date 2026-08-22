import { useEffect, useMemo, useRef, useState } from "react";
import type { Beach } from "@/types/database";
import type { ConditionSummary } from "@/components/map/map-beach-loader";
import { getConditionMarkerGradient } from "@/components/map/map-marker-builder";
import { getStaticMapViewportImageUrl } from "@/lib/map-utils";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

const MAX_PREVIEW_MARKERS = 24;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const MAPBOX_TILE_SIZE = 512;

export interface MapPreviewOffset {
  x: number;
  y: number;
}

function mercatorPoint(
  latitude: number,
  longitude: number,
  zoom: number,
): MapPreviewOffset {
  const worldSize = MAPBOX_TILE_SIZE * 2 ** zoom;
  const clampedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const latitudeRadians = (clampedLatitude * Math.PI) / 180;

  return {
    x: ((longitude + 180) / 360) * worldSize,
    y:
      ((1 -
        Math.log(
          Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
        ) /
          Math.PI) /
        2) *
      worldSize,
  };
}

export function projectMapPreviewCoordinate({
  latitude,
  longitude,
  center,
  zoom,
}: {
  latitude: number;
  longitude: number;
  center: [number, number];
  zoom: number;
}): MapPreviewOffset | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1]) ||
    !Number.isFinite(zoom)
  ) {
    return null;
  }

  const worldSize = MAPBOX_TILE_SIZE * 2 ** zoom;
  const point = mercatorPoint(latitude, longitude, zoom);
  const centerPoint = mercatorPoint(center[0], center[1], zoom);
  let x = point.x - centerPoint.x;
  if (x > worldSize / 2) x -= worldSize;
  if (x < -worldSize / 2) x += worldSize;

  return { x, y: point.y - centerPoint.y };
}

interface MapPreloadPreviewProps {
  beaches: Beach[];
  center: [number, number];
  zoom: number;
  conditionSummaryMap: Map<string, ConditionSummary>;
  displayForecastMap: Map<string, ForecastDisplay | undefined>;
}

export function MapPreloadPreview({
  beaches,
  center,
  zoom,
  conditionSummaryMap,
  displayForecastMap,
}: MapPreloadPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = (): void => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      setSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const staticMapUrl = useMemo(
    () =>
      size
        ? getStaticMapViewportImageUrl({
        latitude: center[0],
        longitude: center[1],
        width: size.width,
        height: size.height,
        zoom,
          })
        : null,
    [center, size, zoom],
  );

  const markers = useMemo(
    () =>
      beaches
        .flatMap((beach) => {
          if (!Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) {
            return [];
          }
          const offset = projectMapPreviewCoordinate({
            latitude: beach.lat!,
            longitude: beach.lon!,
            center,
            zoom,
          });
          return offset ? [{ beach, offset }] : [];
        })
        .sort(
          (left, right) =>
            Math.hypot(left.offset.x, left.offset.y) -
            Math.hypot(right.offset.x, right.offset.y),
        )
        .slice(0, MAX_PREVIEW_MARKERS),
    [beaches, center, zoom],
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#80C8E2]"
      data-testid="map-preload-preview"
      aria-hidden="true"
    >
      {staticMapUrl ? (
        // The Static Images API URL is already sized for this viewport; Next Image
        // would proxy it and delay the first useful map frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticMapUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : null}
      {markers.map(({ beach, offset }) => {
        const summary = conditionSummaryMap.get(beach.id) ?? "UNKNOWN";
        const waveLabel = displayForecastMap.get(beach.id)?.label?.trim();
        return (
          <div
            key={beach.id}
            className="absolute flex min-h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white px-1.5 text-[10px] font-bold text-white shadow-md"
            style={{
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
              background: getConditionMarkerGradient(summary),
            }}
            data-testid="map-preload-marker"
            data-condition-summary={summary}
          >
            {waveLabel || "\u2022"}
          </div>
        );
      })}
    </div>
  );
}
