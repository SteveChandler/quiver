import Image from "next/image";
import type { ReactElement } from "react";
import { SessionIntelligenceIntentLink } from "./session-intelligence-intent-link";

interface SessionIntelligenceIntentHandoffProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  bestTimeToSurfUrl?: string;
}

const STICKER_SRC = "/images/quiver-stickers/spot-tide-window.png";

export function SessionIntelligenceIntentHandoff({
  cityName,
  citySlug,
  stateSlug,
  bestTimeToSurfUrl,
}: SessionIntelligenceIntentHandoffProps): ReactElement {
  const seasonalHref = bestTimeToSurfUrl ?? `/best-time-to-surf/${citySlug}`;
  const links = [
    {
      label: `Open live ${cityName} conditions`,
      href: `/${stateSlug}/${citySlug}`,
      icon: "waves" as const,
    },
    {
      label: "Check the tide window",
      href: `/tide/${citySlug}`,
      icon: "calendar-days" as const,
    },
    {
      label: "Compare seasonal windows",
      href: seasonalHref,
      icon: "map-pin" as const,
    },
    {
      label: "Scan the regional forecast",
      href: "/forecast",
      icon: "arrow-up-right" as const,
    },
  ];

  return (
    <aside
      aria-label="Turn this guide into today's surf call"
      className="overflow-hidden rounded-2xl border border-[#f68b33]/30 bg-[#14204a] text-white shadow-lg"
      role="region"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#f68b33]">
            Make the call
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Turn this guide into today&apos;s surf call
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {links.map(({ href, icon, label }, index) => (
              <SessionIntelligenceIntentLink
                className="inline-flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white transition hover:border-[#f68b33]/60 hover:bg-white/12"
                href={href}
                key={href}
                label={label}
                index={index}
                cityName={cityName}
                citySlug={citySlug}
                stateSlug={stateSlug}
                icon={icon}
              >
              </SessionIntelligenceIntentLink>
            ))}
          </div>
        </div>
        <div className="hidden justify-self-end sm:block">
          <Image
            alt=""
            aria-hidden="true"
            className="h-auto w-28 drop-shadow-xl"
            height={112}
            src={STICKER_SRC}
            width={112}
          />
        </div>
      </div>
    </aside>
  );
}
