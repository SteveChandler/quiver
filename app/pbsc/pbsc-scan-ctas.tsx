"use client";

import type { ReactElement, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { cn } from "@/lib/utils";

type PbscPlacement = "hero_primary" | "bottom_primary";

interface PbscScanCtasProps {
  isIosVisitor: boolean;
  placement: PbscPlacement;
  className?: string;
  children?: ReactNode;
}

const baseClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-5 py-3 text-base font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]";

const primaryClassName =
  "bg-[#F78E42] text-[#11100D] hover:bg-[#FDB84B]";

export function PbscScanCtas({
  isIosVisitor,
  placement,
  className,
  children,
}: PbscScanCtasProps): ReactElement {
  if (isIosVisitor) {
    return (
      <IosAppStoreCta
        source="pbsc-event-app-store"
        surface="pbsc-page"
        placement={placement}
        className={cn(baseClassName, primaryClassName, className)}
      >
        {children ?? (
          <>
            Open Quiver on iPhone
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </IosAppStoreCta>
    );
  }

  return (
    <AndroidWaitlistCta
      source="pbsc-event-android-waitlist"
      surface="pbsc-page"
      placement={placement}
      successLabel="Android updates are set"
      className={cn(baseClassName, primaryClassName, className)}
    >
      {children ?? "Join Android waitlist"}
    </AndroidWaitlistCta>
  );
}
