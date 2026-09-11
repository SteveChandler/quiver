import type { ReactElement } from "react";

import { ZineSurface } from "@/components/zine/zine-surface";

export default function Loading(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="OUTSIDE"
      className="min-h-screen bg-[#0D1020]"
      stageClassName="min-h-screen pt-20"
      paperClassName="!p-2 sm:!p-4"
    >
      <div className="zine-developing flex min-h-[600px] items-center justify-center border-4 border-[#11100D] bg-[#0B3A75] text-[#F5EEDC]">
        <p className="font-heading text-2xl font-black uppercase tracking-[0.08em]">
          Set on the horizon…
        </p>
      </div>
    </ZineSurface>
  );
}
