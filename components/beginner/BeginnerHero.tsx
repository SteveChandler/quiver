import Image from "next/image";
import Link from "next/link";
import type { BeginnerConditionsBadge, BeginnerCityEditorial } from "@/types/beginner";

const STATUS_COLORS = {
  great: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  fair: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  challenging: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
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
      className="overflow-hidden rounded-[28px] border border-[#252D6B]/12 bg-[#0F1B3D] text-white shadow-[0_28px_90px_rgba(15,27,61,0.18)]"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,142,66,0.26),transparent_34%),linear-gradient(135deg,rgba(37,45,107,0.98),rgba(12,24,54,0.9))]" />
          <div className="relative px-6 py-8 md:px-8 md:py-10">
            <header className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">
                Beginner Surf Guide
              </p>
              <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                Beginner Surf Spots in {cityName}
              </h1>
              <p className="mt-3 text-base text-blue-100/78 md:text-lg">
                {regionLabel} &middot; {totalBeaches} beginner-friendly{" "}
                {totalBeaches === 1 ? "break" : "breaks"}
              </p>
            </header>

            {conditionsBadge && (
              <div
                className={`inline-flex max-w-full items-start gap-3 rounded-2xl border border-white/15 ${STATUS_COLORS[conditionsBadge.status].bg} px-5 py-3 shadow-sm`}
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
                  <p className="text-xs text-slate-700">
                    {conditionsBadge.waveHeight} &middot; {conditionsBadge.wind}{" "}
                    &middot; {conditionsBadge.waterTemp}
                  </p>
                  <p className="text-xs text-slate-700">
                    Based on conditions at {conditionsBadge.spotName}
                  </p>
                </div>
              </div>
            )}

            {cityEditorial && cityEditorial.description.length > 0 && (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-blue-50/88">
                {cityEditorial.description[0]}
              </p>
            )}

            {quickLinks.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:border-orange-200/50 hover:bg-white/14"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative min-h-[240px] border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
          {heroImageUrl ? (
            <>
              <Image
                src={heroImageUrl}
                alt={`${cityName} beginner surf conditions`}
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1B3D] via-[#0F1B3D]/10 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#203A7C,#0F1B3D_52%,#F78E42)]" />
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
