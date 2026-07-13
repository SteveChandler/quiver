import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import {
  createQrCodeDataUri,
  SHARE_CARD_COLORS,
} from "@/app/api/og/_components/install-share-card";

export const runtime = "nodejs";

const TRUSTED_IMAGE_HOSTS = new Set(["cdn.quiversurf.app"]);

function configuredSupabaseStorageHost(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedSupabaseStorageUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  const configuredHost = configuredSupabaseStorageHost();

  return (
    configuredHost !== null &&
    hostname === configuredHost &&
    url.pathname.startsWith("/storage/v1/object/public/")
  );
}

function trustedBackgroundUrl(value: string | null): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (TRUSTED_IMAGE_HOSTS.has(hostname) || isTrustedSupabaseStorageUrl(url)) {
      return url.toString();
    }
  } catch {
    return "";
  }

  return "";
}

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

interface SessionShareCardProps {
  beach: string;
  rating: string;
  stars: number;
  size: string;
  board: string;
  date: string;
  windLabel: string;
  windSpeed: string;
  tagline: string;
  footer: string;
  bg: string;
  qrImageSrc: string;
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

function SessionShareCard({
  beach,
  rating,
  stars,
  size,
  board,
  date,
  windLabel,
  windSpeed,
  tagline,
  footer,
  bg,
  qrImageSrc,
}: SessionShareCardProps) {
  const detailCards = [
    { label: "Waves", value: size || "Logged" },
    { label: "Board", value: board || "Quiver" },
    {
      label: "Wind",
      value: [windSpeed, windLabel].filter(Boolean).join(" ") || "Session notes",
    },
  ];
  const clampedStars = Math.max(0, Math.min(5, Math.round(stars)));
  const subtitle = buildSessionSubtitle({
    beach,
    rating,
    size,
    board,
    windLabel,
    windSpeed,
    tagline,
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: SHARE_CARD_COLORS.paper,
        color: SHARE_CARD_COLORS.ink,
        fontFamily: "SpaceGrotesk, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 1080,
          display: "flex",
          background: SHARE_CARD_COLORS.navy,
          overflow: "hidden",
        }}
      >
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bg}
            alt=""
            width={1080}
            height={1080}
            style={{
              width: 1080,
              height: 1080,
              objectFit: "cover",
              display: "flex",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.78)",
              fontSize: 84,
              fontWeight: 900,
            }}
          >
            Quiver
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: "flex",
            background: "rgba(17,16,13,0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 72,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              borderRadius: 999,
              background: SHARE_CARD_COLORS.orange,
              color: SHARE_CARD_COLORS.navy,
              padding: "16px 26px",
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {rating} session
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              color: "#FFFFFF",
              textShadow: "0 6px 24px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", fontSize: 92, fontWeight: 900 }}>
              {beach}
            </div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>
              {date || "Logged on Quiver"}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 34,
          padding: "56px 72px 64px",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              color: SHARE_CARD_COLORS.orange,
              letterSpacing: 2,
            }}
          >
            {"★".repeat(clampedStars)}
            {"☆".repeat(5 - clampedStars)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              color: SHARE_CARD_COLORS.muted,
            }}
          >
            {rating}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 40,
            lineHeight: 1.28,
            fontWeight: 700,
            color: SHARE_CARD_COLORS.ink,
          }}
        >
          {tagline || subtitle}
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {detailCards.map((card) => (
            <div
              key={card.label}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                gap: 12,
                borderRadius: 28,
                background: "#F4EBD8",
                border: "2px solid #E5D4B3",
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 900,
                  color: SHARE_CARD_COLORS.muted,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 900,
                  color: SHARE_CARD_COLORS.ink,
                  lineHeight: 1.08,
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 30,
            borderTop: "2px solid #E7EAF1",
            paddingTop: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 900,
                color: SHARE_CARD_COLORS.navy,
              }}
            >
              Open this session on Quiver
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                color: SHARE_CARD_COLORS.muted,
              }}
            >
              {footer}
            </div>
          </div>
          <div
            style={{
              width: 148,
              height: 148,
              borderRadius: 22,
              background: "#FFFFFF",
              border: "2px solid #E7EAF1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageSrc}
              alt=""
              width={124}
              height={124}
              style={{ width: 124, height: 124, display: "flex" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const beach = truncate(searchParams.get("beach") || "Your surf session", 38);
    const rating = truncate(searchParams.get("rating") || "Good", 18);
    const size = truncate(searchParams.get("size") || "Waist-Chest", 24);
    const board = truncate(searchParams.get("board") || "", 34);
    const windLabel = truncate(searchParams.get("windLabel") || "", 28);
    const windSpeed = truncate(searchParams.get("windSpeed") || "", 18);
    const tagline = truncate(searchParams.get("tagline") || "", 64);
    const date = truncate(searchParams.get("date") || "", 32);
    const bg = trustedBackgroundUrl(searchParams.get("bg"));
    const stars = Number(searchParams.get("stars") || 4);
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
        <SessionShareCard
          beach={beach}
          rating={rating}
          stars={Number.isFinite(stars) ? stars : 4}
          size={size}
          board={board}
          date={date}
          windLabel={windLabel}
          windSpeed={windSpeed}
          tagline={tagline}
          footer={footer}
          bg={bg}
          qrImageSrc={qrImageSrc}
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
