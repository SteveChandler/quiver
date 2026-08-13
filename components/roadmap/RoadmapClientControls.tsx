"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SubmitRequestDialog } from "./SubmitRequestDialog";

interface Props {
  authed: boolean;
}

export function RoadmapClientControls({ authed }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const handleOpen = (): void => {
    if (!authed) {
      router.push("/auth/sign-in?next=/roadmap");
      return;
    }
    setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="group relative inline-flex min-h-11 shrink-0 rotate-[-1deg] items-center rounded-[14px_6px_16px_4px] border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-[var(--font-zine-display)] text-sm font-black uppercase tracking-wide text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.35)] transition hover:-rotate-[2deg] hover:-translate-y-0.5 focus-ring"
      >
        Drop a req
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </button>
      {authed && <SubmitRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </>
  );
}
