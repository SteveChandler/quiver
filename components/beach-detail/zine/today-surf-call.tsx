import Link from "next/link";
import type { Beach } from "@/types/database";
import type { SurfCallResult, SurfCallVerdict } from "@/lib/utils/surf-call-logic";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";
import { formatTimeInTimezone } from "@/lib/utils/date-time";
import { DoodleWave, DoodleWind, DoodleTide, DoodleStar, TornDivider, HandArrow } from "./atoms";

interface TodaySurfCallProps {
  beach: Beach;
  surfCallReport?: SurfCallResult | null;
  beachTimezone?: string | null;
  isTomorrow?: boolean;
}

const ZINE_YES_DARK_TEAL_3_95_CONTRAST_ON_TAN = "#006B5F";

const VERDICT_COLOR: Record<SurfCallVerdict, string> = {
  YES: ZINE_YES_DARK_TEAL_3_95_CONTRAST_ON_TAN,
  MAYBE: "#B47A0F",
  NO: "#5C5A57",
};

type TierKey = "beginner" | "intermediate" | "advanced";
const TIER_LABEL: Record<TierKey, string> = {
  beginner: "beginners",
  intermediate: "intermediates",
  advanced: "advanced surfers",
};

function selectDisplayTier(userTier: SkillLevel | null | undefined): TierKey {
  if (userTier === "intermediate") return "intermediate";
  if (userTier === "advanced" || userTier === "expert") return "advanced";
  return "beginner";
}

export function TodaySurfCall({
  beach,
  surfCallReport,
  beachTimezone,
  isTomorrow = false,
}: TodaySurfCallProps) {
  if (!surfCallReport) return null;

  const tiers = surfCallReport?.tiers ?? null;
  const userTier = surfCallReport?.userTier ?? null;
  const displayTier: TierKey | null = tiers ? selectDisplayTier(userTier) : null;
  const tierSlice = displayTier && tiers ? tiers[displayTier] : null;

  const fallbackVerdict: SurfCallVerdict = surfCallReport?.verdict ?? "MAYBE";

  const verdict: SurfCallVerdict = tierSlice?.verdict ?? fallbackVerdict;
  const trail = buildDisplayTrail(
    verdict,
    tierSlice?.bestWindowStart ?? surfCallReport?.bestWindowStart ?? null,
    beachTimezone,
    tierSlice?.trail,
  );
  const color = VERDICT_COLOR[verdict];

  const isAuthed = userTier != null;
  const showUpgradeCta = tiers != null && !isAuthed;
  const bestWindCardinal =
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? degreeWindowToCardinal(
          beach.wind_offshore_deg - beach.wind_offshore_tol_deg,
          beach.wind_offshore_deg + beach.wind_offshore_tol_deg,
        ) ?? null
      : null;

  const updatedAt = surfCallReport?.updatedAt
    ? formatTimeInTimezone(surfCallReport.updatedAt, beachTimezone) || null
    : null;

  return (
    <section
      className="relative mt-8"
      aria-label={isTomorrow ? "Tomorrow's surf call" : "Today's surf call"}
    >
      <TornDivider />

      <div
        className="relative px-5 pt-7 pb-10 md:px-8 md:pt-9 md:pb-12"
        style={{
          background: "linear-gradient(180deg, #EDE2C8 0%, #DCC9A2 100%)",
          boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
        }}
      >
        {/* Section header — title only; metadata moves to the printer's mark at bottom-right */}
        <div className="flex items-center gap-3">
          <DoodleStar size={20} color="#0B3A75" />
          <h2
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 400,
              fontSize: 26,
              color: "#11100D",
              letterSpacing: "-0.005em",
              textTransform: "uppercase",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {isTomorrow ? "Tomorrow's Surf Call" : "Today's Surf Call"}
          </h2>
        </div>

        {/* Stamp container — narrow + horizontally centered so the verdict reads
            as the marquee, not a left-aligned subhead. The margin scrawl is pinned
            absolutely to the top-left of the stamp so the "for beginners — you?"
            question physically attaches to the verdict instead of sitting in a
            quiet eyebrow row above it. */}
        <div className="relative mt-9 md:mt-11 md:max-w-[520px] md:mx-auto">
          {tiers && (
            <TierMarginScrawl displayTier={displayTier!} isAuthed={isAuthed} verdictColor={color} />
          )}
          <YesStamp verdict={verdict} trail={trail} color={color} />
        </div>

        {/* Why-callout — promoted from footer to right under the stamp.
            This is the editorial voice (the local who paddled out yesterday)
            and it deserves higher visual presence than a footnote. */}
        {surfCallReport?.whySentence && (
          <WhyCallout text={surfCallReport.whySentence} />
        )}

        {showUpgradeCta && (
          <div className="flex justify-center">
            <UpgradeCallHint />
          </div>
        )}

        {/* 3-cell condition strip. BEST WINDOW removed (the trail caption "BEST AT 5:00 PM"
            inside the stamp covers it). BEST WIND no longer renders as a competing
            navy circle — its data folds into the WIND cell as an offshore-window subtitle. */}
        <ConditionStrip
          surfCallReport={surfCallReport}
          bestWindCardinal={bestWindCardinal}
        />

        {/* Printer's mark — small mono timestamp at bottom-right, like the registration
            mark on a screen-printed poster. Reads as production credit, not headline. */}
        {updatedAt && (
          <div
            className="absolute bottom-2 right-3 md:bottom-3 md:right-4"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#11100D",
              opacity: 0.5,
            }}
            aria-label={`Updated ${updatedAt}`}
          >
            ⚑ updated {updatedAt}
          </div>
        )}
      </div>
    </section>
  );
}

