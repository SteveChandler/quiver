"use client";

import Image from "next/image";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";
import {
  trackInstallBarClick,
  trackInstallBarDismiss,
  trackInstallBarView,
} from "@/lib/analytics/install-bar-tracking";
import {
  buildInstallBarCopy,
  INSTALL_BAR_PLACEMENT,
  INSTALL_BAR_SCROLL_THRESHOLD_VH,
  type InstallBarSurface,
  isInstallAskInView,
} from "@/lib/app-store/install-bar";
import { buildAppHandoffUrl } from "@/lib/constants/app-handoff";
import { cn } from "@/lib/utils";

interface InstallBarProps {
  surface: InstallBarSurface;
  placeName: string;
  valueLabel: string | null;
  isTomorrow?: boolean;
  source: string;
  pathname: string;
  onDismiss: () => void;
}

/**
 * Fixed-bottom install bar for iPhone visitors. Fixed positioning means it
 * cannot shift layout (CLS). It is mounted lazily by `StickyInstallAsk`, which
 * owns eligibility and the hand-back to the signup bar after dismissal.
 *
 * One ask at a time: the other install asks are suppressed for these visitors,
 * the bar stays hidden until the visitor has scrolled past the first answer,
 * and it hides again while any remaining in-flow install ask is on screen.
 */
export function InstallBar({
  surface,
  placeName,
  valueLabel,
  isTomorrow = false,
  source,
  pathname,
  onDismiss,
}: InstallBarProps): ReactElement {
  const reducedMotion = useReducedMotion();
  const barRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  const copy = useMemo(
    () => buildInstallBarCopy({ surface, placeName, valueLabel, isTomorrow }),
    [surface, placeName, valueLabel, isTomorrow],
  );
  const href = useMemo(
    () =>
      buildAppHandoffUrl({
        source,
        surface,
        placement: INSTALL_BAR_PLACEMENT,
      }),
    [source, surface],
  );

  useEffect(() => {
    let frame: number | null = null;

    const evaluate = (): void => {
      frame = null;
      const scrolledPastAnswer =
        window.scrollY >= window.innerHeight * INSTALL_BAR_SCROLL_THRESHOLD_VH;
      setIsVisible(scrolledPastAnswer && !isInstallAskInView());
    };
    const schedule = (): void => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackInstallBarView({ surface, pathname });
  }, [isVisible, pathname, surface]);

  // WCAG 2.4.11: keep focused elements from sitting under the bar.
  useEffect(() => {
    if (!isVisible) return;

    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${barRef.current?.offsetHeight ?? 72}px`;

    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [isVisible]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const handoff = createClientAppHandoffLink({
        source,
        surface,
        placement: INSTALL_BAR_PLACEMENT,
      });
      event.currentTarget.href = handoff.url;
      trackInstallBarClick({
        surface,
        pathname,
        source,
        ctaText: copy.cta,
        destinationUrl: handoff.url,
        handoffId: handoff.handoffId,
      });
    },
    [copy.cta, pathname, source, surface],
  );

  const handleDismiss = useCallback(() => {
    trackInstallBarDismiss({ surface, pathname });
    onDismiss();
  }, [onDismiss, pathname, surface]);

  return (
    <aside
      ref={barRef}
      aria-label="Quiver iPhone app install"
      data-testid="install-bar"
      data-visible={isVisible}
      aria-hidden={!isVisible}
      inert={!isVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50",
        "border-t border-white/10 bg-[#252D6B] text-white shadow-[0_-4px_20px_rgba(0,0,0,0.3)]",
        "pb-[env(safe-area-inset-bottom)]",
        reducedMotion
          ? cn("transition-opacity duration-200", isVisible ? "opacity-100" : "invisible opacity-0")
          : cn(
              "transition-[opacity,transform] duration-300 ease-out",
              isVisible
                ? "translate-y-0 opacity-100"
                : "invisible translate-y-full opacity-0",
            ),
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <Image
          src="/quiver-app-icon-128.png"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-[8px]"
        />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold leading-5">
            {copy.headline}
          </p>
          <p className="text-xs leading-4 text-white/75">{copy.subline}</p>
        </div>
        <a
          href={href}
          onClick={handleClick}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#F78E42] px-4 text-sm font-semibold text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
        >
          {copy.cta}
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss app install bar"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
