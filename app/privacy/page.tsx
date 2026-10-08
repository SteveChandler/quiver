import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { PRIVACY_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Quiver protects your privacy and handles your personal data. Our comprehensive privacy policy explains our data practices in clear terms.",
  alternates: { canonical: "/privacy" },
  keywords: [
    "privacy policy",
    "data protection",
    "personal data",
    "surf app privacy",
    "user data",
  ],
  openGraph: {
    title: "Privacy Policy",
    description:
      "Transparent privacy practices for the surf community. Learn how we protect and handle your personal information.",
    type: "website",
  },
};

export default function PrivacyPage() {
  const {
    hero,
    overview,
    importantInfo,
    dataCategories,
    accessibility,
    sections,
    annexes,
    contact,
  } = PRIVACY_CONTENT;

  return (
    <ZineSurface sectionLabel="Privacy" editionLabel="The fine print">
      <main>
        {/* Hero */}
        <header className="relative">
          <QuiverSticker
            sticker="orangeTape"
            className="absolute -top-7 right-6 hidden w-32 rotate-3 opacity-85 sm:block"
          />
          <p className="label-black mb-5">Privacy policy</p>
          <h1 className="zine-h1 font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#11100D]/75 sm:text-2xl">
            {hero.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
            <span className="inline-flex items-center border-2 border-[#11100D] bg-[#F0E5CC] px-3 py-1 font-semibold">
              Last Updated: {hero.lastUpdated}
            </span>
            <span className="max-w-xl normal-case tracking-normal text-[#11100D]/60">
              {hero.effectiveDate}
            </span>
          </div>
        </header>

        {/* Overview */}
        <section className="mt-12">
          <div className="torn torn-tb border-2 border-[#11100D] bg-[#F0E5CC]">
            <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
              {overview.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
              {overview.description}
            </p>
          </div>
        </section>

        {/* Important Information */}
        <section className="mt-14">
          <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <p className="typewriter mb-2">Who we are</p>
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {importantInfo.title}
            </h2>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                Purpose of this Privacy Policy
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                {importantInfo.purpose}
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                Children&rsquo;s Privacy
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                {importantInfo.childrenPolicy}
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                Contact Details
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                {importantInfo.contact}
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                Changes to Privacy Policy
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                {importantInfo.changes}
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                Third-Party Links
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                {importantInfo.thirdPartyLinks}
              </p>
            </div>
          </div>
        </section>

        {/* Data Categories */}
        <section className="mt-14">
          <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <p className="typewriter mb-2">What we collect</p>
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {dataCategories.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
              {dataCategories.intro}
            </p>
          </div>

          <div className="space-y-5">
            {dataCategories.categories.map((category, index) => (
              <div
                key={index}
                className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8]"
              >
                <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                  {category.name}
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 text-sm lg:grid-cols-2">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#B56A2B]">
                      Description
                    </p>
                    <p className="mt-1 leading-relaxed text-[#11100D]/72">
                      {category.description}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#B56A2B]">
                      Sources
                    </p>
                    <p className="mt-1 leading-relaxed text-[#11100D]/72">
                      {category.sources}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#B56A2B]">
                      Legal Basis
                    </p>
                    <p className="mt-1 leading-relaxed text-[#11100D]/72">
                      {category.purpose}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#B56A2B]">
                      Third Parties Disclosed
                    </p>
                    <p className="mt-1 leading-relaxed text-[#11100D]/72">
                      {category.disclosed}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Accessibility Notice */}
        <section className="mt-12">
          <div className="notebook">
            <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
              {accessibility.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
              {accessibility.description}
            </p>
          </div>
        </section>

        {/* Privacy Sections */}
        <section className="mt-14 space-y-12">
          {sections.map((section) => (
            <div key={section.id} id={section.id}>
              <div className="mb-5 flex items-center gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                <span className="circled bg-[#F78E42]/35 shrink-0">
                  <section.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-6">
                {section.content.map((item, itemIndex) => (
                  <div key={itemIndex}>
                    <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                      {item.subtitle}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                      {item.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Quick Navigation */}
        <section className="mt-14">
          <div className="mb-5 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <p className="typewriter mb-2">Jump to</p>
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              Quick Navigation
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-3 border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
              >
                <section.icon
                  className="h-5 w-5 text-[#11100D] transition-colors group-hover:text-[#B56A2B]"
                  aria-hidden
                />
                <span className="text-sm font-bold text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                  {section.title}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Annexes */}
        <section className="mt-14 space-y-10">
          {/* US Residents Annex */}
          <div className="torn torn-tb border-2 border-[#11100D] bg-[#F0E5CC]">
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {annexes.usResidents.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
              {annexes.usResidents.intro}
            </p>
            <div className="mt-5 space-y-6">
              {annexes.usResidents.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Surf Sessions Annex */}
          <div className="torn torn-tb border-2 border-[#11100D] bg-[#F0E5CC]">
            <h2 className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl">
              {annexes.surfSessions.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
              {annexes.surfSessions.intro}
            </p>
            <div className="mt-5 space-y-6">
              {annexes.surfSessions.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#11100D]/72 sm:text-base">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-14 border-t-2 border-dashed border-[#11100D]/35 pt-10">
          <p className="label-black mb-5">Get in touch</p>
          <h2 className="font-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
            {contact.title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
            {contact.description}
          </p>

          <div className="mt-6 space-y-2 text-sm leading-relaxed text-[#11100D]/74 sm:text-base">
            {contact.methods.map((method, index) => (
              <p key={index}>
                <strong className="text-[#11100D]">{method.type}:</strong>{" "}
                {method.value}
              </p>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="mailto:privacy@quiversurf.com"
              className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5"
            >
              <Mail className="mr-2 h-5 w-5" aria-hidden />
              Contact Privacy Team
            </Link>
          </div>
        </section>
      </main>
    </ZineSurface>
  );
}
