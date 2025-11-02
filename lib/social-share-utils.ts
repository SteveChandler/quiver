import React from "react";
// Use dynamic import so tests can mock fs/promises before runtime
const readFileDynamic = async (filePath: string) => {
  // Import the test-mockable shim rather than core fs/promises for stability
  const mod: any = await import("@/lib/test-shims/fs-readfile");
  return mod.readFile(filePath);
};
import path from "path";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// Brand palette sourced from tailwind.config.ts
const BRAND = {
  oceanBlue: "#0077B6",
  sunsetOrange: "#FF7F11",
  darkGrey: "#333333",
  white: "#FFFFFF",
};

export type ShareVariant = "story" | "square";

export type SessionData = {
  title?: string;
  beachName: string;
  scheduledAt?: string | Date; // preferred
  date?: string | Date; // fallback
  score?: number; // 0-100
  waveHeightFtMin?: number;
  waveHeightFtMax?: number;
  periodSeconds?: number;
  // Enhanced fields for richer share images
  rating?: number; // Overall session rating 0-5
  waveQuality?: number; // Wave quality rating 0-5
  userName?: string; // User's display name for attribution
  userAvatar?: string; // User's avatar URL
  photoUrl?: string; // Featured session photo
  duration?: number; // Session duration in minutes
};

type FontSpec = {
  name: string;
  weight?: number;
  style?: "normal" | "italic";
  file: string;
};

const CANDIDATE_FONTS: FontSpec[] = [
  // Vendored first (ensured by scripts/fetch-fonts.mjs)
  { name: "Noto Sans", weight: 400, style: "normal", file: "NotoSans/NotoSans-Regular.ttf" },
  { name: "Noto Sans", weight: 700, style: "normal", file: "NotoSans/NotoSans-Bold.ttf" },
  // Try Tailwind-configured families if present
  { name: "Roboto", weight: 400, style: "normal", file: "Roboto/Roboto-Regular.ttf" },
  { name: "Roboto", weight: 700, style: "normal", file: "Roboto/Roboto-Bold.ttf" },
  { name: "Open Sans", weight: 400, style: "normal", file: "OpenSans/OpenSans-Regular.ttf" },
  { name: "Open Sans", weight: 600, style: "normal", file: "OpenSans/OpenSans-SemiBold.ttf" },
  { name: "Montserrat", weight: 600, style: "normal", file: "Montserrat/Montserrat-SemiBold.ttf" },
  // Generic fallbacks (common naming)
  { name: "Inter", weight: 400, style: "normal", file: "Inter/Inter-Regular.ttf" },
  { name: "Inter", weight: 700, style: "normal", file: "Inter/Inter-Bold.ttf" },
];

