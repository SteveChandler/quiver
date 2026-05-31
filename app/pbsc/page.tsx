import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin, Waves } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { parseUserAgent } from "@/lib/utils/user-agent-parser";
import { PbscScanCtas } from "./pbsc-scan-ctas";

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver at PBSC Summer Longboard Classic",
  description:
    "Quiver turns every session into local knowledge, so the next call is always a little sharper.",
  path: "/pbsc",
  keywords: [
    "PBSC Summer Longboard Classic",
    "Pacific Beach Surf Club",
    "Tourmaline Surf Park",
    "Quiver app",
    "surf forecast app",
    "surf session log",
  ],
});

export const dynamic = "force-dynamic";

const REASONS = [
  {
    title: "Make your own call",
    body: "See the surf window, source, and setup notes instead of stopping at fair, good, or ok.",
  },
  {
    title: "Tag the days worth repeating",
    body: "Log the board, beach, conditions, and rating so your best sessions become useful signal.",
  },
  {
    title: "Build local knowledge",
    body: "Every logged session adds context for the next swell, tide, wind, and board call.",
  },
] as const;

export default async function PbscPage() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isIosVisitor = parseUserAgent(userAgent).os === "iOS";

  return (
    <main className="min-h-screen bg-[#252D6B] text-[#F4EBD8]">
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_14%_9%,rgba(247,142,66,0.34),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(42,201,198,0.28),transparent_22%),linear-gradient(135deg,#1E2558_0%,#252D6B_52%,#11100D_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.13] mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 7px, rgba(255,255,255,0.22) 8px), repeating-linear-gradient(90deg, transparent 0 15px, rgba(0,0,0,0.2) 16px)",
          }}
        />
        <div
          aria-hidden
          className="absolute bottom-4 left-0 right-0 -z-10 h-5 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#F4EBD8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#F4EBD8 75%),linear-gradient(45deg,transparent 75%,#F4EBD8 75%),linear-gradient(45deg,#F4EBD8 25%,#11100D 25%)",
            backgroundPosition: "0 0,0 0,10px -10px,10px -10px",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex -rotate-2 items-center gap-2 rounded-sm border-2 border-[#F78E42]/70 bg-[#11100D]/45 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#FDB84B] shadow-[5px_5px_0_rgba(42,201,198,0.38)]">
              <Waves className="h-4 w-4" />
              Tourmaline live issue no. 001
            </div>
            <h1 className="font-heading text-5xl font-black leading-[0.92] tracking-normal text-white sm:text-6xl md:text-7xl">
              Tag your best days.
              <br />
              Keep them on repeat.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-[#F4EBD8]/88 md:text-xl">
              Quiver turns every session into local knowledge, so the next call
              is always a little sharper.
            </p>

            <PbscScanCtas
              isIosVisitor={isIosVisitor}
              placement="hero_primary"
            />

            <div className="mt-8 grid gap-3 text-sm font-semibold text-[#F4EBD8]/84 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#FDB84B]" />
                June 13, 2026, 7 AM-3 PM
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FDB84B]" />
                Tourmaline Surf Park
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[460px] -rotate-1 overflow-hidden rounded-sm border-2 border-[#F4EBD8]/80 bg-[#11100D] p-3 shadow-[14px_16px_0_rgba(247,142,66,0.34)]">
            <div className="absolute -right-3 top-8 z-10 rotate-6 border-2 border-[#11100D] bg-[#2AC9C6] px-3 py-2 text-center font-mono text-xs font-black uppercase tracking-[0.12em] text-[#11100D] shadow-[4px_4px_0_rgba(247,142,66,0.9)]">
              Check before
              <br />
              the next set
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <Image
                src="/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp"
                alt="Tourmaline Surf Park lineup in Southern California."
                fill
                priority
                sizes="(min-width: 1024px) 420px, 92vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(17,16,13,0.92),rgba(17,16,13,0))] p-5 pt-24">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#FDB84B]">
                  PBSC Summer Longboard Classic
                </p>
                <p className="mt-2 max-w-xs font-heading text-3xl font-black leading-none text-white">
                  Turn sessions into local knowledge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F4EBD8] px-4 py-16 text-[#11100D] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-3">
            {REASONS.map((reason) => (
              <article
                key={reason.title}
                className="rounded-sm border-2 border-[#11100D] bg-[#FFF8E8] p-5 shadow-[6px_6px_0_rgba(17,16,13,0.18)]"
              >
                <h2 className="font-heading text-2xl font-black">
                  {reason.title}
                </h2>
                <p className="mt-3 text-base font-semibold leading-7 text-[#252D6B]">
                  {reason.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-sm border-2 border-[#11100D] bg-[#252D6B] p-6 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.22)] md:flex md:items-center md:justify-between md:gap-8">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#FDB84B]">
                <Waves className="h-4 w-4" />
                Local knowledge loop
              </div>
              <p className="mt-3 max-w-2xl text-lg font-semibold leading-8">
                Download Quiver, check the local call, and log the sessions
                worth remembering.
              </p>
            </div>
            <PbscScanCtas
              isIosVisitor={isIosVisitor}
              placement="bottom_primary"
              className="mt-5 md:mt-0"
            >
              {isIosVisitor ? (
                <>
                  Open Quiver on iPhone
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </>
              ) : (
                "Join Android waitlist"
              )}
            </PbscScanCtas>
          </div>
        </div>
      </section>
    </main>
  );
}
