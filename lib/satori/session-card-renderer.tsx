/**
 * Satori Session Card Renderer
 * Converts SurfSessionCard variants to PNG images using Satori + Resvg
 */

import React from "react";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { SessionWithDetails } from "@/types/database";
import type { ShareVariant, AspectRatio, GeneratedImage } from "@/types/session-share";
import { ASPECT_RATIO_DIMENSIONS } from "@/types/session-share";
import { loadFonts } from "@/lib/social-share-utils";
import { format } from "date-fns";

/**
 * Extract session data for rendering
 */
function extractSessionData(session: SessionWithDetails, photoCount: number = 0) {
  const beachName = session.beaches?.name || "Unknown Beach";
  const date = format(new Date(session.arrival_time), "MMM d, yyyy");
  const rating = session.rating || 0;
  const waveHeight = "4-6 ft"; // Simplified for design
  const wind = "5-10 mph";
  const notes =
    session.notes ||
    session.description ||
    "Perfect morning session! Glassy conditions with consistent sets.";

  return {
    beachName,
    date,
    rating,
    waveHeight,
    wind,
    notes,
    photoCount,
  };
}

/**
 * Star rating component for Satori
 */
function renderStars(rating: number, color: string = "#FCD34D") {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        gap: 8,
      },
    },
    ...stars.map((filled, i) =>
      React.createElement(
        "span",
        {
          key: i,
          style: {
            color: filled ? color : "#D1D5DB",
            fontSize: 40,
          },
        },
        "★"
      )
    )
  );
}

/**
 * QuiverSurf logo component for Satori
 */
function renderLogo(color: string = "#FFFFFF") {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
      },
    },
    // Logo circle
    React.createElement("div", {
      style: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#06B6D4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    }),
    // Logo text
    React.createElement(
      "span",
      {
        style: {
          fontSize: 32,
          fontWeight: 700,
          color: color,
        },
      },
      "QuiverSurf"
    )
  );
}

/**
 * Photo count badge component for Satori
 */
function renderPhotoBadge(photoCount: number, color: string = "#FFFFFF") {
  if (photoCount === 0) return null;

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(0, 0, 0, 0.75)",
        color: color,
        padding: "12px 20px",
        borderRadius: 24,
        fontSize: 24,
        fontWeight: 600,
      },
    },
    React.createElement("span", null, "📷"),
    React.createElement("span", null, `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`)
  );
}

/**
 * Card styling configuration for two-column layouts
 */
interface TwoColumnCardStyle {
  background?: string;
  border?: string;
  borderRadius?: number;
  padding?: number;
}

/**
 * Label styling configuration
 */
interface LabelStyle {
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  marginBottom?: number;
  letterSpacing?: number;
  opacity?: number;
}

/**
 * Value styling configuration
 */
interface ValueStyle {
  fontSize?: number;
  fontWeight?: number;
  color?: string;
}

/**
 * Renders a two-column condition layout with customizable styling
 *
 * @param waveHeight - Wave height value to display
 * @param wind - Wind condition value to display
 * @param cardStyle - Styling for the condition cards
 * @param labelStyle - Styling for the label text
 * @param valueStyle - Styling for the value text
 * @param waveLabel - Custom label for wave height (default: "🌊 Wave Height")
 * @param windLabel - Custom label for wind (default: "💨 Wind")
 * @param gap - Gap between columns (default: 32)
 * @returns React element with two-column layout
 */
