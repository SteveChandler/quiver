"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, ArrowRight, RefreshCw } from "lucide-react";
import { BeachToolSearch } from "@/components/tools/beach-tool-search";
import type { Beach } from "@/types/database";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";

// Popular beaches for the default hero state
const POPULAR_BEACH_SLUGS = [
  { slug: "la-jolla", name: "La Jolla", state: "CA" },
  { slug: "pipeline", name: "Pipeline", state: "HI" },
  { slug: "trestles", name: "Trestles", state: "CA" },
  { slug: "rincon", name: "Rincon", state: "CA" },
  { slug: "rockaway", name: "Rockaway", state: "NY" },
  { slug: "huntington-beach", name: "Huntington Beach", state: "CA" },
  { slug: "ocean-beach", name: "Ocean Beach", state: "CA" },
  { slug: "montauk", name: "Montauk", state: "NY" },
];

interface TidePrediction {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
}

interface TideData {
  beach: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    timezone: string | null;
  };
  stationId: string;
  predictions: TidePrediction[];
  sunTimes: { sunrise_utc: string | null; sunset_utc: string | null } | null;
}

interface TideExtreme {
  ts: string;
  height_ft: number;
  isHigh: boolean;
  formattedTime: string;
}

function mToFt(m: number): number {
  return m * 3.28084;
}

function formatTime(iso: string, timezone: string | null): string {
  const tz = timezone || "America/Los_Angeles";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}

/** Find local extremes (high/low tides) in an array of hourly predictions */
function findTideExtremes(
  predictions: TidePrediction[],
  timezone: string | null
): TideExtreme[] {
  const extremes: TideExtreme[] = [];
  for (let i = 1; i < predictions.length - 1; i++) {
    const prev = predictions[i - 1].tide_height_m;
    const curr = predictions[i].tide_height_m;
    const next = predictions[i + 1].tide_height_m;
    const isHigh = curr > prev && curr > next;
    const isLow = curr < prev && curr < next;
    if (isHigh || isLow) {
      extremes.push({
        ts: predictions[i].ts,
        height_ft: Math.round(mToFt(curr) * 10) / 10,
        isHigh,
        formattedTime: formatTime(predictions[i].ts, timezone),
      });
    }
  }
  return extremes;
}

/** Interpolate current tide height from hourly predictions */
function getCurrentTideHeight(predictions: TidePrediction[]): number | null {
  const now = Date.now();
  for (let i = 0; i < predictions.length - 1; i++) {
    const t1 = new Date(predictions[i].ts).getTime();
    const t2 = new Date(predictions[i + 1].ts).getTime();
    if (now >= t1 && now <= t2) {
      const frac = (now - t1) / (t2 - t1);
      const h = predictions[i].tide_height_m + frac * (predictions[i + 1].tide_height_m - predictions[i].tide_height_m);
      return Math.round(mToFt(h) * 10) / 10;
    }
  }
  return null;
}

