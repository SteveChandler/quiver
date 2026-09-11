import type { ReactElement } from "react";

import { ZineSurface } from "@/components/zine/zine-surface";

export default function Loading(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="ONE MORE WAVE"
      className="min-h-screen bg-[#0B5FA5]"
      stageClassName="min-h-screen pt-20"
      paperClassName="!p-2 sm:!p-4"
    >
      <div className="flex min-h-[600px] items-center justify-center border-4 border-[#0A1D2B] bg-[#127CC1] text-[#F8FEFF] shadow-[4px_4px_0_#0A1D2B]">
        <p className="font-[var(--font-play-pixel)] text-lg uppercase tracking-[0.08em]">
          Set on the horizon…
        </p>
      </div>
    </ZineSurface>
  );
}
