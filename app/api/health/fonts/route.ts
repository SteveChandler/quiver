import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Font specifications from lib/social-share-utils.ts
type FontSpec = {
  name: string;
  weight: number;
  style: "normal" | "italic";
  file: string;
};

const REQUIRED_FONTS: FontSpec[] = [
  { name: "Noto Sans", weight: 400, style: "normal", file: "NotoSans/NotoSans-Regular.ttf" },
  { name: "Noto Sans", weight: 700, style: "normal", file: "NotoSans/NotoSans-Bold.ttf" },
  { name: "Roboto", weight: 400, style: "normal", file: "Roboto/Roboto-Regular.ttf" },
  { name: "Roboto", weight: 700, style: "normal", file: "Roboto/Roboto-Bold.ttf" },
  { name: "Open Sans", weight: 400, style: "normal", file: "OpenSans/OpenSans-Regular.ttf" },
  { name: "Open Sans", weight: 600, style: "normal", file: "OpenSans/OpenSans-SemiBold.ttf" },
  { name: "Montserrat", weight: 600, style: "normal", file: "Montserrat/Montserrat-SemiBold.ttf" },
  { name: "Inter", weight: 400, style: "normal", file: "Inter/Inter-Regular.ttf" },
  { name: "Inter", weight: 700, style: "normal", file: "Inter/Inter-Bold.ttf" },
];

// Also check for WOFF2 variants (Inter uses WOFF2 currently)
const WOFF2_VARIANTS = [
  { name: "Inter", weight: 400, style: "normal", file: "Inter/Inter-Regular.woff2" },
  { name: "Inter", weight: 700, style: "normal", file: "Inter/Inter-Bold.woff2" },
];

type FontStatus = {
  name: string;
  weight: number;
  file: string;
  exists: boolean;
  readable: boolean;
  size?: number;
  format: "ttf" | "woff2" | "unknown";
  error?: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fontsDir = path.resolve(process.cwd(), "public", "fonts");

  const fontChecks = await Promise.all([
    ...REQUIRED_FONTS.map(f => checkFont(fontsDir, f, "ttf")),
    ...WOFF2_VARIANTS.map(f => checkFont(fontsDir, f, "woff2"))
  ]);

  const ttfFonts = fontChecks.filter(f => f.format === "ttf");
  const woff2Fonts = fontChecks.filter(f => f.format === "woff2");

  const availableTTF = ttfFonts.filter(f => f.exists && f.readable).length;
  const availableWOFF2 = woff2Fonts.filter(f => f.exists && f.readable).length;
  const totalRequired = REQUIRED_FONTS.length;

  // Health is OK if we have at least 7 fonts available (TTF or WOFF2 equivalent)
  const totalAvailable = availableTTF + availableWOFF2;
  const isHealthy = totalAvailable >= 7;
  const status = isHealthy ? "healthy" : "degraded";

  // Get missing fonts
  const missingFonts = fontChecks
    .filter(f => !f.exists || !f.readable)
    .map(f => ({
      name: f.name,
      weight: f.weight,
      file: f.file,
      issue: !f.exists ? "not found" : "not readable"
    }));

  const response = {
    status,
    healthy: isHealthy,
    timestamp: new Date().toISOString(),
    summary: {
      totalRequired,
      availableTTF,
      availableWOFF2,
      totalAvailable,
      missing: missingFonts.length,
    },
    fonts: {
      ttf: ttfFonts,
      woff2: woff2Fonts,
    },
    missingFonts: missingFonts.length > 0 ? missingFonts : undefined,
    notes: [
      availableWOFF2 > 0 && availableTTF < totalRequired
        ? "⚠️ Some fonts are WOFF2 instead of TTF - Satori prefers TTF format"
        : null,
      !isHealthy
        ? "🔴 Font availability is below threshold - image generation may fail"
        : "✅ Font availability is sufficient for image generation",
    ].filter(Boolean),
  };

  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}

async function checkFont(
  fontsDir: string,
  font: FontSpec,
  expectedFormat: "ttf" | "woff2"
): Promise<FontStatus> {
  const filePath = path.join(fontsDir, font.file);

  try {
    const stats = await fs.stat(filePath);

    // Try to read the file to verify accessibility
    try {
      await fs.access(filePath, fs.constants.R_OK);

      return {
        name: font.name,
        weight: font.weight,
        file: font.file,
        exists: true,
        readable: true,
        size: stats.size,
        format: expectedFormat,
      };
    } catch (readError) {
      return {
        name: font.name,
        weight: font.weight,
        file: font.file,
        exists: true,
        readable: false,
        format: expectedFormat,
        error: "File exists but is not readable",
      };
    }
  } catch (statError) {
    return {
      name: font.name,
      weight: font.weight,
      file: font.file,
      exists: false,
      readable: false,
      format: expectedFormat,
      error: "File does not exist",
    };
  }
}
