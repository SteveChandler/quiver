import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function LandingPricingTeaser() {
  return (
    <section
      className="border-y border-white/10 bg-[#121832] px-4 py-12 sm:px-6 lg:px-8"
      data-testid="landing-pricing-teaser"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#7BDCB5]">
            <ShieldCheck className="h-4 w-4" />
            Founding Access Waitlist
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-normal text-white sm:text-3xl">
            Log 5 sessions. Get Pro for lifetime.
          </h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            Join founding access, use Quiver to log 5 surf sessions, and
            qualify for lifetime Pro when plans open.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#F78E42]/55 px-5 py-3 text-sm font-semibold text-[#F78E42] transition-colors hover:bg-[#F78E42] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121832]"
        >
          See founding access
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
