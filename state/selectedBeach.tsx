"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface SelectedBeach {
  id: string;
  name: string;
  lat?: number | null;
  lon?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

type SelectedBeachContextValue = {
  selectedBeach: SelectedBeach | null;
  setSelectedBeach: (beach: SelectedBeach | null) => void;
  clearSelectedBeach: () => void;
};

const SelectedBeachContext = createContext<SelectedBeachContextValue | null>(null);

export function SelectedBeachProvider({ children }: { children: ReactNode }) {
  const [selectedBeach, setSelectedBeach] = useState<SelectedBeach | null>(null);

  const clearSelectedBeach = () => setSelectedBeach(null);

  const value = useMemo(
    () => ({ selectedBeach, setSelectedBeach, clearSelectedBeach }),
    [selectedBeach]
  );

  return (
    <SelectedBeachContext.Provider value={value}>
      {children}
    </SelectedBeachContext.Provider>
  );
}

export function useSelectedBeach() {
  const context = useContext(SelectedBeachContext);
  if (!context) {
    throw new Error("useSelectedBeach must be used within a SelectedBeachProvider");
  }
  return context;
}
