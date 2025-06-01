"use client";

import { useState, useEffect } from "react";
import { getBeaches } from "@/actions/beach-actions";
import { getAllSessions } from "@/actions/session-actions";
import type { Beach, SessionWithDetails } from "@/types/database";

interface UseHomeDataReturn {
  beaches: Beach[];
  sessions: SessionWithDetails[];
  loading: boolean;
  error: string | null;
}

export function useHomeData(): UseHomeDataReturn {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch beaches
        const beachesResult = await getBeaches();

        if (beachesResult.success && beachesResult.data) {
          setBeaches(beachesResult.data);
        }

        // Fetch all sessions for community tab
        const communitySessions = await getAllSessions(10);
        if (communitySessions) {
          setSessions(communitySessions);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { beaches, sessions, loading, error };
}
