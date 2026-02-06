"use client";

import {
  Bell,
  CheckCheck,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";

/**
 * LocalIntelMock - Phone screen content showing the local intel feed view
 */
export function LocalIntelMock() {
  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]" data-testid="phone-mock-intel">
      {/* App bar with top safe-area spacing for Dynamic Island */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <span
          className="text-[15px] font-extrabold text-teal-600 tracking-tight"
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

      {/* Header Section with Add Button */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div>
          <div className="text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-ocean-blue" aria-hidden="true" />
            Local Intel
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-ocean-blue text-[10px] font-bold text-white">
              10
            </span>
          </div>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-ocean-blue px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm">
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add Intel
        </button>
      </div>

      {/* Intel Feed */}
      <div className="flex-1 overflow-hidden px-3 space-y-3">
        {/* Intel Post 1 - Lineup Check */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-[12px] font-bold text-white">M</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <span className="text-[9px] text-slate-400">about 22 hours ago</span>
                </div>
              </div>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                Lineup...
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                Checked the lineup during the afternoon window around...
              </p>
              <div className="flex items-center gap-1.5 mb-2.5">
                <MapPin className="h-3 w-3 text-rose-400" aria-hidden="true" />
                <span className="text-[10px] font-medium text-slate-700">La Jolla Shores</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 text-slate-500 hover:text-ocean-blue transition-colors">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[11px] font-medium">Confirm</span>
                </button>
                <button className="text-[11px] font-medium text-slate-500 hover:text-ocean-blue transition-colors">
                  Show more
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Intel Post 2 - Ingress/Egress */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 bg-slate-200">
              <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center">
                <span className="text-[12px] font-bold text-white">U</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[9px] text-slate-400">1 day ago</span>
              </div>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                Ingress/egress...
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                Dropped in via the main path for the afternoon slot around...
              </p>
              <div className="flex items-center gap-1.5 mb-2.5">
                <MapPin className="h-3 w-3 text-rose-400" aria-hidden="true" />
                <span className="text-[10px] font-medium text-slate-700">Crystal Pier</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 text-slate-500 hover:text-ocean-blue transition-colors">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[11px] font-medium">Confirm</span>
                </button>
                <button className="text-[11px] font-medium text-slate-500 hover:text-ocean-blue transition-colors">
                  Show more
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Intel Post 3 - Morning Check */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-[12px] font-bold text-white">M</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    <span className="text-[10px] font-semibold text-slate-700">8</span>
                  </div>
                  <span className="text-[9px] text-slate-400">1 day ago</span>
                </div>
              </div>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                Torrey Pines State...
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                Checked Torrey Pines State Beach during the morning...
              </p>
              <div className="flex items-center gap-1.5 mb-2.5">
                <MapPin className="h-3 w-3 text-rose-400" aria-hidden="true" />
                <span className="text-[10px] font-medium text-slate-700">Torrey Pines State Beach</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 text-slate-500 hover:text-ocean-blue transition-colors">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[11px] font-medium">Confirm</span>
                </button>
                <button className="text-[11px] font-medium text-slate-500 hover:text-ocean-blue transition-colors">
                  Show more
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-4 bg-white border-t border-slate-100">
        <button className="w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm flex items-center justify-center gap-2">
          <span>⭐</span>
          View all 10 intel posts
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

