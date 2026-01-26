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
          background: "linear-gradient(135deg, #0a2e4a 0%, #0d4a6b 50%, #0a3d5c 100%)",
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const beach = searchParams.get("beach") || "Your Beach";
    const verdict = searchParams.get("verdict") || "YES";
    const window = searchParams.get("window") || "";
    const waveHeight = searchParams.get("waveHeight") || "";
    const wind = searchParams.get("wind") || "";
    const tagsParam = searchParams.get("tags") || "";
    const tags = tagsParam ? tagsParam.split(",").slice(0, 3) : [];

    const verdictColor =
      verdict === "YES"
        ? "#34d399"
        : verdict === "MAYBE"
          ? "#fbbf24"
          : "#f87171";

    const response = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background:
              "linear-gradient(135deg, #0a2e4a 0%, #0d4a6b 40%, #0a3d5c 100%)",
          }}
        >
          {/* Content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "48px 56px",
              justifyContent: "space-between",
            }}
          >
            {/* Top: Beach name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  display: "flex",
                }}
              >
                {beach}
              </div>
            </div>

            {/* Center: Verdict + Window */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: verdictColor,
                    letterSpacing: "-0.02em",
                    display: "flex",
                  }}
                >
                  {verdict}
                </div>
                {window && (
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      display: "flex",
                    }}
                  >
                    {window}
                  </div>
                )}
              </div>

              {/* Conditions row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  marginTop: 8,
                }}
              >
                {waveHeight && (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.9)",
                      display: "flex",
                    }}
                  >
                    {waveHeight}
                  </div>
                )}
                {wind && (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      display: "flex",
                    }}
                  >
                    {wind}
                  </div>
                )}
              </div>

              {/* Trend tags */}
              {tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  {tags.map((tag) => (
                    <div
                      key={tag}
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        backgroundColor: "rgba(255,255,255,0.15)",
                        padding: "6px 14px",
                        borderRadius: 20,
                        display: "flex",
                      }}
                    >
                      {tag.trim()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom: Branding */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      display: "flex",
                    }}
                  >
                    Q
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    display: "flex",
                  }}
                >
                  Get your daily surf call at quiversurf.app
                </span>
              </div>
            </div>
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
  } catch {
    return renderFallback();
  }
}
