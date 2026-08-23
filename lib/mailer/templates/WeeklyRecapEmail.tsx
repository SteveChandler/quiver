import * as React from "react";

import { colorForScore } from "@/lib/mailer/colors";
import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  Stamp,
  Sticker,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import { beachBadgeUrl } from "@/lib/mailer/stickers";
import {
  CARD,
  CANVAS,
  cellBg,
  CREAM,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  PAPER_INK,
  ROW,
  STICKER_ROTATIONS,
  SURFACE,
  SURFACE_HIGH,
  TEAL,
  TEXT,
} from "@/lib/mailer/theme";

interface SessionSummary {
  totalSessions: number;
  totalHours: string; // e.g., "4.5"
  topSpot: string; // e.g., "Blacks Beach"
}

/**
 * One upcoming forecast slot surfaced in the "Best days this week" section.
 *
 * The weekly-recap cron queries compute_user_match_score across each user's
 * subscribed beaches for the next 7 days, filters to score >= 6 (looser than
 * the 7.0 alerts threshold since this is a digest, not a time-sensitive push),
 * sorts by score desc, and picks the top N slots.
 */
export interface BestDaySlot {
  beach_name: string;
  score: number; // 0–10, rendered to one decimal
  label: string; // EPIC | GOOD | FAIR | RIDEABLE | MEH
  weekday: string; // e.g., "Thursday"
  time: string; // e.g., "6am"
}

export interface WeeklyRecapEmailProps {
  userName: string | null;
  startDate: string; // e.g., "Jan 20"
  endDate: string; // e.g., "Jan 26"
  stats: SessionSummary;
  ctaUrl: string;
  unsubscribeUrl: string;
  /**
   * Top upcoming similarity-match slots across the user's subscribed beaches.
   * Optional — when empty or undefined the section is omitted entirely, we
   * don't render an empty "Best days this week" block.
   */
  bestDays?: BestDaySlot[];
  /**
   * Cam thumbnail for the user's top spot, resolved server-side from
   * beach_sources. Optional — when null/undefined the hero strip is omitted.
   */
  topSpotImageUrl?: string | null;
}

