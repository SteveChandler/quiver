"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wind, RefreshCw, MapPin, ExternalLink } from "lucide-react";
import { WindCompass } from "@/components/tools/wind-compass";
import {
  getWindCheckerData,
  type WindCheckerData,
} from "@/actions/tools/wind-checker-actions";
import { classifyWindQuality } from "@/lib/utils/wind-quality";
import { degreesToCardinal } from "@/lib/utils/geo-utils";
import type { Beach } from "@/types/database";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { ToolHero } from "@/components/tools/tool-hero";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";

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

interface WindCheckerClientProps {
  initialData?: WindCheckerData;
  initialBeachSlug?: string;
}

export function WindCheckerClient({
  initialData,
  initialBeachSlug: _initialBeachSlug,
}: WindCheckerClientProps) {
  const router = useRouter();
  const [data, setData] = useState<WindCheckerData | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadBeach = useCallback((slug: string) => {
    startTransition(async () => {
      setError(null);
      const result = await getWindCheckerData(slug);
      if (result.success && result.data) {
        setData(result.data);
        router.replace(`?beach=${encodeURIComponent(slug)}`, { scroll: false });
      } else {
        setError(result.error ?? "Failed to load wind data");
      }
    });
  }, [router]);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      if (beach.slug) loadBeach(beach.slug);
    },
    [loadBeach]
  );

  const currentWind = data?.wind[0] ?? null;
  const beach = data?.beach ?? null;

  const windDir = currentWind?.wind_direction_deg ?? 0;
  const windSpeed = currentWind?.wind_speed_mph ?? 0;
  const windCardinal = windDir != null ? degreesToCardinal(windDir) : "—";

  const offshoreQuality =
    beach?.wind_offshore_deg != null &&
    beach?.wind_offshore_tol_deg != null &&
    currentWind?.wind_direction_deg != null
      ? classifyWindQuality(
          currentWind.wind_direction_deg,
          beach.wind_offshore_deg,
          beach.wind_offshore_tol_deg
        )
      : null;

  const verdictStyle =
    offshoreQuality?.color === "green"
      ? {
          background: "rgba(34,197,94,0.12)",
          borderColor: "rgba(34,197,94,0.35)",
          color: "#4ade80",
        }
      : offshoreQuality?.color === "yellow"
        ? {
            background: "rgba(234,179,8,0.12)",
            borderColor: "rgba(234,179,8,0.35)",
            color: "#facc15",
          }
        : offshoreQuality?.color === "red"
          ? {
              background: "rgba(239,68,68,0.12)",
              borderColor: "rgba(239,68,68,0.35)",
              color: "#f87171",
            }
          : {
              background: "rgba(122,140,192,0.12)",
              borderColor: "rgba(122,140,192,0.25)",
              color: "#B8C7E0",
            };

  return (
    <>
      <ToolHero
        imageSrc={TOOL_IMAGES["wind-checker"]}
        title="Offshore Wind Checker"
        description="Is the wind offshore at your break? Check in one tap."
        badge={
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest"
            style={{
              background: "rgba(247,142,66,0.12)",
              borderColor: "rgba(247,142,66,0.35)",
              color: "#F78E42",
            }}
          >
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            Live Wind
          </div>
        }
      >
        <div className="max-w-md mx-auto">
          <BeachSearchAutocomplete
            onSelect={handleBeachSelect}
            placeholder="Search for a beach..."
            maxResults={6}
          />
        </div>
      </ToolHero>

      {/* Body */}
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Loading */}
        {isPending && (
          <div className="flex items-center justify-center py-20 gap-3 text-[#7A8CC0]">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="font-mono text-sm">Loading wind data...</span>
          </div>
        )}

        {/* Error */}
        {error && !isPending && (
          <div
            className="rounded-xl border p-6 text-center"
            style={{
              background: "rgba(30,37,88,0.7)",
              borderColor: "rgba(64,76,146,0.4)",
            }}
          >
            <p className="text-[#B8C7E0] font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Empty state — popular beaches */}
        {!data && !isPending && !error && (
          <div className="space-y-8">
            <div>
              <h2 className="font-heading text-lg font-semibold text-white mb-4">
                Popular Beaches
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {POPULAR_BEACH_SLUGS.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => loadBeach(b.slug)}
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
              <p className="font-mono text-xs text-[#404C92] mt-3 text-center">
                48-hour forecast · updated hourly
              </p>
            </div>

            <div
              className="rounded-xl border px-5 py-4"
              style={{
                background: "rgba(37, 45, 107, 0.3)",
                borderColor: "rgba(64, 76, 146, 0.35)",
              }}
            >
              <p className="font-heading text-sm font-semibold text-white mb-1">
                Check live tides
              </p>
              <p className="text-xs text-[#7A8CC0] mb-2">
                Real-time tide height and 24-hour chart for this beach
              </p>
              <Link
                href="/tools/tide-clock"
                className="font-mono text-xs font-semibold hover:underline"
                style={{ color: "#F78E42" }}
              >
                Tide Clock &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Wind display */}
        {data && beach && currentWind && !isPending && (
          <div className="space-y-5">
            {/* Beach name */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-[#F78E42] shrink-0" aria-hidden="true" />
                <h2 className="font-heading text-2xl font-bold text-white truncate">
                  {beach.name}
                </h2>
              </div>
              {beach.slug && (
                <Link
                  href={`/beach/${beach.slug}`}
                  className="flex items-center gap-1 font-mono text-xs shrink-0 hover:underline"
                  style={{ color: "#F78E42" }}
                >
                  Full forecast <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* Compass + stats */}
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div
                className="noise-texture rounded-2xl border flex items-center justify-center p-5 w-full md:w-auto"
                style={{
                  background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                  borderColor: "rgba(64,76,146,0.5)",
                }}
              >
                <WindCompass
                  windDirectionDeg={windDir}
                  windSpeedMph={windSpeed}
                  offshoreDeg={beach.wind_offshore_deg}
                  toleranceDeg={beach.wind_offshore_tol_deg}
                  windCardinal={windCardinal}
                  size={280}
                />
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="noise-texture rounded-2xl border p-4"
                    style={{
                      background: "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
                      borderColor: "rgba(64,76,146,0.5)",
                    }}
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                      Speed
                    </p>
                    <p className="font-heading text-3xl font-bold text-white leading-none">
                      {windSpeed != null ? Math.round(windSpeed) : "—"}
                      <span className="text-base text-[#B8C7E0] ml-1">mph</span>
                    </p>
                  </div>
                  <div
                    className="noise-texture rounded-2xl border p-4"
                    style={{
                      background: "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
                      borderColor: "rgba(64,76,146,0.5)",
                    }}
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                      Direction
                    </p>
                    <p className="font-heading text-3xl font-bold text-white leading-none">
                      {windCardinal}
                      <span className="text-base text-[#B8C7E0] ml-1">
                        {windDir != null ? `${Math.round(windDir)}°` : ""}
                      </span>
                    </p>
                  </div>
                  {currentWind.wind_gust_mph != null && (
                    <div
                      className="noise-texture rounded-2xl border p-4 col-span-2"
                      style={{
                        background: "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
                        borderColor: "rgba(64,76,146,0.5)",
                      }}
                    >
                      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                        Gusts
                      </p>
                      <p className="font-heading text-2xl font-bold text-white leading-none">
                        {Math.round(currentWind.wind_gust_mph)}
                        <span className="text-base text-[#B8C7E0] ml-1">mph</span>
                      </p>
                    </div>
                  )}
                </div>

                {offshoreQuality ? (
                  <div
                    className="noise-texture rounded-2xl border px-4 py-3"
                    style={verdictStyle}
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                      Wind quality
                    </p>
                    <p className="text-sm font-medium leading-snug">
                      {offshoreQuality.verdict} at {Math.round(windSpeed)} mph
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border px-4 py-3 flex items-start gap-2"
                    style={{
                      background: "rgba(122,140,192,0.08)",
                      borderColor: "rgba(122,140,192,0.2)",
                    }}
                  >
                    <Wind className="h-4 w-4 mt-0.5 shrink-0 text-[#7A8CC0]" aria-hidden="true" />
                    <p className="text-sm text-[#B8C7E0]">
                      Wind is {Math.round(windSpeed)} mph from the {windCardinal}.
                      We don&apos;t have shore orientation data for this beach yet.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {data.wind.length > 1 && (
              <WindTimeline
                wind={data.wind}
                offshoreDeg={beach.wind_offshore_deg}
                toleranceDeg={beach.wind_offshore_tol_deg}
              />
            )}

            {data.hasOrientationData && (
              <div className="flex flex-wrap gap-4 font-mono text-xs text-[#7A8CC0]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/30 border border-green-500/60 inline-block" />
                  Offshore — clean
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/30 border border-yellow-500/60 inline-block" />
                  Cross-shore — some chop
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/30 border border-red-500/60 inline-block" />
                  Onshore — choppy
                </div>
              </div>
            )}

            {beach.slug && (
              <div
                className="noise-texture rounded-2xl border p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                  borderColor: "rgba(247,142,66,0.25)",
                }}
              >
                <p className="text-[#B8C7E0] text-sm mb-3">
                  Wind is just one piece. Get the full picture — waves, tides, crowd
                  levels, and more.
                </p>
                <Link
                  href={`/beach/${beach.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90 min-h-[44px]"
                  style={{ background: "#F78E42", color: "#0F1535" }}
                >
                  Full forecast for {beach.name}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}

interface WindTimelineProps {
  wind: WindCheckerData["wind"];
  offshoreDeg: number | null;
  toleranceDeg: number | null;
}

function WindTimeline({ wind, offshoreDeg, toleranceDeg }: WindTimelineProps) {
  const hours = wind.slice(0, 24);

  const barColor = (dir: number | null, speed: number | null): string => {
    if (dir == null || speed == null) return "bg-[#2A3070]";
    if (offshoreDeg == null || toleranceDeg == null) return "bg-[#404C92]";
    const quality = classifyWindQuality(dir, offshoreDeg, toleranceDeg);
    if (quality.color === "green") return "bg-green-500";
    if (quality.color === "yellow") return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatHour = (ts: string) => {
    const h = new Date(ts).getUTCHours();
    if (h === 0) return "12a";
    if (h === 12) return "12p";
    return h < 12 ? `${h}a` : `${h - 12}p`;
  };

  const bestWindows: string[] = [];
  let inGoodWindow = false;
  let windowStart = "";
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    const isGood =
      h.wind_direction_deg != null &&
      h.wind_speed_mph != null &&
      offshoreDeg != null &&
      toleranceDeg != null &&
      classifyWindQuality(h.wind_direction_deg, offshoreDeg, toleranceDeg).color === "green";

    if (isGood && !inGoodWindow) {
      inGoodWindow = true;
      windowStart = formatHour(h.ts);
    } else if (!isGood && inGoodWindow) {
      inGoodWindow = false;
      bestWindows.push(`${windowStart}–${formatHour(hours[i].ts)}`);
      if (bestWindows.length >= 2) break;
    }
  }
  if (inGoodWindow && hours.length > 0) {
    bestWindows.push(`${windowStart}–${formatHour(hours[hours.length - 1].ts)}`);
  }

  return (
    <div
      className="noise-texture rounded-2xl border p-5"
      style={{
        background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
        borderColor: "rgba(64,76,146,0.4)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
          24-Hour Wind Forecast
        </h3>
        {bestWindows.length > 0 && offshoreDeg != null && (
          <span className="font-mono text-xs font-semibold" style={{ color: "#4ade80" }}>
            Best: {bestWindows.join(", ")}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-0.5 min-w-max pb-1">
          {hours.map((h, i) => {
            const maxBarH = 40;
            const speed = h.wind_speed_mph ?? 0;
            const barH = Math.max(4, Math.min(maxBarH, (speed / 30) * maxBarH));
            const color = barColor(h.wind_direction_deg, h.wind_speed_mph);
            const label = formatHour(h.ts);
            const showLabel = i % 3 === 0;

            return (
              <div key={h.ts} className="flex flex-col items-center gap-0.5 w-8">
                <div
                  className="flex flex-col justify-end"
                  style={{ height: maxBarH }}
                  title={`${label}: ${Math.round(speed)} mph from ${h.wind_direction_deg != null ? degreesToCardinal(h.wind_direction_deg) : "?"}`}
                >
                  <div
                    className={`w-full rounded-sm opacity-80 ${color}`}
                    style={{ height: barH }}
                  />
                </div>
                {showLabel && (
                  <span className="font-mono text-[9px] text-[#404C92] leading-none">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

