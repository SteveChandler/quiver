"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Waves, RefreshCw, MapPin, ExternalLink, Gauge } from "lucide-react";
import { SwellWaveViz } from "@/components/tools/swell-wave-viz";
import { SwellCompass } from "@/components/tools/swell-compass";
import {
  getSwellAnalyzerData,
  type SwellAnalyzerData,
} from "@/actions/tools/swell-analyzer-actions";
import { ratePeriod } from "@/lib/utils/swell-period-rating";
import { degreesToCardinal } from "@/lib/utils/geo-utils";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import type { Beach } from "@/types/database";
import { ToolHero } from "@/components/tools/tool-hero";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";

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
}

export function SwellAnalyzerClient({ initialData }: SwellAnalyzerClientProps) {
  const router = useRouter();
  const [swellHeight, setSwellHeight] = useState(6);
  const [swellPeriod, setSwellPeriod] = useState(12);
  const [swellDirection, setSwellDirection] = useState(270);

  const [beachData, setBeachData] = useState<SwellAnalyzerData | null>(
    initialData ?? null
  );
  const [beachError, setBeachError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const periodRating = ratePeriod(swellPeriod);
  const cardinal = degreesToCardinal(swellDirection);

  // Dark-theme verdict colors keyed to period quality
  const periodStyle = {
    red: { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#f87171" },
    yellow: { background: "rgba(234,179,8,0.12)", borderColor: "rgba(234,179,8,0.35)", color: "#facc15" },
    lime: { background: "rgba(132,204,22,0.12)", borderColor: "rgba(132,204,22,0.35)", color: "#a3e635" },
    green: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)", color: "#4ade80" },
  }[periodRating.color];

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      if (!beach.slug) return;
      const slug = beach.slug;
      startTransition(async () => {
        setBeachError(null);
        const result = await getSwellAnalyzerData(slug);
        if (result.success && result.data) {
          setBeachData(result.data);
          router.replace(`?beach=${encodeURIComponent(slug)}`, { scroll: false });

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
    [router]
  );

  const beachSwellMatch = beachData?.swellMatch ?? null;
  const matchStyle =
    beachSwellMatch?.status === "optimal"
      ? { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)", color: "#4ade80" }
      : beachSwellMatch?.status === "acceptable"
        ? { background: "rgba(234,179,8,0.12)", borderColor: "rgba(234,179,8,0.35)", color: "#facc15" }
        : { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#f87171" };

  const cardStyle = {
    background: "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)",
    borderColor: "rgba(64,76,146,0.5)",
  };

  return (
    <>
      <ToolHero
        imageSrc={TOOL_IMAGES["swell-analyzer"]}
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

        {/* === INTERACTIVE SWELL EXPLAINER === */}
        <section
          className="noise-texture rounded-2xl border p-6 space-y-5"
          style={{
            background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
            borderColor: "rgba(64,76,146,0.4)",
          }}
        >
          <h2 className="font-heading text-lg font-bold text-white">
            Explore swell quality
          </h2>
          <p className="text-sm text-[#7A8CC0]">
            Adjust the sliders to see how swell height, period, and direction affect wave quality.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Height slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="swell-height" className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                  Swell height
                </label>
                <span className="font-mono text-sm font-bold text-white">{swellHeight} ft</span>
              </div>
              <input
                id="swell-height"
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={swellHeight}
                onChange={(e) => setSwellHeight(Number(e.target.value))}
                className="w-full h-2 cursor-pointer accent-[#F78E42]"
              />
              <div className="flex justify-between font-mono text-xs text-[#404C92] mt-0.5">
                <span>1 ft</span>
                <span>20 ft</span>
              </div>
            </div>

            {/* Period slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="swell-period" className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                  Swell period
                </label>
                <span className="font-mono text-sm font-bold text-white">{swellPeriod}s</span>
              </div>
              <input
                id="swell-period"
                type="range"
                min={4}
                max={22}
                step={1}
                value={swellPeriod}
                onChange={(e) => setSwellPeriod(Number(e.target.value))}
                className="w-full h-2 cursor-pointer accent-[#F78E42]"
              />
              <div className="flex justify-between font-mono text-xs text-[#404C92] mt-0.5">
                <span>4s</span>
                <span>22s</span>
              </div>
            </div>
          </div>

          {/* Direction buttons */}
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-2">
              Direction —{" "}
              <span className="text-white">{cardinal} ({swellDirection}°)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CARDINAL_DIRECTIONS.map(({ label, deg }) => (
                <button
                  key={label}
                  onClick={() => setSwellDirection(deg)}
                  className="min-h-[44px] min-w-[44px] rounded-xl border font-mono text-sm font-semibold transition-colors"
                  style={
                    swellDirection === deg
                      ? { background: "#F78E42", borderColor: "#F78E42", color: "#0F1535" }
                      : { background: "rgba(64,76,146,0.25)", borderColor: "rgba(64,76,146,0.5)", color: "#B8C7E0" }
                  }
                  aria-pressed={swellDirection === deg}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality badge */}
          <div
            className="noise-texture rounded-2xl border px-4 py-3 flex items-start justify-between gap-3"
            style={periodStyle}
          >
            <div>
              <div className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                Period quality
              </div>
              <div className="font-heading text-base font-bold">{periodRating.label}</div>
              <div className="text-sm opacity-80 mt-0.5">{periodRating.description}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-heading text-3xl font-bold">{swellPeriod}s</div>
              <div className="font-mono text-xs opacity-70">period</div>
            </div>
          </div>

          {/* Wave visualization */}
          <div className="rounded-xl overflow-hidden">
            <SwellWaveViz
              heightFt={swellHeight}
              periodSeconds={swellPeriod}
              qualityColor={periodRating.color}
              width={640}
              height={130}
            />
          </div>

          <p className="font-mono text-xs text-[#404C92] leading-relaxed">
            <strong className="text-[#7A8CC0]">Swell period</strong> is the time between
            wave crests. Longer periods mean the swell traveled farther — those waves carry
            more energy and break more cleanly than short-period wind chop.
          </p>
        </section>

        {/* === CHECK YOUR BEACH === */}
        <section
          className="noise-texture rounded-2xl border p-6 space-y-5"
          style={{
            background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
            borderColor: "rgba(64,76,146,0.4)",
          }}
        >
          <div>
            <h2 className="font-heading text-lg font-bold text-white mb-1">
              Check your beach
            </h2>
            <p className="text-sm text-[#7A8CC0]">
              Search a beach to see the current swell and whether it&apos;s in the sweet spot.
            </p>
          </div>

          <div className="max-w-lg">
            <BeachSearchAutocomplete
              onSelect={handleBeachSelect}
              placeholder="Search for a beach..."
              maxResults={6}
            />
          </div>

          {beachError && (
            <p className="font-mono text-sm text-red-400">{beachError}</p>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-[#7A8CC0]">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-mono text-sm">Loading swell data...</span>
            </div>
          )}

          {beachData && !isPending && (
            <div className="space-y-5">
              {/* Beach name */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-[#F78E42] shrink-0" aria-hidden="true" />
                  <h3 className="font-heading text-xl font-bold text-white truncate">
                    {beachData.beach.name}
                  </h3>
                </div>
                {beachData.beach.slug && (
                  <Link
                    href={`/beach/${beachData.beach.slug}`}
                    className="flex items-center gap-1 font-mono text-xs shrink-0 hover:underline"
                    style={{ color: "#F78E42" }}
                  >
                    Full forecast <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Swell compass */}
                <div
                  className="noise-texture rounded-2xl border flex items-center justify-center p-4 w-full md:w-auto shrink-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(26,33,88,0.95) 0%, rgba(15,21,53,0.98) 100%)",
                    borderColor: "rgba(64,76,146,0.5)",
                  }}
                >
                  <SwellCompass
                    swellDirectionDeg={
                      beachData.currentSwell?.direction ?? swellDirection
                    }
                    windowMinDeg={beachData.beach.swell_window_min_deg}
                    windowMaxDeg={beachData.beach.swell_window_max_deg}
                    swellCardinal={
                      beachData.currentSwell?.cardinal ??
                      degreesToCardinal(swellDirection)
                    }
                    size={220}
                  />
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-3 w-full">
                  {beachData.currentSwell ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div
                          className="noise-texture rounded-2xl border p-3 text-center"
                          style={cardStyle}
                        >
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
                        <div
                          className="noise-texture rounded-2xl border p-3 text-center"
                          style={cardStyle}
                        >
                          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0] mb-1">
                            Period
                          </p>
                          <p className="font-heading text-2xl font-bold text-white leading-none">
                            {beachData.currentSwell.period ?? "—"}
                          </p>
                          <p className="font-mono text-xs text-[#7A8CC0]">sec</p>
                        </div>
                        <div
                          className="noise-texture rounded-2xl border p-3 text-center"
                          style={cardStyle}
                        >
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

                      {/* Period quality for actual swell */}
                      {beachData.currentSwell.period != null && (
                        <div
                          className="rounded-2xl border px-3 py-2"
                          style={
                            {
                              red: { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#f87171" },
                              yellow: { background: "rgba(234,179,8,0.12)", borderColor: "rgba(234,179,8,0.35)", color: "#facc15" },
                              lime: { background: "rgba(132,204,22,0.12)", borderColor: "rgba(132,204,22,0.35)", color: "#a3e635" },
                              green: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)", color: "#4ade80" },
                            }[ratePeriod(beachData.currentSwell.period).color]
                          }
                        >
                          <span className="font-mono text-xs font-semibold">
                            {ratePeriod(beachData.currentSwell.period).label}
                          </span>
                          {" — "}
                          <span className="text-xs">
                            {ratePeriod(beachData.currentSwell.period).description}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[#7A8CC0]">
                      No current forecast data available for this beach.
                    </p>
                  )}

                  {/* Swell window match */}
                  {beachSwellMatch && (
                    <div
                      className="noise-texture rounded-2xl border px-3 py-2.5"
                      style={matchStyle}
                    >
                      <p className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                        Swell window match
                      </p>
                      <p className="text-sm font-medium leading-snug">
                        {beachSwellMatch.message}
                      </p>
                    </div>
                  )}

                  {beachData.beach.swell_window_min_deg != null &&
                    beachData.beach.swell_window_max_deg != null && (
                      <p className="font-mono text-xs text-[#404C92]">
                        Optimal window:{" "}
                        <span className="text-[#7A8CC0]">
                          {degreesToCardinal(beachData.beach.swell_window_min_deg)} (
                          {Math.round(beachData.beach.swell_window_min_deg)}°) –{" "}
                          {degreesToCardinal(beachData.beach.swell_window_max_deg)} (
                          {Math.round(beachData.beach.swell_window_max_deg)}°)
                        </span>
                      </p>
                    )}
                </div>
              </div>

              {/* Window legend */}
              {beachData.beach.swell_window_min_deg != null && (
                <div className="flex flex-wrap gap-4 font-mono text-xs text-[#7A8CC0]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/30 border border-green-500/60 inline-block" />
                    Optimal swell window
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
                    In window — ideal
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                    Outside window
                  </div>
                </div>
              )}

              {/* CTA */}
              {beachData.beach.slug && (
                <div
                  className="noise-texture rounded-2xl border p-5"
                  style={{
                    background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                    borderColor: "rgba(247,142,66,0.25)",
                  }}
                >
                  <p className="text-[#B8C7E0] text-sm mb-3">
                    See the full 7-day swell forecast, tides, and crowd levels for{" "}
                    {beachData.beach.name}.
                  </p>
                  <Link
                    href={`/beach/${beachData.beach.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90 min-h-[44px]"
                    style={{ background: "#F78E42", color: "#0F1535" }}
                  >
                    Full forecast
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!beachData && !isPending && !beachError && (
            <div className="rounded-2xl border border-dashed p-10 text-center"
              style={{ borderColor: "rgba(64,76,146,0.4)" }}
            >
              <Waves className="h-10 w-10 mx-auto mb-3 text-[#2A3070]" />
              <p className="text-[#7A8CC0] font-mono text-sm">
                Search for a beach to check if the current swell is in the sweet spot.
              </p>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
