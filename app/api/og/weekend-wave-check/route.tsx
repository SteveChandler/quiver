import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { parseMajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/evaluator";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { resolveMajorEventHoldBoundary } from "@/lib/recommendations/major-event-hold/adapters/shared";
import { getBeachByIdFromDb } from "@/lib/services/beach-query-service";
import { calculateDayScore } from "@/lib/utils/regional-forecast-utils";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import { selectBeach } from "@/lib/recommendations/selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(response: ImageResponse): ImageResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function renderFallback() {
  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #1E2558 0%, #252D6B 100%)",
          fontFamily: "SpaceGrotesk, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#FFFFFF",
            display: "flex",
            fontFamily: "SpaceGrotesk, system-ui, sans-serif",
          }}
        >
          Quiver
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            display: "flex",
          }}
        >
          Weekend Wave Check
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 22,
            color: "#F78E42",
            display: "flex",
          }}
        >
          quiversurf.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
  return noStore(response);
}

type Verdict = "Go" | "Maybe" | "Skip";

function getVerdictColor(verdict: Verdict): string {
  switch (verdict) {
    case "Go":
      return "#22c55e";
    case "Maybe":
      return "#F78E42";
    case "Skip":
      return "#ef4444";
    default:
      return "#F78E42";
  }
}

function getVerdictBg(verdict: Verdict): string {
  switch (verdict) {
    case "Go":
      return "rgba(34, 197, 94, 0.15)";
    case "Maybe":
      return "rgba(247, 142, 66, 0.15)";
    case "Skip":
      return "rgba(239, 68, 68, 0.15)";
    default:
      return "rgba(247, 142, 66, 0.15)";
  }
}

function getVerdictBorder(verdict: Verdict): string {
  switch (verdict) {
    case "Go":
      return "rgba(34, 197, 94, 0.5)";
    case "Maybe":
      return "rgba(247, 142, 66, 0.5)";
    case "Skip":
      return "rgba(239, 68, 68, 0.5)";
    default:
      return "rgba(247, 142, 66, 0.5)";
  }
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? value.substring(0, max - 1) + "\u2026" : value;
}

interface ResolvedWeekendDay {
  beach: Beach;
  candidate: MajorEventHoldCandidate;
  forecasts: EnhancedForecastEntity[];
  verdict: Verdict;
  score: number;
  summary: string;
}

interface ResolvedWeekendCard {
  saturday: ResolvedWeekendDay;
  sunday: ResolvedWeekendDay;
  bestDay: "Saturday" | "Sunday";
  bestWindow: string;
}

function candidateFromQuery(
  searchParams: URLSearchParams,
  day: "sat" | "sun",
): MajorEventHoldCandidate | null {
  return parseMajorEventHoldCandidate({
    candidateId: `og-weekend:${day}`,
    beachId: searchParams.get(`${day}_beach_id`),
    startsAt: searchParams.get(`${day}_starts_at`),
    endsAt: searchParams.get(`${day}_ends_at`),
  });
}

function verdictForScore(score: number): Verdict {
  if (score >= 60) return "Go";
  if (score >= 40) return "Maybe";
  return "Skip";
}

