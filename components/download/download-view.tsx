import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import { SaltyEyebrow, TornDivider } from "@/components/beach-detail/zine/atoms";
import { StoreDownloadButtons } from "@/components/landing-page/store-download-buttons";
import { QuiverSticker, ZineSurface, type QuiverStickerProps } from "@/components/zine";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";
import { ANDROID_BETA_LANDING_PATH } from "@/lib/constants/app-store";

interface DownloadViewProps {
  platform: FirstTouchPlatform;
}

interface DownloadChapter {
  sticker: QuiverStickerProps["sticker"];
  image: string;
  imageAlt: string;
  title: string;
  body: string;
}

const CHAPTERS: DownloadChapter[] = [
  {
    sticker: "forecastWaveMark",
    image: "/images/app-screenshots/surf-call.png",
    imageAlt: "Quiver forecast screen showing a surf call",
    title: "Honest surf forecasts",
    body: "Ten-day calls, refreshed every three hours, with the variables that matter at your break.",
  },
  {
    sticker: "spotSwellMatch",
    image: "/images/app-screenshots/local-intel.png",
    imageAlt: "Quiver local intel and spot discovery screen",
    title: "Find the right window",
    body: "Scan nearby options, wind reads, and local context before you burn the morning.",
  },
  {
    sticker: "blogSessionLog",
    image: "/images/app-screenshots/session-log.png",
    imageAlt: "Quiver session logging screen",
    title: "Build your field notes",
    body: "Log the board, conditions, and score in one tap so your next call starts smarter.",
  },
];

function PhoneShot({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}): ReactElement {
  return (
    <div
      className={`relative mx-auto aspect-[9/19.5] w-full max-w-[230px] overflow-hidden rounded-[28px] border-4 border-[#11100D] bg-[#11100D] shadow-[8px_10px_0_rgba(17,16,13,0.18)] ${className ?? ""}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="230px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}

export function DownloadView({ platform }: DownloadViewProps): ReactElement {
  return (
    <div
      data-testid="download-view"
      className="min-h-screen bg-[#0D1020]"
    >
      <ZineSurface
        sectionLabel="Download"
        data-testid="download-hero"
        className="px-3 py-8 sm:px-6 sm:py-12"
        stageClassName="mx-auto max-w-6xl"
        paperClassName="relative overflow-hidden"
        showMasthead={false}
      >
        <div className="grid gap-8 md:grid-cols-[1.08fr_0.92fr] md:items-center">
          <div>
            <SaltyEyebrow text="THE SURFER'S FIELD GUIDE" />
            <h1 className="zine-h1 mt-3 max-w-3xl text-[#11100D]">
              Get Quiver for your phone.
            </h1>
            <p className="mt-4 max-w-2xl font-mono text-sm leading-relaxed text-[#11100D]/80 sm:text-base">
              Free to start. Live on iPhone now — and the Android beta is open
              through Google Play closed testing.
            </p>
            <div className="mt-6 max-w-xl">
              <StoreDownloadButtons
                platform={platform}
                surface="download"
                placement="hero"
                orientation="stack"
                includeComparison
              />
            </div>
          </div>
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute left-8 top-0 z-20 w-24 -rotate-12"
              sizes="6rem"
            />
            <PhoneShot
              src="/images/app-screenshots/surf-call.png"
              alt="Quiver iPhone surf forecast app"
              className="-rotate-2"
              priority
            />
          </div>
        </div>
      </ZineSurface>

      <ZineSurface
        sectionLabel="Inside the app"
        data-testid="download-chapters"
        className="px-3 py-8 sm:px-6 sm:py-12"
        stageClassName="mx-auto max-w-6xl"
        showMasthead={false}
      >
        <div className="grid gap-7 lg:grid-cols-3">
          {CHAPTERS.map((chapter, index) => (
            <article
              key={chapter.title}
              className="torn relative bg-[#F4EBD8] p-5 shadow-[2px_4px_0_rgba(0,0,0,0.18)]"
              style={{ transform: `rotate(${index % 2 === 0 ? -0.8 : 0.8}deg)` }}
            >
              <QuiverSticker
                sticker={chapter.sticker}
                className="absolute -right-3 -top-5 z-20 w-16 rotate-6"
                sizes="4rem"
              />
              <PhoneShot
                src={chapter.image}
                alt={chapter.imageAlt}
                className="max-w-[190px]"
              />
              <h2 className="mt-5 font-[var(--font-zine-display)] text-xl uppercase leading-tight text-[#11100D]">
                {chapter.title}
              </h2>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[#11100D]/80">
                {chapter.body}
              </p>
            </article>
          ))}
        </div>
      </ZineSurface>

      <ZineSurface
        sectionLabel="Plans"
        data-testid="download-platforms"
        className="px-3 py-8 sm:px-6 sm:py-12"
        stageClassName="mx-auto max-w-5xl"
        showMasthead={false}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="notebook bg-[#F4EBD8] p-6 shadow-[2px_4px_0_rgba(0,0,0,0.18)]">
            <h2 className="font-[var(--font-zine-display)] text-2xl uppercase text-[#11100D]">
              iPhone
            </h2>
            <p className="mt-2 font-mono text-sm leading-relaxed text-[#11100D]/80">
              Live in the App Store with forecasts, favorites, and session
              logging.
            </p>
          </div>
          <div className="notebook bg-[#F4EBD8] p-6 shadow-[2px_4px_0_rgba(0,0,0,0.18)]">
            <h2 className="font-[var(--font-zine-display)] text-2xl uppercase text-[#11100D]">
              Android
            </h2>
            <p className="mt-2 font-mono text-sm leading-relaxed text-[#11100D]/80">
              The Android beta is open through Google Play closed testing. Join
              the tester group, opt in, then install for personalized surf
              decisions, saved spots, alerts, and session logging.
            </p>
            <Link
              href={ANDROID_BETA_LANDING_PATH}
              data-testid="download-android-beta-link"
              className="mt-4 inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
            >
              Join the Android beta
            </Link>
          </div>
        </div>
        <TornDivider />
        <div className="mt-5 flex justify-center">
          <StoreDownloadButtons
            platform={platform}
            surface="download"
            placement="final"
            orientation="stack"
            includeComparison
          />
        </div>
      </ZineSurface>
    </div>
  );
}
