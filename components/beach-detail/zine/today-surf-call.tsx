import Link from "next/link";
import type { Beach } from "@/types/database";
import type { SurfCallResult, SurfCallVerdict } from "@/lib/utils/surf-call-logic";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";
import { formatTimeInTimezone } from "@/lib/utils/date-time";
import {
  getSurfCallVerdictCall,
  SCORE_LABEL_INK,
  SCORE_LABEL_PAPER_WASH,
} from "@/components/forecast/score-band-call";
import { DoodleWave, DoodleWind, DoodleTide, DoodleStar, TornDivider } from "./atoms";

interface TodaySurfCallProps {
  beach: Beach;
  surfCallReport?: SurfCallResult | null;
  beachTimezone?: string | null;
  isTomorrow?: boolean;
}

type TierKey = "beginner" | "intermediate" | "advanced";
const TIER_LABEL: Record<TierKey, string> = {
  beginner: "beginners",
  intermediate: "intermediates",
  advanced: "advanced surfers",
};

/** Native's eyebrow: Space Mono bold caps, tracked, flat on paper. */
const NOTE_STYLE = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#4A463C",
  background: "#F4EBD8",
  padding: "2px 8px",
} as const;

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
  const call = getSurfCallVerdictCall(
    verdict,
    surfCallReport?.score,
    isTomorrow ? "upcoming" : "now",
  );
  const color = SCORE_LABEL_INK[call.label];

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
          <DoodleStar size={20} color="#8A5E00" />
          <h2
            style={{
              fontFamily: "var(--font-zine-display), 'Space Grotesk', sans-serif",
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
          <CallCaption
            label={call.label}
            action={call.action}
            trail={trail}
            color={color}
            wash={SCORE_LABEL_PAPER_WASH[call.label]}
          />
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
            Updated {updatedAt}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Native's call caption (`verdict-strip.tsx`): the rating and its call on a
 * paper wash, in a comic panel with sticker corners, an ink outline and a hard
 * ink drop. It never tilts, and the internal verdict never shows as copy.
 */
function CallCaption({
  label,
  action,
  trail,
  color,
  wash,
}: {
  label: string;
  action: string;
  trail: string | null;
  color: string;
  wash: string;
}) {
  return (
    <div
      className="relative w-full overflow-hidden px-5 pb-4 pt-3 md:px-7 md:pb-5 md:pt-4"
      style={{
        background: wash,
        border: "2.5px solid #11100D",
        borderRadius: "12px 4px 14px 6px",
        boxShadow: "7px 7px 0 #11100D",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 left-[45%]"
        style={{
          backgroundImage: "radial-gradient(rgba(17,16,13,0.07) 1.1px, transparent 1.3px)",
          backgroundSize: "6px 6px",
        }}
      />
      <div className="relative">
        <div
          className="text-[56px] md:text-[80px]"
          style={{
            fontFamily: "var(--font-zine-display), 'Space Grotesk', sans-serif",
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            color,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          className="mt-1 text-xl md:text-2xl"
          style={{ fontWeight: 700, lineHeight: 1.2, color: "#11100D" }}
        >
          {action}
        </div>
        {trail && (
          <div
            className="mt-2"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#11100D",
            }}
          >
            {trail}
          </div>
        )}
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
        style={NOTE_STYLE}
        aria-label={`Your call — for ${TIER_LABEL[displayTier]}`}
      >
        Your call · {TIER_LABEL[displayTier]}
      </div>
    );
  }

  return (
    <div
      className="absolute -top-4 -left-1 md:-top-5 md:-left-2 z-10 pointer-events-none"
      style={{ ...NOTE_STYLE, color: verdictColor }}
      aria-label="Beginner call — not you?"
    >
      For beginners · <span style={{ color: "#11100D" }}>you?</span>
    </div>
  );
}

function WhyCallout({ text }: { text: string }) {
  return (
    <div className="mt-6 md:mt-7 max-w-[640px] mx-auto">
      <p
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 17,
          lineHeight: 1.45,
          color: "#11100D",
          fontWeight: 500,
          margin: 0,
          textAlign: "center",
        }}
      >
        {text}
      </p>
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
          gap: 8,
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 16,
          color: "#11100D",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        <span>
          surf at a higher level?{" "}
          <span
            style={{
              color: "#AA4918",
              textDecoration: "underline",
              textDecorationThickness: "2px",
              textUnderlineOffset: 4,
            }}
          >
            get your call
          </span>
        </span>
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
      color: "#8A5E00",
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
            font === "display" ? "var(--font-zine-display), 'Space Grotesk', sans-serif" : "var(--font-zine-display), 'Space Grotesk', monospace",
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
  // The action phrase already makes the call; these would restate it.
  if (verdict === "YES" && ["PADDLE OUT", "WORTH A SURF"].includes(trail.trim().toUpperCase())) {
    return null;
  }
  return trail;
}

/** Timing under the call. The action phrase owns the call itself. */
function buildDisplayTrail(
  verdict: SurfCallVerdict,
  windowStart: string | null | undefined,
  timezone: string | null | undefined,
  trailOverride?: string | null,
): string | null {
  const normalizedTrailOverride = normalizeTrailOverride(verdict, trailOverride);
  if (normalizedTrailOverride && isNonTimeTrailOverride(normalizedTrailOverride)) {
    return normalizedTrailOverride;
  }

  const formattedWindow = formatWindow(windowStart, timezone);
  if (verdict === "YES") return formattedWindow ? `BEST AT ${formattedWindow}` : null;
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
