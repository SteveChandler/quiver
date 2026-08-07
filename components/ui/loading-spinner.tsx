"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  label?: string;
}

export function LoadingSpinner({
  size = "md",
  className = "",
  text,
  label,
}: LoadingSpinnerProps) {
  if (label !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <svg
          className="h-6 w-6 animate-spin"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        {label && <p className="mt-3 text-sm">{label}</p>}
      </div>
    );
  }

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

// Convenience components for common patterns
export function CenteredLoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex justify-center py-8">
      <LoadingSpinner text={text} />
    </div>
  );
}

export function InlineLoadingSpinner({ text }: { text?: string }) {
  return <LoadingSpinner size="sm" text={text} />;
}
