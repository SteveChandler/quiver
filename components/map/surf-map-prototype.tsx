"use client";

import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import type mapboxgl from "mapbox-gl";
import {
  Bell,
  ChevronDown,
  Clock3,
  CloudSun,
  Compass,
  Crosshair,
  Droplets,
  Heart,
  Info,
  LocateFixed,
  Lock,
  Menu,
  Play,
  Search,
  Settings,
  Share2,
  Smartphone,
  Star,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_LAYER_COLOR,
  SWELL_MAP_CTA_CLASS,
  buildLegendRampCss,
  degreesToCompass,
} from "@/components/map/swell-map-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type LayerId = "s1" | "s2" | "wind" | "combined";

interface SurfLayer {
  id: LayerId;
  label: string;
  meta: string;
  icon: typeof Waves;
  color: string;
  background: string;
}

interface SurfSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  waveFt: number;
  periodS: number;
  windMph: number;
  rating: number;
  tide: string;
  screen: {
    x: number;
    y: number;
  };
}

interface Particle {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  age: number;
  life: number;
  speed: number;
  phase: number;
}

interface MarkerPosition {
  x: number;
  y: number;
}

const SURF_LAYERS: SurfLayer[] = [
  {
    id: "s1",
    label: "Primary swell",
    meta: "WNW 14s",
    icon: Waves,
    color: SWELL_LAYER_COLOR.s1, // #F78E42
    background: "linear-gradient(135deg, #161A40, #F78E42)",
  },
  {
    id: "s2",
    label: "Secondary swell",
    meta: "SSW 11s",
    icon: Droplets,
    color: SWELL_LAYER_COLOR.s2, // #FDB84B
    background: "linear-gradient(135deg, #161A40, #FDB84B)",
  },
  {
    id: "wind",
    label: "Wind",
    meta: "W 8 mph",
    icon: Wind,
    color: SWELL_LAYER_COLOR.wind, // #00D4AA Pacific Teal (the ONE sanctioned teal)
    background: "linear-gradient(135deg, #161A40, #00D4AA)",
  },
  {
    id: "combined",
    label: "Combined",
    meta: "Surf energy",
    icon: CloudSun,
    color: SWELL_LAYER_COLOR.combined, // #F78E42
    background: "linear-gradient(135deg, #1E2558, #FDB84B 55%, #F78E42)",
  },
];

const SURF_SPOTS: SurfSpot[] = [
  {
    id: "ocean-beach",
    name: "Ocean Beach",
    lat: 32.75,
    lon: -117.25,
    waveFt: 3.2,
    periodS: 14,
    windMph: 7,
    rating: 82,
    tide: "Rising",
    screen: { x: 42, y: 62 },
  },
  {
    id: "la-jolla",
    name: "La Jolla Shores",
    lat: 32.86,
    lon: -117.26,
    waveFt: 2.8,
    periodS: 13,
    windMph: 6,
    rating: 76,
    tide: "Mid",
    screen: { x: 48, y: 45 },
  },
  {
    id: "t-street",
    name: "T-Street",
    lat: 33.42,
    lon: -117.62,
    waveFt: 3.7,
    periodS: 15,
    windMph: 8,
    rating: 88,
    tide: "Rising",
    screen: { x: 57, y: 30 },
  },
  {
    id: "huntington",
    name: "Huntington Pier",
    lat: 33.65,
    lon: -118.0,
    waveFt: 4.1,
    periodS: 12,
    windMph: 10,
    rating: 71,
    tide: "High",
    screen: { x: 67, y: 23 },
  },
];

const TIME_STEPS = [
  { label: "Now", time: "7 AM", swell: "3.2 ft" },
  { label: "Tue 10", time: "10 AM", swell: "3.6 ft" },
  { label: "Tue 1", time: "1 PM", swell: "4.1 ft" },
  { label: "Tue 4", time: "4 PM", swell: "3.8 ft" },
  { label: "Wed", time: "7 AM", swell: "3.4 ft" },
  { label: "Thu", time: "7 AM", swell: "2.9 ft" },
  { label: "Fri", time: "7 AM", swell: "4.4 ft" },
];

