import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowUpRight, CalendarDays, ShieldCheck, Waves } from "lucide-react";
import type { RightNowConditions } from "@/types/beginner";

interface BeginnerSessionDecisionProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  conditions?: RightNowConditions;
  referenceSpotName?: string;
  decisionSummary?: string;
  bestTimeToSurfUrl?: string;
}

const STICKER_SRC = "/images/quiver-stickers/surf-wax.png";

export function BeginnerSessionDecision({
  cityName,
  citySlug,
  stateSlug,
  conditions,
  referenceSpotName,
  decisionSummary,
  bestTimeToSurfUrl,
}: BeginnerSessionDecisionProps): ReactElement {
  const seasonalHref = bestTimeToSurfUrl ?? `/best-time-to-surf/${citySlug}`;
  const spotHref = `/${stateSlug}/${citySlug}`;
  const spotName = conditions?.spotName ?? referenceSpotName ?? cityName;
  const summary =
    conditions?.summary ??
    decisionSummary ??
    `Use this ${cityName} beginner guide as the first filter.`;
  const links = [
    {
      label: `Open live ${cityName} spots`,
      href: spotHref,
      icon: Waves,
    },
    {
      label: "Check tide timing",
      href: `/tide/${citySlug}`,
      icon: CalendarDays,
    },
    {
      label: "Compare beginner seasons",
      href: seasonalHref,
      icon: ArrowUpRight,
    },
  ];

  return (
    <aside
      aria-label={`Beginner session call for ${cityName}`}
      className="overflow-hidden rounded-2xl border border-[#18a7a5]/30 bg-white shadow-lg"
      role="region"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#18a7a5]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#0b7371]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Beginner call
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            {spotName} is the reference spot right now
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {summary} Check the tide and keep a backup spot.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {links.map(({ href, icon: Icon, label }) => (
              <Link
                className="inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#f68b33]/60 hover:bg-[#fff4ea]"
                href={href}
                key={href}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon aria-hidden="true" className="h-4 w-4 text-[#f68b33]" />
                  {label}
                </span>
              </Link>
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
