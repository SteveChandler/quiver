"use client";

import { HalftonePhoto, DoodleWave, DoodleWind, DoodleTide } from "@/components/beach-detail/zine/atoms";
import { compassPointToWord, type CompassPoint } from "@/lib/utils/distance-utils";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";

/**
 * Verdict words keep the home screen's existing copy — changing what the call
 * is *called* is a product decision, not a restyle. They render uppercase via
 * CSS rather than in JS so the accessible name and the DOM text stay sentence
 * case ("Maybe"), which is what assistive tech and the decision-badge tests
 * read.
 *
 * Colours are shared with the beach-detail surf call
 * (`components/beach-detail/zine/today-surf-call.tsx`) so one verdict looks
 * like one verdict across surfaces.
 */
const VERDICT_WORD: Record<CanonicalDecisionVerdict, string> = {
  go: "Go",
  maybe: "Maybe",
  no: "No",
};

const VERDICT_COLOR: Record<CanonicalDecisionVerdict, string> = {
  // Dark teal clears 3.95:1 on the tan plate — the obvious green does not.
  go: "#006B5F",
  maybe: "#B47A0F",
  no: "#5C5A57",
};

export interface HomeCallPlateProps {
  beachName: string;
  heroPhotoUrl: string;
  verdict: CanonicalDecisionVerdict | null;
  waveHeight: string;
  swellDirection: string;
  swellPeriod: number;
  windSpeed: number;
  windDirection: string | number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  bestWindowTitle: string;
  bestWindowSubtitle: string;
  bestWindowTime: string;
  isTomorrow?: boolean;
  /** Editorial one-liner — regional call or generated greeting. */
  greeting?: string;
  userName?: string | null;
  levelTitle?: string | null;
  xpTotal?: number | null;
  driveContext?: {
    distanceMiles: number;
    bearing: CompassPoint;
    homeBeachName: string;
  };
}

export function HomeCallPlate({
  beachName,
  heroPhotoUrl,
  verdict,
  waveHeight,
  swellDirection,
  swellPeriod,
  windSpeed,
  windDirection,
  tideHeight,
  tideDirection,
  waterTemp,
  bestWindowTitle,
  bestWindowSubtitle,
  bestWindowTime,
  isTomorrow,
  greeting,
  userName,
  levelTitle,
  xpTotal,
  driveContext,
}: HomeCallPlateProps) {
  const color = verdict ? VERDICT_COLOR[verdict] : STAMP_BLUE;
  const word = verdict ? VERDICT_WORD[verdict] : "—";
  const trail =
    verdict === "no"
      ? "Wait for swell"
      : bestWindowTime && bestWindowTime !== "—"
        ? // Cased by CSS, not here — the DOM keeps "5:45am" so time strings
          // stay readable to assistive tech and assertable in tests.
          `${isTomorrow ? "Tomorrow" : "Best"} at ${bestWindowTime}`
        : "Check the windows";

  return (
    <section role="banner" aria-label={`${beachName} surf conditions`}>
      {/* Eyebrow: who and where. The drive line is the whole reason the hero
          may not be your home beach, so it sits with the place, not buried.
          Casing is CSS-only — the DOM keeps the real beach name. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="typewriter" style={{ opacity: 0.7 }}>
          <span>{beachName}</span>
          {driveContext && (
            <span style={{ opacity: 0.8 }} data-testid="hero-drive-subtitle">
              {" · "}
              {Math.round(driveContext.distanceMiles)} mi{" "}
              {compassPointToWord(driveContext.bearing)} of{" "}
              {driveContext.homeBeachName}
            </span>
          )}
        </div>

        {(levelTitle || xpTotal != null) && (
          <div
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: INK,
              opacity: 0.62,
            }}
          >
            {levelTitle && <span>{levelTitle}</span>}
            {xpTotal != null && <span>{xpTotal.toLocaleString()} XP</span>}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        {/* Left: the call itself */}
        <div className="min-w-0">
          {/* The call is the page's headline. Quiver's whole position is that
              it makes the call rather than handing you a forecast to
              interpret, so the verdict — not the wave height — is the h1. */}
          <div className="relative">
            {/* Width hugs the word — a stamp is pressed onto the page, it
                doesn't stretch to fill the column. */}
            <div
              className="flex flex-col items-center justify-center"
              data-testid="hero-decision-badge"
              aria-label={`Session decision: ${word}`}
              style={{
                width: "fit-content",
                maxWidth: "100%",
                border: `5px double ${color}`,
                padding: "14px 32px 10px",
                transform: "rotate(-1.5deg)",
                filter: "url(#zine-rough-edge)",
                background: `linear-gradient(180deg, rgba(244,235,216,0.6) 0%, ${color}1A 100%)`,
                boxShadow: `5px 6px 0 ${color}55, 12px 14px 0 ${color}22`,
              }}
            >
              <h1
                className="zine-display text-[76px] sm:text-[104px] md:text-[124px]"
                style={{
                  fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                  fontWeight: 900,
                  lineHeight: 0.88,
                  letterSpacing: "-0.025em",
                  color,
                  textTransform: "uppercase",
                  textAlign: "center",
                  textShadow: `2px 2px 0 ${color}33, -1px -1px 0 ${color}22`,
                  margin: 0,
                }}
              >
                {word}
              </h1>
              <div
                className="mt-2"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: INK,
                  textAlign: "center",
                  opacity: 0.78,
                }}
              >
                {trail}
              </div>
            </div>
          </div>

          {/* Editorial line — the local's read, in the marker hand. */}
          {greeting && (
            <p
              className="mt-6 max-w-[560px]"
              style={{
                fontFamily: "var(--font-handwritten), cursive",
                fontSize: 24,
                lineHeight: 1.2,
                color: INK,
                fontWeight: 700,
                margin: "24px 0 0",
              }}
            >
              <span aria-hidden style={{ color: STAMP_BLUE, marginRight: 5 }}>
                &ldquo;
              </span>
              {greeting}
              <span aria-hidden style={{ color: STAMP_BLUE, marginLeft: 3 }}>
                &rdquo;
              </span>
            </p>
          )}

          {/* Best window, as a taped note rather than another card. */}
          <div
            className="mt-6 inline-block rot-1"
            style={{
              background: "#F0E5CC",
              padding: "12px 18px",
              boxShadow: "2px 4px 0 rgba(0,0,0,0.18)",
              maxWidth: "100%",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontSize: 17,
                lineHeight: 1.15,
                color: INK,
                textTransform: "uppercase",
              }}
            >
              {bestWindowTitle}
            </div>
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
                fontSize: 13,
                color: INK,
                opacity: 0.72,
              }}
            >
              {bestWindowSubtitle}
            </div>
          </div>
        </div>

        {/* Right: the photo, as a taped plate. Halftone keeps it a printed
            picture rather than a glossy hero image. */}
        <figure className="relative m-0 hidden md:block">
          <span className="tape tl" aria-hidden />
          <span className="tape br" aria-hidden />
          {/* No `label` here — the beach name already reads once in the
              eyebrow above, and the design system forbids repeating the same
              badge on one surface. */}
          <HalftonePhoto
            src={heroPhotoUrl}
            alt={`${beachName} conditions`}
            height={230}
          />
          <figcaption
            className="mt-2"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: INK,
              opacity: 0.55,
            }}
          >
            {userName ? `Filed for ${userName}` : "Filed today"}
          </figcaption>
        </figure>
      </div>

      <ConditionStrip
        waveHeight={waveHeight}
        swellDirection={swellDirection}
        swellPeriod={swellPeriod}
        windSpeed={windSpeed}
        windDirection={windDirection}
        tideHeight={tideHeight}
        tideDirection={tideDirection}
        waterTemp={waterTemp}
      />
    </section>
  );
}

