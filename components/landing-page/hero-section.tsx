"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import { useAuth } from "@/context/auth-context";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

const LANDING_HERO_VIDEO_DESKTOP_SRC =
  "/videos/quiver-landing-hero-1280.mp4";
const LANDING_HERO_VIDEO_MOBILE_SRC = "/videos/quiver-landing-hero-720.mp4";
const LANDING_HERO_POSTER_SRC = "/images/hero/quiver-landing-hero-poster.jpg";
const HERO_VIDEO_LOAD_DELAY_MS = 2500;
const HERO_VIDEO_FAILED_START_TIMEOUT_MS = 5000;
const HERO_VIDEO_VISIBLE_FAILED_START_GRACE_MS = 1500;
const HERO_DOWNLOAD_BUTTON_SOURCE = "hero-video-download-button";
const APP_FIRST_HERO_SOURCE = "landing_hero";
const APP_FIRST_HERO_PLACEMENT = "hero_primary";
const APP_FIRST_COHORT = "app_first";
const HERO_PRIMARY_CTA_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-ocean-blue-decorative px-6 py-3 font-heading text-base font-bold text-background shadow-[0_4px_0_rgba(0,0,0,0.32)] transition hover:bg-[#D57835] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue-decorative focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-[#C06A25]";

type HeroVideoVariant = "mobile" | "desktop";

interface HeroSectionProps {
  initialPlatform?: FirstTouchPlatform;
  appFirst?: boolean;
}

interface AppFirstHeroSectionProps {
  initialPlatform: FirstTouchPlatform;
}

function getHeroVideoVariant(): HeroVideoVariant {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export function HeroSection({
  initialPlatform = "desktop",
  appFirst = false,
}: HeroSectionProps = {}): ReactElement {
  if (appFirst) {
    return <AppFirstHeroSection initialPlatform={initialPlatform} />;
  }

  return <LegacyHeroSection />;
}

function AppFirstHeroSection({
  initialPlatform,
}: AppFirstHeroSectionProps): ReactElement {
  const reducedMotion = useReducedMotion();
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (initialPlatform !== "desktop" || hasTrackedView.current) return;

    hasTrackedView.current = true;
    trackAppHandoffView({
      source: APP_FIRST_HERO_SOURCE,
      surface: "landing-page",
      placement: APP_FIRST_HERO_PLACEMENT,
      platform: "desktop",
      cohort: APP_FIRST_COHORT,
    });
  }, [initialPlatform]);

  return (
    <section className="noise-texture relative isolate overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid min-h-[76svh] w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)] lg:px-8 lg:py-12">
        <div className="max-w-4xl">
          <p className="mb-5 inline-flex -rotate-1 rounded-[10px_4px_12px_5px] border border-sunset-orange/35 bg-card/70 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-sunset-orange shadow-[0_2px_0_rgba(0,0,0,0.22)]">
            iPhone is live · Android beta is open
          </p>

          <h1 className="max-w-5xl font-heading text-[clamp(3rem,8vw,7.25rem)] font-black uppercase leading-[0.88] text-foreground">
            Know where to paddle out. Get Quiver on your phone.
          </h1>

          <p className="mt-5 max-w-2xl font-sans text-lg leading-8 text-muted-foreground sm:text-xl">
            The surf call, beach context, and session log your dawn patrol can
            trust before the first set rolls through.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-4 sm:max-w-2xl lg:max-w-none">
            <NativeAppFunnelCta
              platform={initialPlatform}
              source={APP_FIRST_HERO_SOURCE}
              surface="landing-page"
              placement={APP_FIRST_HERO_PLACEMENT}
              variant={APP_FIRST_COHORT}
              cohort={APP_FIRST_COHORT}
              className={HERO_PRIMARY_CTA_CLASS}
              desktopClassName="w-full max-w-2xl rounded-[22px_10px_26px_12px] border-sunset-orange/20"
            />

            <a
              href="#proof"
              className="w-fit font-sans text-sm font-semibold text-foreground/72 underline decoration-sunset-orange/50 underline-offset-4 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue-decorative focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          data-testid="hero-supporting-media"
          className="relative mx-auto w-full max-w-[560px]"
        >
          <div className="relative overflow-hidden rounded-[28px_12px_34px_16px] border border-white/12 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <div className="relative aspect-video">
              <Image
                src={LANDING_HERO_POSTER_SRC}
                alt="Quiver app preview showing the surf call before a session."
                fill
                priority
                sizes="(min-width: 1024px) 42vw, 92vw"
                className="object-cover"
              />
              {!reducedMotion ? (
                <video
                  src={LANDING_HERO_VIDEO_MOBILE_SRC}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={LANDING_HERO_POSTER_SRC}
                  aria-label="Quiver app surf call preview"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 bg-header-start px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-sunset-orange">
              <span>the call</span>
              <span>beach intel</span>
              <span>session log</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LegacyHeroSection(): ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const hasTrackedView = useRef(false);
  const hasTrackedVideoLoad = useRef(false);
  const hasTrackedVideoStart = useRef(false);
  const hasTrackedVideoError = useRef(false);
  const hasTrackedVideoFailedStart = useRef(false);
  const hasVideoLoaded = useRef(false);
  const hasVideoStarted = useRef(false);
  const hasVideoEndedRef = useRef(false);
  const hasHiddenVideoStall = useRef(false);
  const visibleFailedStartTimeoutId = useRef<number | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [hasVideoFailedToStart, setHasVideoFailedToStart] = useState(false);
  const [videoVariant, setVideoVariant] =
    useState<HeroVideoVariant>("desktop");
  const videoSrc =
    videoVariant === "mobile"
      ? LANDING_HERO_VIDEO_MOBILE_SRC
      : LANDING_HERO_VIDEO_DESKTOP_SRC;
  const isAppStoreCtaVisible =
    reducedMotion || hasVideoEnded || hasVideoError || hasVideoFailedToStart;

  const trackVideoEvent = useCallback(
    (event: string, extra: Record<string, unknown> = {}) => {
      track(event, {
        source: "landing-hero-video",
        surface: "landing-page",
        video_variant: videoVariant,
        ...extra,
      });
    },
    [videoVariant],
  );

  const clearVisibleFailedStartTimer = useCallback(() => {
    if (visibleFailedStartTimeoutId.current === null) return;
    window.clearTimeout(visibleFailedStartTimeoutId.current);
    visibleFailedStartTimeoutId.current = null;
  }, []);

  const getVideoDiagnostics = useCallback(
    (video: HTMLVideoElement | null = videoRef.current) => ({
      media_error_code: video?.error?.code ?? null,
      media_error_message: video?.error?.message ?? null,
      ready_state: video?.readyState ?? null,
      network_state: video?.networkState ?? null,
      current_src: video?.currentSrc || video?.getAttribute("src") || videoSrc,
      has_loaded: hasVideoLoaded.current,
      has_started: hasVideoStarted.current,
      has_ended: hasVideoEndedRef.current,
      visibility_state:
        typeof document === "undefined" ? "visible" : document.visibilityState,
    }),
    [videoSrc],
  );

  const trackFailedStart = useCallback(
    (metadata: Record<string, unknown>) => {
      if (hasTrackedVideoFailedStart.current) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        hasHiddenVideoStall.current = true;
        return;
      }
      hasTrackedVideoFailedStart.current = true;
      setHasVideoFailedToStart(true);
      trackVideoEvent("landing_hero_video_failed_to_start", metadata);
    },
    [trackVideoEvent],
  );

  const handleIosAppClick = () => {
    trackIosAppCtaClick({
      source: HERO_DOWNLOAD_BUTTON_SOURCE,
      surface: "landing-page",
      placement: "hero_video_overlay",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_URL,
      video_loaded: shouldLoadVideo,
      video_completed: hasVideoEnded,
    });
  };

  useEffect(() => {
    setVideoVariant(getHeroVideoVariant());
  }, []);

  useEffect(() => {
    if (user || hasTrackedView.current || !isAppStoreCtaVisible) return;
    hasTrackedView.current = true;
    trackIosAppCtaView({
      source: HERO_DOWNLOAD_BUTTON_SOURCE,
      surface: "landing-page",
      placement: "hero_video_overlay",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_URL,
      video_loaded: shouldLoadVideo,
      video_completed: hasVideoEnded,
    });
  }, [hasVideoEnded, isAppStoreCtaVisible, shouldLoadVideo, user]);

  useEffect(() => {
    if (reducedMotion || shouldLoadVideo) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let delayId: number | undefined;
    let idleId: number | undefined;

    const loadVideo = () => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(
          () => setShouldLoadVideo(true),
          { timeout: 1500 },
        );
        return;
      }

      setShouldLoadVideo(true);
    };

    const scheduleVideoLoad = () => {
      delayId = window.setTimeout(loadVideo, HERO_VIDEO_LOAD_DELAY_MS);
    };

    if (document.readyState === "complete") {
      scheduleVideoLoad();
    } else {
      window.addEventListener("load", scheduleVideoLoad, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleVideoLoad);
      if (delayId !== undefined) window.clearTimeout(delayId);
      if (idleId !== undefined && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      }
    };
  }, [reducedMotion, shouldLoadVideo]);

  useEffect(() => {
    if (reducedMotion || !shouldLoadVideo) return;

    const timeoutId = window.setTimeout(() => {
      if (hasVideoLoaded.current || hasVideoStarted.current) return;
      if (document.visibilityState === "hidden") {
        hasHiddenVideoStall.current = true;
        return;
      }
      trackFailedStart(getVideoDiagnostics());
    }, HERO_VIDEO_FAILED_START_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [getVideoDiagnostics, reducedMotion, shouldLoadVideo, trackFailedStart]);

  useEffect(() => {
    if (reducedMotion || !shouldLoadVideo) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!hasHiddenVideoStall.current) return;

      clearVisibleFailedStartTimer();

      if (hasVideoLoaded.current || hasVideoStarted.current) {
        hasHiddenVideoStall.current = false;
        return;
      }

      setHasVideoFailedToStart(true);
      visibleFailedStartTimeoutId.current = window.setTimeout(() => {
        visibleFailedStartTimeoutId.current = null;
        if (!hasHiddenVideoStall.current) return;
        if (hasVideoLoaded.current || hasVideoStarted.current) {
          hasHiddenVideoStall.current = false;
          return;
        }

        hasHiddenVideoStall.current = false;
        trackFailedStart(getVideoDiagnostics());
      }, HERO_VIDEO_VISIBLE_FAILED_START_GRACE_MS);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearVisibleFailedStartTimer();
    };
  }, [
    clearVisibleFailedStartTimer,
    getVideoDiagnostics,
    reducedMotion,
    shouldLoadVideo,
    trackFailedStart,
  ]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#252D6B] px-0 pb-0 pt-0"
    >
      <h1 className="sr-only">Quiver surf forecast app for iPhone</h1>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto w-full"
      >
        <div className="overflow-hidden bg-[#252D6B]">
          <div className="relative aspect-video w-full">
            <Image
              src={LANDING_HERO_POSTER_SRC}
              alt="Quiver app launch video preview showing the iPhone surf forecast experience."
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {shouldLoadVideo && !reducedMotion ? (
              <video
                ref={videoRef}
                src={videoSrc}
                autoPlay
                muted
                playsInline
                preload="none"
                poster={LANDING_HERO_POSTER_SRC}
                aria-label="Quiver iPhone launch video"
                className="absolute inset-0 h-full w-full object-cover"
                onLoadedData={() => {
                  hasVideoLoaded.current = true;
                  hasHiddenVideoStall.current = false;
                  clearVisibleFailedStartTimer();
                  if (hasTrackedVideoLoad.current) return;
                  hasTrackedVideoLoad.current = true;
                  trackVideoEvent("landing_hero_video_loaded");
                }}
                onPlay={() => {
                  hasVideoStarted.current = true;
                  hasVideoEndedRef.current = false;
                  hasHiddenVideoStall.current = false;
                  clearVisibleFailedStartTimer();
                  setHasVideoEnded(false);
                  setHasVideoError(false);
                  setHasVideoFailedToStart(false);
                  if (hasTrackedVideoStart.current) return;
                  hasTrackedVideoStart.current = true;
                  trackVideoEvent("landing_hero_video_started");
                }}
                onEnded={() => {
                  hasVideoEndedRef.current = true;
                  setHasVideoEnded(true);
                  trackVideoEvent("landing_hero_video_ended");
                }}
                onError={(event) => {
                  setHasVideoError(true);
                  const diagnostics = getVideoDiagnostics(event.currentTarget);
                  if (!hasTrackedVideoError.current) {
                    hasTrackedVideoError.current = true;
                    trackVideoEvent(
                      "landing_hero_video_error",
                      diagnostics,
                    );
                  }
                  if (!hasVideoLoaded.current && !hasVideoStarted.current) {
                    trackFailedStart(diagnostics);
                  }
                }}
              />
            ) : null}
            {isAppStoreCtaVisible ? (
              <a
                href={IOS_APP_STORE_URL}
                data-testid="hero-video-app-store-cta"
                aria-label={IOS_APP_STORE_CTA}
                onClick={handleIosAppClick}
                className="absolute left-[9.8%] top-[80.9%] z-20 flex h-[6.2%] min-h-9 w-[13.4%] min-w-[112px] items-center justify-center overflow-hidden whitespace-nowrap rounded-[9px] bg-[#111B46] px-3 text-center text-sm font-semibold leading-none text-white shadow-[0_8px_24px_rgba(17,27,70,0.28)] ring-1 ring-white/20 transition hover:bg-[#252D6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              >
                <span>{IOS_APP_STORE_CTA}</span>
              </a>
            ) : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
