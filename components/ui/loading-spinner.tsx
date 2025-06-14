"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