/** Returns true if tide is currently rising */
function isTideRising(predictions: TidePrediction[]): boolean | null {
  const now = Date.now();
  for (let i = 0; i < predictions.length - 1; i++) {
    const t1 = new Date(predictions[i].ts).getTime();
    const t2 = new Date(predictions[i + 1].ts).getTime();
    if (now >= t1 && now <= t2) {
      return predictions[i + 1].tide_height_m > predictions[i].tide_height_m;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Analog Tide Clock SVG
// ---------------------------------------------------------------------------

interface TideClockProps {
  predictions: TidePrediction[];
  sunriseUtc: string | null;
  sunsetUtc: string | null;
}

function TideClock({ predictions, sunriseUtc, sunsetUtc }: TideClockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 8;

    ctx.clearRect(0, 0, W, H);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1A2158";
    ctx.fill();
    ctx.strokeStyle = "rgba(64, 76, 146, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (predictions.length < 2) {
      ctx.fillStyle = "#7A8CC0";
      ctx.font = `${r * 0.12}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("No data", cx, cy);
      return;
    }

    // Find min/max heights over 24h
    const heights = predictions.map((p) => p.tide_height_m);
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    const rangeH = maxH - minH || 1;

    // Draw 24h tide curve as arc sectors colored by height
    const nowMs = Date.now();
    const startMs = new Date(predictions[0].ts).getTime();
    const endMs = new Date(predictions[predictions.length - 1].ts).getTime();
    const totalMs = endMs - startMs || 1;

    // Draw arc segments
    const segmentCount = predictions.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const t1 = new Date(predictions[i].ts).getTime();
      const t2 = new Date(predictions[i + 1].ts).getTime();
      const angle1 = ((t1 - startMs) / totalMs) * Math.PI * 2 - Math.PI / 2;
      const angle2 = ((t2 - startMs) / totalMs) * Math.PI * 2 - Math.PI / 2;

      // Interpolate height color
      const norm = (predictions[i].tide_height_m - minH) / rangeH;
      const hue = 200 + norm * 40; // blue-teal range
      const lightness = 35 + norm * 25;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 4, angle1, angle2);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
      ctx.fill();
    }

    // Draw sunrise/sunset arc overlay (golden glow) on outer ring
    if (sunriseUtc && sunsetUtc) {
      const riseMs = new Date(sunriseUtc).getTime();
      const setMs = new Date(sunsetUtc).getTime();
      if (riseMs >= startMs && setMs <= endMs) {
        const riseAngle = ((riseMs - startMs) / totalMs) * Math.PI * 2 - Math.PI / 2;
        const setAngle = ((setMs - startMs) / totalMs) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, riseAngle, setAngle);
        ctx.strokeStyle = "rgba(247, 142, 66, 0.4)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }

    // Tick marks at each hour
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 6 === 0;
      const inner = isMajor ? r - 18 : r - 12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();
    }

    // Current time needle
    if (nowMs >= startMs && nowMs <= endMs) {
      const nowAngle = ((nowMs - startMs) / totalMs) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(nowAngle) * (r - 6), cy + Math.sin(nowAngle) * (r - 6));
      ctx.strokeStyle = "#F78E42";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();

      // Needle dot
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(nowAngle) * (r - 6),
        cy + Math.sin(nowAngle) * (r - 6),
        5,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "#F78E42";
      ctx.fill();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#252D6B";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [predictions, sunriseUtc, sunsetUtc]);

  useEffect(() => {
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    // Respect prefers-reduced-motion
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      draw();
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      className="w-full max-w-[280px] mx-auto"
      aria-label="Analog tide clock showing 24-hour tide cycle"
    />
  );
}

// ---------------------------------------------------------------------------
// 24-hour tide curve chart (SVG)
// ---------------------------------------------------------------------------

function TideCurveChart({
  predictions,
  sunriseUtc,
  sunsetUtc,
  timezone,
}: {
  predictions: TidePrediction[];
  sunriseUtc: string | null;
  sunsetUtc: string | null;
  timezone: string | null;
}) {
  if (predictions.length < 2) return null;

  const W = 600;
  const H = 120;
  const PAD_X = 32;
  const PAD_Y = 12;

  const heights = predictions.map((p) => mToFt(p.tide_height_m));
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const rangeH = maxH - minH || 1;

  const startMs = new Date(predictions[0].ts).getTime();
  const endMs = new Date(predictions[predictions.length - 1].ts).getTime();
  const totalMs = endMs - startMs || 1;
  const nowMs = Date.now();

  const xScale = (ms: number) =>
    PAD_X + ((ms - startMs) / totalMs) * (W - PAD_X * 2);
  const yScale = (h: number) =>
    H - PAD_Y - ((h - minH) / rangeH) * (H - PAD_Y * 2);

  // Build SVG path for the tide curve
  const points = predictions.map((p, i) => {
    const x = xScale(new Date(p.ts).getTime());
    const y = yScale(mToFt(p.tide_height_m));
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  // Gradient fill
  const fillPoints = [
    ...points,
    `L ${xScale(endMs).toFixed(1)} ${(H - PAD_Y).toFixed(1)}`,
    `L ${PAD_X} ${(H - PAD_Y).toFixed(1)}`,
    "Z",
  ];

  // Now marker x position
  const nowX = nowMs >= startMs && nowMs <= endMs ? xScale(nowMs) : null;

  // Sunrise/sunset x positions
  const sunriseX = sunriseUtc
    ? xScale(new Date(sunriseUtc).getTime())
    : null;
  const sunsetX = sunsetUtc ? xScale(new Date(sunsetUtc).getTime()) : null;

  // Hour labels at 0, 6, 12, 18, 24
  const hourLabels: { x: number; label: string }[] = [];
  const tzStr = timezone || "America/Los_Angeles";
  for (let h = 0; h <= 24; h += 6) {
    const ms = startMs + (h / 24) * totalMs;
    if (ms > endMs) break;
    const x = xScale(ms);
    const label = new Date(ms).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
      timeZone: tzStr,
    });
    hourLabels.push({ x, label });
  }

  return (
    <div className="w-full overflow-x-auto -mx-1">
      <svg
        viewBox={`0 0 ${W} ${H + 24}`}
        className="w-full min-w-[320px]"
        aria-label="24-hour tide curve"
        role="img"
      >
        <defs>
          <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B6BD4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3B6BD4" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Daylight zone */}
        {sunriseX !== null && sunsetX !== null && (
          <rect
            x={Math.max(PAD_X, sunriseX)}
            y={PAD_Y}
            width={Math.min(W - PAD_X, sunsetX) - Math.max(PAD_X, sunriseX)}
            height={H - PAD_Y * 2}
            fill="rgba(247, 142, 66, 0.08)"
          />
        )}

        {/* Tide fill */}
        <path d={fillPoints.join(" ")} fill="url(#tideGradient)" />

        {/* Tide curve line */}
        <path
          d={points.join(" ")}
          fill="none"
          stroke="#3B6BD4"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Sunrise marker */}
        {sunriseX !== null && sunriseX >= PAD_X && sunriseX <= W - PAD_X && (
          <line
            x1={sunriseX}
            y1={PAD_Y}
            x2={sunriseX}
            y2={H - PAD_Y}
            stroke="#F78E42"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.7"
          />
        )}

        {/* Sunset marker */}
        {sunsetX !== null && sunsetX >= PAD_X && sunsetX <= W - PAD_X && (
          <line
            x1={sunsetX}
            y1={PAD_Y}
            x2={sunsetX}
            y2={H - PAD_Y}
            stroke="#F78E42"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.7"
          />
        )}

        {/* Now line */}
        {nowX !== null && (
          <>
            <line
              x1={nowX}
              y1={PAD_Y}
              x2={nowX}
              y2={H - PAD_Y}
              stroke="#F78E42"
              strokeWidth="2"
            />
            <circle cx={nowX} cy={H - PAD_Y} r="4" fill="#F78E42" />
          </>
        )}

        {/* Hour labels */}
        {hourLabels.map(({ x, label }) => (
          <text
            key={label}
            x={x}
            y={H + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#7A8CC0"
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}

        {/* Y-axis labels */}
        <text
          x={PAD_X - 4}
          y={yScale(maxH)}
          textAnchor="end"
          fontSize="9"
          fill="#7A8CC0"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          {maxH.toFixed(1)}ft
        </text>
        <text
          x={PAD_X - 4}
          y={yScale(minH)}
          textAnchor="end"
          fontSize="9"
          fill="#7A8CC0"
          fontFamily="monospace"
          dominantBaseline="middle"
        >
          {minH.toFixed(1)}ft
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function TideClockClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tideData, setTideData] = useState<TideData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beachName, setBeachName] = useState<string | null>(null);

  // Read ?beach= from URL on mount
  useEffect(() => {
    const beachSlug = searchParams.get("beach");
    if (beachSlug) {
      fetchTideData(beachSlug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTideData = useCallback(async (beachSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tools/tide-clock?beachSlug=${encodeURIComponent(beachSlug)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to load tide data");
      }
      const data: TideData = await res.json();
      setTideData(data);
      setBeachName(data.beach.name);

      // Update URL without navigation
      const params = new URLSearchParams(searchParams.toString());
      params.set("beach", beachSlug);
      router.replace(`?${params.toString()}`, { scroll: false });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tide data temporarily unavailable. Try again in a few minutes."
      );
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      if (beach.slug) {
        setBeachName(beach.name);
        fetchTideData(beach.slug);
      }
    },
    [fetchTideData]
  );

  const extremes = tideData
    ? findTideExtremes(tideData.predictions, tideData.beach.timezone)
    : [];
  const nextHigh = extremes.find((e) => e.isHigh) ?? null;
  const nextLow = extremes.find((e) => !e.isHigh) ?? null;
  const currentHeight = tideData
    ? getCurrentTideHeight(tideData.predictions)
    : null;
  const rising = tideData ? isTideRising(tideData.predictions) : null;

  const beachUrl =
    tideData?.beach.slug && tideData.beach.city && tideData.beach.state
      ? getBeachUrlSafe({
          slug: tideData.beach.slug,
          city: tideData.beach.city,
          state: tideData.beach.state,
        })
      : null;

  return (
    <div className="min-h-screen" style={{ background: "#0F1535" }}>
      {/* Header */}
      <section
        className="noise-texture border-b"
        style={{
          background:
            "linear-gradient(180deg, #1E2558 0%, #252D6B 100%)",
          borderColor: "rgba(64,76,146,0.4)",
        }}
      >
        <div className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
              Tide Clock
            </h1>
            <p className="text-[#B8C7E0] text-base sm:text-lg max-w-xl mx-auto">
              Real-time tide heights for 279+ beaches. Always free.
            </p>
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <BeachToolSearch
              onSelect={handleBeachSelect}
              placeholder="Find your beach..."
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-[#7A8CC0]">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="font-mono text-sm">Loading tide data...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="rounded-xl border p-6 text-center"
            style={{
              background: "rgba(30, 37, 88, 0.7)",
              borderColor: "rgba(64, 76, 146, 0.4)",
            }}
          >
            <p className="text-[#B8C7E0] font-mono text-sm">
              {beachName
                ? `Tide data temporarily unavailable for ${beachName}. Try again in a few minutes.`
                : error}
            </p>
          </div>
        )}

        {/* Tide display */}
        {tideData && !loading && (
          <div className="space-y-6">
            {/* Beach name + rising/falling */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-white">
                  {tideData.beach.name}
                </h2>
                {tideData.beach.city && tideData.beach.state && (
                  <p className="text-[#7A8CC0] font-mono text-sm mt-0.5">
                    {tideData.beach.city}, {tideData.beach.state}
                  </p>
                )}
              </div>
              {rising !== null && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider"
                  style={{
                    background: rising
                      ? "rgba(247, 142, 66, 0.12)"
                      : "rgba(100, 120, 200, 0.15)",
                    borderColor: rising
                      ? "rgba(247, 142, 66, 0.4)"
                      : "rgba(184, 199, 224, 0.25)",
                    color: rising ? "#F78E42" : "#B8C7E0",
                  }}
                >
                  {rising ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {rising ? "Rising" : "Falling"}
                </span>
              )}
            </div>

            {/* Main tide display: clock + stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              {/* Analog clock */}
              <div
                className="noise-texture rounded-2xl border p-6 flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                  borderColor: "rgba(64,76,146,0.5)",
                }}
              >
                <TideClock
                  predictions={tideData.predictions}
                  sunriseUtc={tideData.sunTimes?.sunrise_utc ?? null}
                  sunsetUtc={tideData.sunTimes?.sunset_utc ?? null}
                />
              </div>

              {/* Stats */}
              <div className="space-y-4">
                {/* Current height */}
                {currentHeight !== null && (
                  <div
                    className="noise-texture rounded-2xl border p-5"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
                      borderColor: "rgba(247, 142, 66, 0.35)",
                    }}
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                      Current Height
                    </p>
                    <p className="font-heading text-4xl font-bold text-white leading-none">
                      {currentHeight}
                      <span className="text-xl text-[#B8C7E0] ml-1.5">ft</span>
                    </p>
                  </div>
                )}

                {/* Next extremes */}
                <div className="grid grid-cols-2 gap-3">
                  {nextHigh && (
                    <div
                      className="noise-texture rounded-2xl border p-4 text-center"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
                        borderColor: "rgba(247, 142, 66, 0.35)",
                        transform: "rotate(-0.75deg)",
                      }}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="h-3.5 w-3.5 text-[#F78E42]" aria-hidden="true" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#7A8CC0]">
                          High
                        </span>
                      </div>
                      <p className="font-heading text-xl font-bold text-white">
                        {nextHigh.formattedTime}
                      </p>
                      <p className="font-mono text-sm text-[#B8C7E0]">
                        {nextHigh.height_ft} ft
                      </p>
                    </div>
                  )}
                  {nextLow && (
                    <div
                      className="noise-texture rounded-2xl border p-4 text-center"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(30,37,88,0.95) 100%)",
                        borderColor: "rgba(184, 199, 224, 0.2)",
                        transform: "rotate(0.75deg)",
                      }}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingDown className="h-3.5 w-3.5 text-[#B8C7E0]" aria-hidden="true" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#7A8CC0]">
                          Low
                        </span>
                      </div>
                      <p className="font-heading text-xl font-bold text-white">
                        {nextLow.formattedTime}
                      </p>
                      <p className="font-mono text-sm text-[#B8C7E0]">
                        {nextLow.height_ft} ft
                      </p>
                    </div>
                  )}
                </div>

                {/* Sun times */}
                {tideData.sunTimes?.sunrise_utc && tideData.sunTimes?.sunset_utc && (
                  <div
                    className="rounded-xl border px-4 py-3 flex items-center justify-between"
                    style={{
                      background: "rgba(247, 142, 66, 0.06)",
                      borderColor: "rgba(247, 142, 66, 0.2)",
                    }}
                  >
                    <div className="text-center">
                      <p className="font-mono text-xs text-[#7A8CC0] mb-0.5">Sunrise</p>
                      <p className="font-mono text-sm font-semibold text-[#F78E42]">
                        {formatTime(tideData.sunTimes.sunrise_utc, tideData.beach.timezone)}
                      </p>
                    </div>
                    <div className="text-[#F78E42] text-xs">—</div>
                    <div className="text-center">
                      <p className="font-mono text-xs text-[#7A8CC0] mb-0.5">Sunset</p>
                      <p className="font-mono text-sm font-semibold text-[#F78E42]">
                        {formatTime(tideData.sunTimes.sunset_utc, tideData.beach.timezone)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 24-hour tide curve */}
            <div
              className="noise-texture rounded-2xl border p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(26,33,88,0.95) 0%, rgba(15,21,53,0.98) 100%)",
                borderColor: "rgba(64,76,146,0.4)",
              }}
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-4">
                24-Hour Tide Chart
              </p>
              <TideCurveChart
                predictions={tideData.predictions}
                sunriseUtc={tideData.sunTimes?.sunrise_utc ?? null}
                sunsetUtc={tideData.sunTimes?.sunset_utc ?? null}
                timezone={tideData.beach.timezone}
              />
              <div className="flex items-center gap-4 mt-3 text-xs font-mono text-[#7A8CC0]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5 bg-[#F78E42]" />
                  Now
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5 border-t border-dashed border-[#F78E42] opacity-70" />
                  Sunrise / Sunset
                </span>
              </div>
            </div>

            {/* CTA */}
            {beachUrl && (
              <div
                className="rounded-xl border px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between"
                style={{
                  background: "rgba(37, 45, 107, 0.4)",
                  borderColor: "rgba(64, 76, 146, 0.4)",
                }}
              >
                <div>
                  <p className="font-heading font-semibold text-white text-sm">
                    Get the full picture
                  </p>
                  <p className="text-[#7A8CC0] text-xs mt-0.5">
                    Wave height, wind, crowd levels & more for {tideData.beach.name}
                  </p>
                </div>
                <Link
                  href={beachUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-mono text-sm font-semibold text-white transition-all min-w-max"
                  style={{ background: "#F78E42" }}
                >
                  View Full Forecast
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Hero empty state — popular beaches */}
        {!tideData && !loading && !error && (
          <div className="space-y-8">
            <div>
              <h2 className="font-heading text-lg font-semibold text-white mb-4">
                Popular Beaches
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {POPULAR_BEACH_SLUGS.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => {
                      setBeachName(b.name);
                      fetchTideData(b.slug);
                    }}
                    className="noise-texture rounded-xl border p-4 text-left transition-all hover:border-[rgba(247,142,66,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                    style={{
                      background: "rgba(37,45,107,0.5)",
                      borderColor: "rgba(64,76,146,0.4)",
                      minHeight: "44px",
                    }}
                  >
                    <p className="font-heading font-semibold text-white text-sm truncate">
                      {b.name}
                    </p>
                    <p className="font-mono text-xs text-[#7A8CC0] mt-0.5">
                      {b.state}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tool to Dawn Patrol cross-link */}
            <div
              className="rounded-xl border px-5 py-4"
              style={{
                background: "rgba(37, 45, 107, 0.3)",
                borderColor: "rgba(64, 76, 146, 0.35)",
              }}
            >
              <p className="font-heading text-sm font-semibold text-white mb-1">
                Planning a dawn patrol?
              </p>
              <p className="text-[#7A8CC0] text-xs mb-3">
                Check first light times, 7-day sunrise forecast, and tide at dawn.
              </p>
              <Link
                href="/tools/dawn-patrol"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-[#F78E42] hover:underline"
              >
                Dawn Patrol Calculator
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
