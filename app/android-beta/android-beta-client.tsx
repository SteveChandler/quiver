"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
} from "@/lib/constants/app-store";
import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";

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
    <main className="min-h-screen bg-[#07133A] px-4 py-16 text-white">
      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-[#F78E42]/40 bg-[#F78E42]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F7B27C]">
              Android Closed Beta
            </span>
            <div className="space-y-3">
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Join the Quiver Android beta
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                Quiver on Android is still in closed testing. This page is the
                handoff for testers: join the group, use the right Google
                account, and we&apos;ll route you into the Play beta flow as
                access opens up.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href={ANDROID_BETA_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#F78E42] px-5 py-3 text-center font-semibold text-[#252D6B] transition hover:bg-[#FFAA63]"
            >
              Join the tester group
            </a>
            <a
              href={ANDROID_BETA_CONTACT_MAILTO}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/16 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/8"
            >
              Email {ANDROID_BETA_CONTACT_EMAIL}
            </a>
          </div>

          <ol className="grid gap-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[28px] border border-white/10 bg-white/6 p-5"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F78E42] text-sm font-semibold text-[#252D6B]">
                    {index + 1}
                  </span>
                  <h2 className="font-heading text-lg font-semibold text-white">
                    {step.title}
                  </h2>
                </div>
                <p className="text-sm leading-6 text-white/72">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="rounded-[32px] border border-white/10 bg-[#111B46] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="rounded-[24px] bg-white p-5">
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
            <h2 className="font-heading text-lg font-semibold text-white">
              Scan for the beta instructions
            </h2>
            <p className="text-sm leading-6 text-white/68">
              This QR code uses the Quiver smart handoff: Android routes to the
              beta access path, iPhone routes to the App Store, and desktop gets
              the phone handoff.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