export function WeeklyRecapEmail({
  userName,
  startDate,
  endDate,
  stats,
  ctaUrl,
  unsubscribeUrl,
  bestDays,
  topSpotImageUrl,
}: WeeklyRecapEmailProps) {
  const showBestDays = Array.isArray(bestDays) && bestDays.length > 0;
  const greeting = userName ? `Nice work, ${userName}.` : "Nice work!";
  const sessionWord = stats.totalSessions === 1 ? "session" : "sessions";
  const hasBadge = beachBadgeUrl(stats.topSpot) !== null;

  return (
    <EmailShell>
      <Wordmark dateline={`${startDate} — ${endDate}`} />

      {/* Masthead — editorial headline + rotated gold session stamp */}
      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 20px" })}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: "collapse" }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "top" }}>
                  <Eyebrow color={GOLD}>Weekly Recap · Vol 24</Eyebrow>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 31,
                      lineHeight: 1.04,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    {greeting}
                  </h1>
                </td>
                <td
                  align="right"
                  width="92"
                  style={{ verticalAlign: "top", width: 92 }}
                >
                  <Stamp fontSize={10} padding="11px 13px">
                    <span style={{ fontSize: 22, display: "block" }}>
                      {stats.totalSessions}
                    </span>
                    SESH
                  </Stamp>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Top-spot cam strip — taped in, progressive enhancement */}
      {topSpotImageUrl ? (
        <tr>
          <td {...cellBg(CANVAS, { padding: 0 })}>
            <div style={{ padding: "0 0 0 28px", marginBottom: -13 }}>
              <Sticker sticker="goldTape" width={118} rotation="-4deg" />
            </div>
            <div
              style={{
                lineHeight: 0,
                maxHeight: 150,
                overflow: "hidden",
                borderBottom: `2px solid ${GOLD}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Email clients can't use next/image; a plain absolute-URL <img> is required. */}
              <img
                src={topSpotImageUrl}
                alt={`Latest look at ${stats.topSpot}`}
                width="600"
                style={{ width: "100%", display: "block", border: 0 }}
              />
            </div>
          </td>
        </tr>
      ) : null}

      {/* Body */}
      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          {/* Hero stats — hours as the metric, top spot as the warm callout */}
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{
              borderCollapse: "collapse",
              width: "100%",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 22,
            }}
          >
            <tbody>
              <tr>
                <td
                  {...cellBg(SURFACE, {
                    width: "50%",
                    verticalAlign: "middle",
                    padding: "20px",
                  })}
                >
                  <Eyebrow color={MUTED}>Hours wet</Eyebrow>
                  <p
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 48,
                      lineHeight: 0.95,
                      color: CREAM,
                      margin: "6px 0 0",
                    }}
                  >
                    {stats.totalHours}
                  </p>
                </td>
                <td
                  {...cellBg(SURFACE_HIGH, {
                    width: "50%",
                    verticalAlign: "middle",
                    padding: "16px 20px",
                  })}
                >
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ borderCollapse: "collapse" }}
                  >
                    <tbody>
                      <tr>
                        {hasBadge ? (
                          <td
                            style={{
                              verticalAlign: "middle",
                              paddingRight: 12,
                            }}
                          >
                            <BeachBadge beach={stats.topSpot} size={52} />
                          </td>
                        ) : null}
                        <td style={{ verticalAlign: "middle" }}>
                          <Eyebrow color={MUTED}>Top spot</Eyebrow>
                          <p
                            style={{
                              fontFamily: FONT_DISPLAY,
                              fontWeight: 700,
                              fontSize: 22,
                              lineHeight: 1.1,
                              color: TEAL,
                              margin: "6px 0 0",
                              wordWrap: "break-word",
                            }}
                          >
                            {stats.topSpot}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Best days this week — data kept crisp/upright; zine via the tape
              accent + gold kicker, not by tilting the numbers. */}
          {showBestDays ? (
            <div style={{ marginBottom: 26 }}>
              <div style={{ marginBottom: -11, paddingLeft: 8 }}>
                <Sticker sticker="creamTape" width={84} rotation="3deg" />
              </div>
              <Eyebrow color={GOLD} marginBottom={12}>
                Best days this week
              </Eyebrow>
              {bestDays!.map((slot, idx) => {
                const bandColor = colorForScore(slot.score);
                return (
                  <div
                    key={`${slot.beach_name}-${slot.weekday}-${slot.time}-${idx}`}
                    style={{
                      backgroundColor: ROW,
                      borderLeft: `3px solid ${bandColor}`,
                      borderRadius: "0 8px 8px 0",
                      marginBottom: 7,
                    }}
                  >
                    <table
                      role="presentation"
                      cellPadding={0}
                      cellSpacing={0}
                      width="100%"
                      style={{ borderCollapse: "collapse", width: "100%" }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              verticalAlign: "middle",
                              width: 96,
                              padding: "11px 0 11px 14px",
                              fontFamily: FONT_MONO,
                              fontSize: 11,
                              letterSpacing: "0.5px",
                              color: MUTED,
                            }}
                          >
                            {slot.weekday} {slot.time}
                          </td>
                          <td
                            style={{
                              verticalAlign: "middle",
                              padding: "11px 8px",
                              fontFamily: FONT_DISPLAY,
                              fontWeight: 500,
                              fontSize: 14,
                              color: TEXT,
                            }}
                          >
                            {slot.beach_name}
                          </td>
                          <td
                            style={{
                              verticalAlign: "middle",
                              width: 64,
                              textAlign: "right",
                              padding: "11px 14px 11px 0",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: FONT_MONO,
                                fontWeight: 700,
                                fontSize: 17,
                                color: bandColor,
                              }}
                            >
                              {slot.score.toFixed(1)}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontFamily: FONT_MONO,
                                fontSize: 9,
                                letterSpacing: "1px",
                                color: bandColor,
                              }}
                            >
                              {slot.label}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* CTA — cream paper note + rotated orange button */}
          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 15,
                lineHeight: 1.4,
                color: PAPER_INK,
                margin: 0,
              }}
            >
              Your sessions, your match scores, the whole logbook — waiting for
              you.
            </p>
          </PaperPanel>
          <div style={{ textAlign: "center", padding: "18px 0 2px" }}>
            <CTAButton href={ctaUrl}>See your quiver</CTAButton>
          </div>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "0 28px 22px" })}>
          <StickerStrip />
        </td>
      </tr>

      <Footer>
        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "0.5px",
            color: "rgba(184,199,224,0.65)",
            margin: 0,
          }}
        >
          You logged {stats.totalSessions} {sessionWord} this week ·{" "}
          <a
            href={unsubscribeUrl}
            style={{ color: MUTED, textDecoration: "underline" }}
          >
            Manage email preferences
          </a>
        </p>
      </Footer>
    </EmailShell>
  );
}
