"use client";

import { useEmbedImpression } from "@/hooks/use-embed-impression";
import type { ConditionsData } from "@/types/conditions";
import { buildConditionsCards } from "@/lib/utils/conditions-card-builder";

interface EmbedTickerWidgetProps {
  beachName: string;
  beachUrl: string;
  slug: string;
  data: ConditionsData;
  theme: "light" | "dark";
}

// Inline SVG icons — kept minimal to avoid lucide-react dependency in embed context

function WaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </svg>
  );
}

function ThermometerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}

function TideIcon({ rising }: { rising: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {rising ? (
        <polyline points="18 15 12 9 6 15" />
      ) : (
        <polyline points="6 9 12 15 18 9" />
      )}
    </svg>
  );
}

function QuiverLogoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

// Embed-specific icon map keyed by ConditionsIconType
const EMBED_ICONS: Record<string, React.ReactNode> = {
  waves: <WaveIcon />,
  swell: <ArrowIcon />,
  wind: <WindIcon />,
  water: <ThermometerIcon />,
};

interface TickerCard {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}

/** Delegates to shared buildConditionsCards, then maps iconType → inline SVG icons */
function buildCards(data: ConditionsData): TickerCard[] {
  return buildConditionsCards(data).map((card) => ({
    id: card.id,
    label: card.label,
    value: card.value,
    icon:
      card.id === "tide"
        ? <TideIcon rising={card.tideRising ?? false} />
        : EMBED_ICONS[card.id],
  }));
}

interface CardItemProps {
  card: TickerCard;
  beachUrl: string;
  isDark: boolean;
}

function CardItem({ card, beachUrl, isDark }: CardItemProps) {
  return (
    <a
      href={beachUrl}
      target="_blank"
      rel="noopener" // noreferrer intentionally omitted to preserve Referer header for embed analytics
      className="flex items-center gap-1.5 px-4 shrink-0 h-full hover:opacity-80 transition-opacity"
    >
      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
        {card.icon}
      </span>
      <span
        className={`text-[10px] uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        {card.label}
      </span>
      <span className="text-sm font-semibold">{card.value}</span>
    </a>
  );
}

interface DividerProps {
  isDark: boolean;
}

function Divider({ isDark }: DividerProps) {
  return (
    <span
      className={`shrink-0 w-px h-5 self-center ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
      aria-hidden="true"
    />
  );
}

interface BrandingCardProps {
  beachUrl: string;
  isDark: boolean;
}

function BrandingCard({ beachUrl, isDark }: BrandingCardProps) {
  return (
    <a
      href={beachUrl}
      target="_blank"
      rel="noopener" // noreferrer intentionally omitted to preserve Referer header for embed analytics
      className="flex items-center gap-1 px-4 shrink-0 h-full hover:opacity-80 transition-opacity"
    >
      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
        <QuiverLogoIcon />
      </span>
      <span
        className={`text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        Powered by Quiver
      </span>
    </a>
  );
}

export function EmbedTickerWidget({
  beachName,
  beachUrl,
  slug,
  data,
  theme,
}: EmbedTickerWidgetProps) {
  useEmbedImpression("ticker", slug);

  const isDark = theme === "dark";
  const cards = buildCards(data);
  const hasCards = cards.length > 0;

  if (!hasCards) {
    return (
      <div
        className={`flex items-center justify-center h-[55px] w-full text-sm ${
          isDark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500"
        }`}
      >
        <span title={beachName}>No data available</span>
      </div>
    );
  }

  // Build interleaved list: card, divider, card, divider, ..., branding card
  // Rendered twice for seamless CSS scroll loop
  function renderTrack() {
    return (
      <>
        {cards.map((card, i) => (
          <span key={card.id} className="flex items-center h-full">
            <CardItem card={card} beachUrl={beachUrl} isDark={isDark} />
            {i < cards.length - 1 && <Divider isDark={isDark} />}
          </span>
        ))}
        <Divider isDark={isDark} />
        <BrandingCard beachUrl={beachUrl} isDark={isDark} />
        {/* trailing separator before the loop restarts */}
        <Divider isDark={isDark} />
      </>
    );
  }

  return (
    <>
      {/*
        Keyframe defined inline so the embed page has no external CSS dependency.
        The animation scrolls the inner track by -50% (the first copy) for a seamless loop.
      */}
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-animate {
          animation: ticker-scroll 30s linear infinite;
        }
        .ticker-group:hover .ticker-animate {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-animate {
            animation: none;
            display: none;
          }
          .ticker-static {
            display: flex;
            overflow-x: auto;
          }
        }
      `}</style>

      <div
        className={`ticker-group relative h-[55px] w-full overflow-hidden border-b ${
          isDark
            ? "bg-slate-900 text-white border-slate-700"
            : "bg-white text-slate-900 border-slate-200"
        }`}
        aria-label={`${beachName} surf conditions ticker`}
      >
        {/*
          Static fallback for prefers-reduced-motion — shown as a scrollable row.
          CSS hides this when motion is allowed and shows the animated version instead.
        */}
        <div
          className="ticker-static hidden items-center h-full w-full"
        >
          {cards.map((card, i) => (
            <span key={card.id} className="flex items-center h-full">
              <CardItem card={card} beachUrl={beachUrl} isDark={isDark} />
              {i < cards.length - 1 && <Divider isDark={isDark} />}
            </span>
          ))}
          <Divider isDark={isDark} />
          <BrandingCard beachUrl={beachUrl} isDark={isDark} />
        </div>

        {/*
          Animated track — hidden when prefers-reduced-motion is active (CSS above).
          Two identical copies rendered side-by-side so the loop is seamless:
          the track translates left by 50% (one copy width), then resets.
        */}
        <div
          className="ticker-animate flex items-center h-full w-max"
          aria-hidden="true"
        >
          {renderTrack()}
          {renderTrack()}
        </div>
      </div>
    </>
  );
}
