import { jpegResponse } from "@/lib/seo/og-image";
import { ImageResponse } from "next/og";
import { type NextRequest, type NextResponse } from "next/server";

import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import {
  createQrCodeDataUri,
  SHARE_CARD_COLORS,
} from "@/app/api/og/_components/install-share-card";
import {
  buildSessionShareDetails,
  formatShareWaveSize,
} from "@/lib/share/session-share-card-details";
import {
  isQuiverShareUrl,
  lookupPublicSessionShare,
  sessionIdFromShareUrl,
} from "@/lib/share/public-session-share-record";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import {
  sessionRatingLabel,
  sessionRatingStars,
} from "@/lib/share/session-rating";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const runtime = "nodejs";

// A card with no session id is built only from its URL, so it can be cached for a day.
const URL_ONLY_CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
// A card tied to a session id shows stored data that can change (rating, is_public, deleted_at).
const SESSION_CACHE =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";

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
  /** The surfer's own 1-5 rating; null hides the rating pill, stars and label. */
  stars: number | null;
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
  const size = formatShareWaveSize(params.size);
  // The rating alone ("epic rating") repeats the stars and label above it, so it
  // joins the line only beside a beach or a size (Steven, Nov 12: "Remove the line").
  const headlineParts =
    params.beach || size
      ? [
          params.beach ? `${params.beach} session` : "",
          params.rating ? `${params.rating.toLowerCase()} rating` : "",
          size,
        ].filter(Boolean)
      : [];
  const details = [params.board, params.windLabel, params.windSpeed]
    .filter(Boolean)
    .join(" · ");
  const summary = params.tagline || details;

  return truncate(
    [headlineParts.join(" — "), summary].filter(Boolean).join(". "),
    118,
  );
}

// Drawn as a path: the OG renderer's default font has no star glyph and shows empty boxes.
function ShareStar({ filled }: { filled: boolean }) {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill={filled ? SHARE_CARD_COLORS.orange : "none"}
        stroke={SHARE_CARD_COLORS.orange}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SessionShareCard({
  beach,
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
  const detailCards = buildSessionShareDetails({
    size,
    board,
    windSpeed,
    windLabel,
  });
  const rating = stars === null ? "" : sessionRatingLabel(stars);
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
          {rating ? (
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
          ) : null}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              color: "#FFFFFF",
              textShadow: "0 6px 24px rgba(0,0,0,0.35)",
            }}
          >
            {beach ? (
              <div style={{ display: "flex", fontSize: 92, fontWeight: 900 }}>
                {beach}
              </div>
            ) : null}
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
        {stars !== null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                fontSize: 58,
                color: SHARE_CARD_COLORS.orange,
                gap: 6,
              }}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <ShareStar key={index} filled={index < stars} />
              ))}
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
        ) : null}

        {tagline || subtitle ? (
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
        ) : null}

        {detailCards.length > 0 ? (
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
        ) : null}

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
            {footer ? (
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
            ) : null}
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

async function renderSessionShareCard(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const useJpeg = searchParams.get("format") === "jpeg";
  try {
    const param = (name: string): string => searchParams.get(name) || "";
    const requestHost = new URL(request.url).host;
    const sessionId = sessionIdFromShareUrl(
      searchParams.get("shareUrl"),
      requestHost,
    );
    const lookup = sessionId ? await lookupPublicSessionShare(sessionId) : null;
    const stored = lookup?.status === "found" ? lookup.record : null;
    // A public session's stored values win over the URL: installed native builds send
    // "Fair"/3 stars for an unrated session. When the read fails, nothing proves the URL's
    // rating is real, so the card shows none.
    const stars = stored
      ? stored.rating
      : lookup?.status === "error"
        ? null
        : sessionRatingStars(searchParams.get("stars"));
    const beach = truncate(stored?.beach || param("beach"), 38);
    const size = truncate(stored ? stored.waveHeight : param("size"), 24);
    const board = truncate(
      stored && !stored.hasBoard ? "" : param("board"),
      34,
    );
    const windLabel = truncate(
      stored ? stored.windLabel : param("windLabel"),
      28,
    );
    const windSpeed = truncate(
      stored ? stored.windSpeed : param("windSpeed"),
      18,
    );
    const tagline = truncate(stored?.tagline || param("tagline"), 64);
    const date = truncate(stored?.date || param("date"), 32);
    const bg = trustedBackgroundUrl(searchParams.get("bg"));
    const shareUrl = searchParams.get("shareUrl");
    // Only a Quiver address is printed. For any other host the card keeps its
    // "Open this session on Quiver" line and shows no address.
    const footer = truncate(
      shareUrl
        ? isQuiverShareUrl(shareUrl, requestHost)
          ? `Open this session at ${formatShareUrl(shareUrl)}`
          : ""
        : knownFooter(searchParams.get("footer")),
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
      <SessionShareCard
        beach={beach}
        stars={stars}
        size={size}
        board={board}
        date={date}
        windLabel={windLabel}
        windSpeed={windSpeed}
        tagline={tagline}
        footer={footer}
        bg={bg}
        qrImageSrc={qrImageSrc}
      />,
      { width: 1080, height: 1920 },
    );

    response.headers.set(
      "Cache-Control",
      !lookup
        ? URL_ONLY_CACHE
        : lookup.status === "error"
          ? "no-store"
          : SESSION_CACHE,
    );
    return useJpeg ? await jpegResponse(response) : response;
  } catch {
    const fallback = renderFallback();
    return useJpeg ? jpegResponse(fallback) : fallback;
  }
}

// ImageResponse is a plain Response; the wrapper only reads and sets its headers.
/** Footer text the apps send; any other text could point a Quiver card at another site. */
const KNOWN_FOOTERS = new Set(["Logged on Quiver"]);
const DEFAULT_FOOTER = "Free surf forecasts and session tracking by Quiver";

function knownFooter(value: string | null): string {
  return value && KNOWN_FOOTERS.has(value.trim()) ? value.trim() : DEFAULT_FOOTER;
}

const handleGet = withRateLimit(
  renderSessionShareCard as (request: NextRequest) => Promise<NextResponse>,
  "public-default",
);

export const GET = withErrorNoStore(handleGet);