function renderTwoColumnConditions(
  waveHeight: string,
  wind: string,
  cardStyle: TwoColumnCardStyle,
  labelStyle: LabelStyle,
  valueStyle: ValueStyle,
  waveLabel: string = "🌊 Wave Height",
  windLabel: string = "💨 Wind",
  gap: number = 32
) {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        gap,
      },
    },
    // Wave height card
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          background: cardStyle.background,
          border: cardStyle.border,
          borderRadius: cardStyle.borderRadius,
          padding: cardStyle.padding,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            color: labelStyle.color,
            fontSize: labelStyle.fontSize,
            fontWeight: labelStyle.fontWeight,
            marginBottom: labelStyle.marginBottom,
            letterSpacing: labelStyle.letterSpacing,
            opacity: labelStyle.opacity,
          },
        },
        waveLabel
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: valueStyle.fontSize,
            fontWeight: valueStyle.fontWeight,
            color: valueStyle.color,
          },
        },
        waveHeight
      )
    ),
    // Wind card
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          background: cardStyle.background,
          border: cardStyle.border,
          borderRadius: cardStyle.borderRadius,
          padding: cardStyle.padding,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            color: labelStyle.color,
            fontSize: labelStyle.fontSize,
            fontWeight: labelStyle.fontWeight,
            marginBottom: labelStyle.marginBottom,
            letterSpacing: labelStyle.letterSpacing,
            opacity: labelStyle.opacity,
          },
        },
        windLabel
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: valueStyle.fontSize,
            fontWeight: valueStyle.fontWeight,
            color: valueStyle.color,
          },
        },
        wind
      )
    )
  );
}

/**
 * Variant 1: Classic Overlay
 */
function renderVariant1(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        color: "#FFFFFF",
        backgroundImage:
          "linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.6) 100%), linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        },
      },
      renderLogo("#FFFFFF"),
      photoCount > 0 ? renderPhotoBadge(photoCount, "#FFFFFF") : null
    ),
    // Main content
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          flex: 1,
          marginTop: 40,
        },
      },
      // Beach name
      React.createElement(
        "h1",
        {
          style: {
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 16,
          },
        },
        data.beachName
      ),
      // Date
      React.createElement(
        "p",
        {
          style: {
            fontSize: 40,
            marginBottom: 48,
            opacity: 0.9,
          },
        },
        `📅 ${data.date}`
      ),
      // Conditions
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: 32,
            marginBottom: 48,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 36,
            },
          },
          `🌊 ${data.waveHeight}`
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: 36,
            },
          },
          `💨 ${data.wind}`
        )
      ),
      // Rating
      renderStars(data.rating),
      // CTA
      React.createElement(
        "div",
        {
          style: {
            marginTop: 48,
            background: "#FFFFFF",
            color: "#000000",
            padding: "24px 48px",
            borderRadius: 16,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 600,
          },
        },
        "Track your sessions at quiversurf.app"
      )
    )
  );
}

/**
 * Variant 2: Split Layout
 */
function renderVariant2(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;
  const imageHeight = height * 0.45;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        background: "#F9FAFB",
      },
    },
    // Image section
    React.createElement(
      "div",
      {
        style: {
          height: imageHeight,
          backgroundImage:
            "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          display: "flex",
          padding: 32,
          justifyContent: "space-between",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(0,0,0,0.7)",
            color: "#FFFFFF",
            padding: "16px 32px",
            borderRadius: 9999,
            fontSize: 24,
            fontWeight: 600,
          },
        },
        data.waveHeight
      ),
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(0,0,0,0.7)",
            color: "#FFFFFF",
            padding: "16px 32px",
            borderRadius: 9999,
            fontSize: 24,
            fontWeight: 600,
          },
        },
        data.wind
      )
    ),
    // Content section
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          padding: 64,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        renderLogo("#000000"),
        React.createElement(
          "h1",
          {
            style: {
              fontSize: 72,
              fontWeight: 800,
              color: "#111827",
              marginTop: 32,
              marginBottom: 16,
            },
          },
          data.beachName
        ),
        React.createElement(
          "p",
          {
            style: {
              fontSize: 32,
              color: "#6B7280",
              marginBottom: 24,
            },
          },
          data.date
        ),
        renderStars(data.rating, "#FCD34D")
      ),
      React.createElement(
        "div",
        {
          style: {
            background: "#000000",
            color: "#FFFFFF",
            padding: "24px 48px",
            borderRadius: 16,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 600,
          },
        },
        "Track your sessions at quiversurf.app"
      )
    )
  );
}

/**
 * Variant 3: Minimal Dark
 */
