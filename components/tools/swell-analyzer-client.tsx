"use client";

import React, { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Waves,
  RefreshCw,
  MapPin,
  ExternalLink,
  Gauge,
  SlidersHorizontal,
} from "lucide-react";
import { ToolShareButton } from "@/components/tools/tool-share-button";
import { SwellWaveViz } from "@/components/tools/swell-wave-viz";
import { SwellCompass } from "@/components/tools/swell-compass";
import {
  getSwellAnalyzerData,
  type SwellAnalyzerData,
} from "@/actions/tools/swell-analyzer-actions";
import { ratePeriod } from "@/lib/utils/swell-period-rating";
import { degreesToCardinal } from "@/lib/utils/geo-utils";
import { analyzeSwellMatch } from "@/lib/analyzers/swell-analyzer";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import type { Beach } from "@/types/database";
import { ToolHero } from "@/components/tools/tool-hero";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";
import * as SliderPrimitive from "@radix-ui/react-slider";

const CARDINAL_DIRECTIONS = [
  { label: "N", deg: 0 },
  { label: "NE", deg: 45 },
  { label: "E", deg: 90 },
  { label: "SE", deg: 135 },
  { label: "S", deg: 180 },
  { label: "SW", deg: 225 },
  { label: "W", deg: 270 },
  { label: "NW", deg: 315 },
];

interface SwellAnalyzerClientProps {
  initialData?: SwellAnalyzerData;
  isDemo?: boolean;
}

