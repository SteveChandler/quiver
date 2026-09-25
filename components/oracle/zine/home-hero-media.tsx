"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { getStaticMapImageUrl } from "@/lib/map-utils";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

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
  /** Direction the swell arrives from, in degrees. */
  swellDirectionDeg: number | null;
  swellPeriod: number;
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
  swellDirectionDeg,
  swellPeriod,
  showViewpoints = true,
  children,
}: HomeHeroMediaProps) {
  const streetsMap = useMemo(
    () => mapSourcesOrNull(lat, lon, "mapbox/outdoors-v12", 13),
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
          <MapPicture sources={streetsMap} alt={`Map of ${beachName}`} />
          <SwellLines directionDeg={swellDirectionDeg} period={swellPeriod} />
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

/** Only the source matching the viewport downloads. `sm` is where the hero turns 16:10. */
function MapPicture({ sources, alt }: { sources: MapSources; alt: string }) {
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={sources.wide} />
      <MediaImage src={sources.phone} alt={alt} />
    </picture>
  );
}

function MediaImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote map/photo URLs fill an aspect box; next/image adds nothing here
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      loading="eager"
      decoding="async"
    />
  );
}

/**
 * Short streaks travelling with the swell, faded out toward the beach so they
 * read as open water rather than covering the land. Longer periods move
 * faster, the way groundswell does. Reduced motion draws a single still frame.
 */
function SwellLines({
  directionDeg,
  period,
}: {
  directionDeg: number | null;
  period: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || directionDeg == null) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Swell is reported by where it comes FROM; the lines travel the other way.
    const travel = ((directionDeg + 180) * Math.PI) / 180;
    const dx = Math.sin(travel);
    const dy = -Math.cos(travel);
    const speed = 18 + Math.max(0, Math.min(period, 20)) * 3;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    const streaks = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      length: 10 + Math.random() * 14,
      phase: Math.random(),
    }));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // 1 on the side the swell arrives from, 0 past the beach at the centre.
    const waterWeight = (x: number, y: number) => {
      const along = (x - width / 2) * -dx + (y - height / 2) * -dy;
      const reach = Math.max(width, height) / 2;
      return Math.max(0, Math.min(1, along / (reach * 0.55) + 0.1));
    };

    const draw = (elapsedSeconds: number) => {
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineWidth = 1.6;
      for (const streak of streaks) {
        const travelled = elapsedSeconds * speed;
        const x = (((streak.x * width + dx * travelled) % width) + width) % width;
        const y = (((streak.y * height + dy * travelled) % height) + height) % height;
        const alpha = waterWeight(x, y) * (0.35 + 0.35 * Math.sin((elapsedSeconds + streak.phase * 6) * 1.3) ** 2);
        if (alpha <= 0.02) continue;
        context.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        context.beginPath();
        context.moveTo(x - dx * streak.length, y - dy * streak.length);
        context.lineTo(x, y);
        context.stroke();
      }
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(0);
    });
    observer.observe(canvas);

    if (reduceMotion) {
      draw(0);
      return () => observer.disconnect();
    }

    const tick = (now: number) => {
      if (!last) last = now;
      draw((now - last) / 1000);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [directionDeg, period]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
