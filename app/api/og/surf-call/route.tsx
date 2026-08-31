import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { parseMajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/evaluator";
import { getBeachByIdFromDb } from "@/lib/services/beach-query-service";
import {
  createQrCodeDataUri,
  LandscapeInstallShareCard,
  SHARE_CARD_COLORS,
} from "@/app/api/og/_components/install-share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(response: ImageResponse): ImageResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function renderFallback(): ImageResponse {
  return noStore(
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: SHARE_CARD_COLORS.paper,
            color: SHARE_CARD_COLORS.ink,
            fontFamily: "SpaceGrotesk, system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 900, display: "flex" }}>
            Get Quiver
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: SHARE_CARD_COLORS.muted,
              marginTop: 14,
              display: "flex",
            }}
          >
            Free surf forecasts, alerts, and session tracking.
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    ),
  );
}

function formatScore(score: number | null): string {
  if (score === null || !Number.isFinite(score) || score <= 0) return "";
  return `${(score / 10).toFixed(1)}/10`;
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.substring(0, Math.max(0, max - 1))}…` : value;
}

function surfCallSubtitle(params: {
  score: number | null;
  windowTime: string;
  waveHeight: string;
  timeContext: string;
  conditionLabel: string;
  message: string;
  tags: string[];
}): string {
  const primary = [
    formatScore(params.score),
    params.timeContext,
    params.windowTime,
    params.waveHeight,
    params.conditionLabel,
  ].filter(Boolean);
  const context = params.message || params.tags.slice(0, 2).join(" · ");
  return truncate([primary.join(" · "), context].filter(Boolean).join(". "), 112);
}

interface ResolvedSurfCallCard {
  beachName: string;
  score: number | null;
  waveHeight: string;
  timeContext: string;
  conditionLabel: string;
  windowTime: string;
  message: string;
}

function sameInstant(left: string | null, right: string): boolean {
  return left !== null && Date.parse(left) === Date.parse(right);
}

async function resolveSurfCallCard(
  searchParams: URLSearchParams,
): Promise<ResolvedSurfCallCard | null> {
  const beachId = searchParams.get("beachId");
  const startsAt = searchParams.get("startsAt");
  const endsAt = searchParams.get("endsAt");
  const candidate = parseMajorEventHoldCandidate({
    candidateId: "og-surf-call",
    beachId,
    startsAt,
    endsAt,
  });
  if (!candidate) return null;

  const beachResult = await getBeachByIdFromDb(candidate.beachId);
  if (!beachResult.success || !beachResult.data) return null;
  const result = await getSpotSurfReportPublic(beachResult.data);
  const report = result?.report;
  if (
    !report ||
    report.recommendationAvailability.state !== "available" ||
    report.verdict === "NO" ||
    !sameInstant(report.bestWindowStart, candidate.startsAt) ||
    !sameInstant(report.bestWindowEnd, candidate.endsAt)
  ) {
    return null;
  }

  return {
    beachName: truncate(beachResult.data.name || "Surf conditions", 40),
    score: report.score,
    waveHeight: truncate(report.waveHeight || "", 20),
    timeContext: result.isTomorrow ? "Tomorrow" : "Today",
    conditionLabel: truncate(report.windDescription || "", 28),
    windowTime: truncate(report.peakTime || "", 26),
    message: truncate(report.whySentence || "", 74),
  };
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  try {
    const origin = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);

    const resolved = await resolveSurfCallCard(searchParams);

    const qrValue = buildSmartQrHandoffUrl({
      source: "share_card",
      surface: "og_surf_call_card",
      placement: "surf_call_share_qr",
      qr_id: "surf_call_share_card",
      target: "download",
      utm_content: "surf_call_card",
    });
    const qrImageSrc = await createQrCodeDataUri(qrValue);

    const response = new ImageResponse(
      (
        <LandscapeInstallShareCard
          baseUrl={origin}
          qrValue={qrValue}
          qrImageSrc={qrImageSrc}
          title={
            resolved
              ? `${resolved.beachName} is lining up`
              : "Check current surf conditions"
          }
          subtitle={
            resolved
              ? surfCallSubtitle({
                  score: resolved.score,
                  windowTime: resolved.windowTime,
                  waveHeight: resolved.waveHeight,
                  timeContext: resolved.timeContext,
                  conditionLabel: resolved.conditionLabel,
                  message: resolved.message,
                  tags: [],
                })
              : "Wave, wind, and tide conditions can change quickly. Check the latest forecast and official advisories."
          }
          footer="Free surf forecasts and condition alerts by Quiver"
          compact
        />
      ),
      { width: 1200, height: 630 },
    );

    return noStore(response);
  } catch (error) {
    console.error("[OG/surf-call] Error generating image:", error);
    return renderFallback();
  }
}