export function SwellAnalyzerClient({
  initialData,
  isDemo = false,
}: SwellAnalyzerClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"current" | "explore">(
    initialData && !isDemo ? "current" : "explore",
  );
  const [swellHeight, setSwellHeight] = useState(
    initialData?.currentSwell?.height ?? 6,
  );
  const [swellPeriod, setSwellPeriod] = useState(
    initialData?.currentSwell?.period ?? 12,
  );
  const [swellDirection, setSwellDirection] = useState(
    initialData?.currentSwell?.direction ?? 270,
  );

  const [beachData, setBeachData] = useState<SwellAnalyzerData | null>(
    initialData ?? null,
  );
  const [beachError, setBeachError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDemoBanner, setShowDemoBanner] = useState(isDemo);

  // Values displayed depend on mode
  const displayHeight =
    mode === "current" && beachData?.currentSwell?.height != null
      ? beachData.currentSwell.height
      : swellHeight;
  const displayPeriod =
    mode === "current" && beachData?.currentSwell?.period != null
      ? beachData.currentSwell.period
      : swellPeriod;
  const displayDirection =
    mode === "current" && beachData?.currentSwell?.direction != null
      ? beachData.currentSwell.direction
      : swellDirection;

  const periodRating = ratePeriod(displayPeriod);
  const cardinal = degreesToCardinal(displayDirection);

  const periodStyle = {
    red: {
      background: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.35)",
      color: "#f87171",
    },
    yellow: {
      background: "rgba(234,179,8,0.12)",
      borderColor: "rgba(234,179,8,0.35)",
      color: "#facc15",
    },
    lime: {
      background: "rgba(132,204,22,0.12)",
      borderColor: "rgba(132,204,22,0.35)",
      color: "#a3e635",
    },
    green: {
      background: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.35)",
      color: "#4ade80",
    },
  }[periodRating.color];

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      if (!beach.slug) return;
      const slug = beach.slug;
      startTransition(async () => {
        setShowDemoBanner(false);
        setBeachError(null);
        const result = await getSwellAnalyzerData(slug);
        if (result.success && result.data) {
          setBeachData(result.data);
          setMode("current");
          router.replace(`?beach=${encodeURIComponent(slug)}`, {
            scroll: false,
          });

          if (result.data.currentSwell?.direction != null) {
            setSwellDirection(result.data.currentSwell.direction);
          }
          if (result.data.currentSwell?.period != null) {
            setSwellPeriod(result.data.currentSwell.period);
          }
          if (result.data.currentSwell?.height != null) {
            setSwellHeight(result.data.currentSwell.height);
          }
        } else {
          setBeachError(result.error ?? "Failed to load swell data");
        }
      });
    },
    [router],
  );

  // Swell window match — compute from real data in current mode, slider direction in explore
  const beachSwellMatch =
    mode === "current"
      ? (beachData?.swellMatch ?? null)
      : beachData
        ? analyzeSwellMatch(swellDirection, {
            name: beachData.beach.name,
            swellWindowMin: beachData.beach.swell_window_min_deg,
            swellWindowMax: beachData.beach.swell_window_max_deg,
          })
        : null;

  const matchStyle =
    beachSwellMatch?.status === "optimal"
      ? {
          background: "rgba(34,197,94,0.12)",
          borderColor: "rgba(34,197,94,0.35)",
          color: "#4ade80",
        }
      : beachSwellMatch?.status === "acceptable"
        ? {
            background: "rgba(234,179,8,0.12)",
            borderColor: "rgba(234,179,8,0.35)",
            color: "#facc15",
          }
        : {
            background: "rgba(239,68,68,0.12)",
            borderColor: "rgba(239,68,68,0.35)",
            color: "#f87171",
          };

  const hasCurrentSwell = beachData?.currentSwell != null;

  return (
    <>
      <ToolHero
        imageSrc={TOOL_IMAGES["swell-analyzer"]}
        imageAlt="Clean hollow wave used to visualize swell quality."
        title="Swell Quality Analyzer"
        description="Understand how swell period and direction affect wave quality — then check if your break is in the sweet spot."
        badge={
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest"
            style={{
              background: "rgba(247,142,66,0.12)",
              borderColor: "rgba(247,142,66,0.35)",
              color: "#F78E42",
            }}
          >
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Swell Science
          </div>
        }
      />

      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* === UNIFIED SECTION === */}
        <section
          className="noise-texture rounded-2xl border p-6 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
            borderColor: "rgba(64,76,146,0.4)",
          }}
        >
          {/* Search bar */}
          <div className="max-w-lg">
            <BeachSearchAutocomplete
              onSelect={handleBeachSelect}
              placeholder="Search for a beach..."
              maxResults={6}
              source="tool_swell_analyzer"
            />
          </div>

          {showDemoBanner && beachData && !isPending && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs"
              style={{
                background: "rgba(247,142,66,0.08)",
                borderLeft: "3px solid #F78E42",
                color: "#B8C7E0",
              }}
            >
              <span>
                Showing{" "}
                <strong className="text-white">{beachData.beach.name}</strong> —
                search above to check your break
              </span>
            </div>
          )}

          {beachError && (
            <p className="font-mono text-sm text-red-400">{beachError}</p>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-[#7A8CC0]">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-mono text-sm">Loading swell data...</span>
            </div>
          )}

          {/* Mode toggle — only show when beach has data */}
          {beachData && !isPending && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin
                  className="h-4 w-4 text-[#F78E42] shrink-0"
                  aria-hidden="true"
                />
                <h3 className="font-heading text-xl font-bold text-white truncate">
                  {beachData.beach.name}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Toggle */}
                <div
                  className="flex gap-1 rounded-lg p-1"
                  style={{ background: "rgba(64,76,146,0.2)" }}
                  role="group"
                  aria-label="View mode"
                >
                  <button
                    onClick={() => setMode("current")}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors min-h-[36px] focus-ring"
                    style={
                      mode === "current"
                        ? {
                            background: "rgba(247,142,66,0.15)",
                            color: "#F78E42",
                          }
                        : { color: "#7A8CC0" }
                    }
                    aria-pressed={mode === "current"}
                    disabled={!hasCurrentSwell}
                  >
                    <Waves className="h-3.5 w-3.5" aria-hidden="true" />
                    Current
                  </button>
                  <button
                    onClick={() => setMode("explore")}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors min-h-[36px] focus-ring"
                    style={
                      mode === "explore"
                        ? {
                            background: "rgba(247,142,66,0.15)",
                            color: "#F78E42",
                          }
                        : { color: "#7A8CC0" }
                    }
                    aria-pressed={mode === "explore"}
                  >
                    <SlidersHorizontal
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Explore
                  </button>
                </div>

                <ToolShareButton
                  toolName="Swell Quality Analyzer"
                  beachName={beachData.beach.name}
                  shareText={
                    beachSwellMatch
                      ? `Swell is ${{ optimal: "firing", acceptable: "workable", poor: "poor" }[beachSwellMatch.status] ?? beachSwellMatch.status} at ${beachData.beach.name} right now`
                      : undefined
                  }
                />
              </div>
            </div>
          )}

          {/* === CONTENT AREA === */}
          {!isPending && (beachData || mode === "explore") && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Left: Compass */}
                <div
                  className="noise-texture rounded-2xl border flex items-center justify-center p-4 w-full md:w-auto shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(26,33,88,0.95) 0%, rgba(15,21,53,0.98) 100%)",
                    borderColor: "rgba(64,76,146,0.5)",
                  }}
                >
                  <SwellCompass
                    swellDirectionDeg={displayDirection}
                    windowMinDeg={beachData?.beach.swell_window_min_deg ?? null}
                    windowMaxDeg={beachData?.beach.swell_window_max_deg ?? null}
                    swellCardinal={cardinal}
                    size={280}
                  />
                </div>

                {/* Right: Mode-dependent content */}
                <div className="flex-1 space-y-3 w-full">
                  {mode === "current" && beachData?.currentSwell ? (
                    <>
                      {/* Stats grid */}
                      <div
                        className="grid grid-cols-3 divide-x"
                        style={
                          {
                            "--tw-divide-color": "rgba(64,76,146,0.3)",
                          } as React.CSSProperties
                        }
                      >
                        <div className="p-3 text-center">
                          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                            Height
                          </p>
                          <p className="font-heading text-2xl font-bold text-white leading-none">
                            {beachData.currentSwell.height != null
                              ? beachData.currentSwell.height.toFixed(1)
                              : "—"}
                          </p>
                          <p className="font-mono text-xs text-[#7A8CC0]">ft</p>
                        </div>
                        <div className="p-3 text-center">
                          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                            Period
                          </p>
                          <p className="font-heading text-2xl font-bold text-white leading-none">
                            {beachData.currentSwell.period ?? "—"}
                          </p>
                          <p className="font-mono text-xs text-[#7A8CC0]">
                            sec
                          </p>
                        </div>
                        <div className="p-3 text-center">
                          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                            Dir
                          </p>
                          <p className="font-heading text-2xl font-bold text-white leading-none">
                            {beachData.currentSwell.cardinal ?? "—"}
                          </p>
                          <p className="font-mono text-xs text-[#7A8CC0]">
                            {beachData.currentSwell.direction != null
                              ? `${Math.round(beachData.currentSwell.direction)}°`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : mode === "current" && !hasCurrentSwell && beachData ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[#7A8CC0]">
                        No current forecast data available. Switch to Explore to
                        analyze hypothetical swells.
                      </p>
                    </div>
                  ) : (
                    /* Explore mode: sliders */
                    <div className="space-y-4">
                      {/* Height slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                            Swell height
                          </span>
                          <span className="font-mono text-sm font-bold text-white">
                            {swellHeight} ft
                          </span>
                        </div>
                        <SliderPrimitive.Root
                          className="relative flex w-full touch-none select-none items-center"
                          min={1}
                          max={20}
                          step={0.5}
                          value={[swellHeight]}
                          onValueChange={([val]) => setSwellHeight(val)}
                          aria-label="Swell height"
                        >
                          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[#404C92]/40">
                            <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#F78E42]" />
                          </SliderPrimitive.Track>
                          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[#F78E42] bg-[#0F1535] shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 motion-safe:active:scale-110" />
                        </SliderPrimitive.Root>
                        <div className="flex justify-between font-mono text-xs text-[#404C92] mt-0.5">
                          <span>1 ft</span>
                          <span>20 ft</span>
                        </div>
                      </div>

                      {/* Period slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                            Swell period
                          </span>
                          <span className="font-mono text-sm font-bold text-white">
                            {swellPeriod}s
                          </span>
                        </div>
                        <SliderPrimitive.Root
                          className="relative flex w-full touch-none select-none items-center"
                          min={4}
                          max={22}
                          step={1}
                          value={[swellPeriod]}
                          onValueChange={([val]) => setSwellPeriod(val)}
                          aria-label="Swell period"
                        >
                          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[#404C92]/40">
                            <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#F78E42]" />
                          </SliderPrimitive.Track>
                          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[#F78E42] bg-[#0F1535] shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 motion-safe:active:scale-110" />
                        </SliderPrimitive.Root>
                        <div className="flex justify-between font-mono text-xs text-[#404C92] mt-0.5">
                          <span>4s</span>
                          <span>22s</span>
                        </div>
                      </div>

                      {/* Direction buttons */}
                      <div>
                        <div className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-2">
                          Direction —{" "}
                          <span className="text-white">
                            {cardinal} ({swellDirection}°)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {CARDINAL_DIRECTIONS.map(({ label, deg }) => (
                            <button
                              key={label}
                              onClick={() => setSwellDirection(deg)}
                              className="min-h-[44px] min-w-[44px] rounded-xl border font-mono text-sm font-semibold transition-colors focus-ring"
                              style={
                                swellDirection === deg
                                  ? {
                                      background: "#F78E42",
                                      borderColor: "#F78E42",
                                      color: "#0F1535",
                                    }
                                  : {
                                      background: "rgba(64,76,146,0.25)",
                                      borderColor: "rgba(64,76,146,0.5)",
                                      color: "#B8C7E0",
                                    }
                              }
                              aria-pressed={swellDirection === deg}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Period quality badge — shared across modes */}
              <div
                className="noise-texture rounded-2xl border px-4 py-3 flex items-start justify-between gap-3"
                style={periodStyle}
              >
                <div>
                  <div className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                    Period quality
                  </div>
                  <div className="font-heading text-base font-bold">
                    {periodRating.label}
                  </div>
                  <div className="text-sm opacity-80 mt-0.5">
                    {periodRating.description}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-heading text-3xl font-bold">
                    {displayPeriod}s
                  </div>
                  <div className="font-mono text-xs opacity-70">period</div>
                </div>
              </div>

              {/* Swell window match — shared across modes */}
              {beachSwellMatch && (
                <div
                  className="px-3 py-2.5"
                  style={{
                    borderLeft: `3px solid ${matchStyle.color}`,
                    color: matchStyle.color,
                  }}
                >
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                    Swell window match
                  </p>
                  <p className="text-sm font-medium leading-snug">
                    {beachSwellMatch.message}
                  </p>
                </div>
              )}

              {/* Wave visualization — full width, prominent */}
              <div className="rounded-xl overflow-hidden">
                <SwellWaveViz
                  heightFt={displayHeight}
                  periodSeconds={displayPeriod}
                  qualityColor={periodRating.color}
                />
              </div>

              {/* Swell period explainer */}
              <p className="font-mono text-xs text-[#404C92] leading-relaxed">
                <strong className="text-[#7A8CC0]">Swell period</strong> is the
                time between wave crests. Longer periods mean the swell traveled
                farther — those waves carry more energy and break more cleanly
                than short-period wind chop.
              </p>

              {/* Full forecast link */}
              {beachData?.beach.slug && (
                <Link
                  href={`/beach/${beachData.beach.slug}`}
                  className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold hover:underline"
                  style={{ color: "#F78E42" }}
                >
                  Full 7-day forecast for {beachData.beach.name}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
