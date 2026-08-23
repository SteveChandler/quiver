// lib/mailer/templates/ConsolidatedAlertEmail.tsx
import * as React from "react";

import type { MatchingWindow } from "@/lib/alerts/types";
import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import { beachBadgeUrl } from "@/lib/mailer/stickers";
import {
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  ORANGE,
  STICKER_ROTATIONS,
  SURFACE,
  TEXT,
} from "@/lib/mailer/theme";
import {
  formatWaveHeightRange,
  formatWindSpeed,
  formatSwellPeriod,
} from "@/lib/formatters/surf-data";
import { degreesToCardinal } from "@/lib/utils/geo-utils";

const KNOTS_TO_MPH = 1.15078;

export interface ConsolidatedAlertEmailProps {
  displayName: string | null;
  alertDate: string;
  matches: MatchingWindow[];
  manageAlertsUrl: string;
  unsubscribeUrl: string;
  baseUrl: string;
}

export function ConsolidatedAlertEmail({
  displayName,
  alertDate,
  matches,
  manageAlertsUrl,
  unsubscribeUrl,
  baseUrl,
}: ConsolidatedAlertEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";
  const headingDate = formatEmailHeadingDate(alertDate);

  return (
    <EmailShell>
      <Wordmark dateline={headingDate} />

      {/* Masthead — gold kicker + rotated greeting */}
      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 20px" })}>
          <Eyebrow color={GOLD}>Your surf report</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1.05,
              color: CREAM,
              margin: "0 0 4px",
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            {greeting}
          </h1>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              letterSpacing: "0.5px",
              color: MUTED,
              margin: 0,
            }}
          >
            {headingDate}
          </p>
        </td>
      </tr>

      {/* One card per matching beach window */}
      {matches.map((match, i) => {
        const timeWindow = formatWindow(match);
        const conditionsLine = buildConditionsLine(match.conditions_snapshot);
        const beachUrl = buildEmailBeachUrl(baseUrl, match);
        const ruleName = formatEmailRuleName(match.rule_name);
        const tokenParam = match.disable_token
          ? `?token=${match.disable_token}`
          : "";
        const disableUrl = `${baseUrl}/api/alerts/rules/${match.rule_id}/disable-email${tokenParam}`;
        const hasBadge = beachBadgeUrl(match.beach_name) !== null;

        return (
          <tr key={match.rule_id + i}>
            <td
              {...cellBg(i % 2 === 0 ? CARD : SURFACE, {
                padding: "22px 28px",
                borderTop: i === 0 ? undefined : `1px solid ${CANVAS}`,
              })}
            >
              {/* Beach name + badge */}
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
                        <BeachBadge beach={match.beach_name} size={48} />
                      </td>
                    ) : null}
                    <td style={{ verticalAlign: "middle" }}>
                      <p
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontWeight: 700,
                          fontSize: 21,
                          lineHeight: 1.1,
                          color: CREAM,
                          margin: 0,
                        }}
                      >
                        {match.beach_name}
                      </p>
                      <p
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          letterSpacing: "0.5px",
                          color: MUTED,
                          margin: "4px 0 0",
                        }}
                      >
                        {ruleName}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Prominent time window chip */}
              <div
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 8,
                  padding: "10px 14px",
                  margin: "16px 0 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: ORANGE,
                    marginBottom: 4,
                  }}
                >
                  {timeWindow.label}
                </div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 18,
                    lineHeight: 1.3,
                    color: ORANGE,
                    wordBreak: "break-word",
                  }}
                >
                  {timeWindow.text}
                </div>
              </div>

              {/* Conditions — Space Mono labelled metrics */}
              {conditionsLine ? (
                <p
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: TEXT,
                    margin: "0 0 16px",
                    wordBreak: "break-word",
                  }}
                >
                  {conditionsLine}
                </p>
              ) : null}

              {/* Primary CTA + secondary disable link */}
              <div style={{ marginBottom: 10 }}>
                <CTAButton href={beachUrl}>
                  Check {match.beach_name} forecast
                </CTAButton>
              </div>
              <p
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: "0.5px",
                  margin: 0,
                }}
              >
                <a href={disableUrl} style={secondaryLinkStyle}>
                  Disable this rule
                </a>
              </p>
            </td>
          </tr>
        );
      })}

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
          <a href={manageAlertsUrl} style={secondaryLinkStyle}>
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

const secondaryLinkStyle: React.CSSProperties = {
  color: MUTED,
  textDecoration: "underline",
};

export interface FormattedEmailWindow {
  label: "Good Around" | "Good Window";
  text: string;
}

