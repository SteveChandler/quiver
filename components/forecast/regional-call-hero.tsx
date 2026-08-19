"use client";

/**
 * Regional Call Hero — Sticker Wall edition
 *
 * The confident, region-aware headline at the top of /forecast. Computes copy
 * from the peak-week conditions of a single region's summary and renders the
 * scene as a layered "sticker wall": photo backdrop + navy tint + scan lines
 * behind a set of absolutely / flow-positioned stickers (date, region chip,
 * wave-height tag, polaroid inset photo, handwritten pullquote, headline,
 * sub, CTAs). Each sticker has a `--depth-*` coefficient; pointer movement
 * and page scroll drive `--px`, `--py`, `--scroll` CSS vars on the wall,
 * producing a gentle parallax where stickers further from the board move
 * more. RAF-smoothed. `prefers-reduced-motion` short-circuits the loop.
 *
 * @module components/forecast/regional-call-hero
 */

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Share2 } from "lucide-react";
import { toast } from "sonner";

import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { getWaveSizeDescription } from "@/lib/utils/wave-formatters";

interface RegionalCallHeroProps {
  region: ForecastRegion;
  summary: RegionalForecastSummary | undefined;
  isAuthed: boolean;
}

interface HeadlineAngle {
  headline: string;
  peakScore: number;
  peakDay?: string;
  peakWaveRange?: string;
  peakWindDescriptor?: string;
  whyLine?: string;
}

/** Month abbreviation map to avoid locale drift between server and client. */
const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatDateSticker(date: Date): string {
  const dayName = DAY_ABBR[date.getUTCDay()];
  const month = MONTH_ABBR[date.getUTCMonth()];
  const day = date.getUTCDate();
  return `${dayName} · ${month} ${day}`;
}

