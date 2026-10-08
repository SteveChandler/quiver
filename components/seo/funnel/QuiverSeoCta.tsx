import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SeoCta } from "@/lib/seo/funnel-pages";

interface QuiverSeoCtaProps {
  title: string;
  description: string;
  primaryCta: SeoCta;
  secondaryCta?: SeoCta;
}

export function QuiverSeoCta({
  title,
  description,
  primaryCta,
  secondaryCta,
}: QuiverSeoCtaProps) {
  return (
    <section className="rounded-lg border border-[#11100D]/10 bg-[#252D6B] p-6 text-white shadow-[4px_5px_0_rgba(17,16,13,0.18)] md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-lg bg-ocean-blue">
            <Link href={primaryCta.href}>
              {primaryCta.label}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {secondaryCta ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-lg border-white/30 bg-white/10 text-white hover:bg-white/15"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
