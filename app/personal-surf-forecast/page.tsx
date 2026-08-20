import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ClipboardCheck,
  CloudSun,
  Compass,
  Layers3,
  LockKeyhole,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from "lucide-react";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 86400;

const PAGE_PATH = "/personal-surf-forecast";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const PAGE_TITLE = "Personal Surf Forecast App | Quiver";
const PAGE_DESCRIPTION =
  "See how Quiver uses rated surf sessions to match forecast conditions to you, rank windows, explain personal fit, and keep wave forecasts separate.";

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
  keywords: [
    "personal surf forecast app",
    "personal surf forecast",
    "personal surf forecaster",
    "surf forecast for me",
    "surf session recommendations",
    "surf condition match",
  ],
});

interface DecisionItem {
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
}

interface CapabilityItem {
  capability: string;
  details: string;
  access: string;
}

interface MechanismItem {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const DECISION_ITEMS: DecisionItem[] = [
  {
    label: "Use the free forecast",
    title: "You need the physical conditions",
    description:
      "Check forecasts, conditions, and tides for 280+ breaks. Free access also includes one watched beach with up to three alert rules.",
    icon: <CloudSun className="h-5 w-5" aria-hidden />,
  },
  {
    label: "Log rated sessions",
    title: "You want to build useful history",
    description:
      "A free account can capture and rate sessions. Five eligible rated sessions are required before Quiver presents a learned profile instead of a starter read.",
    icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
  },
  {
    label: "Add Quiver Pro",
    title: "You want conditions ranked for you",
    description:
      "Personal match, reasons, ranked windows, personal alerts, best-spot decisions, and board-aware picks require Quiver Pro or an active trial.",
    icon: <Sparkles className="h-5 w-5" aria-hidden />,
  },
];

const CAPABILITY_ITEMS: CapabilityItem[] = [
  {
    capability: "Physical forecast",
    details:
      "Forecast conditions and tides remain their own system; personal fit does not rewrite the predicted waves",
    access: "Free",
  },
  {
    capability: "Break coverage",
    details: "Forecasts, conditions, and tides for 280+ breaks",
    access: "Free",
  },
  {
    capability: "Session history",
    details: "Log and rate surf sessions with a signed-in account",
    access: "Free account",
  },
  {
    capability: "Basic alerts",
    details: "One watched beach with up to three alert rules",
    access: "Free account",
  },
  {
    capability: "Learned condition ranges",
    details:
      "After at least five eligible rated sessions, history and condition snapshots can form learned ranges for wave height and period, wind speed and direction, and tide",
    access: "Pro or trial",
  },
  {
    capability: "Personal decision layer",
    details:
      "Personal match, fit reasons, ranked windows, personal alerts, best-spot decisions, and board-aware picks",
    access: "Quiver Pro",
  },
];

const MECHANISM_ITEMS: MechanismItem[] = [
  {
    step: "01",
    title: "Keep the forecast intact",
    description:
      "Quiver keeps the physical condition forecast separate from personal fit. Personalization never rewrites wave height, period, wind, or tide predictions.",
    icon: <Layers3 className="h-5 w-5" aria-hidden />,
  },
  {
    step: "02",
    title: "Rate eligible sessions",
    description:
      "Rated session history is paired with its forecast condition snapshots. The learning inputs are wave height and period, wind speed and direction, and tide.",
    icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
  },
  {
    step: "03",
    title: "Cross the learning threshold",
    description:
      "Below five eligible rated sessions, Quiver gives an explicit starter read. At five or more qualifying sessions, it can use learned condition ranges.",
    icon: <BrainCircuit className="h-5 w-5" aria-hidden />,
  },
  {
    step: "04",
    title: "Rank fit for Pro",
    description:
      "For active Pro or trial users, the similarity layer scores candidate beaches and windows, then attaches personal fit, reasons, and window ranking.",
    icon: <Compass className="h-5 w-5" aria-hidden />,
  },
];

const FAQ_ITEMS = [
  {
    question: "What is a personal surf forecast app?",
    answer:
      "A personal surf forecast app helps you interpret general conditions in the context of the surf you prefer. In Quiver, the physical forecast stays separate while the Pro personal-fit layer ranks how well candidate beaches and windows match your learned condition ranges.",
  },
  {
    question: "Does Quiver change the wave forecast for each surfer?",
    answer:
      "No. Quiver does not rewrite the physical wave forecast for an individual surfer. Personalization changes fit and ranking: it scores how well forecast conditions match you while leaving the underlying forecast intact.",
  },
  {
    question: "How many sessions does Quiver need to learn my preferences?",
    answer:
      "Quiver requires at least five eligible rated sessions before it presents a learned profile. Below that threshold, it labels the result as a starter read instead of implying that your history has produced a learned match.",
  },
  {
    question: "What conditions does the personal-fit layer use?",
    answer:
      "Rated sessions and their forecast snapshots produce learned ranges for wave height and period, wind speed and direction, and tide. Those ranges are used to assess fit, not to alter the condition forecast.",
  },
  {
    question: "Does personal match require Quiver Pro?",
    answer:
      "Yes. Personal match requires Quiver Pro or an active trial. Pro also adds fit reasons, ranked session windows, personal alerts, best-spot decisions, and board-aware picks. Free users keep the full underlying forecast.",
  },
  {
    question: "Can I log sessions without Quiver Pro?",
    answer:
      "Yes. Session logging is available with a free signed-in account. The session log captures and helps you review what happened; the Pro personal forecast layer uses eligible rated history to help rank future conditions.",
  },
];

function AccessBadge({ access }: { access: string }): ReactElement {
  const isPro = access === "Quiver Pro" || access === "Pro or trial";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border-2 border-[#11100D] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] shadow-[2px_2px_0_rgba(17,16,13,0.18)] ${
        isPro
          ? "bg-[#252D6B] text-[#F4EBD8]"
          : "bg-[#F78E42] text-[#11100D]"
      }`}
    >
      {isPro ? (
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Check className="h-3.5 w-3.5" aria-hidden />
      )}
      {access}
    </span>
  );
}

export default function PersonalSurfForecastPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Personal surf forecast", url: PAGE_URL },
        ]}
      />
      <WebPageSchema
        name={PAGE_TITLE}
        url={PAGE_URL}
        description={PAGE_DESCRIPTION}
      />
      <FAQSchema items={FAQ_ITEMS} />

      <ZineSurface
        sectionLabel="Personal forecast"
        editionLabel="Condition match"
        data-testid="personal-surf-forecast-zine-surface"
      >
        <main className="overflow-hidden text-[#11100D]">
          <section className="relative px-4 pb-10 pt-8 md:pb-16 md:pt-16">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.2]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.22) 1px, transparent 0), linear-gradient(90deg, rgba(37,45,107,0.1) 1px, transparent 1px)",
                backgroundSize: "12px 12px, 76px 76px",
              }}
            />
            <div
              aria-hidden
              className="absolute right-0 top-10 hidden h-[82%] w-[42%] border-y-2 border-l-2 border-[#11100D] bg-[#252D6B] lg:block"
              style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)" }}
            />

            <div className="relative mx-auto grid max-w-7xl gap-9 lg:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.96fr)] lg:items-center">
              <div>
                <span className="inline-block -rotate-1 rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-heading text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.28)]">
                  Your condition-fit field guide
                </span>
                <p className="mb-3 mt-7 font-mono text-xs font-black uppercase tracking-[0.24em] text-[#9E5010]">
                  Personalization &amp; session fit
                </p>
                <h1 className="max-w-4xl font-heading text-4xl font-black leading-[0.92] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl">
                  Personal Surf Forecast App
                </h1>
                <p className="mt-5 max-w-2xl text-base font-black leading-7 text-[#252D6B] md:text-xl md:leading-8">
                  Find the forecast windows that fit you. Quiver keeps the wave
                  forecast intact, then uses eligible rated session history to
                  help Pro surfers understand fit, reasons, and which beaches
                  and windows rise to the top.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.3)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
                  >
                    Create a free account
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/forecast"
                    className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] shadow-[5px_5px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
                  >
                    Browse forecasts
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#252D6B]">
                  <Link className="underline-offset-4 hover:text-[#9E5010] hover:underline" href="/surf-session-log">
                    See how session logging works
                  </Link>
                  <Link className="underline-offset-4 hover:text-[#9E5010] hover:underline" href="/features">
                    Explore Quiver features
                  </Link>
                  <Link className="underline-offset-4 hover:text-[#9E5010] hover:underline" href="/best-surf-forecast-app">
                    Compare surf apps
                  </Link>
                </div>
              </div>

              <div className="relative min-h-[390px] sm:min-h-[470px]">
                <QuiverSticker
                  sticker="orangeTape"
                  className="absolute right-8 top-0 z-10 hidden w-32 rotate-6 opacity-90 sm:block"
                />
                <div className="absolute left-2 top-10 w-[88%] -rotate-2 border-2 border-[#11100D] bg-[#F8EFD8] p-4 shadow-[10px_10px_0_rgba(17,16,13,0.3)] sm:left-8 sm:p-6">
                  <div className="flex items-center justify-between border-b-2 border-[#11100D] pb-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#252D6B]">
                    <span>Personal fit</span>
                    <span>Pro</span>
                  </div>
                  <p className="mt-5 font-heading text-3xl font-black uppercase leading-none sm:text-4xl">
                    Morning window
                  </p>
                  <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-[#9E5010]">
                    Forecast unchanged · fit attached
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {[
                      ["Wave", "Range checked"],
                      ["Period", "Range checked"],
                      ["Wind", "Fit explained"],
                      ["Tide", "Fit explained"],
                    ].map(([label, value]) => (
                      <div key={label} className="border-2 border-[#11100D]/35 bg-[#F4EBD8] p-2.5">
                        <p className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#9E5010]">
                          {label}
                        </p>
                        <p className="mt-1 font-heading text-sm font-black text-[#11100D]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t-2 border-[#11100D] pt-4">
                    <p className="font-heading text-lg font-black text-[#252D6B]">
                      History ranks the fit. It does not change the waves.
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#252D6B]">
                      Learned after five eligible rated sessions; starter read
                      before then.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-8 md:py-10">
            <div className="mx-auto max-w-7xl">
              <div className="relative -rotate-[0.5deg] border-2 border-[#11100D] bg-[#11100D] p-6 text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.25)] md:p-8">
                <QuiverSticker
                  sticker="halftoneCircle"
                  className="absolute -right-5 -top-7 hidden w-20 rotate-[8deg] opacity-90 md:block"
                />
                <span className="absolute -top-4 left-7 rotate-[-2deg] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D]">
                  quick take
                </span>
                <p className="font-heading text-2xl font-black leading-tight md:text-4xl">
                  A personal surf forecast app should tell you how forecast
                  conditions fit your preferences without pretending the wave
                  prediction itself has changed. Quiver keeps forecasts free;
                  personal match requires Quiver Pro or an active trial.
                </p>
              </div>
            </div>
          </section>

          <section className="px-4 py-10 md:py-14">
            <div className="mx-auto max-w-7xl">
              <p className="inline-flex border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
                choose by job
              </p>
              <h2 className="mt-3 max-w-4xl font-heading text-4xl font-black leading-none text-[#11100D] md:text-6xl">
                What do you need before the next paddle-out?
              </h2>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {DECISION_ITEMS.map((item, index) => (
                  <article
                    key={item.title}
                    className={`border-2 border-[#11100D] p-5 shadow-[6px_6px_0_rgba(17,16,13,0.2)] ${
                      index === 2
                        ? "bg-[#252D6B] text-[#F4EBD8]"
                        : "bg-[#F8EFD8] text-[#11100D]"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#F78E42]">
                      {item.icon}
                      {item.label}
                    </div>
                    <h3 className="mt-5 font-heading text-2xl font-black leading-tight">
                      {item.title}
                    </h3>
                    <p className={`mt-3 text-sm font-semibold leading-6 ${index === 2 ? "text-[#F4EBD8]/85" : "text-[#252D6B]"}`}>
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-10 md:py-14">
            <div className="relative mx-auto max-w-7xl rotate-[0.2deg] border-2 border-[#11100D] bg-[#F8EFD8] p-4 shadow-[9px_9px_0_rgba(17,16,13,0.22)] md:p-6">
              <QuiverSticker
                sticker="spotSwellMatch"
                className="absolute -right-4 -top-7 hidden w-20 rotate-6 drop-shadow-md md:block"
              />
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                capability check
              </p>
              <h2 className="mt-2 font-heading text-4xl font-black leading-none text-[#11100D] md:text-5xl">
                Forecast first. Personal fit on top.
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#252D6B]">
                Free forecast access and Pro personalization are separate, so
                you can see exactly what each layer provides.
              </p>

              <div className="mt-7 hidden overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                      <th scope="col" className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em]">
                        Capability
                      </th>
                      <th scope="col" className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em]">
                        What it does
                      </th>
                      <th scope="col" className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em] text-[#F78E42]">
                        Access
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAPABILITY_ITEMS.map((item, index) => (
                      <tr
                        key={item.capability}
                        className={`border-b-2 border-[#11100D] ${index % 2 === 0 ? "bg-[#F4EBD8]" : "bg-[#EFE0C2]"}`}
                      >
                        <th scope="row" className="px-5 py-4 text-left font-heading text-base font-black text-[#11100D]">
                          {item.capability}
                        </th>
                        <td className="px-5 py-4 font-semibold leading-6 text-[#252D6B]">
                          {item.details}
                        </td>
                        <td className="px-5 py-4">
                          <AccessBadge access={item.access} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-3 md:hidden">
                {CAPABILITY_ITEMS.map((item) => (
                  <article
                    key={item.capability}
                    className="border-2 border-[#11100D] bg-[#F4EBD8] p-4 shadow-[4px_4px_0_rgba(17,16,13,0.16)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-heading text-lg font-black text-[#11100D]">
                        {item.capability}
                      </h3>
                      <AccessBadge access={item.access} />
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
                      {item.details}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-10 md:py-16">
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div className="relative border-2 border-[#11100D] bg-[#252D6B] p-6 text-[#F4EBD8] shadow-[9px_9px_0_rgba(17,16,13,0.26)] md:p-8">
                  <QuiverSticker
                    sticker="navyLightning"
                    className="absolute -right-5 -top-6 hidden w-16 rotate-[10deg] drop-shadow-md md:block"
                  />
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#F78E42]">
                    mechanism, not hype
                  </p>
                  <h2 className="mt-3 font-heading text-4xl font-black leading-none md:text-6xl">
                    How it actually works.
                  </h2>
                  <p className="mt-5 text-base font-semibold leading-7 text-[#F4EBD8]/85">
                    Session history teaches fit only after the threshold. It
                    does not recalibrate the physical forecast.
                  </p>
                  <div className="mt-6 border-2 border-[#F78E42] bg-[#11100D]/30 p-4">
                    <div className="flex items-center gap-2 font-heading font-black text-[#F78E42]">
                      <SlidersHorizontal className="h-5 w-5" aria-hidden />
                      What this is not
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#F4EBD8]/82">
                      Personal fit is not a claim that Quiver changes the
                      predicted wave for you. It is a separate ranking layer
                      built to explain whether those conditions match you.
                    </p>
                  </div>
                </div>

                <ol className="grid gap-4 sm:grid-cols-2">
                  {MECHANISM_ITEMS.map((item) => (
                    <li
                      key={item.step}
                      className="border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[6px_6px_0_rgba(17,16,13,0.18)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] font-mono text-xs font-black">
                          {item.step}
                        </span>
                        <span className="text-[#9E5010]">{item.icon}</span>
                      </div>
                      <h3 className="mt-5 font-heading text-2xl font-black leading-tight text-[#11100D]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[#252D6B]">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="px-4 py-10 md:py-14">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center gap-3">
                <Waves className="h-7 w-7 text-[#9E5010]" aria-hidden />
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                  common questions
                </p>
              </div>
              <h2 className="mt-3 font-heading text-4xl font-black leading-none text-[#11100D] md:text-6xl">
                Personal surf forecast FAQ.
              </h2>
              <div className="mt-7 grid gap-3">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.question}
                    className="group border-2 border-[#11100D] bg-[#F4EBD8] shadow-[5px_5px_0_rgba(17,16,13,0.18)]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-lg font-black text-[#11100D]">
                      {item.question}
                      <span className="shrink-0 text-[#9E5010] transition-transform group-open:rotate-180" aria-hidden>
                        ↓
                      </span>
                    </summary>
                    <p className="border-t-2 border-[#11100D] px-5 py-4 font-semibold leading-7 text-[#252D6B]">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 pb-16 pt-10 md:pb-20 md:pt-14">
            <div className="relative mx-auto max-w-7xl overflow-hidden border-2 border-[#11100D] bg-[#11100D] p-6 text-[#F4EBD8] shadow-[10px_10px_0_rgba(247,142,66,0.42)] md:p-10">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[24px] border-[#F78E42]/25" aria-hidden />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#F78E42]">
                    find your next fit
                  </p>
                  <h2 className="mt-3 max-w-3xl font-heading text-4xl font-black leading-none md:text-6xl">
                    Start with the forecast. Build from your sessions.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#F4EBD8]/85">
                    Check the free underlying forecast now, then log and rate
                    sessions to build the history used by Quiver Pro.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/auth/sign-up"
                      className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                    >
                      Create your account
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      href="/forecast"
                      className="inline-flex items-center justify-center rounded-sm border-2 border-[#F4EBD8] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#F4EBD8] transition-colors hover:bg-[#F4EBD8] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EBD8]"
                    >
                      Check surf forecasts
                    </Link>
                  </div>
                </div>

                <nav aria-label="Related Quiver pages" className="border-l-2 border-[#F78E42] pl-5">
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#F78E42]">
                    Keep reading
                  </p>
                  <div className="mt-4 grid gap-3">
                    {[
                      ["Learn how to log surf sessions", "/surf-session-log"],
                      ["Compare the best surf forecast apps", "/best-surf-forecast-app"],
                      ["Explore Quiver features", "/features"],
                      ["Browse free surf reports", "/free-surf-reports"],
                    ].map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-2 font-bold text-[#F4EBD8] underline-offset-4 hover:text-[#F78E42] hover:underline"
                      >
                        {label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ))}
                  </div>
                </nav>
              </div>

              <div className="relative mt-9 flex items-start gap-3 border-t-2 border-[#F4EBD8]/25 pt-5 text-sm font-semibold leading-6 text-[#F4EBD8]/75">
                <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-[#F78E42]" aria-hidden />
                <p>
                  Publisher disclosure: Quiver is our own app. This page is
                  published by Quiver and describes the product boundary
                  verified in its code: forecasts remain separate from the
                  Pro personal-fit layer.
                </p>
              </div>
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
