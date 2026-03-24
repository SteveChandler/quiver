"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Base loading spinner with consistent styling
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function LoadingSpinner({
  size = "md",
  className = "",
  text,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2
        className={cn(
          sizeClasses[size],
          "animate-spin text-primary",
          text && "mr-2"
        )}
      />
      {text && <span className="text-muted-foreground">{text}</span>}
    </div>
  );
}

// Common loading patterns
export function CenteredLoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex justify-center py-8">
      <LoadingSpinner text={text} />
    </div>
  );
}

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

// Card skeleton for consistent card loading states
export function CardSkeleton({
  count = 1,
  showImage = true,
  className = "",
}: {
  count?: number;
  showImage?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex space-x-4">
              {showImage && <Skeleton className="h-16 w-16 rounded-md" />}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
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