function ConditionStrip({
  waveHeight,
  swellDirection,
  swellPeriod,
  windSpeed,
  windDirection,
  tideHeight,
  tideDirection,
  waterTemp,
}: {
  waveHeight: string;
  swellDirection: string;
  swellPeriod: number;
  windSpeed: number;
  windDirection: string | number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
}) {
  const cells = [
    {
      label: "SWELL",
      icon: <DoodleWave size={26} />,
      big: waveHeight,
      ariaLabel: `Wave height ${waveHeight}`,
      testId: "hero-wave-height",
      sub: swellPeriod > 0 ? `${swellDirection} @ ${swellPeriod}s` : swellDirection,
      color: STAMP_BLUE,
    },
    {
      label: "WIND",
      icon: <DoodleWind size={26} />,
      big: windSpeed > 0 ? `${windDirection} ${Math.round(windSpeed)}` : "—",
      sub: windSpeed > 0 ? "MPH" : null,
      color: INK,
    },
    {
      label: "TIDE",
      icon: <DoodleTide size={20} />,
      big: tideHeight ? `${tideHeight.toFixed(1)}FT` : "—",
      sub: tideDirection.toUpperCase(),
      color: INK,
    },
    {
      label: "WATER",
      icon: null,
      big: waterTemp > 0 ? `${Math.round(waterTemp)}°` : "—",
      sub: null,
      color: INK,
    },
  ];

  return (
    <div className="condition-strip mt-7" role="group" aria-label="Current conditions">
      {cells.map((c) => (
        <div key={c.label} style={{ padding: "0 8px", minWidth: 0 }}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: INK,
              }}
            >
              {c.label}
            </span>
            {c.icon && <span style={{ marginLeft: "auto", opacity: 0.85 }}>{c.icon}</span>}
          </div>
          <div
            className="text-[20px] md:text-[28px]"
            aria-label={"ariaLabel" in c ? c.ariaLabel : undefined}
            data-testid={"testId" in c ? c.testId : undefined}
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 900,
              lineHeight: 1.05,
              color: c.color,
              letterSpacing: "-0.01em",
              wordBreak: "keep-all",
            }}
          >
            {c.big}
          </div>
          {c.sub && (
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: INK,
                opacity: 0.72,
              }}
            >
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
