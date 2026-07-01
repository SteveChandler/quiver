import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import {
  createQrCodeDataUri,
  PortraitInstallShareCard,
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
        <div style={{ fontSize: 86, fontWeight: 900, display: "flex" }}>
          Get Quiver
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: SHARE_CARD_COLORS.muted,
            marginTop: 18,
            display: "flex",
          }}
        >
          Free surf forecasts, alerts, and session tracking.
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.substring(0, Math.max(0, max - 1))}…` : value;
}

function formatShareUrl(value: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const host = parsed.host.replace(/^www\./, "");
    return `${host}${parsed.pathname}`;
  } catch {
    return value.replace(/^https?:\/\//, "");
  }
}

function buildSessionSubtitle(params: {
  beach: string;
  rating: string;
  size: string;
  board: string;
  windLabel: string;
  windSpeed: string;
  tagline: string;
}): string {
  const headlineParts = [
    `${params.beach} session`,
    params.rating ? `${params.rating.toLowerCase()} rating` : "",
    params.size,
  ].filter(Boolean);
  const details = [params.board, params.windLabel, params.windSpeed]
    .filter(Boolean)
    .join(" · ");
  const summary = params.tagline || details;

  return truncate(
    [headlineParts.join(" — "), summary].filter(Boolean).join(". "),
    118,
  );
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  try {
    const origin = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);

    const beach = truncate(searchParams.get("beach") || "Your surf session", 38);
    const rating = truncate(searchParams.get("rating") || "Good", 18);
    const size = truncate(searchParams.get("size") || "Waist-Chest", 24);
    const board = truncate(searchParams.get("board") || "", 34);
    const windLabel = truncate(searchParams.get("windLabel") || "", 28);
    const windSpeed = truncate(searchParams.get("windSpeed") || "", 18);
    const tagline = truncate(searchParams.get("tagline") || "", 64);
    const footer = truncate(
      searchParams.get("shareUrl")
        ? `Open this session at ${formatShareUrl(searchParams.get("shareUrl") || "")}`
        : searchParams.get("footer") || "Free surf forecasts and session tracking by Quiver",
      86,
    );

    const qrValue = buildSmartQrHandoffUrl({
      source: "share_card",
      surface: "og_session_card",
      placement: "session_share_qr",
      qr_id: "session_share_card",
      target: "download",
      utm_content: "session_card",
    });
    const qrImageSrc = await createQrCodeDataUri(qrValue);

    const response = new ImageResponse(
      (
        <PortraitInstallShareCard
          baseUrl={origin}
          qrValue={qrValue}
          qrImageSrc={qrImageSrc}
          title="Get Quiver"
          subtitle={buildSessionSubtitle({
            beach,
            rating,
            size,
            board,
            windLabel,
            windSpeed,
            tagline,
          })}
          footer={footer}
        />
      ),
      { width: 1080, height: 1920 },
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    return response;
  } catch {
    return renderFallback();
  }
}
