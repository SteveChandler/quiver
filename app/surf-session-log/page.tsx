import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  Clock3,
  CloudSun,
  LockKeyhole,
  NotebookPen,
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

const PAGE_PATH = "/surf-session-log";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const PAGE_TITLE = "Best App for Surf Session Logging | Quiver";
const PAGE_DESCRIPTION =
  "Find the best app for surf session logging. Quiver tracks sessions, conditions, boards, photos, journal stats, and optional forecast snapshots.";

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
  keywords: [
    "best app for surf session logging",
    "surf session log",
    "surf journal app",
    "surf session tracker",
    "surfing journal",
    "track surf sessions",
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
    label: "Use Quiver free",
    title: "You want a detailed surf journal",
    description:
      "Sign in, record the session and its conditions, attach a board or photos, and choose public or private visibility.",
    icon: <NotebookPen className="h-5 w-5" aria-hidden />,
  },
  {
    label: "Use the journal",
    title: "You want your history in one place",
    description:
      "Review sessions newest first, then scan totals, time surfed, average rating, favorite beach, board-use frequency, and monthly summaries.",
    icon: <BookOpen className="h-5 w-5" aria-hidden />,
  },
  {
    label: "Add Quiver Pro",
    title: "You want help choosing the next session",
    description:
      "Personal match scores, ranked session windows, personal alerts, best-spot decisions, and board-aware picks require Pro or a trial.",
    icon: <Sparkles className="h-5 w-5" aria-hidden />,
  },
];

const CAPABILITY_ITEMS: CapabilityItem[] = [
  {
    capability: "Session basics",
    details: "Spot, date and time, duration, notes, goals, and skill ratings",
    access: "Free account",
  },
  {
    capability: "Conditions recorded",
    details:
      "Wave quality, water temperature, crowd, parking, observed wave height, wind, tide, wave characteristics, and rip-current data",
    access: "Free account",
  },
  {
    capability: "Board and photos",
    details: "Attach a board to the session and add session photos",
    access: "Free account",
  },
  {
    capability: "Ratings and visibility",
    details: "Overall rating plus public or private session visibility",
    access: "Free account",
  },
  {
    capability: "Chronological journal",
    details:
      "Newest-first session history with related beach, board, and photo information",
    access: "Free account",
  },
  {
    capability: "Journal summaries",
    details:
      "Session totals, time surfed, average rating, favorite beach, board-use frequency, and monthly session, rating, and hour summaries",
    access: "Free account",
  },
  {
    capability: "Personal surf decisions",
    details:
      "Personal match score, ranked windows, personal alerts, best-spot decisions, and board-aware picks",
    access: "Quiver Pro",
  },
];

const MECHANISM_ITEMS: MechanismItem[] = [
  {
    step: "01",
    title: "Log after you surf",
    description:
      "Session creation requires a signed-in account. Save the details you care about, from duration and board to conditions, notes, ratings, and photos.",
    icon: <NotebookPen className="h-5 w-5" aria-hidden />,
  },
  {
    step: "02",
    title: "Build a chronological record",
    description:
      "Your journal brings sessions together newest first and keeps beach, board, and photo relationships attached to each entry.",
    icon: <Clock3 className="h-5 w-5" aria-hidden />,
  },
  {
    step: "03",
    title: "Read useful summaries",
    description:
      "See session totals, time surfed, average rating, favorite beach, board-use frequency, and month-by-month session, rating, and hour summaries.",
    icon: <BarChart3 className="h-5 w-5" aria-hidden />,
  },
  {
    step: "04",
    title: "Feed the preference loop",
    description:
      "Saving a session feeds Quiver's preference-learning pipeline. The personalized decision tools that use those signals are Quiver Pro features.",
    icon: <Sparkles className="h-5 w-5" aria-hidden />,
  },
];

const FAQ_ITEMS = [
  {
    question: "What is the best app for surf session logging?",
    answer:
      "Quiver is our pick for surfers who want a detailed session journal connected to forecasts. A free account can log sessions, conditions, boards, notes, ratings, visibility, and photos, while Quiver Pro adds personalized decision tools for future sessions.",
  },
  {
    question: "Is surf session logging free in Quiver?",
    answer:
      "Yes. Session logging is available with a free signed-in account. Forecasts, conditions, and tides for 280+ breaks are also free, along with one watched beach and up to three alert rules. Personal match scores, ranked session windows, personal alerts, best-spot decisions, and board-aware picks are Quiver Pro features.",
  },
  {
    question: "What can I record in a surf session log?",
    answer:
      "You can record the spot, date and time, duration, board, notes, ratings, wave quality, water temperature, crowd, parking, observed wave height, wind, tide, wave characteristics, rip-current data, goals, skill ratings, visibility, and photos.",
  },
  {
    question: "What stats does the surf journal show?",
    answer:
      "The journal can summarize session totals, time surfed, average rating, favorite beach, board-use frequency, and monthly session, rating, and hour totals. Board-use frequency shows which boards you logged most often; it is not a board-performance report.",
  },
  {
    question: "Does Quiver compare a session with the forecast?",
    answer:
      "When a forecast snapshot exists for a session, Quiver can show the stored forecast beside your reported conditions. That is a personal forecast-versus-report comparison, not an independent forecast benchmark.",
  },
  {
    question: "Can I keep a surf session private?",
    answer:
      "Yes. Session logs support public or private visibility, so you can choose what is shared when you save the entry.",
  },
];

