export function ProfileTabLoadingSkeleton({ type }: { type: string }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#11100D] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/70">
            Loading {type}...
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 border-2 border-[#11100D]/25 bg-[#FBF6E8]"
          ></div>
        ))}
      </div>
    </div>
  );
}
