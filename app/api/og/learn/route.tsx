import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "groundswell-vs-wind-swell";
  void slug; // reserved for future per-slug variants

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "1200px", height: "630px", background: "#F4EBD8", padding: "64px", fontFamily: "sans-serif", color: "#11100D" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#6b6455", textTransform: "uppercase" }}>
          <span style={{ color: "#F78E42", fontWeight: 800, marginRight: 12 }}>QUIVER</span> · SURF SCIENCE
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 900, lineHeight: 1, marginTop: 40 }}>
          Groundswell <span style={{ color: "#F78E42", margin: "0 18px" }}>vs</span> Wind Swell
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#3a352b", marginTop: 28, maxWidth: 900 }}>
          One number tells them apart: period. Drag the dial, watch the water change.
        </div>
        {/* groundswell vs windswell split */}
        <div style={{ display: "flex", marginTop: "auto", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "3px solid #11100D", borderRadius: 12, padding: 20, background: "#fbf5e7" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>WIND SWELL · &lt;10s</div>
            <div style={{ display: "flex", fontSize: 22, color: "#6b6455" }}>short, choppy, weak</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "3px solid #11100D", borderRadius: 12, padding: 20, background: "#F78E42" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>GROUNDSWELL · 10s+</div>
            <div style={{ display: "flex", fontSize: 22, color: "#11100D" }}>long, clean, powerful</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    }
  );
}
