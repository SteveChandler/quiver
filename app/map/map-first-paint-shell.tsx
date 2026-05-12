"use client";

import Link from "next/link";

const FEATURED_SPOTS = [
  {
    name: "Mission Beach",
    location: "San Diego, CA",
    href: "/map?search=Mission%20Beach",
    detail: "Beach break with easy access and a steady local crowd.",
  },
  {
    name: "Ocean Beach",
    location: "San Diego, CA",
    href: "/map?search=Ocean%20Beach",
    detail: "Pier-area peaks, bigger tide swings, and quick condition checks.",
  },
  {
    name: "Tourmaline",
    location: "San Diego, CA",
    href: "/map?search=Tourmaline",
    detail: "Longboard-friendly rollers and a mellow discovery starting point.",
  },
] as const;

export function MapFirstPaintShell() {
  return (
    <section
      className="flex-1 overflow-y-auto bg-[#0B1220] text-white"
      data-testid="map-first-paint-shell"
      aria-label="Surf spots map preview"
    >
      <div className="mx-auto grid min-h-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_360px] md:px-6 md:py-8">
        <div className="flex min-h-[420px] flex-col justify-between rounded-lg border border-white/10 bg-[#111827] p-5 shadow-2xl md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F78E42]">
              Quiver surf discovery
            </p>
            <p className="mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
              Interactive surf spots map
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#B8C7E0] md:text-base">
              Explore nearby breaks, filter by wave type and skill level, and
              open live forecasts once the map finishes loading.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Beginner-friendly", "Point breaks", "Beach breaks"].map(
              (label) => (
                <div
                  key={label}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-[#D6E2F3]"
                >
                  {label}
                </div>
              ),
            )}
          </div>

          <div className="mt-8 rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4">
            <div className="h-48 rounded bg-[linear-gradient(135deg,#17213a_0%,#0f766e_45%,#1d4ed8_100%)] opacity-80" />
            <p className="mt-3 text-xs text-[#B8C7E0]">
              Loading the live Mapbox layer after the page content paints.
            </p>
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-base font-semibold">Popular surf spots</h2>
          <p className="mt-1 text-xs text-[#B8C7E0]">
            Start with known breaks while the live map becomes interactive.
          </p>
          <div className="mt-4 space-y-2">
            {FEATURED_SPOTS.map((spot) => (
              <Link
                key={spot.name}
                href={spot.href}
                className="block rounded-md border border-white/10 bg-[#111827] p-3 transition-colors hover:border-[#F78E42]/60"
              >
                <span className="block text-sm font-semibold text-white">
                  {spot.name}
                </span>
                <span className="mt-1 block text-xs text-[#F78E42]">
                  {spot.location}
                </span>
                <span className="mt-2 block text-xs leading-5 text-[#B8C7E0]">
                  {spot.detail}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
