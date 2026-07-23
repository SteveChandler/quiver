import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowUpRight, CalendarDays, ShieldCheck, Waves } from "lucide-react";
import type {
  BeginnerVerdictRating,
  RightNowConditions,
} from "@/types/beginner";

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

const VERDICT_COPY: Record<
  BeginnerVerdictRating,
  {
    label: "YES" | "MAYBE" | "NO";
    headline: string;
    nextStep: string;
    tone: string;
  }
> = {
  ideal: {
    label: "YES",
    headline: "Go surf!",
    nextStep: "Recheck the beach when you arrive and stay inside your limits.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  acceptable: {
    label: "MAYBE",
    headline: "Might work",
    nextStep: "Watch a few sets from shore and use the mellowest available peak.",
    tone: "border-amber-300 bg-amber-50 text-amber-800",
  },
  poor: {
    label: "NO",
    headline: "Skip it",
    nextStep:
      "Wait for a smaller, lighter-wind window or book a lesson at a protected beginner break.",
    tone: "border-rose-300 bg-rose-50 text-rose-800",
  },
  unknown: {
    label: "MAYBE",
    headline: "Check the beach first",
    nextStep:
      "Confirm the sets, wind, and current before deciding whether this window fits you.",
    tone: "border-slate-300 bg-slate-50 text-slate-800",
  },
};

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
  const rating = conditions?.beginnerVerdict.rating ?? "unknown";
  const verdict = VERDICT_COPY[rating];
  const reasons = conditions?.beginnerVerdict.reasons ?? [];
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
            Can a beginner surf here today?
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1 font-mono text-sm font-black tracking-[0.12em] ${verdict.tone}`}
            >
              {verdict.label}
            </span>
            <p className="text-lg font-bold text-slate-900">
              {verdict.headline}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            <strong>{spotName}:</strong> {summary}
          </p>
          {reasons.length > 0 ? (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {reasons.map((reason) => (
                <div
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  key={reason.factor}
                >
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {reason.factor}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {reason.detail}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="mt-4 text-sm font-medium leading-6 text-slate-800">
            Next step: {verdict.nextStep}
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
