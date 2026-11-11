interface NearbyBuoysSlotProps {
  lat: number;
  lon: number;
}

/**
 * OPTIONAL SLOT, renders nothing for now. Nearby wave buoys will come from the
 * `wave_stations` registry (branch feat/wave-station-registry, not merged).
 * When that table is live, query buoys near (lat, lon) here and list them with
 * links; keep returning null when there are none.
 */
export function NearbyBuoysSlot(_props: NearbyBuoysSlotProps) {
  return null;
}
