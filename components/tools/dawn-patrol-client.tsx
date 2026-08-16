"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, RefreshCw, Sun, Moon, Sunrise } from "lucide-react";
import { ToolShareButton } from "@/components/tools/tool-share-button";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { ToolHero } from "@/components/tools/tool-hero";
import { TOOL_IMAGES } from "@/lib/constants/tool-images";
import type { Beach } from "@/types/database";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";

interface DawnPatrolDay {
  date: string;
  civilTwilight: string | null;
  sunrise: string | null;
  sunset: string | null;
  goldenHour: string | null;
}

interface TidePrediction {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
}

interface DawnPatrolData {
  beach: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    timezone: string | null;
  };
  stationId: string | null;
  days: DawnPatrolDay[];
  tidePredictions: TidePrediction[];
}

function mToFt(m: number): number {
  return m * 3.28084;
}

function formatTime(iso: string | null, timezone: string | null): string {
  if (!iso) return "—";
  const tz = timezone || "America/Los_Angeles";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}

function formatDate(dateStr: string, timezone: string | null): string {
  const tz = timezone || "America/Los_Angeles";
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

function isToday(dateStr: string, timezone: string | null): boolean {
  const tz = timezone || "America/Los_Angeles";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  return today === dateStr;
}

/** Find the tide state at a given moment from hourly predictions */
function getTideAtTime(
  predictions: TidePrediction[],
  isoTime: string | null,
): { height_ft: number; isRising: boolean } | null {
  if (!isoTime || predictions.length < 2) return null;
  const targetMs = new Date(isoTime).getTime();

  for (let i = 0; i < predictions.length - 1; i++) {
    const t1 = new Date(predictions[i].ts).getTime();
    const t2 = new Date(predictions[i + 1].ts).getTime();
    if (targetMs >= t1 && targetMs <= t2) {
      const frac = (targetMs - t1) / (t2 - t1);
      const h =
        predictions[i].tide_height_m +
        frac *
          (predictions[i + 1].tide_height_m - predictions[i].tide_height_m);
      return {
        height_ft: Math.round(mToFt(h) * 10) / 10,
        isRising:
          predictions[i + 1].tide_height_m > predictions[i].tide_height_m,
      };
    }
  }
  return null;
}

/** Simple verdict: based on tide at dawn */
function getDawnVerdict(
  tideAtDawn: { height_ft: number; isRising: boolean } | null,
): { emoji: string; label: string; color: string } {
  if (!tideAtDawn) {
    return { emoji: "→", label: "Check conditions", color: "#7A8CC0" };
  }
  // Very high tide at dawn = not ideal for most breaks
  if (tideAtDawn.height_ft > 4.5) {
    return { emoji: "↓", label: "High tide at dawn", color: "#B8C7E0" };
  }
  // Rising tide at moderate height = good
  if (
    tideAtDawn.isRising &&
    tideAtDawn.height_ft >= 1.5 &&
    tideAtDawn.height_ft <= 4
  ) {
    return { emoji: "✓", label: "Good tide", color: "#4CAF8A" };
  }
  // Low tide at dawn = potentially good for reef breaks
  if (tideAtDawn.height_ft < 1.5) {
    return { emoji: "→", label: "Low tide at dawn", color: "#F78E42" };
  }
  return { emoji: "→", label: "Moderate tide", color: "#B8C7E0" };
}

// ---------------------------------------------------------------------------
// Timeline visualization for today
// ---------------------------------------------------------------------------

function DayTimeline({
  day,
  timezone,
}: {
  day: DawnPatrolDay;
  timezone: string | null;
}) {
  const tz = timezone || "America/Los_Angeles";

  if (!day.civilTwilight && !day.sunrise) return null;

  // Build time markers
  const markers: { iso: string; label: string; color: string; icon: string }[] =
    [];

  if (day.civilTwilight) {
    markers.push({
      iso: day.civilTwilight,
      label: "First light",
      color: "#6B7FD4",
      icon: "◑",
    });
  }
  if (day.sunrise) {
    markers.push({
      iso: day.sunrise,
      label: "Sunrise",
      color: "#F78E42",
      icon: "☀",
    });
  }
  if (day.goldenHour) {
    markers.push({
      iso: day.goldenHour,
      label: "Golden hour",
      color: "#FFB347",
      icon: "✦",
    });
  }
  if (day.sunset) {
    markers.push({
      iso: day.sunset,
      label: "Sunset",
      color: "#E06B3E",
      icon: "◐",
    });
  }

  // Timeline spans from 4:30 AM to 8:30 PM local time
  const startHour = 4.5;
  const endHour = 20.5;
  const spanHours = endHour - startHour;

  const getLocalHour = (iso: string): number => {
    const d = new Date(iso);
    const localStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    const parts = localStr.split(":");
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
  };

  const xPct = (iso: string): number => {
    const h = getLocalHour(iso);
    return Math.max(0, Math.min(100, ((h - startHour) / spanHours) * 100));
  };

  // Daylight span
  const sunriseX = day.sunrise ? xPct(day.sunrise) : null;
  const sunsetX = day.sunset ? xPct(day.sunset) : null;

  return (
    <div className="relative pt-10 pb-6">
      {/* Track */}
      <div
        className="relative h-3 rounded-full overflow-visible"
        style={{ background: "rgba(26, 33, 88, 0.8)" }}
      >
        {/* Daylight span */}
        {sunriseX !== null && sunsetX !== null && (
          <div
            className="absolute top-0 h-full rounded-full opacity-30"
            style={{
              left: `${sunriseX}%`,
              width: `${sunsetX - sunriseX}%`,
              background: "linear-gradient(90deg, #F78E42, #FFB347, #F78E42)",
            }}
          />
        )}

        {/* Night before dawn */}
        {day.civilTwilight && (
          <div
            className="absolute top-0 left-0 h-full rounded-l-full"
            style={{
              width: `${xPct(day.civilTwilight)}%`,
              background: "rgba(15, 21, 53, 0.8)",
            }}
          />
        )}

        {/* Markers — even indices above, odd indices below to avoid overlap */}
        {markers.map((m, i) => {
          const x = xPct(m.iso);
          const above = i % 2 === 0;
          return (
            <div
              key={m.label}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${x}%` }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-[#0F1535]"
                style={{ background: m.color }}
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap ${above ? "bottom-6" : "top-6"}`}
              >
                {above ? (
                  <>
                    <p
                      className="font-mono text-xs font-semibold"
                      style={{ color: m.color }}
                    >
                      {formatTime(m.iso, timezone)}
                    </p>
                    <p className="font-mono text-[10px] text-[#7A8CC0]">
                      {m.label}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[10px] text-[#7A8CC0]">
                      {m.label}
                    </p>
                    <p
                      className="font-mono text-xs font-semibold"
                      style={{ color: m.color }}
                    >
                      {formatTime(m.iso, timezone)}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between mt-1.5">
        {["5 AM", "8 AM", "11 AM", "2 PM", "5 PM", "8 PM"].map((l) => (
          <span key={l} className="font-mono text-[9px] text-[#7A8CC0]">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function DawnPatrolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DawnPatrolData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const beachSlug = searchParams.get("beach");
    if (beachSlug) {
      fetchData(beachSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(
    async (beachSlug: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/tools/dawn-patrol?beachSlug=${encodeURIComponent(beachSlug)}`,
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to load dawn patrol data");
        }
        const d: DawnPatrolData = await res.json();
        setData(d);

        const params = new URLSearchParams(searchParams.toString());
        params.set("beach", beachSlug);
        router.replace(`?${params.toString()}`, { scroll: false });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load data. Try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router, searchParams],
  );

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      if (beach.slug) fetchData(beach.slug);
    },
    [fetchData],
  );

  const timezone = data?.beach.timezone ?? null;
  const beachUrl =
    data?.beach.slug && data.beach.city && data.beach.state
      ? getBeachUrlSafe({
          slug: data.beach.slug,
          city: data.beach.city,
          state: data.beach.state,
        })
      : null;

  // Today + tomorrow for the hero cards
  const today = data?.days[0] ?? null;
  const tomorrow = data?.days[1] ?? null;

  return (
    <div className="min-h-screen" style={{ background: "#0F1535" }}>
      <ToolHero
        imageSrc={TOOL_IMAGES["dawn-patrol"]}
        imageAlt="Surfer walking along the shoreline near sunset."
        title="Dawn Patrol Calculator"
        description="Know exactly when to be in the water. First light, sunrise, golden hour — plus tide at dawn."
        headingLevel="p"
      >
        <div className="max-w-md mx-auto">
          <BeachSearchAutocomplete
            onSelect={handleBeachSelect}
            placeholder="Search for a beach..."
            maxResults={6}
            source="tool_dawn_patrol"
          />
        </div>
      </ToolHero>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-[#7A8CC0]">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="font-mono text-sm">
              Loading dawn patrol data...
            </span>
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
            <p className="text-[#B8C7E0] font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Data display */}
        {data && !loading && (
          <div className="space-y-6">
            {/* Beach name */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-white">
                  {data.beach.name}
                </h2>
                {data.beach.city && data.beach.state && (
                  <p className="text-[#7A8CC0] font-mono text-sm mt-0.5">
                    {data.beach.city}, {data.beach.state}
                  </p>
                )}
              </div>
              <ToolShareButton
                toolName="Dawn Patrol Calculator"
                beachName={data.beach.name}
                shareText={
                  today?.civilTwilight
                    ? `First light at ${data.beach.name} is ${formatTime(today.civilTwilight, timezone)} — dawn patrol time`
                    : undefined
                }
              />
            </div>

            {/* Today/Tomorrow hero cards */}
            {today && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[today, tomorrow].filter(Boolean).map((day, idx) => {
                  if (!day) return null;
                  const isTod = isToday(day.date, timezone);
                  const tideAtDawn =
                    data.stationId && data.tidePredictions.length > 0
                      ? getTideAtTime(data.tidePredictions, day.civilTwilight)
                      : null;
                  const verdict = getDawnVerdict(tideAtDawn);

                  return (
                    <div
                      key={day.date}
                      className="noise-texture rounded-2xl border p-5 space-y-4"
                      style={{
                        background:
                          idx === 0
                            ? "linear-gradient(135deg, rgba(47,57,120,0.9) 0%, rgba(37,45,107,0.95) 100%)"
                            : "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                        borderColor:
                          idx === 0
                            ? "rgba(247, 142, 66, 0.35)"
                            : "rgba(64, 76, 146, 0.4)",
                        transform: "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                          {isTod ? "Today" : "Tomorrow"}
                        </p>
                        <span
                          className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: verdict.color,
                            background: `${verdict.color}18`,
                          }}
                        >
                          {verdict.emoji} {verdict.label}
                        </span>
                      </div>

                      {/* Big time display */}
                      {day.civilTwilight && (
                        <div>
                          <p className="font-mono text-xs text-[#7A8CC0] mb-0.5">
                            First light
                          </p>
                          <p className="font-heading text-4xl font-bold text-white leading-none">
                            {formatTime(day.civilTwilight, timezone)}
                          </p>
                          <p className="font-mono text-xs text-[#7A8CC0] mt-1">
                            About 30 min before sunrise — enough to read the
                            lineup
                          </p>
                        </div>
                      )}

                      {/* Sun grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <Sunrise
                            className="h-4 w-4 text-[#F78E42] mx-auto mb-0.5"
                            aria-hidden="true"
                          />
                          <p className="font-mono text-[10px] text-[#7A8CC0]">
                            Sunrise
                          </p>
                          <p className="font-mono text-sm font-semibold text-white">
                            {formatTime(day.sunrise, timezone)}
                          </p>
                        </div>
                        <div>
                          <Sun
                            className="h-4 w-4 text-[#FFB347] mx-auto mb-0.5"
                            aria-hidden="true"
                          />
                          <p className="font-mono text-[10px] text-[#7A8CC0]">
                            Golden hr
                          </p>
                          <p className="font-mono text-sm font-semibold text-white">
                            {formatTime(day.goldenHour, timezone)}
                          </p>
                        </div>
                        <div>
                          <Moon
                            className="h-4 w-4 text-[#B8C7E0] mx-auto mb-0.5"
                            aria-hidden="true"
                          />
                          <p className="font-mono text-[10px] text-[#7A8CC0]">
                            Sunset
                          </p>
                          <p className="font-mono text-sm font-semibold text-white">
                            {formatTime(day.sunset, timezone)}
                          </p>
                        </div>
                      </div>

                      {/* Tide at dawn */}
                      {tideAtDawn && (
                        <div
                          className="rounded-xl border px-3 py-2 flex items-center gap-3"
                          style={{
                            background: "rgba(26, 33, 88, 0.5)",
                            borderColor: "rgba(64, 76, 146, 0.35)",
                          }}
                        >
                          <span className="font-mono text-xs text-[#7A8CC0]">
                            Tide at first light:
                          </span>
                          <span className="font-mono text-sm font-semibold text-white">
                            {tideAtDawn.height_ft} ft{" "}
                            <span className="text-[#7A8CC0] font-normal">
                              ({tideAtDawn.isRising ? "rising" : "falling"})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Timeline */}
                      {isTod && <DayTimeline day={day} timezone={timezone} />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 7-day forecast table */}
            {data.days.length > 2 && (
              <div
                className="noise-texture rounded-2xl border overflow-hidden"
                style={{
                  background: "rgba(26, 33, 88, 0.7)",
                  borderColor: "rgba(64, 76, 146, 0.4)",
                }}
              >
                <div
                  className="px-5 py-4 border-b"
                  style={{ borderColor: "rgba(64,76,146,0.3)" }}
                >
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                    7-Day Dawn Patrol Forecast
                  </p>
                </div>
                <div
                  className="grid grid-cols-4 gap-2 px-5 py-2 text-[10px] font-mono text-[#7A8CC0] border-b"
                  style={{ borderColor: "rgba(64,76,146,0.3)" }}
                >
                  <span>Date</span>
                  <span>First light</span>
                  <span>Sunrise</span>
                  <span className="text-right">Tide</span>
                </div>
                <div
                  className="divide-y"
                  style={{ borderColor: "rgba(64,76,146,0.2)" }}
                >
                  {data.days.slice(2).map((day) => {
                    const tideAtDawn =
                      data.stationId && data.tidePredictions.length > 0
                        ? getTideAtTime(data.tidePredictions, day.civilTwilight)
                        : null;
                    const verdict = getDawnVerdict(tideAtDawn);

                    return (
                      <div
                        key={day.date}
                        className="grid grid-cols-4 gap-2 px-5 py-3 items-center"
                      >
                        <p className="font-mono text-sm text-white">
                          {formatDate(day.date, timezone)}
                        </p>
                        <p className="font-mono text-sm text-white">
                          {formatTime(day.civilTwilight, timezone)}
                        </p>
                        <p className="font-mono text-sm text-[#B8C7E0]">
                          {formatTime(day.sunrise, timezone)}
                        </p>
                        <div className="text-right">
                          <span
                            className="font-mono text-xs px-2 py-0.5 rounded-full"
                            style={{
                              color: verdict.color,
                              background: `${verdict.color}18`,
                            }}
                          >
                            {verdict.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {beachUrl && (
                <div
                  className="rounded-xl border px-5 py-4 flex flex-col gap-3"
                  style={{
                    background: "rgba(37, 45, 107, 0.4)",
                    borderColor: "rgba(64, 76, 146, 0.4)",
                  }}
                >
                  <div>
                    <p className="font-heading font-semibold text-white text-sm">
                      Full morning forecast
                    </p>
                    <p className="text-[#7A8CC0] text-xs mt-0.5">
                      Wave height, wind direction, swell period & crowd levels
                    </p>
                  </div>
                  <Link
                    href={beachUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-mono text-sm font-semibold text-white transition-none self-start"
                    style={{ background: "#F78E42" }}
                  >
                    Get Full Forecast
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {/* Cross-link to Tide Clock */}
              <div
                className="rounded-xl border px-5 py-4 flex flex-col gap-3"
                style={{
                  background: "rgba(37, 45, 107, 0.3)",
                  borderColor: "rgba(64, 76, 146, 0.35)",
                }}
              >
                <div>
                  <p className="font-heading font-semibold text-white text-sm">
                    Check live tides
                  </p>
                  <p className="text-[#7A8CC0] text-xs mt-0.5">
                    Real-time tide height and 24-hour chart for this beach
                  </p>
                </div>
                <Link
                  href={`/tools/tide-clock${data.beach.slug ? `?beach=${data.beach.slug}` : ""}`}
                  className="inline-flex items-center gap-1.5 font-mono text-sm text-[#F78E42] hover:underline self-start"
                >
                  Tide Clock
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Empty hero state */}
        {!data && !loading && !error && (
          <div className="space-y-8">
            <div
              className="rounded-2xl border p-6 text-center"
              style={{
                background: "rgba(37, 45, 107, 0.3)",
                borderColor: "rgba(64, 76, 146, 0.35)",
              }}
            >
              <p className="font-mono text-xs text-[#7A8CC0] uppercase tracking-wider mb-3">
                What is first light?
              </p>
              <p className="text-[#B8C7E0] text-sm max-w-md mx-auto">
                First light (civil twilight) starts about 30 minutes before
                sunrise. There&apos;s enough light to see the lineup and spot
                other surfers — without waiting for the crowds that show up
                after sunrise.
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
                Want real-time tides too?
              </p>
              <p className="text-[#7A8CC0] text-xs mb-3">
                Pair dawn patrol times with the live tide clock.
              </p>
              <Link
                href="/tools/tide-clock"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-[#F78E42] hover:underline"
              >
                Tide Clock
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
