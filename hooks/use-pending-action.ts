"use client";

import { useEffect, useState } from "react";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";

const STORAGE_KEY = "pendingAction";
const EXPIRY_MS = 300_000; // 5 minutes

export interface PendingAction {
  type: "favorite" | "alert";
  beachId: string;
  beachName: string;
  timestamp: number;
}

interface UsePendingActionReturn {
  pendingAction: PendingAction | null;
  setPendingAction: (action: Omit<PendingAction, "timestamp">) => void;
  clearPendingAction: () => void;
}

export function usePendingAction(): UsePendingActionReturn {
  const [pendingAction, setPendingActionState] =
    useState<PendingAction | null>(null);

  // On mount, read from localStorage and auto-expire if stale
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed: PendingAction = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > EXPIRY_MS) {
        safeRemoveItem(STORAGE_KEY);
        return;
      }
      setPendingActionState(parsed);
    } catch {
      // Corrupt data — clear it silently
      safeRemoveItem(STORAGE_KEY);
    }
  }, []);

  function setPendingAction(action: Omit<PendingAction, "timestamp">): void {
    const withTimestamp: PendingAction = { ...action, timestamp: Date.now() };
    safeSetItem(STORAGE_KEY, JSON.stringify(withTimestamp));
    setPendingActionState(withTimestamp);
  }

  function clearPendingAction(): void {
    safeRemoveItem(STORAGE_KEY);
    setPendingActionState(null);
  }

  return { pendingAction, setPendingAction, clearPendingAction };
}
