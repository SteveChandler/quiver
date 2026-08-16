"use client";

import { useState } from "react";
import type { FigureKey } from "./figure-keys";

// Rough content heights of each figure's embed page, so the iframe fits without
// inner scroll. Falls back to a safe default for unknown keys.
const EMBED_HEIGHTS: Record<FigureKey, number> = {
  "swell-period-morph": 520,
  "swell-origin-fetch": 340,
  "wave-height-reference": 570,
  "tide-window": 620,
};

export function EmbedFigureSnippet({ figureKey }: { figureKey: FigureKey }) {
  const [copied, setCopied] = useState(false);
  const height = EMBED_HEIGHTS[figureKey] ?? 480;
  const snippet = `<iframe src="https://www.quiversurf.app/embed/learn/${figureKey}" width="100%" height="${height}" style="border:0;max-width:720px" title="Quiver surf science figure" loading="lazy"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. non-secure context) — leave the snippet selectable instead
    }
  };

  return (
    <details className="mt-3 rounded-md border-[1.5px] border-[#11100D] bg-[#FBF6E8] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#11100D]/70 [&::-webkit-details-marker]:hidden">
        <span className="text-[#F78E42]">&lt;/&gt;</span>
        Embed this figure
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <code className="block overflow-x-auto whitespace-pre rounded bg-[#11100D] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#F4EBD8]">
          {snippet}
        </code>
        <button
          type="button"
          onClick={copy}
          className="self-start rounded border-[1.5px] border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#11100D] transition-transform hover:-translate-y-0.5 focus-ring"
        >
          {copied ? "Copied ✓" : "Copy embed code"}
        </button>
      </div>
    </details>
  );
}
