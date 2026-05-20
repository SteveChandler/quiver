"use client";

import { useCallback, useState } from "react";
import { AppleBetaPromptDialog } from "@/components/app-store/apple-beta-prompt";
import type { AppleBetaPromptDeviceMode } from "@/lib/app-store/apple-beta-prompt";

declare global {
  interface Window {
    __appleBetaPromptHarnessEvents?: string[];
  }
}

interface AppleBetaPromptHarnessProps {
  deviceMode: AppleBetaPromptDeviceMode;
}

type HarnessAction = "idle" | "copy" | "open_testflight" | "not_now" | "close";

export function AppleBetaPromptHarness({
  deviceMode,
}: AppleBetaPromptHarnessProps) {
  const [open, setOpen] = useState(true);
  const [lastAction, setLastAction] = useState<HarnessAction>("idle");

  const recordAction = useCallback((action: HarnessAction): void => {
    window.__appleBetaPromptHarnessEvents = [
      ...(window.__appleBetaPromptHarnessEvents ?? []),
      action,
    ];
    setLastAction(action);
  }, []);

  return (
    <main className="min-h-screen bg-[#07133A] p-6">
      <output
        aria-label="Apple beta prompt last action"
        className="sr-only"
        data-testid="apple-beta-prompt-last-action"
      >
        {lastAction}
      </output>
      <AppleBetaPromptDialog
        open={open}
        deviceMode={deviceMode}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            recordAction("close");
          }
        }}
        onOpenTestFlight={() => {
          recordAction("open_testflight");
          setOpen(false);
        }}
        onCopyLink={() => {
          recordAction("copy");
          setOpen(false);
        }}
        onDismiss={() => {
          recordAction("not_now");
          setOpen(false);
        }}
      />
    </main>
  );
}
