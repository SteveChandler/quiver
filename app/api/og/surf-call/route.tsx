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

    // New parameters for redesigned card
    const beach = searchParams.get("beach") || "Your Beach";
    const score = parseInt(searchParams.get("score") || "0", 10);
    const headline = searchParams.get("headline") || "";
    const waveHeight = searchParams.get("waveHeight") || "";
    const conditionLabel = searchParams.get("conditionLabel") || "";
    const tideBadge = searchParams.get("tideBadge") || "";
    const message = searchParams.get("message") || "";
    const window = searchParams.get("window") || "";

    // Fallback to old parameters if new ones aren't provided
    const verdict = searchParams.get("verdict") || "";

    // Build the headline display
    // If no headline provided, build one from beach name
    const displayHeadline = headline || `Check out ${beach}`;

    // Build conditions line (wave height + condition + tide)
    const conditionParts: string[] = [];
    if (waveHeight) conditionParts.push(waveHeight);
    if (conditionLabel) conditionParts.push(conditionLabel);
    if (tideBadge) conditionParts.push(tideBadge);
    if (!conditionParts.length && window) conditionParts.push(window);
    const conditionsLine = conditionParts.join(" \u2022 ");

    // Determine if we have the new-style data or old-style
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
            // Ocean-inspired gradient background
            background: "linear-gradient(180deg, #0a1628 0%, #0d3a5c 30%, #0f4a6d 50%, #0a3048 70%, #061420 100%)",
          }}
        >
          {/* Wave texture overlay - simulated with gradient */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "radial-gradient(ellipse 150% 80% at 50% 120%, rgba(30,120,180,0.3) 0%, transparent 60%)",
              display: "flex",
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
              background: "rgba(0,0,0,0.35)",
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
              padding: "60px 80px",
              gap: 24,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Quiver Logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: "rgba(249,115,22,0.9)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#FFFFFF",
                    display: "flex",
                  }}
                >
                  Q
                </span>
              </div>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                  display: "flex",
                }}
              >
                Quiver
              </span>
            </div>

            {/* Headline */}
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#FFFFFF",
                textAlign: "center",
                maxWidth: 900,
                lineHeight: 1.2,
                display: "flex",
              }}
            >
              {displayHeadline}
            </div>

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
                  marginTop: 8,
                  marginBottom: 8,
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

            {/* Fallback: Old-style verdict for backwards compatibility */}
            {!hasScore && verdict && (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: 800,
                  color: verdict === "YES" ? "#34d399" : verdict === "MAYBE" ? "#fbbf24" : "#f87171",
                  letterSpacing: "-0.02em",
                  display: "flex",
                  marginTop: 8,
                  marginBottom: 8,
                }}
              >
                {verdict}
              </div>
            )}

            {/* Conditions line */}
            {conditionsLine && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.9)",
                  textAlign: "center",
                  display: "flex",
                }}
              >
                {conditionsLine}
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "center",
                  maxWidth: 800,
                  lineHeight: 1.4,
                  marginTop: 4,
                  display: "flex",
                }}
              >
                {message}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                display: "flex",
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
