"use client";

import { BottomNav } from "@/components/home-screen/bottom-nav";
import { HomeZineShell } from "./home-zine-shell";

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

/**
 * Cold load — nothing has resolved yet, so there is genuinely nothing to show.
 * Still renders the full paper page so the first paint is the real surface.
 */
export function HomeZineLoading() {
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
 * The discovery hook drops its payload on every tab resume, on purpose: a
 * safety hold activated while you were away has to beat the positive call
 * still sitting on your screen (see `hooks/use-surf-discovery.ts` and the
 * major-event-hold suite). What was wrong was the *rendering* of that window —
 * the whole page collapsed to a navy skeleton, which read as a crash rather
 * than a recheck.
 *
 * So this keeps the page, keeps the things that are not the verdict (where you
 * are, the masthead, the chrome), and is explicit that the call itself is
 * being re-read. Nothing here restates the prior verdict.
 */
export function HomeZineRechecking({
  beachName,
}: {
  beachName?: string | null;
}) {
  return (
    <HomeZineShell>
      <div role="status" aria-busy="true">
        <div className="typewriter" style={{ opacity: 0.65 }}>
          {beachName ?? "Your surf"}
        </div>

        <div className="mt-3">
          <StencilHeading>Rechecking the call</StencilHeading>
        </div>

        <p
          className="mt-3"
          style={{
            fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
            fontSize: 15,
            lineHeight: 1.5,
            color: INK,
            opacity: 0.72,
            maxWidth: 460,
          }}
        >
          Conditions and safety holds can change while you&apos;re away, so
          we re-read them before showing you a call.
        </p>

        <hr
          className="mt-6"
          style={{
            border: 0,
            borderTop: "1.5px dashed rgba(17,16,13,0.4)",
          }}
        />

        <div className="mt-6 flex flex-col gap-3" aria-hidden>
          <PaperBar width="min(360px, 72%)" height={30} />
          <PaperBar width="min(240px, 52%)" height={14} />
        </div>

        <span className="sr-only">Rechecking current conditions…</span>
      </div>

      <div className="pb-20 lg:pb-0" />
      <BottomNav />
    </HomeZineShell>
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
