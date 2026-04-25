"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitRequestDialog } from "./SubmitRequestDialog";

interface Props {
  authed: boolean;
}

export function RoadmapClientControls({ authed }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const handleOpen = () => {
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
        className="group relative shrink-0 rotate-[-1deg] rounded-[14px_6px_16px_4px] bg-[#F78E42] px-5 py-3 font-[var(--font-heading)] text-sm font-bold uppercase tracking-wide text-[#252D6B] shadow-[0_3px_0_rgba(0,0,0,0.35)] transition hover:-rotate-[2deg] hover:bg-[#ffa760]"
      >
        Drop a req →
      </button>
      {authed && <SubmitRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </>
  );
}
