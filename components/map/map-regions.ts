export interface MapRegionPill {
  id: string;
  label: string;
  center: { lat: number; lon: number };
}

export const MAP_REGION_PILLS: MapRegionPill[] = [
  {
    id: "san-diego",
    label: "San Diego",
    center: { lat: 32.79, lon: -117.25 },
  },
  {
    id: "orange-county",
    label: "OC",
    center: { lat: 33.63, lon: -117.95 },
  },
  {
    id: "los-angeles",
    label: "LA / South Bay",
    center: { lat: 33.88, lon: -118.41 },
  },
  {
    id: "ventura-sb",
    label: "Ventura / SB",
    center: { lat: 34.34, lon: -119.5 },
  },
  {
    id: "central-coast",
    label: "Central Coast",
    center: { lat: 36.96, lon: -122.02 },
  },
  {
    id: "bay-area",
    label: "Bay Area",
    center: { lat: 37.76, lon: -122.51 },
  },
  {
    id: "hawaii",
    label: "Hawaii",
    center: { lat: 21.66, lon: -158.06 },
  },
];