function objectiveSummary(forecasts: EnhancedForecastEntity[]): string {
  const waveHeights = forecasts
    .map((forecast) => Number(forecast.wave_height))
    .filter(Number.isFinite);
  const averageWaveHeight =
    waveHeights.length > 0
      ? waveHeights.reduce((sum, height) => sum + height, 0) /
        waveHeights.length
      : null;
  const forecast = forecasts[0];
  return [
    averageWaveHeight === null
      ? null
      : `${averageWaveHeight.toFixed(1)} ft waves`,
    forecast?.wind_direction ? `${forecast.wind_direction} wind` : null,
    forecast?.tide_status ? `${forecast.tide_status} tide` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function exactForecastRows(
  forecasts: EnhancedForecastEntity[],
  candidate: MajorEventHoldCandidate,
): EnhancedForecastEntity[] {
  const start = Date.parse(candidate.startsAt);
  const end = Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const timestampedRows = forecasts.map((forecast) => ({
    forecast,
    forecastAt: Date.parse(forecast.forecast_at),
  }));
  if (
    timestampedRows.some(
      ({ forecast, forecastAt }) =>
        forecast.beach_id !== candidate.beachId || !Number.isFinite(forecastAt),
    )
  ) {
    return [];
  }

  const serverInstants = [
    ...new Set(timestampedRows.map(({ forecastAt }) => forecastAt)),
  ].sort((left, right) => left - right);
  const startIndex = serverInstants.indexOf(start);
  if (startIndex < 0 || serverInstants[startIndex + 1] !== end) {
    return [];
  }

  const rows = timestampedRows
    .filter(({ forecastAt }) => forecastAt === start)
    .map(({ forecast }) => forecast);
  return rows.length > 0 ? rows : [];
}

function validBeachTimezone(timezone: string | null): string {
  const candidate = timezone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(
      new Date(0),
    );
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function formatBestWindowStart(day: ResolvedWeekendDay): string {
  return new Date(day.candidate.startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: validBeachTimezone(day.beach.timezone),
    timeZoneName: "short",
  });
}

async function resolveWeekendCard(
  searchParams: URLSearchParams,
): Promise<ResolvedWeekendCard | null> {
  const saturdayCandidate = candidateFromQuery(searchParams, "sat");
  const sundayCandidate = candidateFromQuery(searchParams, "sun");
  if (!saturdayCandidate || !sundayCandidate) return null;

  const [saturdayBeachResult, sundayBeachResult] = await Promise.all([
    getBeachByIdFromDb(saturdayCandidate.beachId),
    getBeachByIdFromDb(sundayCandidate.beachId),
  ]);
  if (
    !saturdayBeachResult.success ||
    !saturdayBeachResult.data ||
    !sundayBeachResult.success ||
    !sundayBeachResult.data
  ) {
    return null;
  }

  const [saturdayBeach, sundayBeach] = await Promise.all([
    selectBeach(saturdayBeachResult.data),
    selectBeach(sundayBeachResult.data),
  ]);
  if (!saturdayBeach || !sundayBeach) return null;

  const candidates = [saturdayCandidate, sundayCandidate];
  const forecastMap = await getBatchFreshForecastsFromCache(
    candidates.map(({ beachId }) => beachId),
    168,
  );
  const saturdayForecasts = exactForecastRows(
    forecastMap.get(saturdayCandidate.beachId)?.forecasts ?? [],
    saturdayCandidate,
  );
  const sundayForecasts = exactForecastRows(
    forecastMap.get(sundayCandidate.beachId)?.forecasts ?? [],
    sundayCandidate,
  );
  if (saturdayForecasts.length === 0 || sundayForecasts.length === 0) {
    return null;
  }

  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience: null,
    applyWaterQualityHolds: true,
  });
  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    candidates,
    decisions,
  );
  if (
    boundary.recommendationAvailability.state !== "available" ||
    candidates.some(
      ({ candidateId }) => !boundary.allowedCandidateIds.has(candidateId),
    )
  ) {
    return null;
  }

  const saturdayScore = calculateDayScore(
    saturdayForecasts,
    saturdayBeachResult.data,
  );
  const sundayScore = calculateDayScore(
    sundayForecasts,
    sundayBeachResult.data,
  );
  const saturday: ResolvedWeekendDay = {
    beach: saturdayBeach,
    candidate: saturdayCandidate,
    forecasts: saturdayForecasts,
    score: saturdayScore,
    verdict: verdictForScore(saturdayScore),
    summary: objectiveSummary(saturdayForecasts),
  };
  const sunday: ResolvedWeekendDay = {
    beach: sundayBeach,
    candidate: sundayCandidate,
    forecasts: sundayForecasts,
    score: sundayScore,
    verdict: verdictForScore(sundayScore),
    summary: objectiveSummary(sundayForecasts),
  };
  const best = sundayScore > saturdayScore ? sunday : saturday;

  return {
    saturday,
    sunday,
    bestDay: best === sunday ? "Sunday" : "Saturday",
    bestWindow: `${best.beach.name || "Surf conditions"} · ${formatBestWindowStart(best)}`,
  };
}

