import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { TERMS_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review Quiver's Terms of Service. Understand your rights and responsibilities when using our surf forecasting and community platform.",
  alternates: { canonical: "/terms" },
  keywords: [
    "terms of service",
    "user agreement",
    "surf app terms",
    "quiver terms",
    "legal terms",
  ],
  openGraph: {
    title: "Terms of Service",
    description:
      "Review the terms and conditions for using Quiver, the surf community platform.",
    type: "website",
  },
};

export default function TermsPage() {
  const { hero, overview, sections, contact } = TERMS_CONTENT;

  return (
    <ZineSurface
      sectionLabel="Terms of service"
      editionLabel="The fine print"
      data-testid="terms-zine-surface"
    >
      <main className="mx-auto max-w-3xl">
        {/* Masthead / hero */}
        <ScrollReveal>
          <header className="relative border-b-2 border-[#11100D] pb-8">
            <QuiverSticker
              sticker="creamTape"
              className="absolute -top-7 right-2 hidden w-28 -rotate-6 opacity-90 sm:block"
            />
            <p className="label-black mb-5">Legal</p>
            <h1 className="font-heading text-4xl font-black uppercase leading-[0.92] tracking-tight text-[#11100D] sm:text-5xl">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#11100D]/75">
              {hero.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <span className="border-l-2 border-[#F78E42] pl-2 text-[#11100D]">
                Last updated: {hero.lastUpdated}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#11100D]/60">
              {hero.effectiveDate}
            </p>
          </header>
        </ScrollReveal>

        {/* Overview */}
        <ScrollReveal>
          <section className="mt-10">
            <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {overview.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#11100D]/80 sm:text-lg">
              {overview.description}
            </p>
          </section>
        </ScrollReveal>

        {/* Quick navigation */}
        <ScrollReveal>
          <nav
            aria-label="Terms sections"
            className="mt-10 border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
          >
            <p className="typewriter mb-4">On this page</p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`#${section.id}`}
                    className="group flex items-start gap-2 text-sm leading-snug text-[#11100D]/80 transition-colors hover:text-[#B56A2B]"
                  >
                    <span aria-hidden className="font-mono text-[#B56A2B]">
                      &rsaquo;
                    </span>
                    <span className="group-hover:underline">
                      {section.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </ScrollReveal>

        {/* Terms sections */}
        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <ScrollReveal key={section.id}>
              <section id={section.id} className="scroll-mt-24">
                <div className="flex items-center gap-3 border-b-2 border-dashed border-[#11100D]/35 pb-3">
                  <section.icon
                    className="h-5 w-5 shrink-0 text-[#B56A2B]"
                    aria-hidden
                  />
                  <h2 className="font-heading text-xl font-black uppercase leading-tight text-[#11100D] sm:text-2xl">
                    {section.title}
                  </h2>
                </div>
                <div className="mt-5 space-y-5">
                  {section.content.map((item, itemIndex) => (
                    <div key={itemIndex}>
                      <h3 className="font-heading text-base font-bold uppercase tracking-wide text-[#11100D]">
                        {item.subtitle}
                      </h3>
                      <p className="mt-2 text-base leading-relaxed text-[#11100D]/78">
                        {item.details}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </ScrollReveal>
          ))}
        </div>

        {/* Contact */}
        <ScrollReveal>
          <section className="mt-14 border-2 border-[#11100D] bg-[#F0E5CC] p-6 sm:p-8">
            <h2 className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {contact.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#11100D]/78">
              {contact.description}
            </p>

            <dl className="mt-6 space-y-3 text-base text-[#11100D]/85">
              {contact.methods.map((method, index) => (
                <div key={index} className="flex flex-wrap gap-x-2">
                  <dt className="font-heading font-bold uppercase tracking-wide text-[#11100D]">
                    {method.type}:
                  </dt>
                  <dd>{method.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-7">
              <Link
                href="mailto:legal@quiversurf.com"
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
              >
                <Mail className="mr-2 h-5 w-5" aria-hidden />
                Contact Legal Team
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </main>
    </ZineSurface>
  );
}
