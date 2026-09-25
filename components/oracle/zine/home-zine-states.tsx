"use client";

import { BottomNav } from "@/components/home-screen/bottom-nav";
import { HomeZineShell } from "./home-zine-shell";
import { HomeHeroMedia } from "./home-hero-media";

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";

function StencilHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="zine-display"
      style={{
        fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
        fontWeight: 400,
        fontSize: 30,
        lineHeight: 1,
        letterSpacing: "-0.005em",
        textTransform: "uppercase",
        color: INK,
        margin: 0,
      }}
    >
      {children}
    </h1>
  );
}

/**
 * A block of ink-on-paper "developing" bars.
 *
 * Deliberately NOT a shimmer: the paper surface has its own grain, and a
 * moving gradient on top of it reads as a rendering artifact. A slow opacity
 * breathe respects `prefers-reduced-motion` via the shared utility class.
 */
function PaperBar({
  width,
  height = 14,
  className = "",
}: {
  width: string;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`zine-developing ${className}`}
      style={{
        width,
        height,
        background: "rgba(17,16,13,0.13)",
        boxShadow: "inset 0 0 0 1px rgba(17,16,13,0.08)",
      }}
      aria-hidden
    />
  );
}

const CREAM = "#F4EBD8";
const GOLD = "#FDB84B";

interface PendingBeach {
  beachName?: string | null;
  lat?: number | null;
  lon?: number | null;
  photoUrl?: string | null;
}

/**
 * The home beach's media card with the call withheld. The place is known from
 * the profile before discovery answers, so the page shows it immediately
 * instead of a grey block. Nothing here states a verdict or its numbers.
 */
function PendingCallPlate({
  beachName,
  lat = null,
  lon = null,
  photoUrl = null,
  chip,
  note,
}: PendingBeach & { chip: string; note?: string }) {
  const name = beachName ?? "Your surf";
  return (
    <HomeHeroMedia
      beachName={name}
      lat={lat}
      lon={lon}
      photoUrl={photoUrl}
      swellDirectionDeg={null}
      swellPeriod={0}
      showViewpoints={false}
    >
      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
        <p
          className="m-0 text-[30px] sm:text-[40px]"
          style={{
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            lineHeight: 0.95,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            color: CREAM,
          }}
        >
          {name}
        </p>
        <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(244,235,216,0.22)" }}>
          {/* Global CSS forces the heading face onto every h1, so the chip's
              mono type lives on the inner span. */}
          <h1 className="m-0">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: GOLD,
                border: `1.5px solid ${GOLD}`,
                background: "rgba(13,16,32,0.6)",
              }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse motion-reduce:animate-none"
                style={{ background: GOLD, borderRadius: 999 }}
              />
              {chip}
            </span>
          </h1>
          {note && (
            <p
              className="m-0 mt-2"
              style={{
                fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.45,
                color: CREAM,
                opacity: 0.85,
                maxWidth: 460,
              }}
            >
              {note}
            </p>
          )}
        </div>
      </div>
    </HomeHeroMedia>
  );
}

/** Same two-pane frame as the resolved page, so the call lands without a jump. */
function PendingCallPage({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <HomeZineShell>
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10"
      >
        <div className="min-w-0">
          {children}
          <div className="condition-strip mt-7" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "0 8px" }}>
                <PaperBar width="60%" height={10} />
                <div className="mt-2">
                  <PaperBar width="85%" height={26} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2.5 lg:mt-0" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <PaperBar key={i} width={`${92 - i * 9}%`} height={22} />
          ))}
        </div>
        <span className="sr-only">{label}…</span>
      </div>

      <div className="pb-20 lg:pb-0" />
      <BottomNav />
    </HomeZineShell>
  );
}

/**
 * Cold load. Before the profile resolves there is genuinely nothing to show,
 * so the paper page carries skeleton bars. Once the home beach is known, the
 * page shows that beach at once and waits only for the call, with native's
 * loading line ("Checking the buoy").
 */
export function HomeZineLoading(beach: PendingBeach = {}) {
  if (beach.lat != null && beach.lon != null) {
    return (
      <PendingCallPage label="Loading your surf call">
        <PendingCallPlate {...beach} chip="Checking the buoy" />
      </PendingCallPage>
    );
  }

  return (
    <HomeZineShell>
      <div role="status" aria-busy="true" aria-label="Loading your surf call">
        <div className="typewriter" style={{ opacity: 0.6 }}>
          Reading the buoys…
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <PaperBar width="min(420px, 80%)" height={34} />
          <PaperBar width="min(260px, 55%)" height={14} />
        </div>

        <div
          className="mt-7"
          style={{ height: 190, background: "rgba(17,16,13,0.09)" }}
          aria-hidden
        />

        <div className="condition-strip mt-7" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: "0 8px" }}>
              <PaperBar width="60%" height={10} />
              <div className="mt-2">
                <PaperBar width="85%" height={26} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <PaperBar key={i} width={`${92 - i * 9}%`} height={22} />
          ))}
        </div>

        <span className="sr-only">Loading your surf call…</span>
      </div>
    </HomeZineShell>
  );
}

/**
 * Recheck state.
 *
 * The discovery hook drops its payload whenever the surfer returns to a
 * hidden tab, on purpose: a safety hold activated while they were away has to
 * beat the positive call still sitting on the screen (see
 * `hooks/use-surf-discovery.ts` and the major-event-hold suite).
 *
 * Like native's hero ("Updating surf call"), the place stays on screen and
 * only the call is withheld. The media is the home beach's, which is known
 * without discovery; nothing here restates the prior verdict or its numbers.
 */
export function HomeZineRechecking(beach: PendingBeach) {
  return (
    <PendingCallPage label="Rechecking current conditions">
      <PendingCallPlate
        {...beach}
        chip="Updating surf call"
        note="Conditions and safety holds can change while you're away, so we re-read them before showing you a call."
      />
    </PendingCallPage>
  );
}

/**
 * Converged, but there is no usable call to show — no spots in range,
 * discovery errored, or picks are held. Honest copy plus the one action that
 * actually changes the outcome.
 */
export function HomeZineEmpty({
  beachName,
  reason,
  onSetHomeBeach,
  onRetry,
}: {
  beachName: string;
  reason: string;
  onSetHomeBeach?: () => void;
  onRetry?: () => void;
}) {
  return (
    <HomeZineShell>
      <div className="typewriter" style={{ opacity: 0.65 }}>
        {beachName}
      </div>

      <div className="mt-3">
        <StencilHeading>No call today</StencilHeading>
      </div>

      <p
        className="mt-3"
        style={{
          fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
          fontSize: 16,
          lineHeight: 1.5,
          color: INK,
          opacity: 0.78,
          maxWidth: 520,
        }}
      >
        {reason}
      </p>

      <hr
        className="mt-6"
        style={{ border: 0, borderTop: "1.5px dashed rgba(17,16,13,0.4)" }}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onSetHomeBeach && (
          <button
            type="button"
            onClick={onSetHomeBeach}
            className="label-black rot-1 focus-ring"
            style={{ cursor: "pointer", border: "none" }}
          >
            Set your home beach
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: STAMP_BLUE,
              background: "transparent",
              border: `1.5px dashed ${STAMP_BLUE}`,
              padding: "9px 16px",
            }} className="focus-ring"
          >
            Try again
          </button>
        )}
      </div>

      <div className="pb-20 lg:pb-0" />
      <BottomNav />
    </HomeZineShell>
  );
}
