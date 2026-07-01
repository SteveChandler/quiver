import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import {
  createQrCodeDataUri,
  LandscapeInstallShareCard,
  SHARE_CARD_COLORS,
} from "@/app/api/og/_components/install-share-card";

export const runtime = "nodejs";

function renderFallback(): ImageResponse {
  return new ImageResponse(
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
  );
}

function formatScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return "";
  return `${(score / 10).toFixed(1)}/10`;
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.substring(0, Math.max(0, max - 1))}…` : value;
}

function surfCallSubtitle(params: {
  score: number;
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

export async function GET(request: NextRequest): Promise<ImageResponse> {
  try {
    const origin = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);

    const beach = truncate(searchParams.get("beach") || "Your surf call", 40);
    const score = parseInt(searchParams.get("score") || "0", 10);
    const waveHeight = truncate(searchParams.get("waveHeight") || "", 20);
    const tags = (searchParams.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const timeContext = truncate(searchParams.get("timeContext") || "", 24);
    const conditionLabel = truncate(searchParams.get("conditionLabel") || "", 28);
    const windowTime = truncate(searchParams.get("window") || "", 26);
    const message = truncate(searchParams.get("message") || "", 74);

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
          title={beach === "Your surf call" ? "Get the surf call" : `${beach} is lining up`}
          subtitle={surfCallSubtitle({
            score,
            windowTime,
            waveHeight,
            timeContext,
            conditionLabel,
            message,
            tags,
          })}
          footer="Free surf forecasts and condition alerts by Quiver"
          compact
        />
      ),
      { width: 1200, height: 630 },
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    );
    return response;
  } catch (error) {
    console.error("[OG/surf-call] Error generating image:", error);
    return renderFallback();
  }
}
