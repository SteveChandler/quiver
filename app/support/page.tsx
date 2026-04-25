import type { Metadata } from "next";
import Link from "next/link";
import { Mail, HelpCircle, Bug } from "lucide-react";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with Quiver surf forecasts, session logging, and account management.",
  alternates: { canonical: "/support" },
};

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <section className="py-16 px-4 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-3">
            Support
          </h1>
          <p className="text-lg text-muted-foreground font-sans">
            Need help? We&apos;re here for you.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="py-10 px-4 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-5 w-5 text-ocean-blue shrink-0" />
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Contact Us
            </h2>
          </div>
          <p className="text-muted-foreground font-sans mb-3">
            Email us and we&apos;ll get back to you within one business day.
          </p>
          <a
            href="mailto:support@quiversurf.app"
            className="inline-flex items-center gap-2 text-ocean-blue font-sans font-medium hover:underline"
          >
            support@quiversurf.app
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 px-4 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <p className="mb-6 text-sm text-slate-400">
            Have a feature request? Drop it on the{" "}
            <Link href="/roadmap" className="text-orange-400 hover:underline">
              roadmap
            </Link>{" "}
            — we reply to every submission.
          </p>
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="h-5 w-5 text-ocean-blue shrink-0" />
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Frequently Asked Questions
            </h2>
          </div>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <dt className="font-heading font-semibold text-foreground mb-1">
                  {item.question}
                </dt>
                <dd className="text-muted-foreground font-sans leading-relaxed">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Bug Report */}
      <section className="py-10 px-4 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Bug className="h-5 w-5 text-ocean-blue shrink-0" />
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Report a Bug
            </h2>
          </div>
          <p className="text-muted-foreground font-sans mb-3">
            Found something broken? Email{" "}
            <a
              href="mailto:support@quiversurf.app"
              className="text-ocean-blue hover:underline"
            >
              support@quiversurf.app
            </a>{" "}
            with:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground font-sans">
            <li>Your device and OS version</li>
            <li>Steps to reproduce the issue</li>
            <li>Screenshots or a screen recording if possible</li>
          </ul>
        </div>
      </section>

      {/* Links */}
      <section className="py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground font-sans">
            <Link href="/privacy" className="text-ocean-blue hover:underline">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/terms" className="text-ocean-blue hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
