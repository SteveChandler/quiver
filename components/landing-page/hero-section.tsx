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
const HERO_DOWNLOAD_BUTTON_SOURCE = "hero-video-download-button";

type HeroVideoVariant = "mobile" | "desktop";

function getHeroVideoVariant(): HeroVideoVariant {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const hasTrackedView = useRef(false);
  const hasTrackedVideoLoad = useRef(false);
  const hasTrackedVideoStart = useRef(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [videoVariant, setVideoVariant] =
    useState<HeroVideoVariant>("desktop");
  const isAppStoreCtaVisible = reducedMotion || hasVideoEnded || hasVideoError;

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
                autoPlay
                muted
                playsInline
                preload="none"
                poster={LANDING_HERO_POSTER_SRC}
                aria-label="Quiver iPhone launch video"
                className="absolute inset-0 h-full w-full object-cover"
                onLoadedData={() => {
                  if (hasTrackedVideoLoad.current) return;
                  hasTrackedVideoLoad.current = true;
                  trackVideoEvent("landing_hero_video_loaded");
                }}
                onPlay={() => {
                  setHasVideoEnded(false);
                  setHasVideoError(false);
                  if (hasTrackedVideoStart.current) return;
                  hasTrackedVideoStart.current = true;
                  trackVideoEvent("landing_hero_video_started");
                }}
                onEnded={() => {
                  setHasVideoEnded(true);
                  trackVideoEvent("landing_hero_video_ended");
                }}
                onError={() => {
                  setHasVideoError(true);
                  trackVideoEvent("landing_hero_video_error");
                }}
              >
                <source
                  src={LANDING_HERO_VIDEO_MOBILE_SRC}
                  type="video/mp4"
                  media="(max-width: 767px)"
                />
                <source
                  src={LANDING_HERO_VIDEO_DESKTOP_SRC}
                  type="video/mp4"
                />
              </video>
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
