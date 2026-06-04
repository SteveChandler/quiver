"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";

const LANDING_HERO_VIDEO_DESKTOP_SRC =
  "/videos/quiver-landing-hero-1280.mp4";
const LANDING_HERO_VIDEO_MOBILE_SRC = "/videos/quiver-landing-hero-720.mp4";
const LANDING_HERO_POSTER_SRC = "/images/hero/quiver-landing-hero-poster.jpg";
const HERO_VIDEO_LOAD_DELAY_MS = 2500;
const HERO_VIDEO_FAILED_START_TIMEOUT_MS = 5000;
const HERO_VIDEO_VISIBLE_FAILED_START_GRACE_MS = 1500;
const HERO_DOWNLOAD_BUTTON_SOURCE = "hero-video-download-button";

type HeroVideoVariant = "mobile" | "desktop";

function getHeroVideoVariant(): HeroVideoVariant {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export function HeroSection() {
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
