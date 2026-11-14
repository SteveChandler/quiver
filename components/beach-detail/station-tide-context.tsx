"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { BeachStationTide } from "@/lib/tides/beach-station-tide";

const StationTideContext = createContext<BeachStationTide | null>(null);

/** Gives the beach page's tide modules the NOAA station table the server loaded. */
export function StationTideProvider({
  value,
  children,
}: {
  value: BeachStationTide | null;
  children: ReactNode;
}): ReactNode {
  return <StationTideContext.Provider value={value}>{children}</StationTideContext.Provider>;
}

/** Null outside a beach tide page, or when the station table did not load. */
export function useStationTide(): BeachStationTide | null {
  return useContext(StationTideContext);
}
