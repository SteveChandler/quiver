"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { getStaticMapImageUrl } from "@/lib/map-utils";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import { HeroSwellField, type HeroSwell, type LoadedMapImage } from "./hero-swell-field";

const CamsSection = dynamic(
  () => import("@/components/beach-detail/cams-section").then((m) => m.CamsSection),
  { ssr: false },
);

/**
 * Same viewpoints, order, and labels as the native hero
 * (quiver-native src/lib/hero-viewpoints.ts) so one beach looks the same on
 * both surfaces.
 */
type HeroViewpoint = "swell" | "satellite" | "photo" | "cam";

const VIEWPOINT_ORDER: readonly HeroViewpoint[] = ["swell", "satellite", "photo", "cam"];

const VIEWPOINT_LABELS: Record<HeroViewpoint, string> = {
  swell: "Swell",
  satellite: "Sat",
  photo: "Photo",
  cam: "Cam",
};

const VIEWPOINT_STORAGE_KEY = "quiver:home-hero-viewpoint";
const ORANGE = "F78E42";

function readStoredViewpoint(): HeroViewpoint | null {
  try {
    const stored = window.localStorage.getItem(VIEWPOINT_STORAGE_KEY);
    return VIEWPOINT_ORDER.includes(stored as HeroViewpoint) ? (stored as HeroViewpoint) : null;
  } catch {
    return null;
  }
}

function storeViewpoint(viewpoint: HeroViewpoint): void {
  try {
    window.localStorage.setItem(VIEWPOINT_STORAGE_KEY, viewpoint);
  } catch {
    // A remembered viewpoint is a convenience; the hero works without it.
  }
}

/**
 * Map tiles sized to the box they fill (the hero is 4:5 on phones and 16:10
 * from `sm` up), at @2x. The zoom offsets keep the framing a full-width
 * 1024x640 request used to show, at a fraction of the bytes: a phone no longer
 * downloads a 2048px image to fill a 360px box.
 */
const MAP_SIZES = {
  phone: { width: 400, height: 500, zoomOffset: -0.35 },
  wide: { width: 800, height: 500, zoomOffset: -0.36 },
} as const;

interface MapSources {
  phone: string;
  wide: string;
}

/** A provider-less map comes back as an inline SVG placeholder, not real media. */
function mapSourcesOrNull(
  lat: number | null,
  lon: number | null,
  style: string,
  zoom: number,
): MapSources | null {
  if (lat == null || lon == null) return null;
  const build = (size: (typeof MAP_SIZES)[keyof typeof MAP_SIZES]) =>
    getStaticMapImageUrl(lat, lon, {
      width: size.width,
      height: size.height,
      zoom: Math.round((zoom + size.zoomOffset) * 100) / 100,
      style,
      markerColor: ORANGE,
    });
  const phone = build(MAP_SIZES.phone);
  if (phone.startsWith("data:")) return null;
  return { phone, wide: build(MAP_SIZES.wide) };
}

interface HomeHeroMediaProps {
  beachName: string;
  lat: number | null;
  lon: number | null;
  /** A real photo of this beach. Omit generic stock so the hero never pretends. */
  photoUrl: string | null;
  sources?: BeachSources | null;
  /** Drives the swell field. Null draws the map alone. */
  swell: HeroSwell | null;
  /** The recheck state keeps the place on screen but has nothing to switch. */
  showViewpoints?: boolean;
  /** Overlays pinned to the bottom of the media: the name plate and the call. */
  children: ReactNode;
}

