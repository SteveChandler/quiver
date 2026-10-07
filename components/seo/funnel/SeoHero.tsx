import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SeoCta, SeoImage } from "@/lib/seo/funnel-pages";
import { SeoImageFrame } from "./SeoImageFrame";

interface SeoHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: SeoCta;
  secondaryCta?: SeoCta;
  image?: SeoImage;
}

export function SeoHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  image,
}: SeoHeroProps) {
  return (
    <header className="grid gap-7 py-6 md:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-center">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ocean-blue/20 bg-ocean-blue/10 px-3 py-1 text-sm font-semibold text-ocean-blue">
          <MapPin className="h-4 w-4" aria-hidden />
          {eyebrow}
        </div>
        <h1 className="max-w-4xl font-heading text-4xl font-bold leading-tight text-gray-900 md:text-5xl lg:text-[3.45rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-700 lg:text-base">
          {description}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-full">
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
              className="rounded-full border-2 border-[#11100D] bg-[#F4EBD8] font-bold text-[#11100D] hover:bg-[#EEE3C9] hover:text-[#11100D]"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {image ? (
        <SeoImageFrame
          image={image}
          priority
          showCaption={false}
          className="w-full max-w-md lg:justify-self-end"
          sizes="(max-width: 1024px) 100vw, 460px"
        />
      ) : null}
    </header>
  );
}