function YesStamp({ verdict, trail, color }: { verdict: SurfCallVerdict; trail: string; color: string }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center"
      style={{
        border: `5px double ${color}`,
        padding: "10px 24px 8px",
        transform: "rotate(-1.5deg)",
        position: "relative",
        filter: "url(#zine-rough-edge)",
        background: `linear-gradient(180deg, rgba(244,235,216,0.6) 0%, ${color}1A 100%)`,
        // Two-layer offset shadow sells the "stamped on paper twice" affordance.
        boxShadow: `5px 6px 0 ${color}55, 12px 14px 0 ${color}22`,
      }}
    >
      {/* Verdict word — the marquee. Massive, single-line, color-coded. */}
      <div
        className="text-[96px] md:text-[150px]"
        style={{
          fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
          fontWeight: 900,
          lineHeight: 0.88,
          letterSpacing: "-0.025em",
          color,
          textTransform: "uppercase",
          textAlign: "center",
          textShadow: `2px 2px 0 ${color}33, -1px -1px 0 ${color}22`,
        }}
      >
        {verdict}
      </div>
      {/* Trail caption — small stamp-impression date marker, not a separate label. */}
      <div
        className="-mt-1 md:mt-0"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "#11100D",
          textAlign: "center",
          opacity: 0.78,
        }}
      >
        {trail}
      </div>
    </div>
  );
}

function TierMarginScrawl({
  displayTier,
  isAuthed,
  verdictColor,
}: {
  displayTier: TierKey;
  isAuthed: boolean;
  verdictColor: string;
}) {
  // Pinned absolutely to the upper-left of the stamp container so the question
  // physically attaches to the verdict — the user can't miss it.
  if (isAuthed) {
    return (
      <div
        className="absolute -top-4 -left-1 md:-top-5 md:-left-2 z-10 pointer-events-none"
        style={{
          transform: "rotate(-3deg)",
          fontFamily: "var(--font-handwritten), cursive",
          fontSize: 18,
          fontWeight: 700,
          color: "#0B3A75",
          background: "rgba(244,235,216,0.85)",
          padding: "2px 8px",
          borderRadius: 2,
        }}
        aria-label={`Your call — for ${TIER_LABEL[displayTier]}`}
      >
        ✦ your call <span style={{ opacity: 0.65, fontSize: 14 }}>· {TIER_LABEL[displayTier]}</span>
      </div>
    );
  }

  return (
    <div
      className="absolute -top-5 -left-2 md:-top-6 md:-left-3 z-10 pointer-events-none"
      style={{
        transform: "rotate(-4deg)",
        fontFamily: "var(--font-handwritten), cursive",
        fontSize: 22,
        fontWeight: 700,
        color: verdictColor,
        background: "rgba(244,235,216,0.85)",
        padding: "2px 10px",
        borderRadius: 2,
      }}
      aria-label="Beginner call — not you?"
    >
      for beginners <span style={{ color: "#11100D" }}>— you?</span>
    </div>
  );
}

function WhyCallout({ text }: { text: string }) {
  return (
    <div className="mt-6 md:mt-7 max-w-[640px] mx-auto">
      <p
        style={{
          fontFamily: "var(--font-handwritten), cursive",
          fontSize: 26,
          lineHeight: 1.18,
          color: "#11100D",
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
        }}
      >
        <span aria-hidden style={{ color: "#0B3A75", marginRight: 6 }}>“</span>
        {text}
        <span aria-hidden style={{ color: "#0B3A75", marginLeft: 4 }}>”</span>
      </p>
      {/* Hand-drawn squiggle — wider/wavier than CSS wavy underline, sells the editorial annotation. */}
      <svg
        viewBox="0 0 240 8"
        preserveAspectRatio="none"
        aria-hidden
        style={{ display: "block", width: "min(280px, 80%)", height: 8, marginTop: 4, marginInline: "auto" }}
      >
        <path
          d="M 1 5 Q 12 0, 24 5 T 48 5 T 72 5 T 96 5 T 120 5 T 144 5 T 168 5 T 192 5 T 216 5 T 239 5"
          stroke="#0B3A75"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function UpgradeCallHint() {
  return (
    <div className="mt-5 md:mt-6">
      <Link
        href="/auth?mode=signin"
        aria-label="Sign in to see the surf call for your level"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          fontFamily: "var(--font-handwritten), cursive",
          fontSize: 24,
          color: "#11100D",
          fontWeight: 700,
          transform: "rotate(-2deg)",
          textDecoration: "none",
        }}
      >
        <span>
          surf at a higher level?{" "}
          <span
            style={{
              textDecoration: "underline wavy",
              textDecorationThickness: "2.5px",
              textUnderlineOffset: 5,
              textDecorationColor: "#B91C1C",
            }}
          >
            get your call
          </span>
        </span>
        <HandArrow dir="down-right" length={56} color="#11100D" strokeWidth={2.6} />
      </Link>
    </div>
  );
}

