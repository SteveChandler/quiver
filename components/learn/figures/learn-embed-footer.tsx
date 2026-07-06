"use client";

import { useEffect } from "react";
import type { FigureKey } from "./figure-keys";

export function LearnEmbedFooter({ figureKey }: { figureKey: FigureKey }) {
  useEffect(() => {
    // fire-and-forget impression; ignore failures (embed visitors are anonymous)
    fetch("/api/embed-impressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetType: "learn-figure", beachSlug: figureKey }),
    }).catch(() => {});
  }, [figureKey]);

  return (
    <a
      href="https://www.quiversurf.app/?utm_source=embed&utm_medium=learn-figure&utm_campaign=groundswell"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center justify-between rounded-md border-[1.5px] border-[#11100D] bg-[#F4EBD8] px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-[#11100D]"
    >
      <span><b className="text-[#F78E42]">Quiver</b> · surf science</span>
      <span className="font-bold text-[#F78E42]">Check your beach →</span>
    </a>
  );
}
