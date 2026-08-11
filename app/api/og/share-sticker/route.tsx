import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CREAM = "#F4EBD8";
const INK = "#11100D";
const ORANGE = "#F78E42";

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function queryValue(searchParams: URLSearchParams, key: string, fallback = ""): string {
  return truncate(searchParams.get(key) ?? fallback, 80);
}

async function loadFont(assetBaseUrl: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(new URL("/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf", assetBaseUrl));
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const requestUrl = new URL(request.url);
  const beachName = queryValue(requestUrl.searchParams, "beachName", "Quiver beach");
  const waveRange = queryValue(requestUrl.searchParams, "waveRange", "—");
  const vibe = queryValue(requestUrl.searchParams, "vibe", "SURF CHECK").toUpperCase();
  const date = queryValue(requestUrl.searchParams, "date");
  const handle = queryValue(requestUrl.searchParams, "handle", "@quiversurf");
  const fontData = await loadFont(`${requestUrl.protocol}//${requestUrl.host}`);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 500,
          minHeight: 300,
          display: "flex",
          flexDirection: "column",
          padding: "30px 42px 36px",
          backgroundColor: CREAM,
          color: INK,
          border: `5px solid ${INK}`,
          borderRadius: "28px 18px 32px 14px",
          transform: "rotate(-2deg)",
          fontFamily: fontData ? "SpaceGrotesk" : "sans-serif",
          boxShadow: `12px 12px 0 ${INK}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, fontWeight: 700 }}>
          <span style={{ letterSpacing: 3 }}>QUIVER</span>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{handle}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: ORANGE }}>{vibe}</span>
          <span style={{ fontSize: 88, lineHeight: 1, fontWeight: 900, marginTop: 7 }}>{waveRange}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 24 }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>{beachName}</span>
          {date ? <span style={{ fontSize: 17, fontWeight: 600 }}>{date}</span> : null}
        </div>
      </div>
    </div>,
    {
      width: 640,
      height: 480,
      ...(fontData
        ? { fonts: [{ name: "SpaceGrotesk", data: fontData, weight: 700 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
