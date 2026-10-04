import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import {
  buildSwellCardView,
  loadSwellShareEvent,
  parseSwellImageFormat,
  parseSwellKind,
  parseSwellTitleId,
  type SwellCardView,
  type SwellShareEvent,
  type SwellShareImageFormat,
} from "@/lib/share/swell-share";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWILIGHT = "#1E2558";
const CREAM = "#F5EEDC";
const INK = "#11100D";
const ORANGE = "#F78E42";
const MUTED = "rgba(17,16,13,0.62)";
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

const SIZES: Record<SwellShareImageFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  card: { width: 1080, height: 1350 },
};

function headlineFontSize(headline: string, format: SwellShareImageFormat): number {
  const steps: Array<[number, number, number]> = [
    [22, 100, 148],
    [36, 82, 124],
    [52, 68, 104],
    [Number.POSITIVE_INFINITY, 56, 88],
  ];
  const [, og, card] = steps.find(([max]) => headline.length <= max) ?? steps[3];
  return format === "og" ? og : card;
}

function SwellCardImage({
  view,
  format,
  appIconSrc,
}: {
  view: SwellCardView;
  format: SwellShareImageFormat;
  appIconSrc: string;
}): ReactElement {
  const portrait = format === "card";
  const inset = portrait ? 36 : 24;
  const pad = portrait ? 64 : 44;
  const markSize = portrait ? 64 : 48;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: inset,
        backgroundColor: TWILIGHT,
        fontFamily: "SpaceGrotesk, sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundColor: CREAM,
          color: INK,
          border: `4px solid ${INK}`,
          borderRadius: portrait ? 28 : 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: portrait ? "10px 22px" : "6px 16px",
              backgroundColor: view.generic ? INK : ORANGE,
              color: view.generic ? CREAM : INK,
              fontSize: portrait ? 40 : 30,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {view.beachName}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: portrait ? 44 : 22,
              fontSize: headlineFontSize(view.headline, format),
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -1.5,
            }}
          >
            {view.headline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: portrait ? "column" : "row",
            alignItems: portrait ? "stretch" : "flex-end",
            justifyContent: "space-between",
          }}
        >
          {view.stats.length > 0 ? (
            <div
              style={{
                display: "flex",
                borderTop: `4px solid ${INK}`,
                paddingTop: portrait ? 28 : 14,
                marginBottom: portrait ? 48 : 0,
              }}
            >
              {view.stats.map((stat, index) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginLeft: index === 0 ? 0 : portrait ? 64 : 52,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: MUTED,
                      fontSize: portrait ? 28 : 22,
                      fontWeight: 700,
                      letterSpacing: 3,
                      textTransform: "uppercase",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: portrait ? 132 : 92,
                        fontWeight: 700,
                        lineHeight: 1.05,
                        letterSpacing: -2,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        marginLeft: 8,
                        fontSize: portrait ? 40 : 30,
                        fontWeight: 700,
                      }}
                    >
                      {stat.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}

          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain HTML, not Next image components. */}
            <img
              src={appIconSrc}
              alt="Quiver"
              width={markSize}
              height={markSize}
              style={{ width: markSize, height: markSize, borderRadius: markSize / 5 }}
            />
            <div
              style={{
                display: "flex",
                marginLeft: 14,
                fontSize: portrait ? 36 : 28,
                fontWeight: 700,
                letterSpacing: 4,
              }}
            >
              QUIVER
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function loadSpaceGroteskData(assetBaseUrl: string): Promise<ArrayBuffer | null> {
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

async function loadEvent(eventKey: string | null): Promise<SwellShareEvent | null> {
  try {
    return await loadSwellShareEvent(createSupabaseServiceRoleClient(), eventKey);
  } catch (error) {
    // A link preview should still get a card when the lookup fails.
    console.error("[OG/swell] Failed to load swell event:", error);
    return null;
  }
}

/**
 * GET /api/og/swell?event_key=<key>&k=<kind>&t=<title_id>&format=og|card
 *
 * Every param is validated and nothing from the URL is drawn: the headline
 * comes from getSwellCardHeadline and the numbers from stored snapshots.
 */
export async function GET(request: NextRequest): Promise<ImageResponse> {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const format = parseSwellImageFormat(searchParams.get("format"));
  const assetBaseUrl =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app"
      : `${requestUrl.protocol}//${requestUrl.host}`;

  const [event, spaceGroteskData] = await Promise.all([
    loadEvent(searchParams.get("event_key")),
    loadSpaceGroteskData(assetBaseUrl),
  ]);
  const view = buildSwellCardView({
    event,
    kind: parseSwellKind(searchParams.get("k")),
    titleId: parseSwellTitleId(searchParams.get("t")),
  });

  const response = new ImageResponse(
    (
      <SwellCardImage
        view={view}
        format={format}
        appIconSrc={new URL("/quiver-app-icon-128.png", request.url).toString()}
      />
    ),
    {
      ...SIZES[format],
      ...(spaceGroteskData
        ? {
            fonts: [
              {
                name: "SpaceGrotesk",
                data: spaceGroteskData,
                weight: 700 as const,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    },
  );
  // Unresolved events are not cached so a card appears once snapshots exist.
  response.headers.set("Cache-Control", view.generic ? "no-store" : CACHE_CONTROL);
  return response;
}
