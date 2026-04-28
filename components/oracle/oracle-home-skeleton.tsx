import { Skeleton } from "@/components/ui/skeleton";

/**
 * Oracle home loading skeleton.
 *
 * Shown to authenticated users while the Oracle home dynamic chunk loads
 * and while auth context resolves. Mirrors the Oracle home layout —
 * hero card, contextual CTA strip, today's windows row, nearby spots
 * row, activity feed — so content slots into the same layout when it
 * hydrates (no CLS).
 *
 * Pre-paint, the SSR popular-beaches section is hidden for signed-in
 * users via `html.has-auth-cookie .ssr-beach-section` (see globals.css
 * + app/layout.tsx pre-paint script), so this skeleton replaces the
 * legacy flash entirely.
 */
export function OracleHomeSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-screen-xl px-4 pt-6 pb-24 sm:px-6 lg:px-8"
      role="status"
      aria-busy="true"
      aria-label="Loading your home screen"
    >
      {/* Hero card */}
      <Skeleton className="mb-6 h-[280px] w-full rounded-2xl sm:h-[340px]" />

      {/* Contextual CTA */}
      <Skeleton className="mb-6 h-12 w-3/4 rounded-xl sm:w-1/2" />

      {/* Today's windows label + row */}
      <Skeleton className="mb-3 h-5 w-32 rounded-md" />
      <div className="mb-8 flex gap-3 overflow-hidden">
        <Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
        <Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
        <Skeleton className="h-24 w-40 shrink-0 rounded-xl" />
      </div>

      {/* Nearby spots label + grid */}
      <Skeleton className="mb-3 h-5 w-40 rounded-md" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
      </div>

      {/* Activity feed label + rows */}
      <Skeleton className="mb-3 h-5 w-36 rounded-md" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      <span className="sr-only">Loading your home screen…</span>
    </div>
  );
}
