"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

export interface LeadCaptureProps {
  breakSlug: string;
  breakName: string;
  heatTotal: number;
  challengeCode: string;
  sessionId?: string;
}

export function LeadCapture({ breakName }: LeadCaptureProps): ReactElement {
  // TODO(packet-b): connect validated email/SMS consent capture to POST /api/play/leads.
  return (
    <section className="torn torn-tb mt-5 border-2 border-[#11100D] bg-[#F4EBD8] p-5 text-left text-[#11100D] shadow">
      <h3 className="font-heading text-xl font-black uppercase">
        {breakName} is real.
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#11100D]/75">
        Quiver tells you the morning it is actually working. Get this week&apos;s {" "}
        {breakName} forecast and the app.
      </p>
      <form className="mt-4 grid gap-3" aria-label={`${breakName} forecast signup coming soon`}>
        <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-[0.1em]">
          Email
          <input
            type="email"
            disabled
            placeholder="you@outside.surf"
            className="h-11 border-2 border-[#11100D] bg-[#F5EEDC] px-3 font-sans text-sm opacity-60"
          />
        </label>
        <label className="flex items-start gap-2 text-xs leading-5 opacity-60">
          <input type="checkbox" disabled className="mt-1" />
          <span>Send me the forecast for this break and Quiver updates. Unsubscribe any time.</span>
        </label>
        <Button type="submit" disabled className="rounded-none font-heading uppercase">
          Forecast signup arrives next
        </Button>
      </form>
    </section>
  );
}
