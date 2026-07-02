"use client";

import {
  ArrowRight,
  Play,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import { ZineSurface } from "@/components/zine";
import { buildAppHandoffPath } from "@/lib/constants/app-handoff";
import { cn } from "@/lib/utils";

export type PbscVisitorPlatform = "ios" | "android" | "unknown";

type PbscPlacement = "hero_primary" | "bottom_primary";

interface PbscWelcomeClientProps {
  platform: PbscVisitorPlatform;
}

interface GetAppCtaProps {
  platform: PbscVisitorPlatform;
  placement: PbscPlacement;
  className?: string;
}

const HERO_WORDS = ["WELCOME TO", "QUIVER"] as const;
const HERO_ROTATIONS = [-1.5, 1.1] as const;

const GOOD_DAY_NOTES = [
  {
    title: "Your good days, on repeat",
    body: "Quiver remembers the sessions you rated highest and compares that signal against today's forecast.",
  },
  {
    title: "Local signal beats generic calls",
    body: "Beach, board, tide, wind, and swell notes become a personal pattern library for the next window.",
  },
  {
    title: "Get it before the next paddle",
    body: "Scan, install, save your home break, and start teaching Quiver what your best days feel like.",
  },
] as const;

const CTA_LABELS: Record<PbscVisitorPlatform, string> = {
  ios: "Get it on the App Store",
  android: "Get it on Google Play",
  unknown: "Get the app",
};

const VIDEO_POSTER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="#F4EBD8"/>
  <path d="M0 654C129 590 224 640 348 590C487 534 584 574 712 518C858 454 989 506 1200 414V900H0Z" fill="#252D6B"/>
  <path d="M0 716C160 650 285 704 430 648C602 570 765 636 930 550C1040 493 1120 476 1200 448V900H0Z" fill="#1A1535"/>
  <circle cx="826" cy="260" r="118" fill="#F78E42"/>
  <text x="86" y="210" fill="#11100D" font-family="Arial, sans-serif" font-size="76" font-weight="900">SEE IT IN ACTION</text>
  <text x="91" y="292" fill="#11100D" font-family="Arial, sans-serif" font-size="34" font-weight="700">Quiver buoy loop preview</text>
</svg>
`)}`;

function buildPbscHandoffHref(placement: PbscPlacement): string {
  return buildAppHandoffPath({
    source: "pbsc-flyer",
    surface: "pbsc-page",
    placement,
    utm_source: "pbsc_qr",
    utm_medium: "flyer",
    utm_campaign: "pbsc_2026",
  });
}

function getWordTransition(
  index: number,
  shouldReduceMotion: boolean,
): Transition {
  if (shouldReduceMotion) {
    return { duration: 0.16, delay: index * 0.04 };
  }

  return {
    duration: 0.62,
    delay: index * 0.16,
    ease: [0.16, 1, 0.3, 1],
  };
}

function GetAppCta({
  platform,
  placement,
  className,
}: GetAppCtaProps): ReactElement {
  const shouldReduceMotion = useReducedMotion() === true;
  const label = CTA_LABELS[platform];
  const href = useMemo(() => buildPbscHandoffHref(placement), [placement]);

  return (
    <motion.a
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-3 rounded-[14px_4px_16px_6px] border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-heading text-base font-black uppercase leading-none text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.32)] transition-colors hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#252D6B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]",
        className,
      )}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
    >
      <span>{label}</span>
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </motion.a>
  );
}