function AccessBadge({ access }: { access: string }): ReactElement {
  const isPro = access === "Quiver Pro";

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

export default function SurfSessionLogPage(): ReactElement {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Surf session log", url: PAGE_URL },
        ]}
      />
      <WebPageSchema
        name={PAGE_TITLE}
        url={PAGE_URL}
        description={PAGE_DESCRIPTION}
      />
      <FAQSchema items={FAQ_ITEMS} />

      <ZineSurface
        sectionLabel="Session journal"
        editionLabel="Surf session log"
        data-testid="surf-session-log-zine-surface"
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
                  Surf journal field guide
                </span>
                <p className="mb-3 mt-7 font-mono text-xs font-black uppercase tracking-[0.24em] text-[#9E5010]">
                  Surf journal &amp; session tracking
                </p>
                <h1 className="max-w-4xl font-heading text-4xl font-black leading-[0.92] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl">
                  Best App for Surf Session Logging
                </h1>
                <p className="mt-5 max-w-2xl text-base font-black leading-7 text-[#252D6B] md:text-xl md:leading-8">
                  Log the surf you actually had. Quiver turns spot, board,
                  conditions, ratings, notes, and photos into a chronological
                  surf journal you can use after every paddle-out.
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
                  <Link className="underline-offset-4 hover:text-[#9E5010] hover:underline" href="/sessions">
                    Open the session journal
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
                    <span>Session 042</span>
                    <span>Private</span>
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-heading text-3xl font-black uppercase leading-none sm:text-4xl">
                        Dawn patrol
                      </p>
                      <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-[#9E5010]">
                        Beach · board · 1h 35m
                      </p>
                    </div>
                    <div className="flex h-16 w-16 shrink-0 -rotate-6 items-center justify-center rounded-full border-4 border-[#11100D] bg-[#F78E42] font-heading text-2xl font-black shadow-[3px_3px_0_rgba(17,16,13,0.22)]">
                      4/5
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["Tide", "Recorded"],
                      ["Wind", "Recorded"],
                      ["Crowd", "Rated"],
                      ["Board", "Attached"],
                      ["Notes", "Saved"],
                      ["Photos", "Added"],
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
                  <p className="mt-5 border-t-2 border-[#11100D] pt-4 text-sm font-semibold leading-6 text-[#252D6B]">
                    Keep the memory, the conditions, and the context together.
                  </p>
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
                  Quiver is a strong fit when you want a detailed surf session
                  log, a chronological journal, and useful summaries in the
                  same app as your forecasts. Logging requires a free account;
                  personalized surf decisions require Quiver Pro.
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
                What do you want the log to do?
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
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#9E5010]">
                  capability check
                </p>
                <h2 className="mt-2 font-heading text-4xl font-black leading-none text-[#11100D] md:text-5xl">
                  What Quiver can log and show.
                </h2>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#252D6B]">
                  The free-account and Pro boundary is shown directly so the
                  journal and personalization features do not blur together.
                </p>
              </div>

              <div className="mt-7 hidden overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#11100D] bg-[#11100D] text-[#F4EBD8]">
                      <th scope="col" className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em]">
                        Capability
                      </th>
                      <th scope="col" className="px-5 py-4 text-left font-heading font-black uppercase tracking-[0.08em]">
                        What it includes
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
                    The useful part is the loop: save the session, keep its
                    context, review the journal, and let the saved entry feed
                    preference learning.
                  </p>
                  <div className="mt-6 border-2 border-[#F78E42] bg-[#11100D]/30 p-4">
                    <div className="flex items-center gap-2 font-heading font-black text-[#F78E42]">
                      <CloudSun className="h-5 w-5" aria-hidden />
                      Forecast snapshot caveat
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#F4EBD8]/82">
                      A forecast-versus-report view appears only when a stored
                      snapshot exists. It compares that forecast with your own
                      report; it is not an independent benchmark.
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
                Surf session logging FAQ.
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
                    remember the session
                  </p>
                  <h2 className="mt-3 max-w-3xl font-heading text-4xl font-black leading-none md:text-6xl">
                    Start your next journal entry.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#F4EBD8]/85">
                    Create an account to log sessions, or check the forecast
                    before you paddle out.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/auth/sign-up"
                      className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#F78E42] bg-[#F78E42] px-5 py-3 font-heading text-sm font-black uppercase tracking-[0.08em] text-[#11100D] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
                    >
                      Sign up to log a session
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
                      ["See your session journal", "/sessions"],
                      ["See how Quiver personalizes future surf calls", "/personal-surf-forecast"],
                      ["Compare the best surf forecast apps", "/best-surf-forecast-app"],
                      ["Read how forecast checks work", "/forecast-accuracy"],
                      ["Explore free surf reports", "/free-surf-reports"],
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
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[#F78E42]" aria-hidden />
                <p>
                  Publisher disclosure: Quiver is our own app. This page is
                  published by Quiver and describes capabilities verified in
                  the product code, including the boundary between free session
                  logging and Quiver Pro personalization.
                </p>
              </div>
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
