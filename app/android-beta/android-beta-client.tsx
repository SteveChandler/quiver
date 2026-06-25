"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
} from "@/lib/constants/app-store";
import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import { QuiverSticker, ZineSurface } from "@/components/zine";

const ANDROID_BETA_SMART_QR_URL = buildSmartQrHandoffUrl({
  source: "android_beta_page",
  surface: "android_beta",
  placement: "instructions_qr",
  qr_id: "android_beta_instructions",
  target: "android_beta",
  utm_medium: "android_beta",
});

const STEPS = [
  {
    title: "Join the tester group",
    body: "Start by joining the Quiver Android testers Google Group.",
  },
  {
    title: "Use the same Google account",
    body: "Make sure the Google account on your Android phone matches the one you use in Google Play.",
  },
  {
    title: "Wait for Play access",
    body: "The closed-test install link is not public on this page yet. Once your access is granted, install through the Play beta flow tied to that same account.",
  },
  {
    title: "Send feedback or access issues",
    body: `Email ${ANDROID_BETA_CONTACT_EMAIL} if the invite does not unlock or if you hit bugs.`,
  },
] as const;

export function AndroidBetaClient() {
  return (
    <ZineSurface
      sectionLabel="Android beta"
      editionLabel="Closed test handoff"
      data-testid="android-beta-zine-surface"
    >
      <main>
        <header className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-8 right-6 hidden w-36 rotate-6 opacity-85 sm:block"
            />
            <p className="label-black mb-5">Android closed beta</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Join the Quiver Android beta
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Quiver on Android is still in closed testing. This page is the
              handoff for testers: join the group, use the right Google account,
              and we&apos;ll route you into the Play beta flow as access opens
              up.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>Google Group invite</span>
              <span aria-hidden>/</span>
              <span>Play closed test</span>
              <span aria-hidden>/</span>
              <span>Same Google account</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={ANDROID_BETA_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
              >
                Join the tester group
              </a>
              <a
                href={ANDROID_BETA_CONTACT_MAILTO}
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Email {ANDROID_BETA_CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <aside className="relative">
            <QuiverSticker
              sticker="creamTape"
              className="absolute -top-6 left-8 z-10 w-28 -rotate-6 opacity-90"
            />
            <div className="torn torn-tb rot-2 border-2 border-[#11100D] bg-[#FBF6E8]">
              <div className="mx-auto w-fit border-2 border-[#11100D] bg-white p-4 shadow-[3px_3px_0_rgba(17,16,13,0.25)]">
                <QRCodeSVG
                  data-testid="android-beta-qr"
                  data-smart-url={ANDROID_BETA_SMART_QR_URL}
                  value={ANDROID_BETA_SMART_QR_URL}
                  size={248}
                  level="H"
                  marginSize={4}
                  bgColor="#FFFFFF"
                  fgColor="#252D6B"
                  imageSettings={{
                    src: "/quiver-app-icon-128.png",
                    width: 34,
                    height: 34,
                    excavate: true,
                  }}
                />
              </div>
              <div className="mt-5 space-y-2 text-center">
                <p className="typewriter mb-1">Scan to start</p>
                <h2 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                  Scan for the beta instructions
                </h2>
                <p className="text-sm leading-relaxed text-[#11100D]/70">
                  This QR code uses the Quiver smart handoff: Android routes to
                  the beta access path, iPhone routes to the App Store, and
                  desktop gets the phone handoff.
                </p>
              </div>
            </div>
          </aside>
        </header>

        <section className="mt-14" aria-labelledby="android-beta-steps-heading">
          <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <div>
              <p className="typewriter mb-2">How to get in</p>
              <h2
                id="android-beta-steps-heading"
                className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                Four steps into the closed test
              </h2>
            </div>
            <QuiverSticker
              sticker="orangeMap"
              className="hidden w-14 rotate-6 drop-shadow-sm sm:block"
            />
          </div>

          <ol className="grid gap-5 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="notebook grid gap-3 sm:grid-cols-[3rem_1fr]"
              >
                <span className="font-mono text-sm font-bold text-[#B56A2B]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </ZineSurface>
  );
}