function VideoModule(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion === true;
  const shouldAutoplay = prefersReducedMotion === false;
  const [isMuted, setIsMuted] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const playVideo = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const playResult = video.play();
      if (playResult && typeof playResult.then === "function") {
        void playResult
          .then(() => setHasStarted(true))
          .catch(() => undefined);
        return;
      }
      setHasStarted(true);
    } catch {
      setHasStarted(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldAutoplay) return;
    playVideo();
  }, [playVideo, shouldAutoplay]);

  const toggleMuted = (): void => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (!video) return;
    video.muted = nextMuted;
    if (video.paused) playVideo();
  };

  return (
    <section
      aria-labelledby="pbsc-video-heading"
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center"
    >
      <div>
        <p className="typewriter">See it in action</p>
        <h2
          id="pbsc-video-heading"
          className="mt-3 max-w-2xl font-heading text-4xl font-black uppercase leading-none text-[#11100D] sm:text-5xl"
        >
          Your forecast gets personal when you log the days that hit.
        </h2>
        <p className="mt-5 max-w-xl font-sans text-lg font-semibold leading-8 text-[#252D6B]">
          Quiver is not another generic make-the-call board. It learns what
          made your favorite sessions work, then brings that memory back when{" "}
          {"today's"} tide, wind, and swell line up.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[330px] -rotate-1 border-2 border-[#11100D] bg-[#11100D] p-2 shadow-[10px_10px_0_rgba(247,142,66,0.42)] sm:max-w-[360px] lg:max-w-[340px]">
        <div className="absolute -left-4 -top-4 z-10 rotate-2 rounded-[12px_4px_14px_6px] border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2 font-mono text-xs font-bold uppercase leading-tight text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.25)]">
          Buoy loop
        </div>
        <div
          className="relative aspect-[9/16] overflow-hidden bg-[#11100D]"
          data-testid="pbsc-video-frame"
        >
          {/* Autoplay is triggered from the effect below, not the attribute:
              useReducedMotion() is null during SSR, so a rendered autoPlay
              value differs between server and client and breaks hydration. */}
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            poster={VIDEO_POSTER}
            aria-label="Animated Quiver buoy loop preview"
          >
            <source src="/videos/buoy-loop.mp4" type="video/mp4" />
          </video>

          {shouldReduceMotion && !hasStarted ? (
            <button
              type="button"
              onClick={playVideo}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F4EBD8]/88 font-heading text-lg font-black uppercase text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-inset"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] shadow-[4px_4px_0_rgba(17,16,13,0.26)]">
                <Play className="ml-1 h-7 w-7 fill-[#11100D]" aria-hidden="true" />
              </span>
              Play video
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleMuted}
            className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-[10px_3px_12px_5px] border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2 font-mono text-xs font-bold uppercase text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
            aria-pressed={!isMuted}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
            {isMuted ? "Tap to unmute" : "Sound on"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function PbscWelcomeClient({
  platform,
}: PbscWelcomeClientProps): ReactElement {
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <main className="min-h-screen bg-[#0D1020]">
      <ZineSurface
        sectionLabel="Welcome"
        editionLabel="Get the app"
        paperClassName="overflow-hidden px-5 py-7 sm:px-8 sm:py-10 lg:px-10"
      >
        <section className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div
            aria-hidden
            className="absolute -right-10 top-5 hidden h-6 w-44 rotate-3 opacity-80 sm:block"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#11100D 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#11100D 75%),linear-gradient(45deg,transparent 75%,#11100D 75%),linear-gradient(45deg,#11100D 25%,#F4EBD8 25%)",
              backgroundPosition: "0 0,0 0,12px -12px,12px -12px",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative">
            <motion.div
              className="mb-5 inline-flex rotate-2 items-center gap-2 rounded-[16px_5px_18px_7px] border-2 border-[#11100D] bg-[#F78E42] px-4 py-2 font-mono text-xs font-bold uppercase leading-tight text-[#11100D] shadow-[4px_4px_0_rgba(17,16,13,0.3)]"
              initial={
                shouldReduceMotion
                  ? { opacity: 0, y: 0, rotate: 2 }
                  : { opacity: 0, y: -12, rotate: -1 }
              }
              animate={{ opacity: 1, y: 0, rotate: 2 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.16 }
                  : { type: "spring", stiffness: 260, damping: 18, delay: 0.35 }
              }
            >
              Golden ticket
              <span aria-hidden>·</span>
              You found the flyer
            </motion.div>

            <div
              className="space-y-1"
              aria-label="Welcome to Quiver."
            >
              {HERO_WORDS.map((word, index) => (
                <motion.div
                  key={word}
                  className="font-heading text-5xl font-black uppercase leading-[0.82] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl lg:text-8xl"
                  initial={
                    shouldReduceMotion
                      ? {
                          opacity: 0,
                          y: 0,
                          rotate: HERO_ROTATIONS[index],
                          scale: 1,
                        }
                      : {
                          opacity: 0,
                          y: 44,
                          rotate: HERO_ROTATIONS[index] * -2,
                          scale: 0.96,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    rotate: shouldReduceMotion ? 0 : HERO_ROTATIONS[index],
                    scale: 1,
                  }}
                  transition={getWordTransition(index, shouldReduceMotion)}
                >
                  {word}
                </motion.div>
              ))}
            </div>

            <motion.p
              className="mt-6 max-w-2xl font-sans text-lg font-semibold leading-8 text-[#252D6B] sm:text-xl"
              initial={
                shouldReduceMotion
                  ? { opacity: 0, y: 0 }
                  : { opacity: 0, y: 12 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.16, delay: 0.12 }
                  : { duration: 0.45, delay: 0.64, ease: [0.16, 1, 0.3, 1] }
              }
            >
              Your good days, on repeat. Quiver matches {"today's"} forecast
              against the sessions you loved, then helps you spot the next one.
            </motion.p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <GetAppCta platform={platform} placement="hero_primary" />
              <p className="max-w-sm font-mono text-xs font-bold uppercase leading-5 text-[#11100D]/62">
                iPhone + Android · about a minute to set up.
              </p>
            </div>
          </div>

          <motion.aside
            className="relative border-2 border-[#11100D] bg-[#FFF8E8] p-5 shadow-[9px_9px_0_rgba(17,16,13,0.18)]"
            initial={
              shouldReduceMotion
                ? { opacity: 0, y: 0, rotate: 0 }
                : { opacity: 0, y: 18, rotate: 1.5 }
            }
            animate={{ opacity: 1, y: 0, rotate: shouldReduceMotion ? 0 : -1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.16, delay: 0.18 }
                : { type: "spring", stiffness: 170, damping: 20, delay: 0.82 }
            }
          >
            <div className="absolute -right-3 -top-3 rotate-3 rounded-[12px_5px_14px_4px] border-2 border-[#11100D] bg-[#252D6B] px-3 py-2 font-mono text-xs font-bold uppercase text-[#F4EBD8] shadow-[3px_3px_0_rgba(247,142,66,0.55)]">
              Straight off the flyer
            </div>
            <p className="typewriter flex items-center gap-2">
              <Waves className="h-4 w-4 text-[#F78E42]" aria-hidden="true" />
              What you found
            </p>
            <h1 className="mt-4 font-heading text-4xl font-black uppercase leading-none text-[#11100D] sm:text-5xl">
              A surf memory machine for the days worth chasing.
            </h1>
            <p className="mt-5 font-sans text-base font-semibold leading-7 text-[#252D6B]">
              Log the session, rate the feel, and keep the conditions that made
              it special. The next time the ocean rhymes, Quiver points it out.
            </p>
            <div className="mt-6 grid gap-2 font-mono text-xs font-bold uppercase leading-5 text-[#11100D]/70 sm:grid-cols-3">
              <span className="border-t-2 border-[#11100D] pt-2">
                Forecast memory
              </span>
              <span className="border-t-2 border-[#11100D] pt-2">
                Session log
              </span>
              <span className="border-t-2 border-[#11100D] pt-2">
                Home break signal
              </span>
            </div>
          </motion.aside>
        </section>

        <div className="my-12 border-t-2 border-dashed border-[#11100D]/35" />

        <VideoModule />

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {GOOD_DAY_NOTES.map((note, index) => (
            <motion.article
              key={note.title}
              className="border-2 border-[#11100D] bg-[#FFF8E8] p-5 shadow-[5px_5px_0_rgba(17,16,13,0.14)]"
              initial={
                shouldReduceMotion
                  ? { opacity: 0, y: 0, rotate: 0 }
                  : { opacity: 0, y: 14, rotate: index === 1 ? 1 : -1 }
              }
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.16, delay: index * 0.04 }
                  : {
                      duration: 0.42,
                      delay: 0.9 + index * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
            >
              <p className="font-mono text-xs font-bold uppercase text-[#B56A2B]">
                0{index + 1}
              </p>
              <h2 className="mt-3 font-heading text-2xl font-black uppercase leading-none text-[#11100D]">
                {note.title}
              </h2>
              <p className="mt-3 font-sans text-base font-semibold leading-7 text-[#252D6B]">
                {note.body}
              </p>
            </motion.article>
          ))}
        </section>

        <section className="mt-12 grid gap-5 border-2 border-[#11100D] bg-[#252D6B] p-5 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.22)] md:grid-cols-[1fr_auto] md:items-center md:p-6">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#FDB84B]">
              You scanned the flyer · Smart move
            </p>
            <h2 className="mt-3 max-w-2xl font-heading text-3xl font-black uppercase leading-none tracking-normal sm:text-4xl">
              Keep the flyer. Take Quiver to the beach.
            </h2>
          </div>
          <GetAppCta
            platform={platform}
            placement="bottom_primary"
            className="bg-[#F4EBD8] hover:bg-[#FDB84B]"
          />
        </section>
      </ZineSurface>
    </main>
  );
}
