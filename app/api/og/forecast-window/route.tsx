import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import {
  buildForecastWindowShareMetadata,
  loadForecastWindowShareMetadata,
  type ForecastWindowShareMetadata,
} from "@/lib/share/forecast-window-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: ImageResponse): ImageResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function renderForecastWindowCard(
  metadata: ForecastWindowShareMetadata,
  appIconSrc: string,
): ImageResponse {
  const title = metadata.forecastAt ? metadata.title : "Quiver surf window";
  const waveHeight = metadata.waveHeight || "Forecast window";
  const conditionRow = metadata.conditionRow || "Open the latest surf call";

  return noStore(
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 66px",
            background:
              "linear-gradient(135deg, #252D6B 0%, #18215A 54%, #101436 100%)",
            color: "#FFFFFF",
            fontFamily: "system-ui, -apple-system, sans-serif",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 360,
              display: "flex",
              background:
                "linear-gradient(180deg, rgba(247,142,66,0.22), rgba(0,212,170,0.12))",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain HTML, not Next image components. */}
                <img
                  src={appIconSrc}
                  alt="Quiver"
                  width={56}
                  height={56}
                  style={{
                    width: 56,
                    height: 56,
                    display: "flex",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                Quiver
              </div>
            </div>
            <div
              style={{
                display: "flex",
                border: "2px solid rgba(253,184,75,0.7)",
                borderRadius: 999,
                padding: "10px 18px",
                color: "#FDB84B",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              Check it on Quiver
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div
              style={{
                display: "flex",
                color: "#B8C7E0",
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {[metadata.beachName, metadata.locationLabel].filter(Boolean).join(" · ")}
            </div>
            <div
              style={{
                display: "flex",
                color: "#F78E42",
                fontSize: 50,
                fontWeight: 900,
                lineHeight: 1.08,
                maxWidth: 760,
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 34 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  color: "#00D4AA",
                  fontSize: 104,
                  fontWeight: 950,
                  lineHeight: 0.9,
                }}
              >
                {waveHeight}
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#B8C7E0",
                  fontSize: 30,
                  fontWeight: 700,
                  marginTop: 22,
                }}
              >
                {conditionRow}
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    ),
  );
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const appIconSrc = new URL("/quiver-app-icon-128.png", request.url).toString();

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? "";
    const windowValue = searchParams.get("window");
    const metadata = await loadForecastWindowShareMetadata({
      slug,
      window: windowValue,
    });

    return renderForecastWindowCard(metadata, appIconSrc);
  } catch {
    return renderForecastWindowCard(
      buildForecastWindowShareMetadata({
        slug: "quiver",
        window: null,
      }),
      appIconSrc,
    );
  }
}
