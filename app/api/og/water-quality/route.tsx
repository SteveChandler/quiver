import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type WaterQualityStatus = "advisory" | "closure" | "good";

interface StatusConfig {
  gradient: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  icon: string;
}

const STATUS_CONFIG: Record<WaterQualityStatus, StatusConfig> = {
  good: {
    gradient: "linear-gradient(160deg, #064e3b 0%, #065f46 40%, #047857 100%)",
    badgeBg: "rgba(16, 185, 129, 0.25)",
    badgeText: "#6ee7b7",
    label: "Water Quality: Good",
    icon: "check",
  },
  advisory: {
    gradient: "linear-gradient(160deg, #78350f 0%, #92400e 40%, #b45309 100%)",
    badgeBg: "rgba(245, 158, 11, 0.25)",
    badgeText: "#fcd34d",
    label: "Water Advisory",
    icon: "warning",
  },
  closure: {
    gradient: "linear-gradient(160deg, #7f1d1d 0%, #991b1b 40%, #b91c1c 100%)",
    badgeBg: "rgba(239, 68, 68, 0.25)",
    badgeText: "#fca5a5",
    label: "Water Quality Alert",
    icon: "alert",
  },
};

function renderFallback() {
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
          background: "linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#FFFFFF",
            display: "flex",
          }}
        >
          Quiver
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            marginTop: 16,
            display: "flex",
          }}
        >
          Water Quality Update
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

// SVG icon components for each status (reliable in ImageResponse / Satori)
function CheckIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "flex" }}
    >
      <circle cx="12" cy="12" r="11" stroke="#6ee7b7" strokeWidth="2" />
      <path
        d="M7 12.5l3.5 3.5 6.5-7"
        stroke="#6ee7b7"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "flex" }}
    >
      <path
        d="M12 3L2 21h20L12 3z"
        stroke="#fcd34d"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v5"
        stroke="#fcd34d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="#fcd34d" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "flex" }}
    >
      <circle cx="12" cy="12" r="11" stroke="#fca5a5" strokeWidth="2" />
      <path
        d="M12 7v6"
        stroke="#fca5a5"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="#fca5a5" />
    </svg>
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const beach = searchParams.get("beach") || "Unknown Beach";
    const rawStatus = searchParams.get("status") || "advisory";

    // Normalise and guard against unknown status values
    const status: WaterQualityStatus =
      rawStatus === "good" || rawStatus === "closure"
        ? rawStatus
        : "advisory";

    const config = STATUS_CONFIG[status];

    const truncate = (value: string, max: number) =>
      value.length > max ? value.substring(0, max - 1) + "\u2026" : value;

    const displayBeach = truncate(beach, 30);

    const icon =
      status === "good" ? (
        <CheckIcon />
      ) : status === "closure" ? (
        <AlertIcon />
      ) : (
        <WarningIcon />
      );

    const response = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            background: config.gradient,
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "64px 80px",
          }}
        >
          {/* Top: Quiver wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "-0.01em",
                display: "flex",
              }}
            >
              Quiver
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                display: "flex",
              }}
            >
              quiversurf.app
            </div>
          </div>

          {/* Center: beach name + status badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
            }}
          >
            {/* Status badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 32px",
                borderRadius: 50,
                backgroundColor: config.badgeBg,
                border: `1.5px solid ${config.badgeText}40`,
              }}
            >
              {icon}
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: config.badgeText,
                  letterSpacing: "0.01em",
                  display: "flex",
                }}
              >
                {config.label}
              </div>
            </div>

            {/* Beach name */}
            <div
              style={{
                fontSize: 88,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                textAlign: "center",
                textShadow: "0 4px 24px rgba(0,0,0,0.4)",
                display: "flex",
              }}
            >
              {displayBeach}
            </div>

            {/* Status description line */}
            <div
              style={{
                fontSize: 34,
                fontWeight: 500,
                color: "rgba(255,255,255,0.75)",
                textAlign: "center",
                display: "flex",
              }}
            >
              {status === "good" &&
                "Water quality has returned to safe levels"}
              {status === "advisory" &&
                "Elevated bacteria levels detected"}
              {status === "closure" &&
                "Health advisory — avoid water contact"}
            </div>
          </div>

          {/* Bottom: CTA */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.02em",
                display: "flex",
              }}
            >
              Check real-time water quality at quiversurf.app
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch {
    return renderFallback();
  }
}
