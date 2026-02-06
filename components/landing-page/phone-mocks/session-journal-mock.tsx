"use client";

import {
  Bell,
  Calendar,
  List,
  MapPin,
  Menu,
  Search,
  TrendingUp,
} from "lucide-react";

/**
 * SessionJournalMock - Phone screen content showing the session journal/tracker view
 */
export function SessionJournalMock() {
  return (
    <div className="flex flex-col h-full bg-white" data-testid="phone-mock-journal">
      {/* App bar with top safe-area spacing for Dynamic Island */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-slate-100">
        <span
          className="text-[15px] font-extrabold text-teal-600 tracking-tight"
        >
          Quiver
        </span>
        <div className="flex items-center gap-3">
          <Search className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
          <Bell className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
          <Menu className="h-[18px] w-[18px] text-slate-400" aria-hidden="true" />
        </div>
      </div>

      {/* Header Section */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-[18px] font-bold text-slate-900 mb-1">
          Surf Journal+
        </div>
        <p className="text-[11px] text-slate-500">
          Track your sessions, analyze your progress, and share your stoke
        </p>
      </div>

      {/* Stats Grid */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Completed Sessions */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-3 ring-1 ring-blue-100/50">
            <p className="text-2xl font-extrabold text-blue-700 tracking-tight">52</p>
            <p className="text-[10px] font-semibold text-blue-600 mt-0.5">Completed Sessions</p>
          </div>
          {/* Planned Sessions */}
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-3 ring-1 ring-purple-100/50">
            <p className="text-2xl font-extrabold text-purple-700 tracking-tight">19</p>
            <p className="text-[10px] font-semibold text-purple-600 mt-0.5">Planned Sessions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          {/* Hours Surfed */}
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 ring-1 ring-emerald-100/50">
            <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">76</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Hours Surfed</p>
          </div>
          {/* Avg Rating */}
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 ring-1 ring-amber-100/50">
            <p className="text-2xl font-extrabold text-amber-700 tracking-tight">2.6</p>
            <p className="text-[10px] font-semibold text-amber-600 mt-0.5">Avg Rating</p>
          </div>
        </div>
      </div>

      {/* Favorite Beach */}
      <div className="mx-4 mb-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-3 ring-1 ring-slate-200/50">
        <p className="text-[18px] font-bold text-slate-900 mb-0.5">Ocean Beach</p>
        <p className="text-[10px] font-medium text-slate-500">Favorite Beach</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 px-4 border-b border-slate-100">
        <button className="pb-2.5 border-b-2 border-ocean-blue">
          <div className="flex items-center gap-1.5">
            <List className="h-3.5 w-3.5 text-ocean-blue" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-ocean-blue">Sessions</span>
          </div>
        </button>
        <button className="pb-2.5 border-b-2 border-transparent">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="text-[11px] font-medium text-slate-500">Insights</span>
          </div>
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm ring-1 ring-slate-200/50">
          <button className="px-2.5 py-1 bg-ocean-blue text-white rounded text-[10px] font-semibold">
            List
          </button>
          <button className="px-2.5 py-1 text-slate-500 rounded text-[10px] font-medium">
            Calendar
          </button>
        </div>
        <span className="text-[10px] font-semibold text-slate-600">52 sessions</span>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-hidden px-4 pt-2 space-y-2.5">
        {/* Session Card 1 */}
        <div className="bg-white rounded-xl p-3 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-[11px] font-bold text-white">SC</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-900">You</p>
                  <p className="text-[10px] text-slate-500">Rockview (Santa Cruz)</p>
                </div>
                <span className="text-[9px] text-slate-400">Jan 1, 2026</span>
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4].map((star) => (
                  <svg
                    key={star}
                    className="h-3 w-3 text-amber-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <svg className="h-3 w-3 text-slate-300 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 line-clamp-2">
                Chasing progress one session at a time! Pumped for the next one 🤙
              </p>
            </div>
          </div>
        </div>

        {/* Session Card 2 */}
        <div className="bg-white rounded-xl p-3 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 bg-slate-200">
              <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-900 flex items-center gap-1">
                    <span>Ingress/egress...</span>
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                    Crystal Pier
                  </p>
                </div>
                <span className="text-[9px] text-slate-400">1 day ago</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 line-clamp-2">
                Dropped in via the main path for the afternoon slot around...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