export async function loadFonts(): Promise<SatoriOptions["fonts"]> {
  const fontsDir = path.resolve(process.cwd(), "public", "fonts");

  const loaded = await Promise.all(
    CANDIDATE_FONTS.map(async (f) => {
      try {
        const filePath = path.join(fontsDir, f.file);
        const data = await readFileDynamic(filePath);
        return {
          name: f.name,
          data,
          weight: f.weight,
          style: f.style,
        } as const;
      } catch {
        // Provide clearer diagnostics when fonts are missing or unreadable
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[share-fonts] missing font file`, f.file);
        }
        return null;
      }
    })
  );

  const validFonts = loaded.filter(Boolean) as SatoriOptions["fonts"];
  
  // Ensure at least one font is available for Satori
  if (validFonts.length === 0) {
    console.warn("[share-fonts] No custom fonts found in public/fonts; Satori will likely fail and fallback image will be returned.");
    // For development: return empty array and catch the error in renderShareImage
    return [];
  }
  
  return validFonts;
}

export function formatSessionForShare(session: SessionData): {
  headline: string;
  subline: string;
  waveLine: string;
  scoreLine: string;
  ratingLine: string;
  durationLine: string;
} {
  const when: Date | undefined = session.scheduledAt
    ? new Date(session.scheduledAt)
    : session.date
    ? new Date(session.date)
    : undefined;

  const dateTime = when ? formatInTimeZone(when, "UTC", "MMM d, h:mmaa").replace(/am/, "AM").replace(/pm/, "PM") : "";
  const headline = session.title?.trim() || "Surf Session";
  const subline = [session.beachName, dateTime].filter(Boolean).join(" • ");

  const hasMin = session.waveHeightFtMin != null;
  const hasMax = session.waveHeightFtMax != null;
  const hMin = hasMin ? session.waveHeightFtMin : hasMax ? session.waveHeightFtMax : undefined;
  const hMax = hasMax ? session.waveHeightFtMax : hasMin ? session.waveHeightFtMin : undefined;
  const waveRange =
    hMin != null && hMax != null && hMin !== hMax
      ? `${Math.round(hMin)}–${Math.round(hMax)} ft`
      : hMin != null
      ? `${Math.round(hMin)} ft`
      : "";
  const descriptor = describeWaveHeight(hMin, hMax);
  const period = session.periodSeconds ? `${Math.round(session.periodSeconds)}s` : "";
  const waveCore = [descriptor, waveRange ? `(${waveRange})` : ""].filter(Boolean).join(" ");
  const waveLine = [waveCore, period].filter(Boolean).join(" • ");

  const score = session.score ?? undefined;
  const scoreLine = score != null ? `Score ${Math.round(score)}/100` : "";

  // Format rating as stars (e.g., "⭐⭐⭐⭐⭐")
  const rating = session.rating ?? session.waveQuality ?? undefined;
  const ratingLine = rating != null ? "⭐".repeat(Math.round(rating)) : "";

  // Format duration (e.g., "2h 30m")
  const durationLine = session.duration
    ? `${Math.floor(session.duration / 60)}h ${session.duration % 60}m`
    : "";

  return { headline, subline, waveLine, scoreLine, ratingLine, durationLine };
}

function describeWaveHeight(hMin?: number, hMax?: number): string {
  const avg = (() => {
    if (hMin != null && hMax != null) return (hMin + hMax) / 2;
    if (hMin != null) return hMin;
    if (hMax != null) return hMax;
    return undefined;
  })();

  if (avg == null) return "";
  if (avg < 1) return "Flat";
  if (avg < 2) return "Ankle-knee";
  if (avg < 3) return "Knee-waist";
  if (avg <= 4) return "Waist-chest";
  if (avg < 5.1) return "Chest-shoulder";
  if (avg < 6) return "Shoulder-head";
  if (avg < 8) return "Head-overhead";
  if (avg < 10) return "Overhead-double";
  return "Well overhead";
}

/**
 * Calculate dimensions from aspect ratio
 */
function getDimensions(aspectRatio?: string): { width: number; height: number } {
  const baseWidth = 1080;

  switch (aspectRatio) {
    case "1:1":
      return { width: baseWidth, height: baseWidth }; // 1080x1080
    case "4:5":
      return { width: baseWidth, height: Math.round(baseWidth * 1.25) }; // 1080x1350
    case "9:16":
      return { width: baseWidth, height: Math.round(baseWidth * 16 / 9) }; // 1080x1920
    default:
      // Fallback: use default for square
      return { width: baseWidth, height: baseWidth };
  }
}

function containerStyle(variant: ShareVariant, aspectRatio?: string): React.CSSProperties {
  // Use aspect ratio if provided, otherwise fall back to variant-based dimensions
  const { width, height } = aspectRatio
    ? getDimensions(aspectRatio)
    : (variant === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 });

  return {
    width,
    height,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: variant === "story" || aspectRatio === "9:16" ? 72 : 64,
    color: BRAND.white,
    backgroundImage: `linear-gradient(135deg, ${BRAND.oceanBlue} 0%, ${BRAND.sunsetOrange} 100%)`,
  };
}

function textShadow(shadowColor = "rgba(0,0,0,0.25)"): string {
  return `0 2px 8px ${shadowColor}`;
}

function headerBlock(formatted: ReturnType<typeof formatSessionForShare>, userName?: string): React.ReactElement {
  const children = [
    React.createElement(
      "div",
      {
        key: "headline",
        style: {
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.05,
          textShadow: textShadow(),
        },
      },
      formatted.headline
    ),
    React.createElement(
      "div",
      { key: "subline", style: { fontSize: 40, opacity: 0.95, textShadow: textShadow() } },
      formatted.subline
    ),
  ];

  // Add user attribution if available
  if (userName) {
    children.unshift(
      React.createElement(
        "div",
        {
          key: "attribution",
          style: {
            fontSize: 32,
            opacity: 0.9,
            fontWeight: 600,
            textShadow: textShadow(),
          },
        },
        `by ${userName}`
      )
    );
  }

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
      },
    },
    ...children
  );
}

function metricsBlock(formatted: ReturnType<typeof formatSessionForShare>): React.ReactElement {
  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(2px)",
    fontSize: 36,
    fontWeight: 700,
  };

  const metrics = [
    formatted.ratingLine,
    formatted.waveLine,
    formatted.durationLine,
    formatted.scoreLine,
  ].filter(Boolean);

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 16 } },
    ...metrics.map((metric, idx) =>
      React.createElement("div", { key: idx, style: pillStyle }, metric)
    )
  );
}

function watermark(): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        alignSelf: "flex-end",
        fontSize: 28,
        opacity: 0.85,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      },
    },
    React.createElement(
      "div",
      {
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          backgroundColor: "rgba(0,0,0,0.25)",
          border: `1px solid rgba(255,255,255,0.3)`,
        },
      },
      "Quiver"
    ),
    React.createElement("span", null, "quiversurf.app")
  );
}

export function getTemplate(session: SessionData, variant: ShareVariant, aspectRatio?: string): React.ReactElement {
  const formatted = formatSessionForShare(session);

  // Build container with optional photo background
  const containerStyles = session.photoUrl
    ? {
        ...containerStyle(variant, aspectRatio),
        backgroundImage: `linear-gradient(135deg, rgba(0, 119, 182, 0.85) 0%, rgba(255, 127, 17, 0.85) 100%), url(${session.photoUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlend: "overlay",
      }
    : containerStyle(variant, aspectRatio);

  return React.createElement(
    "div",
    { style: containerStyles },
    headerBlock(formatted, session.userName),
    metricsBlock(formatted),
    watermark()
  );
}

export async function renderShareImage(
  session: SessionData,
  variant: ShareVariant,
  aspectRatio?: string
): Promise<{
  png: Uint8Array;
  w: number;
  h: number;
}> {
  // Use aspect ratio if provided, otherwise fall back to variant-based dimensions
  const { w, h } = aspectRatio
    ? (() => {
        const dims = getDimensions(aspectRatio);
        return { w: dims.width, h: dims.height };
      })()
    : (variant === "story" ? { w: 1080, h: 1920 } : { w: 1080, h: 1080 });

  try {
    const fonts = await loadFonts();
    const satoriOptions: SatoriOptions = {
      width: w,
      height: h,
      fonts: fonts.length > 0 ? fonts : []
    };

    const svg = await satori(getTemplate(session, variant, aspectRatio), satoriOptions);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
    return { png, w, h };
  } catch (fontError) {
    console.error("Font loading failed:", fontError);
    // Fallback: generate simple error image
    const errorSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0077B6"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
        Image Generation Error
      </text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
        ${session.beachName}
      </text>
    </svg>`;
    const png = new Resvg(errorSvg, { fitTo: { mode: "width", value: w } }).render().asPng();
    return { png, w, h };
  }
}


