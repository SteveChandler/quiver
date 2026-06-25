"use client";

import { useEffect, useRef, type ReactElement } from "react";

import { SendToPhoneCta } from "@/components/app-store/send-to-phone-cta";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";

interface DesktopHandoffProps {
  source?: string;
  surface?: string;
  placement?: string;
  qrId?: string;
  target?: string;
}

const HANDOFF_STEPS = [
  "Scan the code or email yourself the link",
  "Open it on your phone",
  "Save your home break and check the call",
];

export function DesktopHandoff({
  source = "app_handoff_route",
  surface = "app_handoff",
  placement = "handoff_page",
  qrId,
  target,
}: DesktopHandoffProps): ReactElement {
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackAppHandoffView({
      source,
      surface,
      placement,
      qr_id: qrId,
      target,
      platform: "desktop",
    });
  }, [placement, qrId, source, surface, target]);

  return (
    <ZineSurface
      sectionLabel="Get the app"
      editionLabel="Quiver in your pocket"
    >
      <main className="mx-auto max-w-2xl">
        <header className="relative">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-8 right-6 hidden w-32 rotate-6 opacity-85 sm:block"
          />
          <p className="label-black mb-5">Send to phone</p>
          <h1 className="zine-h1 font-heading font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
            Get Quiver on your phone
          </h1>
          <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
            Quiver lives on your phone, where you check the call before dawn and
            log the session after you paddle in. Scan the code to take it down to
            the beach.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
            <span>iOS + Android</span>
            <span aria-hidden>/</span>
            <span>279+ beaches</span>
            <span aria-hidden>/</span>
            <span className="text-[#B56A2B]">free to start</span>
          </div>
        </header>

        <div className="mt-9">
          <SendToPhoneCta
            source={source}
            surface={surface}
            placement={placement}
            qrId={qrId}
            target={target}
          />
        </div>

        <section className="mt-12 border-t-2 border-dashed border-[#11100D]/35 pt-8">
          <p className="typewriter mb-4">How the handoff works</p>
          <ol className="space-y-3">
            {HANDOFF_STEPS.map((step, index) => (
              <li
                key={step}
                className="notebook grid items-center gap-3 sm:grid-cols-[3rem_1fr]"
              >
                <span className="circled bg-[#F78E42]/35 font-mono text-base">
                  {index + 1}
                </span>
                <span className="font-sans text-base leading-relaxed text-[#11100D]/80">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </ZineSurface>
  );
}