export function formatEmailHeadingDate(alertDate: string): string {
  const [weekday, rest] = alertDate.split(", ");
  const weekdayMap: Record<string, string> = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };

  if (!rest || !weekdayMap[weekday]) return alertDate;
  return `${weekdayMap[weekday]}, ${rest}`;
}

export function formatWindow(match: MatchingWindow): FormattedEmailWindow {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: match.beach_timezone,
  };
  const start = new Date(match.window_start).toLocaleTimeString("en-US", opts);
  const end = new Date(match.window_end).toLocaleTimeString("en-US", opts);
  const best = new Date(match.best_hour).toLocaleTimeString("en-US", opts);
  const tzAbbr = new Date(match.best_hour)
    .toLocaleTimeString("en-US", {
      timeZone: match.beach_timezone,
      timeZoneName: "short",
    })
    .split(" ")
    .pop();

  const startMs = new Date(match.window_start).getTime();
  const endMs = new Date(match.window_end).getTime();
  const durationMinutes = (endMs - startMs) / 60000;

  if (Number.isFinite(durationMinutes) && durationMinutes <= 75) {
    return {
      label: "Good Around",
      text: `${best} ${tzAbbr}`,
    };
  }

  return {
    label: "Good Window",
    text: `${start} – ${end} ${tzAbbr} · peak ${best}`,
  };
}

export function buildEmailBeachUrl(
  baseUrl: string,
  match: MatchingWindow,
): string {
  const beachIdentifier = match.beach_slug || match.beach_id;
  return `${baseUrl}/beach/${encodeURIComponent(beachIdentifier)}`;
}

export function formatEmailRuleName(ruleName: string): string {
  return ruleName.replace(/\s+at your home break$/i, "");
}

// Renders the conditions row using the same units + rounding as the live web
// CURRENT CONDITIONS card. Snapshot fields are independently optional so a
// partial forecast still produces a clean line (no "undefined NW" / "NaN mph").
// `wind_speed` is in knots per ForecastHour (lib/alerts/best-hour.ts); convert
// to mph here to match the website. Exported for unit tests.
//
// Metrics use uppercase Space-Mono labels (SWELL / WIND / TIDE) separated by
// " · " instead of emoji, so the line reads as crisp technical data and renders
// consistently across email clients that strip or restyle emoji.
//
// Period and direction prefer the total-spectrum `wave_period` /
// `wave_direction` (the same fields the web Current Conditions card reads, see
// components/beach-detail/tabs/forecast-tab.tsx) over the primary-train
// `swell_1_*`. wave_direction is already a cardinal string ("WSW") in
// enhanced_forecasts; swell_1_direction is numeric degrees and gets converted
// via degreesToCardinal as a fallback when wave_direction is absent.
export function buildConditionsLine(snap: Record<string, unknown>): string {
  const parts: string[] = [];

  if (
    typeof snap.wave_height === "number" &&
    Number.isFinite(snap.wave_height)
  ) {
    let swell = `SWELL ${formatWaveHeightRange(snap.wave_height)}`;

    const period =
      typeof snap.wave_period === "number" && Number.isFinite(snap.wave_period)
        ? snap.wave_period
        : typeof snap.swell_1_period === "number" &&
            Number.isFinite(snap.swell_1_period)
          ? snap.swell_1_period
          : null;
    if (period !== null) swell += ` @ ${formatSwellPeriod(period)}`;

    const cardinal =
      typeof snap.wave_direction === "string" && snap.wave_direction.length > 0
        ? snap.wave_direction
        : typeof snap.swell_1_direction === "number" &&
            Number.isFinite(snap.swell_1_direction)
          ? degreesToCardinal(snap.swell_1_direction)
          : null;
    if (cardinal !== null) swell += ` ${cardinal}`;

    parts.push(swell);
  }

  if (typeof snap.wind_speed === "number" && Number.isFinite(snap.wind_speed)) {
    let wind = `WIND ${formatWindSpeed(snap.wind_speed * KNOTS_TO_MPH)}`;
    if (
      typeof snap.wind_direction_deg === "number" &&
      Number.isFinite(snap.wind_direction_deg)
    ) {
      wind += ` ${degreesToCardinal(snap.wind_direction_deg)}`;
    }
    parts.push(wind);
  }

  if (typeof snap.tide_status === "string" && snap.tide_status.length > 0) {
    parts.push(`TIDE ${snap.tide_status.toLowerCase()}`);
  }

  if (
    typeof snap.beginner_window_reason === "string" &&
    snap.beginner_window_reason.length > 0
  ) {
    parts.push(`why: ${snap.beginner_window_reason}`);
  }

  return parts.join(" · ");
}
