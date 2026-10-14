import Image from "next/image";
import Link from "next/link";
import type { BeginnerConditionsBadge, BeginnerCityEditorial } from "@/types/beginner";

// Paper-safe status tints; hex text colours so the retro-dark utility overrides don't wash them out.
const STATUS_COLORS = {
  great: { border: "border-[#0F766E]/35", text: "text-[#115E59]", dot: "bg-[#0F766E]" },
  fair: { border: "border-[#B65F1A]/35", text: "text-[#8A4B12]", dot: "bg-[#B65F1A]" },
  challenging: { border: "border-[#B91C1C]/35", text: "text-[#8A1F1F]", dot: "bg-[#B91C1C]" },
} as const;

interface BeginnerHeroProps {
  cityName: string;
  regionLabel: string;
  totalBeaches: number;
  conditionsBadge: BeginnerConditionsBadge | null;
  cityEditorial: BeginnerCityEditorial | null;
  heroImageUrl?: string | null;
}

export function BeginnerHero({
  cityName,
  regionLabel,
  totalBeaches,
  conditionsBadge,
  cityEditorial,
  heroImageUrl,
}: BeginnerHeroProps) {
  const quickLinks = cityEditorial?.quickLinks.slice(0, 3) ?? [];

  return (
    <section
      data-testid="beginner-hero"
      className="overflow-hidden rounded-[28px] border-2 border-[#11100D] bg-[#FBF6E8] text-[#11100D] shadow-[6px_6px_0_rgba(17,16,13,0.85)]"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,142,66,0.16),transparent_40%)]" />
          <div className="relative px-6 py-8 md:px-8 md:py-10">
            <header className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#AA4918]">
                Beginner Surf Guide
              </p>
              <h1 className="mt-3 font-display text-3xl font-black uppercase leading-tight text-[#11100D] md:text-4xl">
                Beginner Surf Spots in {cityName}
              </h1>
              <p className="mt-3 text-base text-[#655C4C] md:text-lg">
                {regionLabel} &middot; {totalBeaches} beginner-friendly{" "}
                {totalBeaches === 1 ? "break" : "breaks"}
              </p>
            </header>

            {conditionsBadge && (
              <div
                className={`inline-flex max-w-full items-start gap-3 rounded-2xl border-2 ${STATUS_COLORS[conditionsBadge.status].border} bg-[#F4EBD8] px-5 py-3`}
              >
                <span
                  className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${STATUS_COLORS[conditionsBadge.status].dot}`}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${STATUS_COLORS[conditionsBadge.status].text}`}
                  >
                    {conditionsBadge.statusLabel}
                  </p>
                  <p className="text-xs text-[#11100D]">
                    {conditionsBadge.waveHeight} &middot; {conditionsBadge.wind}{" "}
                    &middot; {conditionsBadge.waterTemp}
                  </p>
                  <p className="text-xs text-[#655C4C]">
                    Based on conditions at {conditionsBadge.spotName}
                  </p>
                </div>
              </div>
            )}

            {cityEditorial && cityEditorial.description.length > 0 && (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#11100D]/80">
                {cityEditorial.description[0]}
              </p>
            )}

            {quickLinks.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-[#11100D]/25 bg-[#F4EBD8] px-3 py-1.5 text-sm font-medium text-[#AA4918] transition hover:border-[#AA4918]/60"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative min-h-[240px] border-t-2 border-[#11100D] lg:min-h-full lg:border-l-2 lg:border-t-0">
          {heroImageUrl ? (
            <>
              <Image
                src={heroImageUrl}
                alt={`${cityName} beginner surf conditions`}
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#11100D]/70 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#EEE3C9,#F7E8C7_55%,#F78E42)]" />
          )}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-sm font-medium text-white/92">
              Use this page to find the cleanest beginner window, not the biggest score.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