function renderNeutralWeekendCard(spaceGroteskData: ArrayBuffer): ImageResponse {
  return noStore(
    new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #1E2558 0%, #252D6B 100%)",
          color: "#FFFFFF",
          fontFamily: "SpaceGrotesk, system-ui, sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800 }}>
          Weekend swell and safety awareness
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            maxWidth: 900,
            textAlign: "center",
            fontSize: 26,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          Wave, wind, and tide conditions can change quickly. Check current
          forecasts and official advisories before entering the water.
        </div>
        <div style={{ display: "flex", marginTop: 32, color: "#F78E42" }}>
          quiversurf.app
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "SpaceGrotesk",
            data: spaceGroteskData,
            weight: 700,
            style: "normal" as const,
          },
        ],
      },
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const spaceGroteskData = await fetch(
      new URL(
        "/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf",
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app"
          : `${new URL(request.url).protocol}//${new URL(request.url).host}`,
      ),
    ).then((res) => res.arrayBuffer());

    const { searchParams } = new URL(request.url);
    const resolved = await resolveWeekendCard(searchParams);
    if (!resolved) return renderNeutralWeekendCard(spaceGroteskData);

    const satVerdict = resolved.saturday.verdict;
    const sunVerdict = resolved.sunday.verdict;
    const satSummary = truncate(resolved.saturday.summary, 60);
    const sunSummary = truncate(resolved.sunday.summary, 60);
    const satBeach = truncate(resolved.saturday.beach.name || "", 28);
    const sunBeach = truncate(resolved.sunday.beach.name || "", 28);
    const bestDay = resolved.bestDay;
    const bestWindow = resolved.bestWindow;

    const response = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #1E2558 0%, #252D6B 50%, #1a2048 100%)",
            fontFamily: "SpaceGrotesk, system-ui, sans-serif",
            position: "relative",
            padding: "44px 56px 40px",
          }}
        >
          {/* Subtle scan line texture overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)",
              display: "flex",
            }}
          />

          {/* Wave decoration top-right */}
          <svg
            width="180"
            height="100"
            viewBox="0 0 200 120"
            style={{
              position: "absolute",
              top: 16,
              right: 24,
              opacity: 0.08,
              display: "flex",
            }}
          >
            <path
              d="M0 60c20-20 40 0 60-20s40 0 60-20 40 0 60-20 40 0 60-20"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M0 90c20-20 40 0 60-20s40 0 60-20 40 0 60-20 40 0 60-20"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          {/* Header row: Quiver wordmark + title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                  display: "flex",
                  fontFamily: "SpaceGrotesk, system-ui, sans-serif",
                }}
              >
                Quiver
              </div>
              <div
                style={{
                  width: 2,
                  height: 24,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  display: "flex",
                }}
              />
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  display: "flex",
                  letterSpacing: "0.02em",
                }}
              >
                Weekend Wave Check
              </div>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#F78E42",
                display: "flex",
                letterSpacing: "0.02em",
              }}
            >
              San Diego
            </div>
          </div>

          {/* Accent line under header */}
          <div
            style={{
              width: "100%",
              height: 2,
              background:
                "linear-gradient(90deg, #F78E42 0%, rgba(247,142,66,0.3) 50%, transparent 100%)",
              marginBottom: 32,
              display: "flex",
            }}
          />

          {/* Two-day breakdown: Saturday | Sunday */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 28,
              flex: 1,
            }}
          >
            {/* Saturday column */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "28px 32px 24px",
                borderRadius: "16px 18px 14px 17px",
                backgroundColor:
                  bestDay === "Saturday"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.04)",
                border:
                  bestDay === "Saturday"
                    ? "1.5px solid rgba(247,142,66,0.35)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                position: "relative",
              }}
            >
              {/* Best day star indicator */}
              {bestDay === "Saturday" && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 16,
                    backgroundColor: "#F78E42",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "6px 8px 7px 5px",
                    transform: "rotate(2deg)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  BEST DAY
                </div>
              )}

              {/* Day label */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  display: "flex",
                }}
              >
                Saturday
              </div>

              {/* Verdict badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 20px",
                    borderRadius: "10px 12px 9px 11px",
                    backgroundColor: getVerdictBg(satVerdict),
                    border: `1.5px solid ${getVerdictBorder(satVerdict)}`,
                    transform: "rotate(-1deg)",
                  }}
                >
                  {/* Verdict dot */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: getVerdictColor(satVerdict),
                      display: "flex",
                      boxShadow: `0 0 8px ${getVerdictColor(satVerdict)}`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: getVerdictColor(satVerdict),
                      display: "flex",
                      fontFamily: "SpaceGrotesk, system-ui, sans-serif",
                    }}
                  >
                    {satVerdict}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.45,
                  marginBottom: 16,
                  display: "flex",
                  flex: 1,
                }}
              >
                {satSummary}
              </div>

              {/* Beach name */}
              {satBeach && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: "auto",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ display: "flex", flexShrink: 0 }}
                  >
                    <path
                      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                      stroke="#F78E42"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle
                      cx="12"
                      cy="10"
                      r="3"
                      stroke="#F78E42"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#F78E42",
                      display: "flex",
                    }}
                  >
                    {satBeach}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div
              style={{
                width: 1,
                backgroundColor: "rgba(255,255,255,0.1)",
                display: "flex",
                alignSelf: "stretch",
              }}
            />

            {/* Sunday column */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "28px 32px 24px",
                borderRadius: "18px 16px 17px 14px",
                backgroundColor:
                  bestDay === "Sunday"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.04)",
                border:
                  bestDay === "Sunday"
                    ? "1.5px solid rgba(247,142,66,0.35)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                position: "relative",
              }}
            >
              {/* Best day star indicator */}
              {bestDay === "Sunday" && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 16,
                    backgroundColor: "#F78E42",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "8px 6px 5px 7px",
                    transform: "rotate(-2deg)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  BEST DAY
                </div>
              )}

              {/* Day label */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  display: "flex",
                }}
              >
                Sunday
              </div>

              {/* Verdict badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 20px",
                    borderRadius: "9px 11px 10px 12px",
                    backgroundColor: getVerdictBg(sunVerdict),
                    border: `1.5px solid ${getVerdictBorder(sunVerdict)}`,
                    transform: "rotate(1deg)",
                  }}
                >
                  {/* Verdict dot */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: getVerdictColor(sunVerdict),
                      display: "flex",
                      boxShadow: `0 0 8px ${getVerdictColor(sunVerdict)}`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: getVerdictColor(sunVerdict),
                      display: "flex",
                      fontFamily: "SpaceGrotesk, system-ui, sans-serif",
                    }}
                  >
                    {sunVerdict}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.45,
                  marginBottom: 16,
                  display: "flex",
                  flex: 1,
                }}
              >
                {sunSummary}
              </div>

              {/* Beach name */}
              {sunBeach && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: "auto",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ display: "flex", flexShrink: 0 }}
                  >
                    <path
                      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                      stroke="#F78E42"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle
                      cx="12"
                      cy="10"
                      r="3"
                      stroke="#F78E42"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#F78E42",
                      display: "flex",
                    }}
                  >
                    {sunBeach}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar: best window highlight + watermark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 24,
              width: "100%",
            }}
          >
            {/* Best call highlight */}
            {bestWindow ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  Best call
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#F78E42",
                    display: "flex",
                    fontFamily: "SpaceGrotesk, system-ui, sans-serif",
                  }}
                >
                  {truncate(bestWindow, 32)}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}

            {/* Watermark */}
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.03em",
                display: "flex",
              }}
            >
              quiversurf.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "SpaceGrotesk",
            data: spaceGroteskData,
            weight: 700,
            style: "normal" as const,
          },
        ],
      },
    );

    return noStore(response);
  } catch (error) {
    console.error("[OG/weekend-wave-check] Error generating image:", error);
    return renderFallback();
  }
}
