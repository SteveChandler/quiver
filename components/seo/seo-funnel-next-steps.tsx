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
  variant?: "default" | "paper";
  className?: string;
}

export function SeoFunnelNextSteps({
  title,
  description,
  steps,
  variant = "default",
  className,
}: SeoFunnelNextStepsProps) {
  if (steps.length === 0) {
    return null;
  }

  const isPaper = variant === "paper";

  return (
    <section
      className={cn(
        isPaper
          ? "seo-paper-next-steps py-6"
          : "py-1",
        className
      )}
      aria-label={title}
      data-testid="seo-funnel-next-steps"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div
            className={cn(
              "mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              isPaper
                ? "border border-[#0B3A75]/20 bg-[#0B3A75]/10 text-[#0B3A75]"
                : "bg-ocean-blue/10 text-ocean-blue"
            )}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Next steps
          </div>
          <h2
            className={cn(
              "text-xl font-semibold md:text-2xl",
              isPaper ? "text-[#11100D]" : "text-slate-900"
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              "mt-2 text-sm leading-6 md:text-base",
              isPaper ? "text-[#655C4C]" : "text-slate-600"
            )}
          >
            {description}
          </p>
        </div>
        <Waves
          className={cn(
            "hidden h-8 w-8 shrink-0 md:block",
            isPaper ? "text-[#0B3A75]/35" : "text-ocean-blue/40"
          )}
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
              "border p-4 transition-colors",
              isPaper
                ? "border-[#11100D]/15 bg-[#FBF6E8]/85 shadow-[2px_3px_0_rgba(17,16,13,0.1)] hover:border-[#0B3A75]/40 hover:bg-[#F4EBD8]"
                : "border-slate-200 bg-slate-50/80 hover:border-ocean-blue/40 hover:bg-ocean-blue/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isPaper
                ? "focus-visible:ring-[#0B3A75] focus-visible:ring-offset-[#F4EBD8]"
                : "focus-visible:ring-ocean-blue"
            )}
          >
            <span>
              <span
                className={cn(
                  "block text-sm font-semibold leading-5",
                  isPaper ? "text-[#11100D]" : "text-slate-900"
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  "mt-2 block text-sm leading-5",
                  isPaper ? "text-[#655C4C]" : "text-slate-600"
                )}
              >
                {step.description}
              </span>
            </span>
            <span
              className={cn(
                "mt-4 inline-flex items-center gap-1 text-sm font-semibold",
                isPaper ? "text-[#0B3A75]" : "text-ocean-blue"
              )}
            >
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
