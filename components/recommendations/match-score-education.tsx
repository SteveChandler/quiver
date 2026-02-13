"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/context/auth-context";

const STORAGE_KEY = "match_score_education_dismissed";
const AUTO_DISMISS_MS = 8000;

interface MatchScoreEducationProps {
  /** The badge element to wrap */
  children: ReactNode;
}

/**
 * One-time educational popover that wraps a PersonalizedBadge.
 *
 * Shows on first encounter for authenticated users, then
 * auto-dismisses after 8 seconds or on tap. Uses localStorage
 * to ensure it only appears once.
 */
export function MatchScoreEducation({ children }: MatchScoreEducationProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed) return;
    } catch {
      // localStorage unavailable (SSR, private mode) — skip
      return;
    }

    // Show popover after a brief delay so the badge has rendered
    const showTimer = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(showTimer);
  }, [user]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Don't render popover wrapper for unauthenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={(next) => !next && dismiss()}>
      <PopoverTrigger asChild>
        <div>{children}</div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-72 text-sm"
        onPointerDownOutside={() => dismiss()}
      >
        <p>
          This is your match score &mdash; how well current conditions fit your
          preferences and surf history. It gets smarter as you log sessions.
        </p>
      </PopoverContent>
    </Popover>
  );
}
