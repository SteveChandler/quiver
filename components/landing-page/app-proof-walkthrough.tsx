import Image from "next/image";
import type { ReactElement } from "react";

const STEPS = [
  {
    eyebrow: "01 / the call",
    title: "Get the call",
    body: "See whether the window is worth it before the coffee cools.",
    imageSrc: "/images/app-screenshots/surf-call.png",
    imageAlt:
      "Quiver app surf call with swell, wind, tide, and best-window guidance.",
    className: "md:col-span-5 md:rotate-[-1deg]",
    imageClassName: "aspect-[9/13]",
  },
  {
    eyebrow: "02 / local check",
    title: "Check the beach",
    body: "Ground-truth the forecast with nearby spots, skill fit, and local context.",
    imageSrc: "/images/app-screenshots/local-intel.png",
    imageAlt:
      "Quiver app local beach finder with nearby surf spots and skill filters.",
    className: "md:col-span-4 md:translate-y-10 md:rotate-[1.5deg]",
    imageClassName: "aspect-[9/14]",
  },
  {
    eyebrow: "03 / log it",
    title: "Log the session",
    body: "Save what happened so your next call gets smarter.",
    imageSrc: "/images/app-screenshots/session-log.png",
    imageAlt:
      "Quiver app session log with beach, board, duration, rating, and wave conditions.",
    className: "md:col-span-3 md:rotate-[-2deg]",
    imageClassName: "aspect-[9/15]",
  },
] as const;

export function AppProofWalkthrough(): ReactElement {
  return (
    <section
      id="proof"
      className="noise-texture relative overflow-hidden bg-background px-5 py-16 text-foreground md:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-sunset-orange">
            app proof
          </p>
          <h2 className="font-heading text-4xl font-black uppercase leading-none sm:text-5xl md:text-6xl">
            The app loop before dawn patrol
          </h2>
          <p className="mt-4 max-w-2xl font-sans text-base leading-7 text-muted-foreground sm:text-lg">
            Quiver is built around the decision surfers actually make: where to
            paddle out, what to expect, and what happened after.
          </p>
        </div>

        <ol className="mt-12 grid gap-7 md:grid-cols-12 md:items-start">
          {STEPS.map((step) => (
            <li key={step.title} className={step.className}>
              <article className="relative overflow-hidden rounded-[26px_10px_30px_14px] border border-white/12 bg-card p-4 shadow-[0_14px_50px_rgba(0,0,0,0.28)]">
                <p className="mb-3 inline-flex rotate-[-1deg] rounded-[9px_3px_11px_4px] bg-sunset-orange px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-background shadow-[0_2px_0_rgba(0,0,0,0.24)]">
                  {step.eyebrow}
                </p>
                <div
                  className={`relative overflow-hidden rounded-[22px_9px_25px_11px] border border-white/10 bg-header-start ${step.imageClassName}`}
                >
                  <Image
                    src={step.imageSrc}
                    alt={step.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 28vw, 92vw"
                    className="object-cover"
                  />
                </div>
                <h3 className="mt-5 font-heading text-2xl font-black uppercase leading-none">
                  {step.title}
                </h3>
                <p className="mt-3 font-sans text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
