import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";
import { cn } from "@/lib/utils";

interface StoreDownloadButtonsProps {
  platform: FirstTouchPlatform;
  surface: string;
  placement: string;
  source?: string;
  orientation?: "row" | "stack";
  includeComparison?: boolean;
  className?: string;
  iosLabel?: ReactNode;
  androidLabel?: ReactNode;
}

const ZINE_CTA_CLASSES =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px_6px_16px_6px] bg-[#F78E42] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]";

const ZINE_DESKTOP_CLASSES =
  "w-full max-w-xl rounded-[18px_8px_20px_10px] border-2 border-[#11100D] bg-[#EFE5CF] p-5 text-[#11100D] shadow-[4px_6px_0_#11100D]";

export function StoreDownloadButtons({
  platform,
  surface,
  placement,
  source,
  orientation = "row",
  includeComparison = false,
  className,
  iosLabel,
  androidLabel,
}: StoreDownloadButtonsProps): ReactElement {
  const resolvedSource = source ?? `${surface}_${placement}`;

  return (
    <div
      data-testid="store-download-buttons"
      className={cn(
        "flex flex-wrap gap-3",
        orientation === "stack"
          ? "flex-col items-stretch"
          : "flex-row items-center",
        className,
      )}
    >
      <NativeAppFunnelCta
        platform={platform}
        source={resolvedSource}
        surface={surface}
        placement={placement}
        className={ZINE_CTA_CLASSES}
        desktopClassName={ZINE_DESKTOP_CLASSES}
        desktopShowEmailForm={false}
        iosLabel={iosLabel}
        androidLabel={androidLabel}
      />

      {includeComparison ? (
        <Link
          data-testid="store-download-compare-link"
          href="/vs/surfline"
          className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#0B3A75] underline decoration-[#F78E42] decoration-2 underline-offset-4 transition hover:text-[#11100D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
        >
          Compare with Surfline
        </Link>
      ) : null}
    </div>
  );
}
