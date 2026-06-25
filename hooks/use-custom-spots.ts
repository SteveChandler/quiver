"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CustomSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  nearestBeachId: string | null;
  visibility: string;
}

interface CustomSpotRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  nearest_beach_id: string | null;
  visibility: string;
}

export function useCustomSpots(): {
  customSpots: CustomSpot[];
  loading: boolean;
} {
  const [customSpots, setCustomSpots] = useState<CustomSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchCustomSpots(): Promise<void> {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("custom_spots")
          .select("id, name, lat, lon, nearest_beach_id, visibility")
          .is("deleted_at", null);

        if (error) {
          console.error("Error fetching custom spots:", error);
          if (isMounted) {
            setCustomSpots([]);
          }
          return;
        }

        const rows = (data ?? []) as CustomSpotRow[];
        const nextCustomSpots = rows
          .filter(
            (row) => Number.isFinite(row.lat) && Number.isFinite(row.lon),
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            lat: row.lat,
            lon: row.lon,
            nearestBeachId: row.nearest_beach_id,
            visibility: row.visibility,
          }));

        if (isMounted) {
          setCustomSpots(nextCustomSpots);
        }
      } catch (error) {
        console.error("Error fetching custom spots:", error);
        if (isMounted) {
          setCustomSpots([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchCustomSpots();

    return () => {
      isMounted = false;
    };
  }, []);

  return { customSpots, loading };
}
