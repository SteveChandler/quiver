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

const CREAM = "#F5EEDC";

function noStore(response: ImageResponse): ImageResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getBeachNameFontSize(beachName: string): number {
  if (beachName.length >= 14) return 64;
  if (beachName.length >= 9) return 78;
  return 92;
}

function renderForecastWindowPoster(
  metadata: ForecastWindowShareMetadata,
  heroSrc: string,
  appIconSrc: string,
  spaceGroteskData: ArrayBuffer | null,
): ImageResponse {
  const location = (
    metadata.locationLabel?.trim() || "SURF FORECAST"
  ).toUpperCase();
  const beachName = (metadata.beachName.trim() || "QUIVER").toUpperCase();
  const conditionBill = [metadata.waveHeight, metadata.conditionRow]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
  const windowTitle = metadata.title.trim().toUpperCase();
  const imageResponseOptions = spaceGroteskData
    ? {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "SpaceGrotesk",
            data: spaceGroteskData,
            weight: 700 as const,
            style: "normal" as const,
          },
        ],
      }
    : { width: 1200, height: 630 };

  return noStore(
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#0D1020",
            color: CREAM,
            fontFamily: spaceGroteskData ? "SpaceGrotesk" : "sans-serif",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain HTML, not Next image components. */}
          <img
            src={heroSrc}
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

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "36%",
              display: "flex",
              background:
                "linear-gradient(180deg, rgba(13,16,32,0.94) 0%, rgba(13,16,32,0.55) 55%, rgba(13,16,32,0) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              left: 0,
              height: "40%",
              display: "flex",
              background:
                "linear-gradient(0deg, rgba(13,16,32,0.94) 0%, rgba(13,16,32,0.55) 55%, rgba(13,16,32,0) 100%)",
            }}
          />

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "34px 58px 28px",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: CREAM,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                }}
              >
                {location}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 6,
                  color: "#F78E42",
                  fontSize: getBeachNameFontSize(beachName),
                  fontWeight: 700,
                  letterSpacing: 2,
                  lineHeight: 0.95,
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              >
                {beachName}
              </div>
            </div>

            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {conditionBill ? (
                <div
                  style={{
                    display: "flex",
                    color: "#FDB84B",
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    lineHeight: 1,
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                >
                  {conditionBill}
                </div>
              ) : null}

              {windowTitle ? (
                <div
                  style={{
                    display: "flex",
                    marginTop: conditionBill ? 14 : 0,
                    color: CREAM,
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: 3,
                    lineHeight: 1.12,
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                >
                  {windowTitle}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    overflow: "hidden",
                    borderRadius: 8,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain HTML, not Next image components. */}
                  <img
                    src={appIconSrc}
                    alt="Quiver"
                    width={40}
                    height={40}
                    style={{
                      width: 40,
                      height: 40,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    marginLeft: 14,
                    color: CREAM,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: 4,
                  }}
                >
                  QUIVER
                </div>
                <div
                  style={{
                    display: "flex",
                    margin: "0 13px",
                    color: CREAM,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  ·
                </div>
                <div
                  style={{
                    display: "flex",
                    color: "#00D4AA",
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  quiversurf.app
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      imageResponseOptions,
    ),
  );
}

async function loadSpaceGroteskData(
  assetBaseUrl: string,
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(
      new URL("/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf", assetBaseUrl),
    );
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const requestUrl = new URL(request.url);
  const assetBaseUrl =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app"
      : `${requestUrl.protocol}//${requestUrl.host}`;
  const heroSrc = new URL(
    "/share/forecast-poster-hero.jpg",
    request.url,
  ).toString();
  const appIconSrc = new URL(
    "/quiver-app-icon-128.png",
    request.url,
  ).toString();
  let spaceGroteskData: ArrayBuffer | null = null;

  try {
    spaceGroteskData = await loadSpaceGroteskData(assetBaseUrl);
    const slug = requestUrl.searchParams.get("slug") ?? "";
    const windowValue = requestUrl.searchParams.get("window");
    const metadata = await loadForecastWindowShareMetadata({
      slug,
      window: windowValue,
    });

    return renderForecastWindowPoster(
      metadata,
      heroSrc,
      appIconSrc,
      spaceGroteskData,
    );
  } catch {
    return renderForecastWindowPoster(
      buildForecastWindowShareMetadata({
        slug: "quiver",
        window: null,
      }),
      heroSrc,
      appIconSrc,
      spaceGroteskData,
    );
  }
}
