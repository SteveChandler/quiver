import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

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
          background: "linear-gradient(180deg, #0f172a 0%, #1e3a5f 50%, #0c1929 100%)",
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
          Quiver Surf Call
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            marginTop: 16,
            display: "flex",
          }}
        >
          quiversurf.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/**
 * Format score from integer (0-100) to display format (e.g., 81 -> "8.1")
 */
function formatScore(score: number): string {
  return (score / 10).toFixed(1);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parameters for redesigned card
    const beach = searchParams.get("beach") || "Your Beach";
    const score = parseInt(searchParams.get("score") || "0", 10);
    const waveHeight = searchParams.get("waveHeight") || "";
    const tags = searchParams.get("tags") || "";
    const timeContext = searchParams.get("timeContext") || "";
    const conditionLabel = searchParams.get("conditionLabel") || "";
    const tideBadge = searchParams.get("tideBadge") || "";

    // Parse condition badges from tags param
    const badgeTags = tags.split(",").filter(Boolean);

    // Build URLs for background image and logo
    const baseUrl = new URL(request.url).origin;
    const waveImageUrl = `${baseUrl}/surfer-wave-sample.png`;
    const logoUrl = `${baseUrl}/logoQuiver.png`;

    // Determine if we have a valid score
    const hasScore = score > 0;

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
            position: "relative",
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#0a1628",
          }}
        >
          {/* Background wave image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={waveImageUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Dark overlay for text readability */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.6) 100%)",
              display: "flex",
            }}
          />

          {/* Content container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "50px 80px",
              gap: 12,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Beach name - prominent at top */}
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "#FFFFFF",
                textAlign: "center",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                display: "flex",
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              {beach}
            </div>

            {/* Time context subtitle */}
            {timeContext && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                  textAlign: "center",
                  display: "flex",
                  marginTop: -4,
                }}
              >
                {timeContext}
              </div>
            )}

            {/* Score - large orange number */}
            {hasScore && (
              <div
                style={{
                  fontSize: 120,
                  fontWeight: 800,
                  color: "#F97316",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "baseline",
                  marginTop: 16,
                  marginBottom: 8,
                  textShadow: "0 4px 30px rgba(249,115,22,0.4)",
                }}
              >
                {formatScore(score)}
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 600,
                    color: "rgba(249,115,22,0.8)",
                    marginLeft: 8,
                    display: "flex",
                  }}
                >
                  /10
                </span>
              </div>
            )}

            {/* Condition badges row */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              {/* Wave height badge */}
              {waveHeight && (
                <div
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 24,
                    padding: "10px 20px",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {waveHeight}
                </div>
              )}

              {/* Condition label badge */}
              {conditionLabel && (
                <div
                  style={{
                    backgroundColor: "rgba(249,115,22,0.25)",
                    borderRadius: 24,
                    padding: "10px 20px",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    border: "1px solid rgba(249,115,22,0.3)",
                  }}
                >
                  {conditionLabel}
                </div>
              )}

              {/* Tide badge */}
              {tideBadge && (
                <div
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 24,
                    padding: "10px 20px",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {tideBadge}
                </div>
              )}

              {/* Additional condition tags */}
              {badgeTags.slice(0, 2).map((tag, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 24,
                    padding: "10px 20px",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>

          {/* Footer - URL on left, logo on right */}
          <div
            style={{
              position: "absolute",
              bottom: 36,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 48px",
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
                display: "flex",
              }}
            >
              quiversurf.app
            </span>

            {/* Logo - bottom right */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Quiver"
              width={60}
              height={90}
              style={{
                display: "flex",
              }}
            />
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch (error) {
    console.error("[OG/surf-call] Error generating image:", error);
    return renderFallback();
  }
}
