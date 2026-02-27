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
          background:
            "linear-gradient(180deg, #0f172a 0%, #1e3a5f 50%, #0c1929 100%)",
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
    { width: 1200, height: 630 },
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
    const windowTime = searchParams.get("window") || "";
    const message = searchParams.get("message") || "";

    // Parse condition badges from tags param
    const badgeTags = tags.split(",").filter(Boolean);

    // Build URLs for background image and logo
    const baseUrl = new URL(request.url).origin;
    const waveImageUrl = `${baseUrl}/surfer-wave-sample.jpg`;
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

          {/* Dark overlay for text readability - enhanced bottom scrim */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.3) 40%, rgba(15, 23, 42, 0.7) 60%, rgba(15, 23, 42, 0.85) 100%)",
              display: "flex",
            }}
          />

          {/* Branding - Top Right (moved to avoid overlap with beach name) */}
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 50,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Quiver"
              height={50}
              style={{
                objectFit: "contain",
              }}
            />
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Quiver
            </div>
          </div>

          {/* Content container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "50px 80px",
              gap: 16,
              position: "relative",
              zIndex: 1,
              marginTop: 20,
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
                marginBottom: 8,
              }}
            >
              {beach}
            </div>

            {/* Time context and Window */}
            {(timeContext || windowTime) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  marginTop: -8,
                }}
              >
                {timeContext && (
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.9)",
                      textAlign: "center",
                    }}
                  >
                    {timeContext}
                  </div>
                )}
                {timeContext && windowTime && (
                  <div style={{ fontSize: 32, color: "rgba(255,255,255,0.4)" }}>
                    •
                  </div>
                )}
                {windowTime && (
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 500,
                      color: "#F97316", // Highlight the time window
                    }}
                  >
                    {windowTime}
                  </div>
                )}
              </div>
            )}

            {/* Score - reduced size for better balance */}
            {hasScore && (
              <div
                style={{
                  fontSize: 110,
                  fontWeight: 800,
                  color: "#F97316",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "baseline",
                  marginTop: 8,
                  marginBottom: 16,
                  textShadow: "0 4px 30px rgba(249,115,22,0.4)",
                }}
              >
                {formatScore(score)}
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    color: "rgba(249,115,22,0.8)",
                    marginLeft: 12,
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
                gap: 16,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              {/* Wave height badge - stronger frosted glass */}
              {waveHeight && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: 20,
                    padding: "12px 24px",
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                >
                  {waveHeight}
                </div>
              )}

              {/* Condition label badge */}
              {conditionLabel && (
                <div
                  style={{
                    background: "rgba(249,115,22,0.2)",
                    borderRadius: 20,
                    padding: "12px 24px",
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#fdba74",
                    display: "flex",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(249,115,22,0.3)",
                  }}
                >
                  {conditionLabel}
                </div>
              )}

              {/* Tide badge - stronger frosted glass */}
              {tideBadge && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: 20,
                    padding: "12px 24px",
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                >
                  {tideBadge}
                </div>
              )}

              {/* Additional condition tags - stronger frosted glass */}
              {badgeTags.slice(0, 2).map((tag, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: 20,
                    padding: "12px 24px",
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    display: "flex",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>

            {/* Verdict/Message - improved readability */}
            {message && (
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                  textAlign: "center",
                  maxWidth: 800,
                  marginTop: 16,
                  marginBottom: 40,
                  lineHeight: 1.6,
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                  background: "rgba(0,0,0,0.3)",
                  padding: "16px 32px",
                  borderRadius: 16,
                }}
              >
                {message}
              </div>
            )}
          </div>

          {/* Footer - centered watermark */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.05em",
              }}
            >
              quiversurf.app
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
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
