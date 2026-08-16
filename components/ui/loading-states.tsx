"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingSpinner,
  CenteredLoadingSpinner,
  InlineLoadingSpinner,
} from "@/components/ui/loading-spinner";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export { LoadingSpinner, CenteredLoadingSpinner, InlineLoadingSpinner };
export { CardSkeleton };

// Common loading patterns
export function FullPageLoader({ text = "Checking the lineup..." }: { text?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function AuthLoader({
  text = "Paddling out...",
}: {
  text?: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner className="mx-auto" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function InlineLoader({ text }: { text?: string }) {
  return <LoadingSpinner size="sm" text={text} />;
}

// Generic list item skeleton with consistent styling
export function ListItemSkeleton({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
    </div>
  );
}

// Form skeleton for loading forms
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array(fields)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      <div className="flex justify-end space-x-2 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// Higher-order component for loading states
interface WithLoadingProps {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

export function WithLoading({
  loading,
  error,
  children,
  loadingComponent,
  errorComponent,
}: WithLoadingProps) {
  if (loading) {
    return loadingComponent || <CenteredLoadingSpinner />;
  }

  if (error) {
    return (
      errorComponent || (
        <div className="text-center py-8">
          <p className="text-destructive">{error}</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}

// Conditional loading wrapper
export function ConditionalLoader({
  condition,
  children,
  fallback = <CenteredLoadingSpinner />,
}: {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return condition ? <>{children}</> : fallback;
}