function coerceDate(value: Date | string | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function headlineForScore(peakScore: number, regionName: string): string {
  if (peakScore >= 75) return `${regionName} is lit.`;
  if (peakScore >= 60) return `${regionName} is on this week.`;
  if (peakScore >= 45) return `${regionName} — fun-size midweek.`;
  return `Calm week in ${regionName} — go longboard.`;
}

function pullquoteForScore(peakScore: number): string {
  if (peakScore >= 75) return "go go go";
  if (peakScore >= 60) return "worth the paddle";
  if (peakScore >= 45) return "take a friend";
  return "flat — longboard it";
}

function windDescriptor(
  conditions: "offshore" | "light" | "onshore"
): string {
  if (conditions === "offshore") return "light offshore";
  if (conditions === "light") return "light winds";
  return "onshore wind";
}

function trendVerb(firstScore: number, lastScore: number): string {
  if (lastScore - firstScore >= 10) return "building";
  if (firstScore - lastScore >= 10) return "dropping";
  return "holding";
}

function computeHeadlineAngle(
  region: ForecastRegion,
  summary: RegionalForecastSummary | undefined
): HeadlineAngle {
  if (!summary || summary.days.length === 0) {
    return {
      headline: `Forecast catching up for ${region.name}.`,
      peakScore: 0,
    };
  }

  const peakDay = summary.days.reduce(
    (best, d) => (d.score > best.score ? d : best),
    summary.days[0]
  );
  const dayName = peakDay.dayOfWeek;
  const setHeight = formatWaveHeightRange(peakDay.avgWaveHeight);
  const size = getWaveSizeDescription(peakDay.avgWaveHeight);
  const wind = windDescriptor(peakDay.windConditions);
  const timing =
    peakDay.bestTimeSlot === "dawn-patrol"
      ? "dawn"
      : peakDay.bestTimeSlot === "morning"
        ? "AM"
        : peakDay.bestTimeSlot === "midday"
          ? "midday"
          : peakDay.bestTimeSlot === "afternoon"
            ? "PM"
            : "evening";

  const firstScore = summary.days[0]?.score ?? peakDay.score;
  const lastScore = summary.days[summary.days.length - 1]?.score ?? peakDay.score;
  const trend = trendVerb(firstScore, lastScore);

  const primarySwell = summary.upcomingSwells[0];
  const whyFragments: string[] = [];
  if (primarySwell) {
    whyFragments.push(
      `${primarySwell.direction} ${Math.round(primarySwell.period)}s`
    );
  }
  whyFragments.push(`${trend} through ${dayName}`);

  return {
    headline: headlineForScore(peakDay.score, region.name),
    peakScore: peakDay.score,
    peakDay: dayName,
    peakWaveRange: `${setHeight} (${size})`,
    peakWindDescriptor: `${timing}, ${wind}`,
    whyLine: whyFragments.join(", "),
  };
}

/**
 * Build a transform string that consumes the wall's `--px`/`--py`/`--scroll`
 * CSS custom properties with per-sticker depth coefficients. Motion-reduce
 * users get static transforms (depths are ignored at the var level — we just
 * never set --px/--py/--scroll).
 */
function stickerTransform(
  depthX: number,
  depthY: number,
  scrollCoef: number,
  rotateDeg: string
): string {
  return `translate3d(
    calc(var(--px, 0) * ${depthX}px),
    calc(var(--py, 0) * ${depthY}px + var(--scroll, 0) * ${scrollCoef}px),
    0
  ) rotate(${rotateDeg})`;
}

export function RegionalCallHero({
  region,
  summary,
  isAuthed,
}: RegionalCallHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const stickerDate = coerceDate(summary?.generatedAt);
  const dateSticker = stickerDate ? formatDateSticker(stickerDate) : "TODAY";
  const stickerDateTime = stickerDate?.toISOString();
  const recommendationsAvailable =
    summary?.recommendationAvailability?.state === "available";
  const angle = recommendationsAvailable
    ? computeHeadlineAngle(region, summary)
    : {
        headline: `Surf conditions in ${region.name}.`,
        peakScore: 0,
      };
  const objectiveDay = summary?.days[0];
  const photoUrl = summary?.photoUrl ?? null;
  const photoAlt = summary?.photoBeachName
    ? `${summary.photoBeachName}, ${region.name}`
    : region.name;
  const pullquote = recommendationsAvailable
    ? pullquoteForScore(angle.peakScore)
    : null;

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetScroll = 0;
    let currentScroll = 0;
    let raf = 0;
    let isVisible = true;

    const loop = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      currentScroll += (targetScroll - currentScroll) * 0.12;
      hero.style.setProperty("--px", currentX.toFixed(3));
      hero.style.setProperty("--py", currentY.toFixed(3));
      hero.style.setProperty("--scroll", currentScroll.toFixed(3));
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      targetX = (x - 0.5) * 2;
      targetY = (y - 0.5) * 2;
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const onScroll = () => {
      if (!isVisible) return;
      const rect = hero.getBoundingClientRect();
      if (rect.height <= 0) return;
      // -0.5 (hero fully above viewport) .. 0 (top-aligned) .. 0.5 (fully below).
      const progress = Math.max(-0.5, Math.min(0.5, -rect.top / rect.height));
      targetScroll = progress;
    };

    // Pause the RAF loop when the hero is fully off-screen so we don't wake
    // the compositor 60×/sec for nothing. Resume on intersect.
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (isVisible) {
          onScroll();
          startLoop();
        } else {
          // Drift targets back to rest so the hero isn't stuck mid-parallax
          // when it re-enters the viewport.
          targetX = 0;
          targetY = 0;
          stopLoop();
        }
      },
      { rootMargin: "150px 0px 150px 0px" }
    );
    visibilityObserver.observe(hero);

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    startLoop();

    return () => {
      stopLoop();
      visibilityObserver.disconnect();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      aria-labelledby="regional-call-hero-heading"
      className="sticker-wall relative mb-10 overflow-hidden rounded-2xl bg-[#252D6B] px-5 py-10 min-h-[24rem] sm:px-8 sm:py-14 sm:min-h-[28rem] lg:min-h-[32rem]"
      data-testid="regional-call-hero"
      style={{ perspective: "900px" }}
    >
      {/* Image backdrop — only renders when a region photo is available. */}
      {photoUrl && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              willChange: "transform",
              transform: stickerTransform(-6, -4, 40, "0deg"),
            }}
          >
            <Image
              src={photoUrl}
              alt={photoAlt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#252D6B]/90 via-[#252D6B]/80 to-[#252D6B]/85"
          />
        </>
      )}

      {/* Scan-line texture overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.1] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 3px)",
        }}
      />

      {/* Upper-right polaroid inset photo (desktop only) — a DIFFERENT beach
          than the backdrop where possible, so the hero reads as two windows
          into the region rather than one image used twice. Falls back to the
          primary photo when the region only has one approved image. The
          image is decorative (`aria-hidden`); the handwritten caption stays
          readable so screen readers still get the beach-name attribution
          (local/cultural signal, not pure decoration). */}
      {(summary?.secondaryPhotoUrl ?? photoUrl) && (
        <div
          className="pointer-events-none absolute right-6 top-6 hidden w-44 lg:block xl:w-52"
          style={{
            willChange: "transform",
            transform: stickerTransform(14, 9, -55, "4.5deg"),
          }}
        >
          <div className="rounded-[2px] bg-white p-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
            <div
              aria-hidden="true"
              className="relative aspect-[4/5] overflow-hidden"
            >
              <Image
                src={(summary?.secondaryPhotoUrl ?? photoUrl) as string}
                alt=""
                fill
                sizes="208px"
                className="object-cover"
              />
            </div>
            <p className="mt-2 text-center font-[var(--font-handwritten)] text-sm leading-tight text-[#252D6B]">
              {summary?.secondaryPhotoBeachName ??
                summary?.photoBeachName ??
                region.name}
            </p>
          </div>
        </div>
      )}

      {/* Bottom-right handwritten pullquote — score-keyed, Caveat font.
          Acts as a share button: opens native share sheet on mobile, falls
          back to clipboard-copy + toast on desktop browsers that lack the
          Web Share API. Every tier is interactive (per /over scope). */}
      {pullquote ? (
        <button
          type="button"
          onClick={() => {
          // Prefer the build-time canonical origin. When absent (e.g. a preview
          // env that didn't set `NEXT_PUBLIC_SITE_URL`) fall back to a relative
          // URL — `navigator.share` + `clipboard.writeText` both resolve it
          // against the current location, so the share recipient still gets
          // an absolute URL from their OS share sheet.
          const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
          const url = `${origin}/forecast?region=${region.slug}`;
          const payload = {
            title: `${region.name} surf forecast`,
            text: angle.headline,
            url,
          };
          const fireEvent = () => {
            try {
              fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "forecast_share",
                  properties: {
                    region: region.slug,
                    surface: "hero-pullquote",
                    peak_score: angle.peakScore,
                  },
                }),
                keepalive: true,
              }).catch(() => {});
            } catch {
              /* no-op */
            }
          };

          (async () => {
            if (
              typeof navigator !== "undefined" &&
              typeof navigator.share === "function"
            ) {
              try {
                if (
                  typeof navigator.canShare !== "function" ||
                  navigator.canShare(payload)
                ) {
                  await navigator.share(payload);
                  fireEvent();
                  return;
                }
              } catch (err) {
                if ((err as Error).name === "AbortError") return;
                // fall through to clipboard
              }
            }
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Link copied — send it to your crew");
              fireEvent();
            } catch {
              toast.error("Couldn't copy the link");
            }
          })();
          }}
          aria-label={`Share ${region.name}'s forecast`}
          className="group absolute bottom-5 right-5 hidden max-w-[16rem] flex-col items-end gap-0.5 rounded-[10px_4px_14px_4px] text-right transition-transform hover:scale-[1.04] hover:rotate-[-1.5deg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] motion-reduce:hover:scale-100 motion-reduce:hover:rotate-0 sm:right-8 sm:bottom-8 sm:inline-flex md:text-3xl"
          style={{
            willChange: "transform",
            transform: stickerTransform(11, 7, -30, "-3deg"),
          }}
        >
          <span className="inline-flex items-center gap-2 font-[var(--font-handwritten)] text-2xl leading-tight text-[#F78E42] md:text-3xl">
            <span className="whitespace-nowrap">{pullquote}</span>
            <Share2
              aria-hidden="true"
              className="h-4 w-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100 md:h-5 md:w-5"
            />
          </span>
          <span
            aria-hidden="true"
            className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[#F78E42]/65 transition-colors group-hover:text-[#F78E42]"
          >
            Tap to share
          </span>
        </button>
      ) : null}

      <div className="relative flex flex-col gap-6">
        {/* Date sticker + wave-height tag + region chip */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-[14px_6px_16px_4px] border border-[#F78E42]/40 bg-[#F78E42]/15 px-3 py-1 font-[var(--font-handwritten)] text-lg text-[#F78E42]"
            data-testid="date-sticker"
            style={{
              willChange: "transform",
              transform: stickerTransform(7, 4, -22, "-2deg"),
            }}
          >
            <time dateTime={stickerDateTime}>{dateSticker}</time>
          </span>

          {recommendationsAvailable && angle.peakWaveRange && (
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-[8px_18px_6px_16px] border border-white/20 bg-white/[0.06] px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-white/75"
              style={{
                willChange: "transform",
                transform: stickerTransform(5, 3, -14, "1.25deg"),
              }}
            >
              Peak · {angle.peakWaveRange.split(" (")[0]}
            </span>
          )}

          <Link
            href="#other-regions-strip"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
            data-testid="region-chip"
            style={{
              willChange: "transform",
              transform: stickerTransform(4, 2.5, -12, "0deg"),
            }}
          >
            <span>Showing {region.name}</span>
            <ChevronDown className="h-3 w-3 transition group-hover:translate-y-0.5" />
          </Link>
        </div>

        {/* Headline block — small depth so copy remains comfortably readable. */}
        <div
          className="max-w-3xl"
          style={{
            willChange: "transform",
            transform: stickerTransform(2.5, 1.5, -8, "0deg"),
          }}
        >
          <h1
            id="regional-call-hero-heading"
            className="font-[var(--font-heading)] text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            {angle.headline}
          </h1>

          {recommendationsAvailable &&
          angle.peakDay &&
          angle.peakWaveRange &&
          angle.peakWindDescriptor ? (
            <p className="mt-4 text-lg text-white/85 sm:text-xl">
              Best window:{" "}
              <span className="font-semibold text-white">
                {angle.peakDay} {angle.peakWindDescriptor.split(", ")[0]}
              </span>
              , {angle.peakWaveRange}, {angle.peakWindDescriptor.split(", ")[1]}.
            </p>
          ) : objectiveDay ? (
            <p className="mt-4 text-lg text-white/85 sm:text-xl">
              {objectiveDay.dayOfWeek} conditions:{" "}
              {formatWaveHeightRange(objectiveDay.avgWaveHeight)}, {windDescriptor(objectiveDay.windConditions)} wind,{" "}
              {objectiveDay.dominantTideStatus
                ? `${objectiveDay.dominantTideStatus} tide`
                : "tide status pending"}
              .
            </p>
          ) : (
            <p className="mt-4 text-lg text-white/85">
              Try again in a few — we&apos;re waiting on fresh data for {region.name}.
            </p>
          )}

          {recommendationsAvailable && angle.whyLine && (
            <p className="mt-2 font-mono text-sm text-white/60">
              Why ▸ {angle.whyLine}.
            </p>
          )}
        </div>

        {/* CTAs — depth 0 so click targets stay stable. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={`/forecast/${region.slug}`}
            data-testid="primary-cta"
            className="group inline-flex items-center justify-center gap-2 rounded-[14px_6px_16px_4px] bg-[#F78E42] px-5 py-3 font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-[#252D6B] shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-[#ffa760] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
          >
            Open {region.name} forecast
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>

          {isAuthed ? (
            <Link
              href="/"
              data-testid="authed-cta"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/40 hover:text-white"
            >
              Open Oracle for your beach
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/auth/sign-up"
              data-testid="signup-cta"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/40 hover:text-white"
            >
              Sign up for YOUR home beach
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
