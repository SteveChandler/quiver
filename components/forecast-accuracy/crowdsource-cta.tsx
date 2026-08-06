/**
 * CrowdsourceCta
 *
 * Server component: invites field feedback without implying that surfer reports
 * automatically train or calibrate production forecasts.
 */

import Link from "next/link";

export function CrowdsourceCta() {
  return (
    <section
      aria-label="Share field feedback"
      className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-5 text-center shadow-[4px_4px_0_#11100D] md:p-7"
    >
      <h2 className="font-heading text-2xl font-black text-[#F4EBD8] md:text-3xl">
        Your report is a field note, not ground truth.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-[#D8E8F7] md:text-base">
        Log what you saw: wave size, conditions, and crowd. Reports are captured
        for operator review. They do not automatically train or calibrate
        production forecasts.
      </p>
      <Link
        href="/auth/sign-up"
        className="mt-5 inline-flex rotate-[-1deg] items-center rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-6 py-3 text-sm font-black text-[#11100D] shadow-[3px_3px_0_#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBD8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B3A75]"
      >
        Log a session
      </Link>
    </section>
  );
}
