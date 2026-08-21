/**
 * Shared layout primitives for Quiver email templates.
 *
 * Table-based (the most reliable email layout) and inline-styled, driven by the
 * tokens in ./theme. Every template wraps its rows in <EmailShell> and reuses
 * <Wordmark>, <Eyebrow>, <CTAButton>, <Footer>, <Sticker>, and <BeachBadge> so
 * the brand chrome stays identical across emails.
 */

import * as React from "react";

import {
  BORDER,
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  CREAM_MUTED,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_IMPORT,
  FONT_MONO,
  GOLD,
  GOLD_INK,
  MAST,
  ORANGE,
  ORANGE_INK,
  PAPER,
  STICKER_RADIUS,
  STICKER_ROTATIONS,
  STICKER_SHADOW,
} from "@/lib/mailer/theme";
import { getBaseUrl } from "@/lib/mailer/client";
import { beachBadgeUrl } from "@/lib/mailer/stickers";
import {
  QUIVER_STICKER_ASSETS,
  type QuiverStickerKey,
} from "@/lib/ui/quiver-sticker-assets";

/** Outer canvas + font import + 600px card. Children are <tr> rows. */
export function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FONT_IMPORT }} />
      <div
        style={{
          backgroundColor: CANVAS,
          fontFamily: FONT_BODY,
          lineHeight: 1.5,
          margin: 0,
          padding: "24px 16px",
        }}
      >
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{
            borderCollapse: "collapse",
            maxWidth: 600,
            margin: "0 auto",
            backgroundColor: CARD,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <tbody>{children}</tbody>
        </table>
      </div>
    </>
  );
}

/** Thin top brand bar: QUIVER wordmark + optional mono dateline on the right. */
export function Wordmark({ dateline }: { dateline?: string }) {
  return (
    <tr>
      <td {...cellBg(MAST, { padding: "16px 24px" })}>
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          width="100%"
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td
                align="left"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: "3px",
                  color: CREAM,
                }}
              >
                QUIVER
              </td>
              {dateline ? (
                <td
                  align="right"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    letterSpacing: "1px",
                    color: CREAM_MUTED,
                  }}
                >
                  {dateline}
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

/** Mono caps kicker. */
export function Eyebrow({
  children,
  color = CREAM_MUTED,
  marginBottom = 6,
}: {
  children: React.ReactNode;
  color?: string;
  marginBottom?: number;
}) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color,
        marginBottom,
      }}
    >
      {children}
    </div>
  );
}

/** Primary (orange) or secondary (ghost) call-to-action button. */
export function CTAButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  const cellStyle: React.CSSProperties = {
    borderRadius: 8,
    ...(isPrimary ? {} : { border: `1px solid ${BORDER}` }),
  };
  const anchorStyle: React.CSSProperties = {
    display: "inline-block",
    fontFamily: FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 15,
    color: isPrimary ? ORANGE_INK : CREAM,
    textDecoration: "none",
    padding: "14px 30px",
  };

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse", margin: "0 auto" }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            {...(isPrimary
              ? cellBg(ORANGE, cellStyle)
              : { style: cellStyle })}
          >
            <a href={href} style={anchorStyle}>
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Footer band: top border on the canvas color. Children supply the content. */
export function Footer({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td
        align="center"
        {...cellBg(CANVAS, {
          padding: "20px 24px 26px 24px",
          borderTop: `1px solid ${BORDER}`,
        })}
      >
        {children}
      </td>
    </tr>
  );
}

/**
 * Rotated zine stamp (the "4 SESH" / "NOW FIRING" / "DAY 1" badge). Dynamic
 * text on a solid chip with the asymmetric radius + hard offset shadow. The
 * rotation flattens to upright in Outlook; everywhere else it tilts.
 */
export function Stamp({
  children,
  bg = GOLD,
  ink = GOLD_INK,
  rotation = STICKER_ROTATIONS.hard,
  fontSize = 13,
  padding = "10px 12px",
}: {
  children: React.ReactNode;
  bg?: string;
  ink?: string;
  rotation?: string;
  fontSize?: number;
  padding?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: FONT_MONO,
        fontWeight: 700,
        textAlign: "center",
        letterSpacing: "1px",
        lineHeight: 1.05,
        fontSize,
        color: ink,
        backgroundColor: bg,
        padding,
        borderRadius: STICKER_RADIUS,
        transform: `rotate(${rotation})`,
        boxShadow: STICKER_SHADOW,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Cut-paper zine panel: a cream surface tilted onto the twilight page with the
 * asymmetric radius + hard offset shadow, like a note taped into a zine. Text
 * inside must use the PAPER_INK / PAPER_MUTED colors (cream background). Uses a
 * bgcolor cell so the cream paints in Outlook too.
 */
export function PaperPanel({
  children,
  rotation = STICKER_ROTATIONS.softNeg,
  radius = "4px 12px 6px 14px",
  padding = "16px 18px",
}: {
  children: React.ReactNode;
  rotation?: string;
  radius?: string;
  padding?: string;
}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{
        borderCollapse: "separate",
        width: "100%",
        transform: `rotate(${rotation})`,
        boxShadow: STICKER_SHADOW,
      }}
    >
      <tbody>
        <tr>
          <td {...cellBg(PAPER, { padding, borderRadius: radius })}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* eslint-disable @next/next/no-img-element -- Email clients can't use next/image; absolute-URL <img> is required. */

/** Decorative brand sticker (PNG). Defaults to decorative (empty alt). */
export function Sticker({
  sticker,
  width,
  rotation,
  alt = "",
}: {
  sticker: QuiverStickerKey;
  width: number;
  rotation: string;
  alt?: string;
}) {
  const asset = QUIVER_STICKER_ASSETS[sticker];
  const height = Math.round((width / asset.width) * asset.height);
  return (
    <img
      src={`${getBaseUrl()}${asset.src}`}
      alt={alt}
      width={width}
      height={height}
      style={{
        display: "block",
        border: 0,
        borderRadius: STICKER_RADIUS,
        boxShadow: STICKER_SHADOW,
        transform: `rotate(${rotation})`,
        width,
        height,
      }}
    />
  );
}

/**
 * Full-width hand-drawn divider strip. Unlike <Sticker> this carries no radius,
 * shadow, or rotation — it is a printed rule, not a pasted-on sticker. One PNG
 * rather than nine so it survives every email client's table quirks in one
 * request.
 */
export function StickerStrip({ width = 544 }: { width?: number }) {
  const asset = QUIVER_STICKER_ASSETS.lineStrip;
  const height = Math.round((width / asset.width) * asset.height);
  return (
    <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
      <img
        src={`${getBaseUrl()}${asset.src}`}
        alt=""
        width={width}
        height={height}
        style={{
          display: "block",
          border: 0,
          margin: "0 auto",
          width: "100%",
          maxWidth: width,
          height: "auto",
        }}
      />
    </div>
  );
}

/** Beach-club badge for a named beach, or null when no curated badge exists. */
export function BeachBadge({
  beach,
  size = 96,
  rotation = "-1.4deg",
}: {
  beach: string | null | undefined;
  size?: number;
  rotation?: string;
}) {
  const url = beachBadgeUrl(beach);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={beach ? `${beach} badge` : ""}
      width={size}
      height={size}
      style={{
        display: "block",
        border: 0,
        width: size,
        height: size,
        transform: `rotate(${rotation})`,
      }}
    />
  );
}

/* eslint-enable @next/next/no-img-element */
