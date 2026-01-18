"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";

interface UseUserPreferencesResult {
  data: UserSurfPreferences | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUserPreferences(): UseUserPreferencesResult {
  const { user } = useAuth();
  const [data, setData] = useState<UserSurfPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/user/preferences");
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch preferences"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return { data, loading, error, refetch: fetchPreferences };
}
