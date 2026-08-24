import * as React from "react";

import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  Stamp,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import {
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  ORANGE,
  STICKER_ROTATIONS,
  SURFACE,
  TEXT,
} from "@/lib/mailer/theme";

export interface SwellWatchEmailProps {
  beachName: string;
  eventStartDate: string;
  peakDate: string;
  peakHeightFt: number;
  peakPeriodS: number;
  forecastAt: string;
  issuedAt: string;
  timezone: string;
  ctaUrl: string;
  manageUrl: string;
  unsubscribeUrl: string;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function weekdayName(dateKey: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date(`${dateKey}T12:00:00.000Z`));
  } catch {
    return dateKey;
  }
}

function dateline(forecastAt: string, timezone: string): string {
  try {
    const date = new Date(forecastAt);
    const weekday = date
      .toLocaleDateString("en-US", { weekday: "short", timeZone: timezone })
      .toUpperCase();
    const monthDay = date
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: timezone,
      })
      .toUpperCase();
    return `${weekday} · ${monthDay}`;
  } catch {
    return "";
  }
}

function periodMeaning(periodS: number): string {
  if (periodS >= 14) {
    return "Long-period groundswell. Expect more power, longer walls, and lulls between sets.";
  }
  return "Solid mid-period swell. Watch the wind and tide windows as it fills in.";
}

const secondaryLinkStyle: React.CSSProperties = {
  color: MUTED,
  textDecoration: "underline",
};

export function SwellWatchEmail({
  beachName,
  eventStartDate,
  peakDate,
  peakHeightFt,
  peakPeriodS,
  issuedAt,
  timezone,
  ctaUrl,
  manageUrl,
  unsubscribeUrl,
}: SwellWatchEmailProps) {
  const startDay = weekdayName(eventStartDate, timezone);
  const peakDay = weekdayName(peakDate, timezone);
  const height = formatNumber(peakHeightFt);
  const period = formatNumber(peakPeriodS);

  return (
    <EmailShell>
      <Wordmark dateline={dateline(issuedAt, timezone)} />

      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 22px" })}>
          <Eyebrow color={GOLD}>Swell Watch</Eyebrow>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: "collapse" }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle" }}>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 30,
                      lineHeight: 1.05,
                      color: CREAM,
                      margin: "0 0 10px",
                    }}
                  >
                    Swell incoming — {beachName}
                  </h1>
                  <p
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: TEXT,
                      margin: 0,
                    }}
                  >
                    Building {startDay}, peaking {peakDay}: ~{height} ft @{" "}
                    {period}s.
                  </p>
                </td>
                <td
                  align="right"
                  style={{ verticalAlign: "middle", paddingLeft: 14 }}
                >
                  <Stamp rotation={STICKER_ROTATIONS.soft}>
                    {height} FT
                    <br />@ {period}S
                  </Stamp>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "22px 28px" })}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: "collapse", marginBottom: 16 }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle", paddingRight: 12 }}>
                  <BeachBadge beach={beachName} size={48} />
                </td>
                <td style={{ verticalAlign: "middle" }}>
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: ORANGE,
                      marginBottom: 4,
                    }}
                  >
                    What this means
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: TEXT,
                    }}
                  >
                    {periodMeaning(peakPeriodS)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              backgroundColor: SURFACE,
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 5,
              }}
            >
              Forecast highlight
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 18,
                color: CREAM,
              }}
            >
              {startDay} arrival · {peakDay} peak
            </div>
          </div>

          <CTAButton href={ctaUrl}>Check {beachName} forecast</CTAButton>
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
            fontSize: 11,
            letterSpacing: "0.5px",
            color: MUTED,
            margin: 0,
          }}
        >
          <a href={manageUrl} style={secondaryLinkStyle}>
            Manage your alerts
          </a>
          {" · "}
          <a href={unsubscribeUrl} style={secondaryLinkStyle}>
            Unsubscribe
          </a>
        </p>
      </Footer>
    </EmailShell>
  );
}