function renderVariant3(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        background: "#000000",
        color: "#FFFFFF",
        border: "8px solid #06B6D4",
      },
    },
    // Header
    renderLogo("#FFFFFF"),
    // Main content
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          marginTop: 64,
          flex: 1,
        },
      },
      React.createElement(
        "h1",
        {
          style: {
            fontSize: 88,
            fontWeight: 800,
            marginBottom: 24,
          },
        },
        data.beachName
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: 36,
            color: "#D1D5DB",
            marginBottom: 64,
          },
        },
        data.date
      ),
      // Condition cards
      React.createElement(
        "div",
        {
          style: {
            marginBottom: 48,
          },
        },
        renderTwoColumnConditions(
          data.waveHeight,
          data.wind,
          {
            background: "#1F2937",
            border: "2px solid rgba(6, 182, 212, 0.3)",
            borderRadius: 16,
            padding: 48,
          },
          {
            color: "#06B6D4",
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 16,
          },
          {
            fontSize: 48,
            fontWeight: 800,
          }
        )
      ),
      // Rating
      React.createElement(
        "div",
        {
          style: {
            marginBottom: "auto",
          },
        },
        React.createElement(
          "p",
          {
            style: {
              color: "#06B6D4",
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 16,
            },
          },
          "Rating"
        ),
        renderStars(data.rating)
      ),
      // CTA
      React.createElement(
        "div",
        {
          style: {
            marginTop: 64,
            background: "#06B6D4",
            color: "#000000",
            padding: "24px 48px",
            borderRadius: 16,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 800,
          },
        },
        "Track your sessions at quiversurf.app"
      )
    )
  );
}

/**
 * Variant 4: Glass Morphism
 */
function renderVariant4(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        backgroundImage:
          "linear-gradient(135deg, #60A5FA 0%, #06B6D4 50%, #14B8A6 100%)",
        color: "#FFFFFF",
      },
    },
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 64,
        },
      },
      renderLogo("#FFFFFF"),
      renderStars(data.rating)
    ),
    // Glass card
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: 48,
          padding: 64,
          border: "2px solid rgba(255, 255, 255, 0.3)",
          display: "flex",
          flexDirection: "column",
        },
      },
      React.createElement(
        "h1",
        {
          style: {
            fontSize: 88,
            fontWeight: 800,
            marginBottom: 24,
          },
        },
        data.beachName
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: 36,
            marginBottom: 64,
            opacity: 0.95,
          },
        },
        data.date
      ),
      // Condition cards
      React.createElement(
        "div",
        {
          style: {
            marginBottom: "auto",
          },
        },
        renderTwoColumnConditions(
          data.waveHeight,
          data.wind,
          {
            background: "rgba(255, 255, 255, 0.3)",
            borderRadius: 32,
            padding: 40,
            border: "2px solid rgba(255, 255, 255, 0.4)",
          },
          {
            fontSize: 20,
            opacity: 0.9,
            marginBottom: 8,
          },
          {
            fontSize: 40,
            fontWeight: 800,
          },
          "Waves",
          "Wind"
        )
      )
    ),
    // CTA
    React.createElement(
      "div",
      {
        style: {
          marginTop: 48,
          background: "#FFFFFF",
          color: "#0EA5E9",
          padding: "24px 48px",
          borderRadius: 32,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 800,
        },
      },
      "Track your sessions at quiversurf.app"
    )
  );
}

/**
 * Variant 5: Info Grid
 */
function renderVariant5(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        background: "#FFFFFF",
        border: "16px solid #000000",
      },
    },
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 48,
          borderBottom: "8px solid #000000",
          marginBottom: 48,
        },
      },
      renderLogo("#000000"),
      renderStars(data.rating, "#EAB308")
    ),
    // Beach info box
    React.createElement(
      "div",
      {
        style: {
          border: "8px solid #000000",
          padding: 48,
          marginBottom: 48,
        },
      },
      React.createElement(
        "h1",
        {
          style: {
            fontSize: 80,
            fontWeight: 900,
            marginBottom: 16,
          },
        },
        data.beachName
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: 36,
            fontWeight: 700,
          },
        },
        data.date
      )
    ),
    // Conditions grid
    React.createElement(
      "div",
      {
        style: {
          marginBottom: "auto",
        },
      },
      renderTwoColumnConditions(
        data.waveHeight,
        data.wind,
        {
          border: "8px solid #000000",
          padding: 40,
        },
        {
          fontSize: 20,
          fontWeight: 800,
          marginBottom: 8,
          letterSpacing: 2,
        },
        {
          fontSize: 56,
          fontWeight: 900,
        },
        "WAVES",
        "WIND"
      )
    ),
    // CTA
    React.createElement(
      "div",
      {
        style: {
          marginTop: 48,
          border: "8px solid #000000",
          background: "#000000",
          color: "#FFFFFF",
          padding: "24px 48px",
          textAlign: "center",
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: 2,
        },
      },
      "TRACK YOUR SESSIONS AT QUIVERSURF.APP"
    )
  );
}

