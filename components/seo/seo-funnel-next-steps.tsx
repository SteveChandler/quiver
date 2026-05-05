import Link from "next/link";
import { ArrowRight, Compass, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SeoFunnelNextStep {
  label: string;
  href: string;
  description: string;
}

interface SeoFunnelNextStepsProps {
  title: string;
  description: string;
  steps: SeoFunnelNextStep[];
  className?: string;
}

export function SeoFunnelNextSteps({
  title,
  description,
  steps,
  className,
}: SeoFunnelNextStepsProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "py-1",
        className
      )}
      aria-label={title}
      data-testid="seo-funnel-next-steps"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-ocean-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ocean-blue">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Next steps
          </div>
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
            {description}
          </p>
        </div>
        <Waves
          className="hidden h-8 w-8 shrink-0 text-ocean-blue/40 md:block"
          aria-hidden="true"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={`${step.href}-${step.label}`}
            href={step.href}
            aria-label={step.label}
            className={cn(
              "group flex min-h-[132px] flex-col justify-between rounded-lg",
              "border border-slate-200 bg-slate-50/80 p-4",
              "transition-colors hover:border-ocean-blue/40 hover:bg-ocean-blue/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
            )}
          >
            <span>
              <span className="block text-sm font-semibold leading-5 text-slate-900">
                {step.label}
              </span>
              <span className="mt-2 block text-sm leading-5 text-slate-600">
                {step.description}
              </span>
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ocean-blue">
              Open page
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
