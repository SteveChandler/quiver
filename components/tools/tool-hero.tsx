import Image from "next/image";
import type { ReactNode } from "react";

interface ToolHeroProps {
  imageSrc: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  children?: ReactNode;
  priority?: boolean;
}

/**
 * Hero component for tool pages — matches the Learn portal pattern.
 * Blurred background + sharp overlay + gradient mask + noise texture.
 * Shorter than Learn heroes (40-50vh) since tool pages are functional.
 */
export function ToolHero({
  imageSrc,
  title,
  description,
  badge,
  children,
  priority = true,
}: ToolHeroProps) {
  return (
    <section className="relative flex min-h-[280px] flex-col justify-end overflow-hidden bg-[#0A0E27] sm:min-h-[340px] md:min-h-[400px]">
      {/* Layer 1: Blurred background */}
      <Image
        src={imageSrc}
        alt=""
        fill
        className="object-cover blur-3xl opacity-40 scale-110"
        priority={priority}
        sizes="100vw"
      />

      {/* Layer 2: Sharp main image */}
      <Image
        src={imageSrc}
        alt=""
        fill
        className="object-cover object-center contrast-[1.10] saturate-[1.2] brightness-[1.05]"
        priority={priority}
        sizes="100vw"
      />

      {/* Layer 3: Gradient overlay — stronger at bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E27] via-[#252D6B]/70 to-transparent" />

      {/* Layer 4: Noise texture */}
      <div className="noise-texture-subtle absolute inset-0 pointer-events-none" />

      {/* Layer 5: Content — pinned to bottom */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 sm:pb-10 lg:px-8">
        {badge && <div className="mb-4">{badge}</div>}
        <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
