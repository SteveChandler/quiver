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
      router.push("/auth?next=/roadmap");
      return;
    }
    setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
      >
        + Request
      </button>
      {authed && <SubmitRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </>
  );
}