const LAYER_BY_ID = Object.fromEntries(
  SURF_LAYERS.map((layer) => [layer.id, layer]),
) as Record<LayerId, SurfLayer>;

function fallbackPosition(spot: SurfSpot): MarkerPosition {
  return {
    x: spot.screen.x,
    y: spot.screen.y,
  };
}

function randomParticle(width: number, height: number): Particle {
  const x = Math.random() * width;
  const y = Math.random() * height;

  return {
    x,
    y,
    previousX: x,
    previousY: y,
    age: Math.random() * 120,
    life: 90 + Math.random() * 160,
    speed: 0.7 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  };
}

function layerVector(
  layerId: LayerId,
  x: number,
  y: number,
  width: number,
  height: number,
  timeIndex: number,
): { vx: number; vy: number; strength: number } {
  const nx = x / Math.max(1, width);
  const ny = y / Math.max(1, height);
  const timePhase = timeIndex * 0.32;
  const curl = Math.sin(nx * 7.5 + timePhase) * 0.38
    + Math.cos(ny * 6.2 - timePhase) * 0.24;

  const layerAngle: Record<LayerId, number> = {
    s1: -0.48,
    s2: -0.18,
    wind: 0.18,
    combined: -0.36,
  };
  const layerSpeed: Record<LayerId, number> = {
    s1: 1.15,
    s2: 0.82,
    wind: 1.55,
    combined: 1.22,
  };

  const angle = layerAngle[layerId] + curl * (layerId === "wind" ? 0.82 : 0.44);
  const oceanBias = 0.62 + Math.max(0, nx - 0.24) * 0.62;
  const pulse = 0.82 + Math.sin((nx + ny) * 10 + timePhase) * 0.1;
  const strength = layerSpeed[layerId] * oceanBias * pulse;

  return {
    vx: Math.cos(angle) * strength,
    vy: Math.sin(angle) * strength,
    strength,
  };
}

function paintFallbackMap(context: CanvasRenderingContext2D, width: number, height: number) {
  const oceanGradient = context.createLinearGradient(0, 0, width, height);
  oceanGradient.addColorStop(0, "#1E2558");
  oceanGradient.addColorStop(0.42, "#252D6B");
  oceanGradient.addColorStop(1, "#161A40");
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, width, height);

  const landGradient = context.createLinearGradient(0, 0, width * 0.62, height);
  landGradient.addColorStop(0, "#2E3878");
  landGradient.addColorStop(1, "#1E2558");
  context.fillStyle = landGradient;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(width * 0.62, 0);
  context.bezierCurveTo(width * 0.48, height * 0.22, width * 0.54, height * 0.42, width * 0.38, height * 0.58);
  context.bezierCurveTo(width * 0.31, height * 0.72, width * 0.36, height * 0.88, width * 0.22, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width * 0.62, 0);
  context.bezierCurveTo(width * 0.48, height * 0.22, width * 0.54, height * 0.42, width * 0.38, height * 0.58);
  context.bezierCurveTo(width * 0.31, height * 0.72, width * 0.36, height * 0.88, width * 0.22, height);
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.66)";
  context.font = "500 12px var(--font-sans), sans-serif";
  ["San Clemente", "La Jolla", "San Diego", "Pacific Ocean"].forEach((label, index) => {
    const y = height * (0.25 + index * 0.16);
    const x = index === 3 ? width * 0.72 : width * (0.2 + index * 0.08);
    context.fillText(label, x, y);
  });
}

