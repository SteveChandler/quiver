import type { Metadata } from "next";
import Link from "next/link";
import { Mail, HelpCircle, Bug } from "lucide-react";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { buildPageMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildPageMetadata({
  title: "Support",
  description:
    "Get help with Quiver: surf forecasts and alerts, session logging, Pro subscriptions, and account settings, plus how to report a bug or reach the team.",
  path: "/support",
});

const FAQ_ITEMS = [
  {
    question: "How do I find nearby beaches?",
    answer:
      "Tap Find Near Me on the Explore tab. Quiver shows beaches in CA, OR, WA, HI, Baja, and Puerto Rico.",
  },
  {
    question: "How accurate are the surf forecasts?",
    answer:
      "Quiver uses NOAA GFS + HRRR models updated hourly. Forecasts are most accurate 24–48 hours out.",
  },
  {
    question: "Can I use Quiver without signing in?",
    answer:
      "Yes. Browse forecasts and beach info without an account. Sign in to log sessions and connect with your crew.",
  },
  {
    question: "How do I log a surf session?",
    answer:
      "Tap the Record tab (mobile) or navigate to a beach page and tap \"Log Session\". Add photos, conditions, and notes.",
  },
  {
    question: "How do I export my data?",
    answer:
      "Go to Settings → Data Export to download your session history.",
  },
];

export default function SupportPage() {
  return (
    <ZineSurface sectionLabel="Support" editionLabel="Here for you">
      <main>
        <ScrollReveal>
          <header className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-8 right-8 hidden w-36 rotate-6 opacity-85 sm:block"
            />
            <p className="label-black mb-5">Support</p>
            <h1 className="zine-h1 font-heading font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Support
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
              Need help? We&apos;re here for you.
            </p>
          </header>
        </ScrollReveal>

        {/* Contact */}
        <ScrollReveal delay={80}>
          <section className="torn torn-tb rot-neg mt-12 border-2 border-[#11100D] bg-[#F0E5CC]">
            <div className="mb-4 flex items-center gap-3">
              <span className="circled bg-[#F78E42]/35">
                <Mail className="h-5 w-5 text-[#11100D]" aria-hidden />
              </span>
              <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]">
                Contact Us
              </h2>
            </div>
            <p className="mb-4 text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
              Email us and we&apos;ll get back to you within one business day.
            </p>
            <a
              href="mailto:support@quiversurf.app"
              className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-mono text-sm font-semibold tracking-tight text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
            >
              support@quiversurf.app
            </a>
          </section>
        </ScrollReveal>

        {/* FAQ */}
        <section className="mt-14" aria-labelledby="faq-heading">
          <ScrollReveal>
            <p className="mb-6 text-sm leading-relaxed text-[#11100D]/62">
              Have a feature request? Drop it on the{" "}
              <Link
                href="/roadmap"
                className="font-semibold text-[#B56A2B] underline-offset-2 hover:underline"
              >
                roadmap
              </Link>{" "}
              — we reply to every submission.
            </p>
            <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
              <div className="flex items-center gap-3">
                <span className="circled bg-[#F2C94C]/35">
                  <HelpCircle className="h-5 w-5 text-[#11100D]" aria-hidden />
                </span>
                <h2
                  id="faq-heading"
                  className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                >
                  Frequently Asked Questions
                </h2>
              </div>
              <QuiverSticker
                sticker="singleFin"
                className="hidden w-12 rotate-6 drop-shadow-sm sm:block"
              />
            </div>
          </ScrollReveal>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <ScrollReveal key={item.question}>
                <details className="group torn border-2 border-[#11100D] bg-[#FBF6E8] open:bg-[#F0E5CC]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-base font-black uppercase text-[#11100D] transition-colors hover:text-[#B56A2B] [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span className="shrink-0 font-mono text-2xl leading-none transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-[#11100D]/72">
                    {item.answer}
                  </p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Bug Report */}
        <ScrollReveal>
          <section className="relative mt-14" aria-labelledby="bug-heading">
            <QuiverSticker
              sticker="surfWax"
              className="absolute -top-6 right-6 z-10 hidden w-20 -rotate-6 opacity-90 sm:block"
            />
            <div className="notebook">
              <div className="mb-4 flex items-center gap-3">
                <span className="circled bg-[#F78E42]/35">
                  <Bug className="h-5 w-5 text-[#11100D]" aria-hidden />
                </span>
                <h2
                  id="bug-heading"
                  className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D]"
                >
                  Report a Bug
                </h2>
              </div>
              <p className="mb-4 text-base leading-relaxed text-[#11100D]/74">
                Found something broken? Email{" "}
                <a
                  href="mailto:support@quiversurf.app"
                  className="font-semibold text-[#B56A2B] underline-offset-2 hover:underline"
                >
                  support@quiversurf.app
                </a>{" "}
                with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed text-[#11100D]/72">
                <li>Your device and OS version</li>
                <li>Steps to reproduce the issue</li>
                <li>Screenshots or a screen recording if possible</li>
              </ul>
            </div>
          </section>
        </ScrollReveal>

        {/* Links */}
        <ScrollReveal>
          <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-8">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <Link
                href="/privacy"
                className="text-[#11100D]/65 transition-colors hover:text-[#B56A2B]"
              >
                Privacy Policy
              </Link>
              <span aria-hidden> · </span>
              <Link
                href="/terms"
                className="text-[#11100D]/65 transition-colors hover:text-[#B56A2B]"
              >
                Terms of Service
              </Link>
            </p>
          </section>
        </ScrollReveal>
      </main>
    </ZineSurface>
  );
}
