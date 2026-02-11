"use client";

import * as React from "react";
import { Info } from "lucide-react";

interface AuthBlockingOverlayProps {
  /** Callback to reopen the auth modal */
  onInteraction: () => void;
  /** Optional message to display to users */
  message?: string;
  /** Show a subtle hint message (default: true) */
  showHint?: boolean;
}

/**
 * Full-page blocking overlay that captures ALL user interactions
 * and immediately triggers the auth modal to reappear.
 *
 * This component prevents ANY interaction with the page until
 * the user authenticates.
 */
export function AuthBlockingOverlay({
  onInteraction,
  message = "Please sign up to continue",
  showHint = true,
}: AuthBlockingOverlayProps) {
  const handleInteraction = React.useCallback(
    (e: React.SyntheticEvent) => {
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();

      // Immediately trigger callback to reopen modal
      onInteraction();
    },
    [onInteraction]
  );

  // Prevent scrolling when overlay is mounted
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <>
      {/* Full-page blocking overlay */}
      <div
        className="fixed inset-0 z-auth-wall bg-background/60 backdrop-blur-md animate-in fade-in duration-200"
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
        onMouseMove={handleInteraction}
        onKeyDown={handleInteraction}
        onWheel={handleInteraction}
        onScroll={handleInteraction}
        tabIndex={-1}
        role="button"
        aria-label="Click to sign up"
        style={{
          cursor: "pointer",
          touchAction: "none", // Prevent touch interactions
        }}
      >
        {/* Optional hint message */}
        {showHint && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-3 px-6 py-4 bg-card border border-border rounded-lg shadow-lg">
              <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground font-medium">
                {message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Additional keyboard event capture at document level */}
      <div
        className="sr-only"
        onKeyDown={handleInteraction}
        onKeyUp={handleInteraction}
        onKeyPress={handleInteraction}
        aria-hidden="true"
      />
    </>
  );
}
