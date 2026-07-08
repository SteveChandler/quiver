import type { ReactNode } from "react";
import { DownloadFigureButton } from "./download-figure-button";

interface FigureFrameProps {
  kicker?: string;
  title: ReactNode;
  /** One-sentence summary for screen readers, injected visually-hidden. */
  summary: string;
  children: ReactNode;
  caption?: string;
  downloadTitle?: string;
}

/** Shared zine chrome for learn figures. Presentational only (SSR-safe, no hooks). */
export function FigureFrame({
  kicker,
  title,
  summary,
  children,
  caption,
  downloadTitle = "Quiver surf science figure",
}: FigureFrameProps) {
  return (
    <figure className="my-8 rounded-[14px_12px_15px_11px] border-[1.5px] border-[#11100D] bg-[#F4EBD8] p-4 shadow-[3px_4px_0_rgba(17,16,13,0.18)]">
      <span className="sr-only">{summary}</span>
      <div className="mb-3 border-b-[1.5px] border-[#11100D] pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6b6455]">
        <span className="font-bold text-[#F78E42]">QUIVER</span> · SURF SCIENCE
      </div>
      {kicker ? (
        <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#F78E42]">
          {kicker}
        </div>
      ) : null}
      <div className="mb-3 font-display text-2xl font-black uppercase leading-none tracking-tight text-[#11100D]">
        {title}
      </div>
      {children}
      <DownloadFigureButton title={downloadTitle} summary={summary} />
      {caption ? <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6b6455]">{caption}</figcaption> : null}
    </figure>
  );
}