export function HomeHeroMedia({
  beachName,
  lat,
  lon,
  photoUrl,
  sources,
  swell,
  showViewpoints = true,
  children,
}: HomeHeroMediaProps) {
  // /map's basemap, so the swell field reads the same water colour it does there.
  const streetsMap = useMemo(
    () => mapSourcesOrNull(lat, lon, "mapbox/streets-v11", 13),
    [lat, lon],
  );
  const satelliteMap = useMemo(
    () => mapSourcesOrNull(lat, lon, "mapbox/satellite-streets-v12", 15),
    [lat, lon],
  );
  const cameraUrl = sources?.camera_url ?? null;

  const available = useMemo(() => {
    const kinds: HeroViewpoint[] = [];
    if (streetsMap) kinds.push("swell");
    if (satelliteMap) kinds.push("satellite");
    if (photoUrl) kinds.push("photo");
    if (cameraUrl) kinds.push("cam");
    return kinds;
  }, [streetsMap, satelliteMap, photoUrl, cameraUrl]);

  // Stored preference is read after mount so server and client render the
  // same first frame.
  const [preferred, setPreferred] = useState<HeroViewpoint>("swell");
  useEffect(() => {
    const stored = readStoredViewpoint();
    if (stored) setPreferred(stored);
  }, []);

  const active: HeroViewpoint | null = available.includes(preferred)
    ? preferred
    : available[0] ?? null;

  const [streetsImage, setStreetsImage] = useState<LoadedMapImage | null>(null);
  const handleStreetsImage = useCallback((element: HTMLImageElement) => {
    setStreetsImage((current) =>
      current?.element === element && current.src === element.currentSrc
        ? current
        : { element, src: element.currentSrc },
    );
  }, []);

  const selectViewpoint = (viewpoint: HeroViewpoint) => {
    setPreferred(viewpoint);
    storeViewpoint(viewpoint);
  };

  return (
    <figure
      className="relative m-0 aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]"
      data-testid="home-hero-media"
      data-viewpoint={active ?? "none"}
      style={{
        background: "#1A1535",
        border: "1.5px solid #11100D",
        boxShadow: "4px 6px 0 rgba(17,16,13,0.3)",
      }}
    >
      {active === "swell" && streetsMap && (
        <>
          <MapPicture
            sources={streetsMap}
            alt={`Map of ${beachName}`}
            readable
            onLoaded={handleStreetsImage}
          />
          {swell && <HeroSwellField image={streetsImage} swell={swell} />}
        </>
      )}
      {active === "satellite" && satelliteMap && (
        <MapPicture sources={satelliteMap} alt={`Satellite view of ${beachName}`} />
      )}
      {active === "photo" && photoUrl && (
        <MediaImage src={getOptimizedImageUrl(photoUrl)} alt={`Photo of ${beachName}`} />
      )}
      {active === "cam" && cameraUrl && (
        <div className="absolute inset-0 [&>div]:!aspect-auto [&>div]:h-full">
          <CamsSection sources={sources} variant="hero" beachName={beachName} />
        </div>
      )}

      {/* Keeps the name plate and call legible over any media. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(13,16,32,0.92) 0%, rgba(13,16,32,0.55) 34%, rgba(13,16,32,0) 62%)",
        }}
      />

      {showViewpoints && available.length > 1 && (
        <div
          role="tablist"
          aria-label="Hero view"
          className="absolute left-3 top-3 flex gap-1.5 sm:left-4 sm:top-4"
        >
          {available.map((viewpoint) => {
            const selected = viewpoint === active;
            return (
              <button
                key={viewpoint}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectViewpoint(viewpoint)}
                className="focus-ring min-h-9 px-3 transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: selected ? "#11100D" : "#F4EBD8",
                  background: selected ? `#${ORANGE}` : "rgba(13,16,32,0.72)",
                  border: selected ? "1.5px solid #11100D" : "1.5px solid rgba(244,235,216,0.35)",
                }}
              >
                {VIEWPOINT_LABELS[viewpoint]}
              </button>
            );
          })}
        </div>
      )}

      {/* Mapbox's own wordmark sits under the call; keep attribution visible. */}
      {(active === "swell" || active === "satellite") && (
        <span
          className="pointer-events-none absolute right-2 top-2 px-1.5 py-0.5"
          style={{
            fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
            fontSize: 9,
            color: "#F4EBD8",
            background: "rgba(13,16,32,0.55)",
          }}
        >
          © Mapbox © OpenStreetMap
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0">{children}</div>
    </figure>
  );
}

interface MapPictureProps {
  sources: MapSources;
  alt: string;
  /** Load with CORS so a canvas can read the pixels (the swell field's water mask). */
  readable?: boolean;
  onLoaded?: (element: HTMLImageElement) => void;
}

/** Only the source matching the viewport downloads. `sm` is where the hero turns 16:10. */
function MapPicture({ sources, alt, readable, onLoaded }: MapPictureProps) {
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={sources.wide} />
      <MediaImage src={sources.phone} alt={alt} readable={readable} onLoaded={onLoaded} />
    </picture>
  );
}

function MediaImage({
  src,
  alt,
  readable,
  onLoaded,
}: {
  src: string;
  alt: string;
  readable?: boolean;
  onLoaded?: (element: HTMLImageElement) => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote map/photo URLs fill an aspect box; next/image adds nothing here
    <img
      crossOrigin={readable ? "anonymous" : undefined}
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      loading="eager"
      decoding="async"
      onLoad={onLoaded ? (event) => onLoaded(event.currentTarget) : undefined}
      // An image already decoded before hydration never fires load.
      ref={(element) => {
        if (element?.complete && element.naturalWidth > 0) onLoaded?.(element);
      }}
    />
  );
}
