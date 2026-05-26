import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";

export function LandingPricingTeaser() {
  return (
    <section
      className="border-y border-white/10 bg-[#121832] px-4 py-12 sm:px-6 lg:px-8"
      data-testid="landing-pricing-teaser"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#7BDCB5]">
            <Smartphone className="h-4 w-4" />
            Native app status
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-normal text-white sm:text-3xl">
            iPhone is live. Android is next.
          </h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            Open Quiver on the App Store or join the Android waitlist.
          </p>
        </div>
        <Link
          href="/plans"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#F78E42]/55 px-5 py-3 text-sm font-semibold text-[#F78E42] transition-colors hover:bg-[#F78E42] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121832]"
        >
          See app options
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