/**
 * Variant 6: Card Overlay
 */
function renderVariant6(
  session: SessionWithDetails,
  dimensions: { width: number; height: number },
  photoCount: number = 0
): React.ReactElement {
  const data = extractSessionData(session, photoCount);
  const { width, height } = dimensions;

  return React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        backgroundImage:
          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "auto",
        },
      },
      renderLogo("#FFFFFF"),
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(0, 0, 0, 0.7)",
            color: "#FFFFFF",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: 20,
          },
        },
        data.date
      )
    ),
    // White content card
    React.createElement(
      "div",
      {
        style: {
          background: "#FFFFFF",
          borderRadius: 48,
          padding: 64,
          display: "flex",
          flexDirection: "column",
        },
      },
      React.createElement(
        "h1",
        {
          style: {
            fontSize: 72,
            fontWeight: 800,
            color: "#111827",
            marginBottom: 32,
          },
        },
        data.beachName
      ),
      // Conditions
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: 32,
            marginBottom: 32,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 28,
              fontWeight: 600,
            },
          },
          `🌊 ${data.waveHeight}`
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: 28,
              fontWeight: 600,
            },
          },
          `💨 ${data.wind}`
        )
      ),
      // Rating
      React.createElement(
        "div",
        {
          style: {
            marginBottom: "auto",
          },
        },
        renderStars(data.rating, "#EAB308")
      ),
      // CTA
      React.createElement(
        "div",
        {
          style: {
            marginTop: 48,
            background: "#000000",
            color: "#FFFFFF",
            padding: "24px 48px",
            borderRadius: 24,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 700,
          },
        },
        "Track your sessions at quiversurf.app"
      )
    )
  );
}

/**
 * Main render function - routes to appropriate variant
 */
function renderVariant(
  session: SessionWithDetails,
  variant: ShareVariant,
  aspectRatio: AspectRatio,
  photoCount: number = 0
): React.ReactElement {
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  switch (variant) {
    case 1:
      return renderVariant1(session, dimensions, photoCount);
    case 2:
      return renderVariant2(session, dimensions, photoCount);
    case 3:
      return renderVariant3(session, dimensions, photoCount);
    case 4:
      return renderVariant4(session, dimensions, photoCount);
    case 5:
      return renderVariant5(session, dimensions, photoCount);
    case 6:
      return renderVariant6(session, dimensions, photoCount);
    default:
      return renderVariant1(session, dimensions, photoCount);
  }
}

/**
 * Render session card to PNG image
 */
export async function renderSessionCardImage(
  session: SessionWithDetails,
  variant: ShareVariant,
  aspectRatio: AspectRatio,
  photoCount: number = 0
): Promise<GeneratedImage> {
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  try {
    // Load fonts
    const fonts = await loadFonts();

    if (fonts.length === 0) {
      throw new Error("No fonts available for Satori rendering");
    }

    // Render JSX to SVG using Satori
    const jsx = renderVariant(session, variant, aspectRatio, photoCount);
    const satoriOptions: SatoriOptions = {
      width: dimensions.width,
      height: dimensions.height,
      fonts,
    };

    const svg = await satori(jsx, satoriOptions);

    // Convert SVG to PNG using Resvg
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: dimensions.width,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return {
      png: pngBuffer,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch (error) {
    console.error("Failed to render session card image:", error);
    throw error;
  }
}
