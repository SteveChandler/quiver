export function HeroMatchCardSkeleton() {
  return (
    <div className="relative w-full max-w-sm bg-[#1E2558]/80 backdrop-blur-md border-hud rounded-xl p-5 overflow-hidden">
      <div className="animate-pulse space-y-3">
        <div className="h-3 bg-white/10 rounded w-24" />
        <div className="h-4 bg-white/15 rounded w-40" />
        <div className="flex items-center justify-between mt-4">
          <div className="space-y-2 flex-1 mr-4">
            <div className="h-3 bg-white/10 rounded w-32" />
            <div className="h-3 bg-white/10 rounded w-28" />
          </div>
          <div className="h-24 w-24 rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-20 rounded-full bg-white/10" />
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="h-6 w-18 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}
