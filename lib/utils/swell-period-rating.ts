/**
 * Pure swell period quality rating — no beach needed.
 */
export function ratePeriod(periodSeconds: number): {
  label: string;
  description: string;
  color: "red" | "yellow" | "lime" | "green";
} {
  if (periodSeconds < 8) {
    return {
      label: "Wind swell",
      description: "Choppy, disorganized — waves lack power and shape",
      color: "red",
    };
  }
  if (periodSeconds < 12) {
    return {
      label: "Mid-period swell",
      description: "Decent energy — rideable but not the cleanest",
      color: "yellow",
    };
  }
  if (periodSeconds < 16) {
    return {
      label: "Ground swell",
      description: "Powerful, well-organized — waves have good shape",
      color: "lime",
    };
  }
  return {
    label: "Long-period ground swell",
    description: "Heavy, fast-moving — serious energy, fast hollow waves",
    color: "green",
  };
}
