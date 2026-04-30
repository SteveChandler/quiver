import type { CSSProperties } from "react";

export function RoughEdgeFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="zine-rough-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={3} />
        </filter>
      </defs>
    </svg>
  );
}

export function HandArrow({
  dir = "down",
  length = 60,
  color = "#11100D",
  strokeWidth = 2.4,
  style,
}: {
  dir?: "down" | "down-right" | "curve-right";
  length?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  if (dir === "down-right") {
    return (
      <svg width={length} height={length * 0.7} viewBox={`0 0 ${length} ${length * 0.7}`} fill="none" style={style} aria-hidden>
        <path
          d={`M5,5 C${length * 0.3},${length * 0.15} ${length * 0.5},${length * 0.3} ${length * 0.7},${length * 0.45} C${length * 0.8},${length * 0.55} ${length * 0.85},${length * 0.55} ${length - 8},${length * 0.6}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          filter="url(#zine-rough-edge)"
        />
        <path
          d={`M${length - 18},${length * 0.5} L${length - 5},${length * 0.62} L${length - 12},${length * 0.68}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  if (dir === "curve-right") {
    return (
      <svg width={length} height={length * 0.5} viewBox={`0 0 ${length} ${length * 0.5}`} fill="none" style={style} aria-hidden>
        <path
          d={`M5,${length * 0.45} C${length * 0.3},${length * 0.05} ${length * 0.55},${length * 0.05} ${length - 12},${length * 0.32}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          filter="url(#zine-rough-edge)"
        />
        <path
          d={`M${length - 22},${length * 0.18} L${length - 8},${length * 0.34} L${length - 22},${length * 0.42}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg width={34} height={length} viewBox={`0 0 34 ${length}`} fill="none" style={style} aria-hidden>
      <path
        d={`M17,3 C16,${length * 0.25} 19,${length * 0.5} 16,${length * 0.75} C15,${length * 0.85} 18,${length * 0.92} 17,${length - 8}`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        filter="url(#zine-rough-edge)"
      />
      <path
        d={`M9,${length - 15} L17,${length - 3} L25,${length - 15}`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function DoodleWave({ size = 36, color = "#0B3A75" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 48 36" fill="none" aria-hidden>
      <path d="M2,22 C8,16 12,16 16,20 C20,26 24,26 28,20 C32,14 38,14 46,22" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none" filter="url(#zine-rough-edge)" />
      <path d="M6,28 C10,24 14,24 18,26 C22,30 26,30 30,26 C34,22 38,24 44,28" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

export function DoodleWind({ size = 36, color = "#11100D" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 48 32" fill="none" aria-hidden>
      <path d="M3,9 L34,9 C40,9 40,3 35,3" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M3,17 L40,17 C46,17 46,11 41,11" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M3,25 L28,25 C34,25 34,21 29,21" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function DoodleTide({ size = 30, color = "#11100D" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden>
      <path d="M15,4 L15,22 M9,16 L15,22 L21,16" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M3,28 L27,28" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DoodleClock({ size = 22, color = "#11100D" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" filter="url(#zine-rough-edge)" />
      <path d="M12,7 L12,12 L16,14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DoodleStar({ size = 16, color = "#0B3A75", filled = true }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? color : "none"} aria-hidden>
      <path d="M10,2 L12.5,7.6 L18.5,8.4 L14.2,12.7 L15.4,18.6 L10,15.7 L4.6,18.6 L5.8,12.7 L1.5,8.4 L7.5,7.6 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function DoodleCompass({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="34" stroke="#11100D" strokeWidth="2" fill="#F4EBD8" filter="url(#zine-rough-edge)" />
      <circle cx="40" cy="40" r="28" stroke="#11100D" strokeWidth="0.8" fill="none" opacity="0.4" />
      <path d="M40,10 L46,40 L40,70 L34,40 Z" fill="#11100D" stroke="#11100D" strokeWidth="1" />
      <path d="M10,40 L40,46 L70,40 L40,34 Z" fill="none" stroke="#11100D" strokeWidth="1" />
      <text x="40" y="9" fill="#11100D" fontFamily="var(--font-mono), monospace" fontSize="9" textAnchor="middle" fontWeight="700">N</text>
      <text x="40" y="78" fill="#11100D" fontFamily="var(--font-mono), monospace" fontSize="9" textAnchor="middle" fontWeight="700">S</text>
      <text x="74" y="43" fill="#11100D" fontFamily="var(--font-mono), monospace" fontSize="9" textAnchor="middle" fontWeight="700">E</text>
      <text x="6" y="43" fill="#11100D" fontFamily="var(--font-mono), monospace" fontSize="9" textAnchor="middle" fontWeight="700">W</text>
    </svg>
  );
}

export function DoodleWarning({ size = 32, color = "#B91C1C" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16,3 L30,28 L2,28 Z" fill={color} stroke="#11100D" strokeWidth="1.5" strokeLinejoin="round" filter="url(#zine-rough-edge)" />
      <path d="M16,12 L16,20" stroke="#F4EBD8" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="24" r="1.4" fill="#F4EBD8" />
    </svg>
  );
}

export function DoodleSkull({ size = 28, color = "#11100D" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16,4 C9,4 4,9 4,15 C4,18 5,21 7,22 L7,26 L11,26 L11,28 L13,28 L13,26 L19,26 L19,28 L21,28 L21,26 L25,26 L25,22 C27,21 28,18 28,15 C28,9 23,4 16,4 Z" fill={color} stroke={color} strokeWidth="1" filter="url(#zine-rough-edge)" />
      <circle cx="11.5" cy="14" r="2.2" fill="#F4EBD8" />
      <circle cx="20.5" cy="14" r="2.2" fill="#F4EBD8" />
      <path d="M14,19 L15,21 L17,21 L18,19" stroke="#F4EBD8" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function DoodleReef({ size = 30, color = "#0B3A75" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 40 32" fill="none" aria-hidden>
      <path d="M3,28 L9,14 L14,22 L20,8 L26,20 L32,12 L37,28 Z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" filter="url(#zine-rough-edge)" />
      <path d="M0,30 L40,30" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

export function SkillBars({ size = 28, color = "#0B3A75" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="2" y="14" width="5" height="12" fill={color} filter="url(#zine-rough-edge)" />
      <rect x="11" y="8" width="5" height="18" fill={color} filter="url(#zine-rough-edge)" />
      <rect x="20" y="2" width="5" height="24" fill="none" stroke={color} strokeWidth="1.5" filter="url(#zine-rough-edge)" />
    </svg>
  );
}

/**
 * Halftone-treated photo container. If `src` is provided, renders the image
 * with the dot overlay applied via the .halftone-photo CSS class. If absent,
 * falls back to a placeholder of dots + cliff/ocean shapes (used by the design
 * prototype before real photos exist).
 */
export function HalftonePhoto({
  src,
  alt,
  label,
  height = 200,
  ariaHidden = false,
}: {
  src?: string | null;
  alt?: string;
  label?: string | null;
  height?: number;
  ariaHidden?: boolean;
}) {
  return (
    <div
      className="halftone-photo"
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "#C8C2B0",
        overflow: "hidden",
      }}
      aria-hidden={ariaHidden || !src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- intentional: halftone CSS treatment + we need full-bleed cover with no Next image optimisation flicker
        <img
          src={src}
          alt={alt ?? ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <>
          {/* Sky gradient — pale paper at top, deeper at the horizon line */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(180deg, #E8DEC4 0%, #D6C9A6 55%, #B6AC8C 56%, #B6AC8C 100%)",
            }}
          />
          {/* Ocean + wave silhouettes — distant cliff bump on the right
              breaks the horizon, three crest lines layer with parallax. */}
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "multiply", opacity: 0.85 }} aria-hidden>
            {/* Distant cliff / point on the horizon */}
            <path d="M310,112 C325,108 345,109 360,112 L360,116 L310,116 Z" fill="#5C5A57" opacity="0.7" />
            {/* Far swell line — long, flat, just past the horizon */}
            <path d="M0,118 C70,114 140,121 210,116 C280,111 340,121 400,117 L400,128 L0,128 Z" fill="#5C5A57" opacity="0.55" />
            {/* Mid wave line — gentle crests breaking */}
            <path d="M0,138 C50,128 95,142 150,134 C205,126 260,144 315,134 C355,127 380,140 400,135 L400,150 L0,150 Z" fill="#4A4538" />
            {/* Foreground wave — chunkier, closer, hits bottom of frame */}
            <path d="M0,162 C40,156 90,168 150,160 C210,152 260,170 320,162 C360,156 385,168 400,164 L400,200 L0,200 Z" fill="#2B2820" />
            {/* Sparse foam dots on the closest wave */}
            <g fill="#F4EBD8" opacity="0.55">
              <circle cx="68" cy="170" r="1.6" />
              <circle cx="118" cy="174" r="1.4" />
              <circle cx="172" cy="168" r="1.5" />
              <circle cx="232" cy="174" r="1.4" />
              <circle cx="296" cy="170" r="1.6" />
              <circle cx="348" cy="174" r="1.4" />
            </g>
          </svg>
        </>
      )}
      {label && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            background: "rgba(244,235,216,0.85)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "2px 6px",
            color: "#11100D",
            border: "1px solid #11100D",
            zIndex: 2,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function MapDoodle({
  height = 200,
  label,
  locationName = "Beach",
  lat,
  lon,
}: {
  height?: number;
  label?: string | null;
  locationName?: string;
  lat?: number | null;
  lon?: number | null;
}) {
  const { x: markerX, y: markerY } = computeMarkerPosition(lat, lon);
  return (
    <div style={{ position: "relative", width: "100%", height, background: "#EBDFC2", overflow: "hidden" }} aria-hidden>
      <svg viewBox="0 0 400 240" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <rect x="0" y="0" width="170" height="240" fill="#C9D8DD" />
        <pattern id="zine-dots-map" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" fill="#7FA7B8" opacity="0.55" />
        </pattern>
        <rect x="0" y="0" width="170" height="240" fill="url(#zine-dots-map)" />
        <path d="M170,0 C160,40 175,80 165,120 C158,160 175,200 165,240" stroke="#11100D" strokeWidth="2" fill="none" filter="url(#zine-rough-edge)" />
        <path d="M170,0 C160,40 175,80 165,120 C158,160 175,200 165,240 L400,240 L400,0 Z" fill="#EBDFC2" />
        <g stroke="#11100D" strokeWidth="0.6" opacity="0.55">
          <path d="M180,40 L400,30" />
          <path d="M185,80 L400,70" />
          <path d="M190,120 L400,110" />
          <path d="M195,160 L400,150" />
          <path d="M200,200 L400,190" />
          <path d="M220,0 L240,240" />
          <path d="M280,0 L300,240" />
          <path d="M340,0 L360,240" />
        </g>
        <g transform={`translate(${markerX},${markerY})`}>
          <circle r="14" fill="none" stroke="#11100D" strokeWidth="2" filter="url(#zine-rough-edge)" />
          <path d="M-7,-7 L7,7 M-7,7 L7,-7" stroke="#11100D" strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <g stroke="#0B3A75" strokeWidth="1.6" fill="none" strokeDasharray="3,3">
          <path d={`M30,${markerY - 30} C60,${markerY - 25} 90,${markerY - 28} ${markerX - 18},${markerY - 12}`} />
          <path d={`M30,${markerY + 30} C60,${markerY + 25} 90,${markerY + 28} ${markerX - 18},${markerY + 12}`} />
        </g>
        <path d={`M${markerX - 28},${markerY - 17} L${markerX - 16},${markerY - 12} L${markerX - 26},${markerY - 7}`} stroke="#0B3A75" strokeWidth="1.6" fill="none" />
        <path d={`M${markerX - 28},${markerY + 7} L${markerX - 16},${markerY + 12} L${markerX - 26},${markerY + 17}`} stroke="#0B3A75" strokeWidth="1.6" fill="none" />
        <text x="280" y="135" fontFamily="var(--font-handwritten), cursive" fontSize="20" fill="#11100D" fontWeight="700">{locationName}</text>
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "#11100D",
            color: "#F4EBD8",
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "3px 8px",
            fontWeight: 900,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// Place the "X" marker inside the ocean band of the zine map doodle so the
// pin sits roughly where the spot would be relative to its neighbours along
// the coast. Same beach renders the same position every visit; nearby beaches
// land near each other (fractional decimals are close), distant beaches drift
// apart. Stays inside the ocean rectangle (left of the coastline at x≈170).
function computeMarkerPosition(lat?: number | null, lon?: number | null): { x: number; y: number } {
  // Safe ocean zone that avoids the BEACH NAME / CITY label stamp pinned to
  // the top-left corner: x ∈ [40, 150] (ocean band, before coastline at ~170),
  // y ∈ [120, 210] (below the stamp's bottom edge).
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { x: 130, y: 165 };
  }
  const fracLat = Math.abs(lat) - Math.floor(Math.abs(lat));
  const fracLon = Math.abs(lon) - Math.floor(Math.abs(lon));
  const x = 40 + fracLon * 110;
  const y = 210 - fracLat * 90;
  return { x: Math.round(x), y: Math.round(y) };
}

export function SaltyEyebrow({ text = "KEEP IT SALTY" }: { text?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span className="typewriter" style={{ borderBottom: "1.5px solid #11100D", paddingBottom: 1 }}>{text}</span>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M11,2 L13.5,8.5 L20,9 L15,13.5 L17,20 L11,16 L5,20 L7,13.5 L2,9 L8.5,8.5 Z" stroke="#11100D" strokeWidth="1.4" fill="none" filter="url(#zine-rough-edge)" />
      </svg>
    </div>
  );
}

export function TornDivider({ flip = false, color = "#DCC9A2" }: { flip?: boolean; color?: string }) {
  return (
    <svg viewBox="0 0 1200 24" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 18, transform: flip ? "scaleY(-1)" : "none" }} aria-hidden>
      <path d="M0,8 C40,4 70,18 110,8 C150,2 190,16 230,7 C270,2 310,16 350,6 C390,2 430,18 470,9 C510,4 550,16 600,7 C650,2 690,16 730,7 C770,2 820,16 860,8 C900,4 940,16 1000,8 C1060,4 1130,16 1200,8 L1200,24 L0,24 Z" fill={color} filter="url(#zine-rough-edge)" />
    </svg>
  );
}
