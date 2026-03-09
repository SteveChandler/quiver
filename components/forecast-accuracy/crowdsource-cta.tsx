/**
 * CrowdsourceCta
 *
 * Server component — encourages visitors to sign up and log sessions
 * so their local reports help improve forecast accuracy for everyone.
 */

import Link from "next/link";

export function CrowdsourceCta() {
  return (
    <section
      aria-label="Help improve forecast accuracy"
      className="rounded-2xl border border-white/15 bg-gradient-to-br from-sky-900/80 to-indigo-900/80 p-6 md:p-8 text-center"
    >
      <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
        Help Us Get Even More Accurate
      </h2>
      <p className="text-medium max-w-lg mx-auto mb-6 text-sm md:text-base leading-relaxed">
        Every session you log helps calibrate our model. Report what you
        actually see at the beach — wave size, conditions, crowd — and
        your observations feed back into better forecasts for everyone.
      </p>
      <Link
        href="/auth/sign-up"
        className="inline-flex items-center px-6 py-3 rounded-lg bg-white font-semibold text-sm text-ocean-blue hover:bg-gray-50 transition-colors"
      >
        Sign Up to Report Conditions
      </Link>
    </section>
  );
}