function ConditionStrip({
  surfCallReport,
  bestWindCardinal,
}: {
  surfCallReport?: SurfCallResult | null;
  bestWindCardinal: string | null;
}) {
  const swell = surfCallReport?.waveHeight && surfCallReport.waveHeight !== "Unknown" ? surfCallReport.waveHeight : "—";
  const windCompass = surfCallReport?.windCompass ?? "—";
  const windSpeed = surfCallReport?.windSpeed ?? "";
  const windType = surfCallReport?.windType ? surfCallReport.windType.toUpperCase() : "";
  const tidePhase = surfCallReport?.tidePhase ? surfCallReport.tidePhase.toUpperCase() : "—";
  const tideHeight = surfCallReport?.tideHeight ?? "";

  const cells = [
    {
      label: "SWELL",
      icon: <DoodleWave size={28} />,
      big: swell,
      sub: null,
      font: "display" as const,
      color: "#0B3A75",
    },
    {
      label: "WIND",
      icon: <DoodleWind size={28} />,
      big: (
        <>
          {windCompass} {windSpeed}
        </>
      ),
      // Subtitle folds in BEST WIND (offshore preference) so the data isn't lost
      // when we kill the navy circle stamp.
      sub: bestWindCardinal
        ? windType
          ? `${windType} · best ${bestWindCardinal}`
          : `best ${bestWindCardinal}`
        : windType || null,
      font: "serif" as const,
    },
    {
      label: "TIDE",
      icon: <DoodleTide size={20} />,
      big: tidePhase,
      sub: tideHeight || null,
      font: "display" as const,
    },
  ];

  return (
    <div className="condition-strip mt-7" role="group" aria-label="Current conditions">
      {cells.map((c) => (
        <ConditionCell key={c.label} {...c} />
      ))}
    </div>
  );
}

function ConditionCell({
  label,
  icon,
  big,
  sub,
  font,
  color = "#11100D",
}: {
  label: string;
  icon: React.ReactNode;
  big: React.ReactNode;
  sub: React.ReactNode | null;
  font: "display" | "serif";
  color?: string;
}) {
  return (
    <div style={{ padding: "0 8px", position: "relative", minWidth: 0 }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#11100D",
          }}
        >
          {label}
        </span>
        <span style={{ marginLeft: "auto", opacity: 0.85 }}>{icon}</span>
      </div>
      <div
        className="text-[24px] md:text-[34px]"
        style={{
          fontFamily:
            font === "display" ? "var(--font-zine-display), 'Bowlby One', sans-serif" : "var(--font-zine-display), 'Bowlby One', monospace",
          fontWeight: 900,
          lineHeight: 1.05,
          color,
          letterSpacing: "-0.01em",
          wordBreak: "keep-all",
        }}
      >
        {big}
      </div>
      {sub && (
        <div
          className="mt-1"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#11100D",
            opacity: 0.72,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function isNonTimeTrailOverride(trail: string | null | undefined): boolean {
  return !!trail && !/^(BEST|TRY) AT /i.test(trail);
}

function normalizeTrailOverride(
  verdict: SurfCallVerdict,
  trail: string | null | undefined,
): string | null {
  if (!trail) return null;
  if (verdict === "YES" && trail.trim().toUpperCase() === "PADDLE OUT") {
    return "GO SURF!";
  }
  return trail;
}

function buildDisplayTrail(
  verdict: SurfCallVerdict,
  windowStart: string | null | undefined,
  timezone: string | null | undefined,
  trailOverride?: string | null,
): string {
  const normalizedTrailOverride = normalizeTrailOverride(verdict, trailOverride);
  if (normalizedTrailOverride && isNonTimeTrailOverride(normalizedTrailOverride)) {
    return normalizedTrailOverride;
  }

  const formattedWindow = formatWindow(windowStart, timezone);
  if (verdict === "YES") return formattedWindow ? `BEST AT ${formattedWindow}` : "GO SURF!";
  if (verdict === "MAYBE") return formattedWindow ? `TRY AT ${formattedWindow}` : "KEEP WATCHING";
  return "WAIT FOR SWELL";
}

function formatWindow(
  iso: string | null | undefined,
  timezone: string | null | undefined,
): string | null {
  if (!iso) return null;
  return formatTimeInTimezone(iso, timezone) || null;
}
