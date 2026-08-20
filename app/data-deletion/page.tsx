import { Metadata } from "next";
import Link from "next/link";
import { Mail, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { QuiverSticker, ZineSurface } from "@/components/zine";

export const metadata: Metadata = {
  title: "Delete Your Quiver Account & Data",
  description:
    "How to delete your Quiver account and personal data. Step-by-step instructions for in-app deletion and contact for users who cannot access the app.",
  alternates: { canonical: "/data-deletion" },
  robots: { index: true, follow: true },
};

const IN_APP_STEPS = [
  "Open the Quiver app on iOS or Android (or sign in at quiversurf.app on web)",
  "Tap the Profile tab in the bottom navigation",
  "Tap Edit Profile",
  "Scroll to the bottom and tap Delete Account",
  "Confirm the deletion in the modal — your account and personal data are removed immediately",
];

const DELETED_DATA = [
  "Profile (display name, bio, avatar, location, experience level)",
  "Authentication record (email, password hash, OAuth links)",
  "Surf sessions and session photos you uploaded",
  "Comments you left on sessions",
  "Boards in your quiver",
  "Saved beaches and favorite locations",
  "Follow relationships (followers and following)",
  "Push notification tokens and notification preferences",
  "Subscription state and entitlement records (purchase receipts retained per Apple/Google policy)",
];

const RETAINED_DATA = [
  "Aggregated, anonymized usage analytics (no personal identifiers, used for product improvement)",
  "Crash and error logs in Sentry (anonymized within 30 days)",
  "Financial transaction records required by tax law (retained up to 7 years; not linkable to a usable identity)",
  "Public surf forecast and beach data (not personal — these are environmental measurements)",
];

export default function DataDeletionPage() {
  return (
    <ZineSurface
      sectionLabel="Your data"
      editionLabel="You own your data"
    >
      <main>
        {/* Hero */}
        <header className="relative">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-8 right-8 hidden w-32 rotate-6 opacity-85 sm:block"
          />
          <p className="label-black mb-5">Account deletion</p>
          <h1 className="zine-h1 font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
            Delete Your Quiver Account &amp; Data
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
            You own your data. Here&apos;s exactly how to delete it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
            <span>Last updated: April 30, 2026</span>
            <span aria-hidden>/</span>
            <span>iOS &amp; Android &amp; quiversurf.app</span>
          </div>
        </header>

        {/* In-App Steps */}
        <section className="mt-12 border-2 border-[#11100D] bg-[#FBF6E8] p-6 shadow-[2px_3px_0_rgba(17,16,13,0.22)] sm:p-8">
          <p className="typewriter mb-2">Recommended</p>
          <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
            Delete from inside the app
          </h2>
          <p className="mt-2 text-base leading-relaxed text-[#11100D]/70">
            The fastest way. Takes under 30 seconds.
          </p>
          <ol className="mt-6 space-y-4">
            {IN_APP_STEPS.map((step, idx) => (
              <li key={idx} className="flex items-start gap-4">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] font-mono text-sm font-bold text-[#11100D]">
                  {idx + 1}
                </span>
                <span className="pt-1 text-base leading-relaxed text-[#11100D]/80">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Email Fallback */}
        <section className="torn torn-tb rot-neg mt-10 border-2 border-[#11100D] bg-[#F0E5CC]">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-1 h-6 w-6 flex-shrink-0 text-[#B56A2B]"
              aria-hidden
            />
            <div>
              <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D]">
                Can&apos;t access the app?
              </h2>
              <p className="mt-2 text-base leading-relaxed text-[#11100D]/74">
                If you&apos;ve lost device access, forgot your password, or otherwise can&apos;t
                sign in, email us and we&apos;ll process the deletion manually within 7 days.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href="mailto:privacy@quiversurf.app?subject=Account%20deletion%20request"
              className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
            >
              <Mail className="mr-2 h-5 w-5" aria-hidden />
              privacy@quiversurf.app
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[#11100D]/65">
              Include the email you signed up with so we can locate your account. We&apos;ll
              confirm deletion when complete.
            </p>
          </div>
        </section>

        {/* What Gets Deleted */}
        <section className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-[#11100D]" aria-hidden />
              <h2 className="font-display text-xl font-black uppercase leading-tight text-[#11100D] sm:text-2xl">
                Data we delete
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/60">
              Removed immediately
            </p>
            <ul className="mt-4 space-y-3">
              {DELETED_DATA.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-2 text-sm leading-relaxed text-[#11100D]/72"
                >
                  <span className="mt-1 text-[#11100D]" aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-[#B56A2B]" aria-hidden />
              <h2 className="font-display text-xl font-black uppercase leading-tight text-[#11100D] sm:text-2xl">
                Data we retain
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/60">
              Anonymized or required by law
            </p>
            <ul className="mt-4 space-y-3">
              {RETAINED_DATA.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-2 text-sm leading-relaxed text-[#11100D]/72"
                >
                  <span className="mt-1 text-[#B56A2B]" aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Timing & Reversal */}
        <section className="mt-12">
          <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <p className="typewriter mb-2">Fine print</p>
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              Timing &amp; reversal
            </h2>
          </div>
          <div className="space-y-3 text-base leading-relaxed text-[#11100D]/74">
            <p>
              <strong className="text-[#11100D]">In-app deletion:</strong> immediate. The auth
              record and all linked personal data are removed from our database the moment you
              confirm.
            </p>
            <p>
              <strong className="text-[#11100D]">Email-requested deletion:</strong> processed
              within 7 calendar days. We may verify your identity by replying to the email
              address on file before we delete.
            </p>
            <p>
              <strong className="text-[#11100D]">Backups:</strong> any deleted data persists in
              encrypted backups for up to 30 days, after which it is permanently overwritten.
            </p>
            <p>
              <strong className="text-[#11100D]">Reversal:</strong>{" "}
              account deletion is permanent. We do not maintain a recovery window.
              If you&apos;d like to take a break instead, you can sign out and your
              data will remain unchanged.
            </p>
          </div>
        </section>

        {/* Footer link */}
        <section className="mt-12 border-t-2 border-dashed border-[#11100D]/35 pt-8 text-center">
          <p className="text-base text-[#11100D]/74">
            Questions about your data?{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[#B56A2B] underline-offset-4 hover:underline"
            >
              Read the full Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>
    </ZineSurface>
  );
}