function runCanvasParticleFallback(
  canvas: HTMLCanvasElement,
  layerId: LayerId,
  timeIndex: number,
  particlesEnabled: boolean,
  reducedMotion: boolean,
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;

  let animationFrame = 0;
  let particles: Particle[] = [];

  const render = () => {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (!particlesEnabled) {
      context.clearRect(0, 0, width, height);
      canvas.dataset.rafScheduled = "false";
      return;
    }

    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0,0,0,0.105)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    const activeLayer = LAYER_BY_ID[layerId];
    context.shadowColor = activeLayer.color;
    context.shadowBlur = 0;

    for (const particle of particles) {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const vector = layerVector(layerId, particle.x, particle.y, width, height, timeIndex);
      particle.x += vector.vx * particle.speed * 1.45;
      particle.y += vector.vy * particle.speed * 1.45;
      particle.age += 1;

      const outOfBounds = particle.x < -16
        || particle.x > width + 16
        || particle.y < -16
        || particle.y > height + 16;

      if (outOfBounds || particle.age > particle.life) {
        Object.assign(particle, randomParticle(width, height));
        continue;
      }

      const alpha = Math.min(0.78, 0.22 + vector.strength * 0.22);
      context.strokeStyle = activeLayer.color;
      context.globalAlpha = Math.min(0.96, alpha + 0.18);
      context.lineWidth = layerId === "wind" ? 1.65 : 2.2 + vector.strength * 0.32;
      context.beginPath();
      context.moveTo(particle.previousX, particle.previousY);
      context.lineTo(particle.x, particle.y);
      context.stroke();
    }

    context.globalAlpha = 1;
    if (reducedMotion || !particlesEnabled) {
      canvas.dataset.rafScheduled = "false";
      return;
    }
    animationFrame = window.requestAnimationFrame(render);
    canvas.dataset.rafScheduled = "true";
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: Math.min(950, Math.max(320, Math.round(rect.width * rect.height / 1100))) }, () =>
      randomParticle(rect.width, rect.height),
    );
    context.clearRect(0, 0, rect.width, rect.height);
    if (reducedMotion && particlesEnabled) render();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  if (!reducedMotion || !particlesEnabled) render();

  return () => {
    observer.disconnect();
    window.cancelAnimationFrame(animationFrame);
    canvas.dataset.rafScheduled = "false";
  };
}

function useParticleCanvas(
  layerId: LayerId,
  timeIndex: number,
  particlesEnabled: boolean,
  reducedMotion: boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    return runCanvasParticleFallback(
      canvas,
      layerId,
      timeIndex,
      particlesEnabled,
      reducedMotion,
    );
  }, [layerId, particlesEnabled, timeIndex, reducedMotion]);

  return canvasRef;
}

function useMotionPreferenceChecked(): boolean {
  const [motionPreferenceChecked, setMotionPreferenceChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionPreferenceChecked(typeof mediaQuery.matches === "boolean");
  }, []);

  return motionPreferenceChecked;
}

function SurfLayerButton({
  layer,
  selected,
  onClick,
}: {
  layer: SurfLayer;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = layer.icon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={selected}
      className={cn(
        "h-auto justify-start rounded-md px-2.5 py-2 text-left text-white hover:text-white focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161A40]",
        selected && "ring-1 ring-white/35",
      )}
      onClick={onClick}
    >
      <span
        className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md shadow-sm"
        style={{ background: layer.background }}
      >
        <Icon className="h-5 w-5 text-white drop-shadow" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5">
          {layer.label}
        </span>
        <span className="block truncate font-mono text-xs text-white/70">
          {layer.meta}
        </span>
      </span>
    </Button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  enabled,
  onClick,
}: {
  icon: typeof Waves;
  label: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role="switch"
      aria-checked={enabled}
      className="h-10 justify-between rounded-md px-3 text-white hover:text-white focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161A40]"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-white/72" />
        <span>{label}</span>
      </span>
      <span
        className="h-5 w-9 rounded-full border border-white/28 p-0.5 transition-colors motion-reduce:transition-none"
        style={{ background: enabled ? SWELL_LAYER_COLOR.wind : "rgba(255,255,255,0.12)" }}
      >
        <span
          className={cn(
            "block h-3.5 w-3.5 rounded-full bg-white transition-transform motion-reduce:transition-none",
            enabled && "translate-x-4",
          )}
        />
      </span>
    </Button>
  );
}

