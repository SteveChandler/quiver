import { ImageResponse } from "next/og";
import { getSurfDropStatus } from "@/lib/surf-drops/service";
import type { SurfDropRecord } from "@/lib/surf-drops/types";

const COLORS = {
  paper: "#F4EBD8",
  ink: "#11100D",
  orange: "#F78E42",
  navy: "#252D6B",
  muted: "#5F625A",
} as const;

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatWindow(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "Surf window";
  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime())) {
    return "Surf window";
  }

  return `${starts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} - ${ends.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function creatorName(drop: SurfDropRecord | null): string {
  return truncate(
    drop?.creator?.display_name?.trim() ||
      drop?.creator?.full_name?.trim() ||
      "A surfer",
    42,
  );
}

function publicSpotLabel(drop: SurfDropRecord | null): string {
  if (!drop) return "A surf zone";
  if (drop.location_type === "known_spot" && drop.beach?.name) {
    return truncate(drop.beach.name, 54);
  }
  // Custom-pin share images must never reveal exact_label or coordinates.
  return truncate(drop.general_area || "A surf zone", 54);
}

function footerText(drop: SurfDropRecord | null): string {
  const status = getSurfDropStatus(drop);
  if (status === "expired") return "This Surf Drop has ended.";
  if (status === "cancelled") return "This Surf Drop was cancelled.";
  if (status === "notfound") return "Meet your crew on Quiver.";
  return "Full details unlock after sign in.";
}

export function renderFallbackSurfDropOgImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COLORS.paper,
          color: COLORS.ink,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          fontFamily: "Space Grotesk, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 74, fontWeight: 900, display: "flex" }}>
          Surf Drop
        </div>
        <div style={{ marginTop: 18, fontSize: 32, color: COLORS.muted, display: "flex" }}>
          Meet your crew on Quiver.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export function renderSurfDropOgImage(drop: SurfDropRecord | null): ImageResponse {
  if (!drop) return renderFallbackSurfDropOgImage();

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COLORS.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 54,
          fontFamily: "Space Grotesk, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: COLORS.paper,
            color: COLORS.ink,
            border: `5px solid ${COLORS.ink}`,
            boxShadow: "18px 18px 0 rgba(17,16,13,0.34)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 58,
            transform: "rotate(-1deg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: COLORS.orange,
                border: `3px solid ${COLORS.ink}`,
                padding: "12px 18px",
                fontSize: 25,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Surf Drop
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>
              quiver
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: COLORS.muted }}>
              {creatorName(drop)} dropped a pin
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 78,
                lineHeight: 0.95,
                fontWeight: 950,
                letterSpacing: 0,
              }}
            >
              {publicSpotLabel(drop)}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 34,
                fontWeight: 800,
                color: COLORS.navy,
              }}
            >
              {formatWindow(drop.starts_at, drop.ends_at)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              borderTop: `3px solid ${COLORS.ink}`,
              paddingTop: 24,
              fontSize: 30,
              fontWeight: 700,
              color: COLORS.muted,
            }}
          >
            {footerText(drop)}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );

  response.headers.set("Cache-Control", "public, max-age=86400");
  return response;
}
