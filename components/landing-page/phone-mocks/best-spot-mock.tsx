"use client";

import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Waves,
  Wind,
} from "lucide-react";

// Generate dynamic date for the phone mock
const getFormattedDate = () => {
  const today = new Date();
  return today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

/**
 * BestSpotMock - Phone screen content matching the "Your Best Spot Today" design
 */
export function BestSpotMock() {
  const formattedDate = getFormattedDate();

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]" data-testid="phone-mock-forecast">
      {/* App bar with top safe-area spacing for Dynamic Island */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <span
          className="text-[15px] font-extrabold text-teal-600 tracking-tight"
          data-testid="phone-mock-logo"
        >
          Quiver
        </span>
        <div className="flex items-center gap-3">
          <Search className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
          <Bell className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-white">SC</span>
          </div>
        </div>
      </div>

      {/* Main card - flex-1 to fill remaining screen height, justify-between to distribute content */}
      <div
        className="mx-3 mt-3 mb-8 flex-1 flex flex-col justify-between rounded-2xl bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 p-4"
        data-testid="best-spot-card"
      >
        {/* Card header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM4.343 4.343a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM14.536 14.536a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM2 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zM15 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.343 15.657a.75.75 0 010-1.06l1.061-1.061a.75.75 0 111.06 1.06l-1.06 1.061a.75.75 0 01-1.061 0zM14.536 5.464a.75.75 0 010-1.06l1.061-1.061a.75.75 0 111.06 1.06l-1.06 1.061a.75.75 0 01-1.061 0z" />
                <circle cx="10" cy="10" r="3" />
              </svg>
            </div>
            <span
              className="text-[13px] font-semibold text-slate-800"
              data-testid="best-spot-heading"
            >
              Your Best Spot Today
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-ocean-blue px-2.5 py-1 text-[10px] font-bold text-white shadow-sm"
            data-testid="match-badge"
          >
            <span className="text-[9px]">✦</span> 94% Match
          </span>
        </div>

        {/* Date */}
        <div className="mt-2.5 flex items-center gap-1.5 text-slate-500">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[11px] font-medium" data-testid="spot-date">
            {formattedDate}
          </span>
        </div>

        {/* Location row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin
              className="h-4 w-4 text-rose-400"
              aria-hidden="true"
            />
            <div>
              <p
                className="text-[13px] font-semibold text-slate-900"
                data-testid="spot-name"
              >
                Marine Street Beach
              </p>
              <p className="text-[10px] text-slate-500">La Jolla, California</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Details
          </button>
        </div>

        {/* Best Window section - stacked full-width tiles */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Best Window
            </span>
          </div>

          {/* Stacked full-width pastel tiles */}
          <div
            className="flex flex-col gap-2"
            data-testid="best-window-tiles"
          >
            {/* Time tile */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 px-3.5 py-2.5 ring-1 ring-sky-100/60">
              <div>
                <p className="text-[9px] font-semibold text-sky-600 uppercase tracking-wide">Time</p>
                <p className="text-[13px] font-bold text-sky-900">4:00 PM - 7:00 PM</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-sky-500" aria-hidden="true" />
              </div>
            </div>
            {/* Tide + Wind row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 px-3 py-2.5 ring-1 ring-teal-100/60">
                <div>
                  <p className="text-[9px] font-semibold text-teal-600 uppercase tracking-wide">Tide</p>
                  <p className="text-[12px] font-bold text-teal-900">Rising</p>
                </div>
                <Waves className="h-4 w-4 text-teal-400" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-2.5 ring-1 ring-violet-100/60">
                <div>
                  <p className="text-[9px] font-semibold text-violet-600 uppercase tracking-wide">Wind</p>
                  <p className="text-[12px] font-bold text-violet-900">5 mph NE</p>
                </div>
                <Wind className="h-4 w-4 text-violet-400" aria-hidden="true" />
              </div>
            </div>
            {/* Confidence tile */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 px-3.5 py-2.5 ring-1 ring-emerald-100/60">
              <div>
                <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">Confidence</p>
                <p className="text-[13px] font-bold text-emerald-900">88% High</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div
          className="mt-4 grid grid-cols-2 gap-2.5"
          data-testid="bottom-stats"
        >
          {/* Waves stat */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3.5 text-center ring-1 ring-blue-100/50">
            <p className="text-2xl font-extrabold text-blue-700 tracking-tight">3.3 <span className="text-sm font-semibold">ft</span></p>
            <p className="text-[10px] font-semibold text-blue-600 mt-0.5">Waves</p>
            <p className="text-[9px] text-blue-400 mt-0.5">18.2s · Live</p>
          </div>
          {/* Match stat */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 text-center ring-1 ring-emerald-100/50">
            <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              94<span className="text-sm font-semibold">%</span>
            </p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Match Score</p>
          </div>
        </div>

        {/* Footer text */}
        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
          <p
            className="text-[10px] text-slate-600 leading-relaxed"
            data-testid="spot-summary"
          >
            ✨ Perfect conditions for an evening session!
          </p>
        </div>
      </div>
    </div>
  );
}