function recolorBasemapToNavy(map: mapboxgl.Map): void {
  const NAVY_LAND = SWELL_MAP_SURFACE.base;
  const NAVY_WATER = SWELL_MAP_SURFACE.panel;
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", NAVY_LAND);
        continue;
      }
      if (layer.type !== "fill" && layer.type !== "line" && layer.type !== "symbol") continue;

      const id = layer.id.toLowerCase();
      const isWater = id.includes("water") || id.includes("ocean") || id.includes("bathymetry");
      if (layer.type === "fill") {
        map.setPaintProperty(layer.id, "fill-color", isWater ? NAVY_WATER : NAVY_LAND);
      } else if (layer.type === "line") {
        map.setPaintProperty(layer.id, "line-color", SWELL_MAP_SURFACE.border);
      } else if (layer.type === "symbol") {
        // Keep labels legible on navy.
        map.setPaintProperty(layer.id, "text-color", "rgba(255,255,255,0.78)");
        map.setPaintProperty(layer.id, "text-halo-color", NAVY_LAND);
      }
    } catch {
      // Some layers reject paint props for their type; skip silently.
    }
  }
}

export function SurfMapPrototype() {
  const reducedMotion = useReducedMotion();
  const motionPreferenceChecked = useMotionPreferenceChecked();
  const effectiveReducedMotion = !motionPreferenceChecked || reducedMotion;
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>("combined");
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(2);
  const [selectedSpotId, setSelectedSpotId] = useState("ocean-beach");
  const [menuOpen, setMenuOpen] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [isolinesEnabled, setIsolinesEnabled] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [spotPositions, setSpotPositions] = useState<Record<string, MarkerPosition>>(
    () => Object.fromEntries(SURF_SPOTS.map((spot) => [spot.id, fallbackPosition(spot)])),
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const canvasRef = useParticleCanvas(
    selectedLayerId,
    selectedTimeIndex,
    particlesEnabled,
    effectiveReducedMotion,
  );

  useEffect(() => {
    if (motionPreferenceChecked && reducedMotion) setParticlesEnabled(false);
  }, [motionPreferenceChecked, reducedMotion]);

  const selectedLayer = LAYER_BY_ID[selectedLayerId];
  const selectedLayerHeading =
    selectedLayer.id === "wind" ? `wind from ${degreesToCompass(270)}` : selectedLayer.meta;
  const selectedSpot = useMemo(
    () => SURF_SPOTS.find((spot) => spot.id === selectedSpotId) ?? SURF_SPOTS[0],
    [selectedSpotId],
  );
  const selectedTime = TIME_STEPS[selectedTimeIndex];

  const updateSpotPositions = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const next = Object.fromEntries(
      SURF_SPOTS.map((spot) => {
        const point = map.project([spot.lon, spot.lat]);
        return [
          spot.id,
          {
            x: point.x,
            y: point.y,
          },
        ];
      }),
    ) as Record<string, MarkerPosition>;
    setSpotPositions(next);
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!container || !token) return undefined;

    let cancelled = false;
    let map: mapboxgl.Map | null = null;

    void import("mapbox-gl").then((mapboxModule) => {
      if (cancelled || !container) return;

      const mapbox = mapboxModule.default;
      if (!mapbox.supported({ failIfMajorPerformanceCaveat: true })) return;

      mapbox.accessToken = token;
      try {
        map = new mapbox.Map({
          container,
          center: [-117.55, 33.33],
          zoom: 7.15,
          minZoom: 6,
          maxZoom: 10.5,
          style: "mapbox://styles/mapbox/dark-v11",
          attributionControl: false,
        });
      } catch {
        setMapLoaded(false);
        return;
      }

      mapRef.current = map;
      map.on("load", () => {
        recolorBasemapToNavy(map!);
        setMapLoaded(true);
        updateSpotPositions();
      });
      map.on("move", updateSpotPositions);
      map.on("resize", updateSpotPositions);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [updateSpotPositions]);

  useEffect(() => {
    if (mapLoaded) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paintFallbackMap(context, rect.width, rect.height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => observer.disconnect();
  }, [mapLoaded]);

  const markerStyle = useCallback(
    (spot: SurfSpot): { style: CSSProperties } => {
      const position = spotPositions[spot.id] ?? fallbackPosition(spot);
      const map = mapRef.current;
      const left = map ? `${position.x}px` : `${position.x}%`;
      const top = map ? `${position.y}px` : `${position.y}%`;
      const selected = spot.id === selectedSpotId;

      return {
        style: {
          left,
          top,
          background: selected ? SWELL_LAYER_COLOR.s1 : SWELL_MAP_SURFACE.panel,
          borderRadius: SWELL_MAP_STICKER_RADIUS,
          boxShadow: SWELL_MAP_STICKER_SHADOW,
          transform: `translate(-50%, -50%) rotate(${selected ? -1.5 : 1.5}deg)`,
        },
      };
    },
    [spotPositions, selectedSpotId],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#252D6B] text-white">
      <div ref={mapContainerRef} className="absolute inset-0" />
      {!mapLoaded && (
        <canvas
          ref={fallbackCanvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_56%,rgba(30,37,88,0.55),transparent_42%),linear-gradient(180deg,rgba(22,26,64,0.10),rgba(22,26,64,0.42))]" />
      <canvas
        ref={canvasRef}
        data-testid="surf-map-particles"
        data-raf-scheduled="false"
        className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
        aria-hidden="true"
      />
      <div aria-live="polite" className="sr-only" data-testid="surf-map-live">
        {`${selectedLayer.label} layer active — ${selectedLayerHeading}`}
      </div>

      {isolinesEnabled && !effectiveReducedMotion && (
        <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:repeating-radial-gradient(ellipse_at_70%_52%,transparent_0,transparent_44px,rgba(255,255,255,0.18)_45px,transparent_47px)]" />
      )}

      <div
        className="absolute left-3 top-3 z-20 w-[min(380px,calc(100vw-24px))] rounded-lg text-white md:left-4 md:top-4"
        style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
      >
        <div className="flex h-10 items-center gap-2 border-b border-white/12 px-3">
          <Search className="h-4 w-4 text-white/82" />
          <span className="text-sm font-semibold">Ocean Beach, San Diego</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 rounded-full text-white hover:bg-white/12 hover:text-white"
            aria-label="Center on current location"
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-3 px-3 py-3">
          <div className="font-heading text-5xl font-semibold leading-none">
            {selectedSpot.waveFt.toFixed(1)}
          </div>
          <div className="pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">ft</span>
              <span className="text-sm text-white/72">{selectedLayer.meta}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-white/75">
              <Wind className="h-3.5 w-3.5" />
              <span>{selectedSpot.windMph} mph wind</span>
              <span>{selectedSpot.periodS}s period</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 border-t border-white/10 text-xs">
          {TIME_STEPS.slice(0, 4).map((step, index) => (
            <button
              key={step.label}
              type="button"
              aria-pressed={selectedTimeIndex === index}
              aria-current={selectedTimeIndex === index ? "true" : undefined}
              className={cn(
                "border-r border-white/10 px-2 py-2 text-left last:border-r-0 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FDB84B]",
                selectedTimeIndex === index && "bg-white/12",
              )}
              onClick={() => setSelectedTimeIndex(index)}
            >
              <span className="block font-semibold uppercase text-white/58">
                {step.label}
              </span>
              <span className="mt-1 block font-mono font-semibold">{step.swell}</span>
            </button>
          ))}
        </div>
        <div className="h-2 rounded-b-lg" style={{ background: buildLegendRampCss() }} />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 items-center gap-2 md:flex">
        <Image
          src="/quiver-app-icon-128.png"
          alt=""
          width={30}
          height={30}
          className="rounded-md shadow"
        />
        <span className="font-heading text-2xl font-semibold drop-shadow">
          Quiver
        </span>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 md:flex">
        <Button
          type="button"
          size="sm"
          className={cn("h-8 rounded-full px-3 font-semibold", SWELL_MAP_CTA_CLASS)}
        >
          <Smartphone className="h-4 w-4" />
          Get app
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 rounded-full px-3 text-white hover:text-white"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
        >
          Login
        </Button>
      </div>

      <div className="absolute right-3 top-20 z-20 hidden w-48 flex-col gap-2 md:flex">
        <div
          className="rounded-lg p-2"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
        >
          <div className="mb-1 flex items-center justify-between px-2 text-sm font-semibold">
            <span>Layers</span>
            <Settings className="h-4 w-4 text-white/70" />
          </div>
          <div className="flex flex-col gap-1">
            {SURF_LAYERS.map((layer) => (
              <SurfLayerButton
                key={layer.id}
                layer={layer}
                selected={layer.id === selectedLayerId}
                onClick={() => setSelectedLayerId(layer.id)}
              />
            ))}
          </div>
        </div>
        <div
          className="rounded-lg p-2"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
        >
          <ToggleRow
            icon={Waves}
            label="Particles"
            enabled={particlesEnabled}
            onClick={() => setParticlesEnabled((enabled) => !enabled)}
          />
          <ToggleRow
            icon={Compass}
            label="Pressure lines"
            enabled={isolinesEnabled}
            onClick={() => setIsolinesEnabled((enabled) => !enabled)}
          />
        </div>
      </div>

      <div className="absolute right-3 top-[42%] z-20 flex flex-col gap-3 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-white hover:text-white"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
          aria-label="Center map"
        >
          <Crosshair className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-white hover:text-white"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
          aria-label="Share map"
        >
          <Share2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-10 w-10 rounded-full text-white hover:text-white", SWELL_MAP_CTA_CLASS)}
          style={{ boxShadow: SWELL_MAP_STICKER_SHADOW }}
          aria-label="Open layer menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {SURF_SPOTS.map((spot) => {
        const selected = spot.id === selectedSpotId;

        return (
          <button
            key={spot.id}
            type="button"
            aria-pressed={selected}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "absolute z-10 border border-white/35 px-2.5 py-1 font-mono text-xs font-bold transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]",
              selected ? "z-20 text-[#161A40]" : "text-white",
            )}
            {...markerStyle(spot)}
            onClick={() => setSelectedSpotId(spot.id)}
          >
            {spot.waveFt.toFixed(1)}ft
          </button>
        );
      })}

      <div
        className="absolute bottom-[86px] left-3 z-20 w-[min(330px,calc(100vw-24px))] rounded-lg p-3 md:bottom-20 md:left-4"
        style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-semibold leading-6">
              {selectedSpot.name}
            </p>
            <p className="mt-0.5 text-xs text-white/64">
              {selectedTime.time} surf call
            </p>
          </div>
          <div
            className="rounded-md px-2 py-1 font-mono text-sm font-bold text-[#FDB84B]"
            style={{ background: "rgba(253,184,75,0.16)" }}
          >
            {selectedSpot.rating}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
            <span className="block text-white/70">Swell</span>
            <span className="font-mono font-semibold">{selectedTime.swell}</span>
          </div>
          <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
            <span className="block text-white/70">Wind</span>
            <span className="font-mono font-semibold">{selectedSpot.windMph} mph</span>
          </div>
          <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
            <span className="block text-white/70">Tide</span>
            <span className="font-mono font-semibold">{selectedSpot.tide}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="xs"
            className={cn("h-8 flex-1", SWELL_MAP_CTA_CLASS)}
          >
            <Bell className="h-3.5 w-3.5" />
            Alert me
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="h-8 flex-1 text-white hover:text-white"
            style={{ background: SWELL_MAP_SURFACE.panelDeep }}
          >
            <Heart className="h-3.5 w-3.5" />
            Save spot
          </Button>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-30 border-t"
        style={{
          background: SWELL_MAP_SURFACE.panelDeep,
          borderColor: SWELL_MAP_SURFACE.border,
          boxShadow: "0 -8px 0 0 rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex h-14 items-stretch">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-14 w-16 rounded-none text-white hover:bg-white/10 hover:text-white"
            aria-label="Play forecast timeline"
          >
            <Play className="h-6 w-6 fill-white" />
          </Button>
          <div className="flex min-w-0 flex-1 overflow-x-auto">
            {TIME_STEPS.map((step, index) => (
              <button
                key={step.label}
                type="button"
                aria-pressed={selectedTimeIndex === index}
                aria-current={selectedTimeIndex === index ? "true" : undefined}
                className={cn(
                  "relative min-w-[104px] border-l px-3 text-left text-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FDB84B] motion-reduce:transition-none",
                  selectedTimeIndex === index && "bg-white/12",
                )}
                style={{ borderColor: SWELL_MAP_SURFACE.border }}
                onClick={() => setSelectedTimeIndex(index)}
              >
                {selectedTimeIndex === index && (
                  <span
                    className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md px-4 py-1.5 font-mono text-sm font-semibold text-[#161A40]"
                    style={{ background: SWELL_LAYER_COLOR.s2, boxShadow: SWELL_MAP_STICKER_SHADOW }}
                  >
                    {step.time}
                  </span>
                )}
                <span className="block text-white/55">{step.label}</span>
                <span className="block font-mono font-semibold">{step.swell}</span>
              </button>
            ))}
          </div>
          <div className="hidden w-80 border-l border-white/12 px-4 py-2 md:block">
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-white/72">
              <span>ft</span>
              <span>1.6</span>
              <span>3.3</span>
              <span>5</span>
              <span>6.6</span>
              <span>20</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: buildLegendRampCss() }} />
          </div>
        </div>
      </div>

      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(22,26,64,0.55)] md:hidden" />
          <Dialog.Content
            aria-label="Surf map layers and settings"
            className="fixed inset-y-0 right-0 z-50 w-[min(292px,74vw)] overflow-y-auto border-l p-3 text-white outline-none data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:transition-none md:hidden"
            style={{
              background: SWELL_MAP_SURFACE.panelDeep,
              borderColor: SWELL_MAP_SURFACE.border,
              boxShadow: SWELL_MAP_STICKER_SHADOW,
            }}
          >
            <Dialog.Title className="sr-only">Surf map layers and settings</Dialog.Title>
            <Dialog.Description className="sr-only">
              Layer, timeline, and display controls for the surf map.
            </Dialog.Description>
            <div className="mb-3 flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                className={cn("h-8 rounded-full px-3 text-white", SWELL_MAP_CTA_CLASS)}
              >
                <Lock className="h-4 w-4" />
                Go Pro
              </Button>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-white hover:text-white"
                  style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
                  aria-label="Close layer menu"
                >
                  <X className="h-6 w-6" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/72">
              <button
                type="button"
                className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                <Smartphone className="mx-auto mb-1 h-5 w-5" />
                App
              </button>
              <button
                type="button"
                className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                <Bell className="mx-auto mb-1 h-5 w-5" />
                Alerts
              </button>
              <button
                type="button"
                className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                <Settings className="mx-auto mb-1 h-5 w-5" />
                Settings
              </button>
            </div>
            <div className="my-3 flex flex-wrap gap-2 text-sm">
              {["All", "Swell", "Wind", "Tide", "Cams", "Search"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-1 text-white/82 hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]",
                    label === "All" && "bg-[rgba(253,184,75,0.18)] text-[#FDB84B]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SURF_LAYERS.map((layer) => {
                const Icon = layer.icon;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    aria-pressed={layer.id === selectedLayerId}
                    className={cn(
                      "rounded-lg border p-2 text-left text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]",
                      layer.id === selectedLayerId ? "border-white/42 bg-white/12" : "border-white/10",
                    )}
                    onClick={() => {
                      setSelectedLayerId(layer.id);
                      setMenuOpen(false);
                    }}
                  >
                    <span
                      className="mb-2 flex h-16 items-center justify-center rounded-md"
                      style={{ background: layer.background }}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </span>
                    {layer.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-1 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
            >
              Display more layers (12)
              <ChevronDown className="h-4 w-4" />
            </button>
            <div
              className="mt-4 rounded-lg p-3"
              style={{ background: SWELL_MAP_SURFACE.panelDeep }}
            >
              <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <Clock3 className="h-4 w-4" />
                Timeline: {selectedTime.time}
              </div>
              <input
                suppressHydrationWarning
                type="range"
                min={0}
                max={TIME_STEPS.length - 1}
                value={selectedTimeIndex}
                onChange={(event) => setSelectedTimeIndex(Number(event.target.value))}
                className="w-full accent-[#F78E42]"
              />
            </div>
            <div
              className="mt-3 rounded-lg p-2"
              style={{ background: SWELL_MAP_SURFACE.panelDeep }}
            >
              <ToggleRow
                icon={Waves}
                label="Particles animation"
                enabled={particlesEnabled}
                onClick={() => setParticlesEnabled((enabled) => !enabled)}
              />
              <ToggleRow
                icon={Info}
                label="Isolines"
                enabled={isolinesEnabled}
                onClick={() => setIsolinesEnabled((enabled) => !enabled)}
              />
              <ToggleRow
                icon={Star}
                label="Favorite spots"
                enabled
                onClick={() => undefined}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
