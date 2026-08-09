import { Skeleton } from "@/components/ui/skeleton";

export function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 py-4">
      <Skeleton className="h-6 w-48" />

      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      <div className="space-y-3 mt-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
