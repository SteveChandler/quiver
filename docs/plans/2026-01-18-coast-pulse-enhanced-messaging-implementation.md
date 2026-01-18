# Coast Pulse Enhanced Messaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform bland NOAA/CDIP buoy data into interpretive, actionable surf commentary with professional surf report tone.

**Architecture:** New formatting module `coast-pulse-formatter.ts` with pure functions for each data type. Region detection from coordinates. Integration via existing `formatBuoyConditions()` and tide message construction in the API route.

**Tech Stack:** TypeScript, Jest for testing, existing `direction-utils.ts` patterns.

---

## Task 1: Create Coastal Regions Constants

**Files:**
- Create: `lib/constants/coastal-regions.ts`
- Test: `__tests__/constants/coastal-regions.test.ts`

**Step 1: Write the failing test**

Create `__tests__/constants/coastal-regions.test.ts`:

```typescript
import {
  detectCoastalRegion,
  COASTAL_REGIONS,
  type CoastalRegion,
} from "@/lib/constants/coastal-regions";

describe("detectCoastalRegion", () => {
  it("detects SoCal from San Diego coordinates", () => {
    const region = detectCoastalRegion(32.75, -117.25);
    expect(region?.id).toBe("socal");
    expect(region?.coastFaces).toContain("SW");
  });

  it("detects NorCal from Santa Cruz coordinates", () => {
    const region = detectCoastalRegion(36.95, -122.03);
    expect(region?.id).toBe("central-ca");
  });

  it("detects East Coast FL from Miami coordinates", () => {
    const region = detectCoastalRegion(25.76, -80.19);
    expect(region?.id).toBe("east-fl");
    expect(region?.coastFaces).toContain("E");
  });

  it("detects Hawaii from Oahu coordinates", () => {
    const region = detectCoastalRegion(21.27, -157.82);
    expect(region?.id).toBe("hawaii");
  });

  it("returns null for inland coordinates", () => {
    const region = detectCoastalRegion(39.74, -104.99); // Denver
    expect(region).toBeNull();
  });

  it("returns null for international coordinates", () => {
    const region = detectCoastalRegion(51.5, -0.12); // London
    expect(region).toBeNull();
  });
});

describe("COASTAL_REGIONS", () => {
  it("has water temp averages for each region", () => {
    for (const region of Object.values(COASTAL_REGIONS)) {
      expect(region.waterTempAvgByMonth).toHaveLength(12);
      expect(region.waterTempAvgByMonth.every((t) => t >= 40 && t <= 85)).toBe(true);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/constants/coastal-regions.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `lib/constants/coastal-regions.ts`:

```typescript
/**
 * Coastal region configuration for location-aware surf messaging
 */

export interface CoastalRegion {
  id: string;
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  coastFaces: string[]; // Primary swell directions that work well
  waterTempAvgByMonth: number[]; // Jan=0, Dec=11, in Fahrenheit
}

export const COASTAL_REGIONS: Record<string, CoastalRegion> = {
  socal: {
    id: "socal",
    name: "Southern California",
    latMin: 32.5,
    latMax: 34.5,
    lonMin: -120,
    lonMax: -117,
    coastFaces: ["SW", "S", "W"],
    waterTempAvgByMonth: [58, 58, 59, 60, 62, 65, 68, 70, 69, 66, 62, 59],
  },
  "central-ca": {
    id: "central-ca",
    name: "Central California",
    latMin: 34.5,
    latMax: 37.5,
    lonMin: -123,
    lonMax: -120,
    coastFaces: ["W", "NW", "SW"],
    waterTempAvgByMonth: [54, 54, 54, 54, 55, 56, 57, 58, 59, 58, 56, 54],
  },
  norcal: {
    id: "norcal",
    name: "Northern California",
    latMin: 37.5,
    latMax: 42.0,
    lonMin: -125,
    lonMax: -122,
    coastFaces: ["NW", "W"],
    waterTempAvgByMonth: [52, 52, 52, 52, 53, 54, 55, 56, 56, 55, 54, 52],
  },
  "pacific-nw": {
    id: "pacific-nw",
    name: "Pacific Northwest",
    latMin: 42.0,
    latMax: 49.0,
    lonMin: -125,
    lonMax: -122,
    coastFaces: ["W", "NW", "SW"],
    waterTempAvgByMonth: [48, 48, 48, 49, 51, 54, 56, 58, 57, 54, 51, 49],
  },
  hawaii: {
    id: "hawaii",
    name: "Hawaii",
    latMin: 18.5,
    latMax: 22.5,
    lonMin: -161,
    lonMax: -154,
    coastFaces: ["N", "NW", "S", "SW", "E"],
    waterTempAvgByMonth: [75, 75, 76, 77, 78, 79, 80, 81, 81, 80, 78, 76],
  },
  "east-fl": {
    id: "east-fl",
    name: "Florida East Coast",
    latMin: 24.5,
    latMax: 30.5,
    lonMin: -81,
    lonMax: -80,
    coastFaces: ["E", "SE", "NE"],
    waterTempAvgByMonth: [72, 73, 75, 78, 81, 84, 85, 85, 84, 81, 77, 74],
  },
  "east-se": {
    id: "east-se",
    name: "Southeast Coast",
    latMin: 30.5,
    latMax: 36.5,
    lonMin: -82,
    lonMax: -75,
    coastFaces: ["E", "SE"],
    waterTempAvgByMonth: [55, 55, 60, 66, 73, 79, 82, 82, 79, 72, 64, 58],
  },
  "east-mid": {
    id: "east-mid",
    name: "Mid-Atlantic Coast",
    latMin: 36.5,
    latMax: 41.5,
    lonMin: -76,
    lonMax: -73,
    coastFaces: ["E", "ESE", "SE"],
    waterTempAvgByMonth: [42, 41, 44, 50, 58, 67, 74, 76, 72, 64, 55, 47],
  },
  "east-ne": {
    id: "east-ne",
    name: "New England Coast",
    latMin: 41.5,
    latMax: 45.0,
    lonMin: -71,
    lonMax: -69,
    coastFaces: ["E", "SE", "S"],
    waterTempAvgByMonth: [40, 38, 40, 46, 53, 61, 68, 70, 66, 58, 50, 44],
  },
  gulf: {
    id: "gulf",
    name: "Gulf Coast",
    latMin: 25.0,
    latMax: 30.5,
    lonMin: -98,
    lonMax: -81,
    coastFaces: ["S", "SE", "SW"],
    waterTempAvgByMonth: [62, 63, 68, 74, 80, 84, 86, 86, 84, 78, 70, 64],
  },
};

/**
 * Detect coastal region from coordinates
 * @returns Region config or null if not in a known coastal area
 */
export function detectCoastalRegion(
  lat: number,
  lon: number
): CoastalRegion | null {
  for (const region of Object.values(COASTAL_REGIONS)) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lon >= region.lonMin &&
      lon <= region.lonMax
    ) {
      return region;
    }
  }
  return null;
}

/**
 * Get seasonal water temp context
 * @returns "warm for [month]", "cool for [month]", or null if typical
 */
export function getSeasonalTempContext(
  tempF: number,
  region: CoastalRegion,
  month: number // 0-11
): string | null {
  const avg = region.waterTempAvgByMonth[month];
  if (avg == null) return null;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const diff = tempF - avg;
  if (diff >= 5) {
    return `warm for ${monthNames[month]}`;
  }
  if (diff <= -5) {
    return `cool for ${monthNames[month]}`;
  }
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/constants/coastal-regions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/constants/coastal-regions.ts __tests__/constants/coastal-regions.test.ts
git commit -m "feat: add coastal regions constants with detection and seasonal temp context"
```

---

## Task 2: Create Wave Height Interpretation

**Files:**
- Create: `lib/utils/coast-pulse-formatter.ts`
- Test: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Write the failing test**

Create `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  getHeightAssessment,
  getHeightConditionNote,
} from "@/lib/utils/coast-pulse-formatter";

describe("getHeightAssessment", () => {
  it("returns 'Flat' for < 1ft", () => {
    expect(getHeightAssessment(0.5)).toBe("Flat");
    expect(getHeightAssessment(0)).toBe("Flat");
  });

  it("returns 'Ankle-to-knee' for 1-1.5ft", () => {
    expect(getHeightAssessment(1.0)).toBe("Ankle-to-knee");
    expect(getHeightAssessment(1.4)).toBe("Ankle-to-knee");
  });

  it("returns 'Knee-to-waist' for 1.5-2.5ft", () => {
    expect(getHeightAssessment(1.5)).toBe("Knee-to-waist");
    expect(getHeightAssessment(2.4)).toBe("Knee-to-waist");
  });

  it("returns 'Waist-to-chest' for 2.5-4ft", () => {
    expect(getHeightAssessment(2.5)).toBe("Waist-to-chest");
    expect(getHeightAssessment(3.9)).toBe("Waist-to-chest");
  });

  it("returns 'Head-high' for 4-6ft", () => {
    expect(getHeightAssessment(4.0)).toBe("Head-high");
    expect(getHeightAssessment(5.9)).toBe("Head-high");
  });

  it("returns 'Overhead' for 6-8ft", () => {
    expect(getHeightAssessment(6.0)).toBe("Overhead");
    expect(getHeightAssessment(7.9)).toBe("Overhead");
  });

  it("returns 'Double overhead' for 8-12ft", () => {
    expect(getHeightAssessment(8.0)).toBe("Double overhead");
    expect(getHeightAssessment(11.9)).toBe("Double overhead");
  });

  it("returns 'XXL' for > 12ft", () => {
    expect(getHeightAssessment(12.0)).toBe("XXL");
    expect(getHeightAssessment(20.0)).toBe("XXL");
  });
});

describe("getHeightConditionNote", () => {
  it("suggests SUP for flat conditions", () => {
    expect(getHeightConditionNote(0.5, 10)).toContain("SUP");
  });

  it("suggests longboards for small waves", () => {
    expect(getHeightConditionNote(1.2, 12)).toContain("longboard");
  });

  it("notes good size for mid-range", () => {
    expect(getHeightConditionNote(3.5, 14)).toContain("most surfers");
  });

  it("notes experts for big waves", () => {
    expect(getHeightConditionNote(10.0, 18)).toContain("expert");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `lib/utils/coast-pulse-formatter.ts`:

```typescript
/**
 * Coast Pulse message formatting utilities
 * Transforms raw buoy data into interpretive surf commentary
 */

/**
 * Get size assessment label from wave height
 */
export function getHeightAssessment(heightFt: number): string {
  if (heightFt < 1.0) return "Flat";
  if (heightFt < 1.5) return "Ankle-to-knee";
  if (heightFt < 2.5) return "Knee-to-waist";
  if (heightFt < 4.0) return "Waist-to-chest";
  if (heightFt < 6.0) return "Head-high";
  if (heightFt < 8.0) return "Overhead";
  if (heightFt < 12.0) return "Double overhead";
  return "XXL";
}

/**
 * Get condition note based on height and period
 */
export function getHeightConditionNote(
  heightFt: number,
  periodS: number
): string {
  // Flat conditions
  if (heightFt < 1.0) {
    return "Minimal energy, SUP or prone conditions";
  }

  // Small waves - period matters less
  if (heightFt < 1.5) {
    return "Best for patient longboarders";
  }

  if (heightFt < 2.5) {
    return "Favorable for longboards, fun for all";
  }

  // Mid-size waves - period starts to matter
  if (heightFt < 4.0) {
    if (periodS < 9) {
      return "Choppy, but rideable for most surfers";
    }
    return "Good size for most surfers";
  }

  // Head-high - period quality important
  if (heightFt < 6.0) {
    if (periodS < 9) {
      return "Inconsistent, intermediate+";
    }
    return "Solid conditions, intermediate+";
  }

  // Overhead - getting serious
  if (heightFt < 8.0) {
    if (periodS >= 15) {
      return "Powerful surf, experienced surfers";
    }
    return "Heavy surf, experienced surfers";
  }

  // Double overhead+
  if (heightFt < 12.0) {
    return "Heavy conditions, experts only";
  }

  return "Dangerous, big wave spots only";
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add wave height assessment and condition note formatters"
```

---

## Task 3: Add Wave Period Interpretation

**Files:**
- Modify: `lib/utils/coast-pulse-formatter.ts`
- Modify: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Add failing tests**

Append to `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  getHeightAssessment,
  getHeightConditionNote,
  getPeriodLabel,
  getPeriodQuality,
} from "@/lib/utils/coast-pulse-formatter";

// ... existing tests ...

describe("getPeriodLabel", () => {
  it("returns 'Wind chop' for < 6s", () => {
    expect(getPeriodLabel(5)).toBe("Wind chop");
  });

  it("returns 'Short-period wind swell' for 6-9s", () => {
    expect(getPeriodLabel(6)).toBe("Short-period wind swell");
    expect(getPeriodLabel(8)).toBe("Short-period wind swell");
  });

  it("returns 'Mid-period swell' for 9-12s", () => {
    expect(getPeriodLabel(9)).toBe("Mid-period swell");
    expect(getPeriodLabel(11)).toBe("Mid-period swell");
  });

  it("returns 'Groundswell' for 12-15s", () => {
    expect(getPeriodLabel(12)).toBe("Groundswell");
    expect(getPeriodLabel(14)).toBe("Groundswell");
  });

  it("returns 'Long-period groundswell' for 15-18s", () => {
    expect(getPeriodLabel(15)).toBe("Long-period groundswell");
    expect(getPeriodLabel(17)).toBe("Long-period groundswell");
  });

  it("returns 'Deep-water groundswell' for > 18s", () => {
    expect(getPeriodLabel(18)).toBe("Deep-water groundswell");
    expect(getPeriodLabel(22)).toBe("Deep-water groundswell");
  });
});

describe("getPeriodQuality", () => {
  it("returns negative quality for wind chop", () => {
    expect(getPeriodQuality(5)).toBe("Bumpy, disorganized");
  });

  it("returns clean quality for groundswell", () => {
    expect(getPeriodQuality(14)).toBe("Clean lines, good shape expected");
  });

  it("returns excellent quality for deep-water swell", () => {
    expect(getPeriodQuality(20)).toContain("Excellent");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "getPeriodLabel is not a function"

**Step 3: Add the implementation**

Add to `lib/utils/coast-pulse-formatter.ts`:

```typescript
/**
 * Get swell energy label from wave period
 */
export function getPeriodLabel(periodS: number): string {
  if (periodS < 6) return "Wind chop";
  if (periodS < 9) return "Short-period wind swell";
  if (periodS < 12) return "Mid-period swell";
  if (periodS < 15) return "Groundswell";
  if (periodS < 18) return "Long-period groundswell";
  return "Deep-water groundswell";
}

/**
 * Get quality description from wave period
 */
export function getPeriodQuality(periodS: number): string {
  if (periodS < 6) return "Bumpy, disorganized";
  if (periodS < 9) return "Inconsistent, close-out prone";
  if (periodS < 12) return "Decent shape, moderate power";
  if (periodS < 15) return "Clean lines, good shape expected";
  if (periodS < 18) return "Solid energy, powerful waves";
  return "Excellent organization, maximum power";
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add wave period label and quality formatters"
```

---

## Task 4: Add Swell Direction Interpretation

**Files:**
- Modify: `lib/utils/coast-pulse-formatter.ts`
- Modify: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Add failing tests**

Append to `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  // ... existing imports ...
  getSwellDirectionContext,
} from "@/lib/utils/coast-pulse-formatter";
import { COASTAL_REGIONS } from "@/lib/constants/coastal-regions";

// ... existing tests ...

describe("getSwellDirectionContext", () => {
  const socal = COASTAL_REGIONS.socal;
  const norcal = COASTAL_REGIONS.norcal;
  const eastFl = COASTAL_REGIONS["east-fl"];

  it("notes favorable direction for SoCal SW swell", () => {
    const context = getSwellDirectionContext("SW", socal);
    expect(context).toContain("south-facing");
  });

  it("notes direct hit for NorCal NW swell", () => {
    const context = getSwellDirectionContext("NW", norcal);
    expect(context).toContain("direct");
  });

  it("notes favorable for East Coast SE swell", () => {
    const context = getSwellDirectionContext("SE", eastFl);
    expect(context).toContain("east-facing");
  });

  it("notes shadowed for unfavorable direction", () => {
    const context = getSwellDirectionContext("N", socal);
    expect(context).toContain("shadow");
  });

  it("returns null for null direction", () => {
    expect(getSwellDirectionContext(null, socal)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "getSwellDirectionContext is not a function"

**Step 3: Add the implementation**

Add to `lib/utils/coast-pulse-formatter.ts`:

```typescript
import type { CoastalRegion } from "@/lib/constants/coastal-regions";

/**
 * Get swell direction context based on region
 */
export function getSwellDirectionContext(
  direction: string | null | undefined,
  region: CoastalRegion
): string | null {
  if (!direction) return null;

  const dir = direction.toUpperCase().replace(/\s+/g, "");

  // Check if this direction is favorable for the region
  const isFavorable = region.coastFaces.some((face) => {
    // Direct match
    if (dir === face) return true;
    // Adjacent match (e.g., SW matches S or W facing)
    if (dir.includes(face) || face.includes(dir)) return true;
    return false;
  });

  // Generate context based on region and direction match
  if (isFavorable) {
    // Describe what the swell direction favors
    const primaryFace = region.coastFaces[0];
    switch (region.id) {
      case "socal":
        if (dir === "SW" || dir === "S") {
          return "Filling in south-facing reefs and points";
        }
        if (dir === "W" || dir === "WNW") {
          return "Working most west-facing beaches";
        }
        if (dir === "NW") {
          return "Wrapping into protected spots";
        }
        return "Favorable for local breaks";

      case "central-ca":
      case "norcal":
        if (dir === "NW" || dir === "WNW") {
          return "Direct hit for most breaks";
        }
        if (dir === "W") {
          return "Clean lines for open beaches";
        }
        if (dir === "SW") {
          return "Favorable for south-facing coves";
        }
        return "Working the coast";

      case "pacific-nw":
        if (dir === "W" || dir === "NW") {
          return "Direct exposure, powerful surf";
        }
        if (dir === "SW") {
          return "Clean lines, less direct angle";
        }
        return "Working exposed beaches";

      case "hawaii":
        if (dir === "N" || dir === "NW") {
          return "Lighting up north shores";
        }
        if (dir === "S" || dir === "SW") {
          return "South shore season";
        }
        if (dir === "E" || dir === "NE") {
          return "Trade swell for east-facing breaks";
        }
        return "Finding favorable exposures";

      case "east-fl":
      case "east-se":
      case "east-mid":
      case "east-ne":
        if (dir === "E" || dir === "ESE") {
          return "Clean lines for east-facing beaches";
        }
        if (dir === "SE" || dir === "S") {
          return "Favorable angle, longer rides";
        }
        if (dir === "NE") {
          return "Direct energy, may be choppy";
        }
        return "Working the coast";

      case "gulf":
        if (dir === "S" || dir === "SE") {
          return "Favorable for gulf beaches";
        }
        return "Finding workable angles";

      default:
        return "Favorable for local breaks";
    }
  }

  // Unfavorable direction
  return "Many spots in shadow from this direction";
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add location-aware swell direction context"
```

---

## Task 5: Add Water Temperature Interpretation

**Files:**
- Modify: `lib/utils/coast-pulse-formatter.ts`
- Modify: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Add failing tests**

Append to `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  // ... existing imports ...
  getTempComfortLabel,
  formatWaterTemp,
} from "@/lib/utils/coast-pulse-formatter";

// ... existing tests ...

describe("getTempComfortLabel", () => {
  it("returns 'Cold' for < 50F", () => {
    expect(getTempComfortLabel(48)).toBe("cold");
  });

  it("returns 'Chilly' for 50-55F", () => {
    expect(getTempComfortLabel(52)).toBe("chilly");
  });

  it("returns 'Cool' for 55-60F", () => {
    expect(getTempComfortLabel(58)).toBe("cool");
  });

  it("returns 'Mild' for 60-65F", () => {
    expect(getTempComfortLabel(63)).toBe("mild");
  });

  it("returns 'Comfortable' for 65-70F", () => {
    expect(getTempComfortLabel(68)).toBe("comfortable");
  });

  it("returns 'Warm' for 70-75F", () => {
    expect(getTempComfortLabel(72)).toBe("warm");
  });

  it("returns 'Tropical' for > 75F", () => {
    expect(getTempComfortLabel(80)).toBe("tropical");
  });
});

describe("formatWaterTemp", () => {
  const socal = COASTAL_REGIONS.socal;

  it("includes temperature and comfort label", () => {
    const result = formatWaterTemp(63, socal, 6); // July
    expect(result).toContain("63°F");
    expect(result).toContain("mild");
  });

  it("adds seasonal context when significantly above average", () => {
    const result = formatWaterTemp(75, socal, 0); // January, avg 58
    expect(result).toContain("warm for January");
  });

  it("adds seasonal context when significantly below average", () => {
    const result = formatWaterTemp(60, socal, 7); // August, avg 70
    expect(result).toContain("cool for August");
  });

  it("omits seasonal context when typical", () => {
    const result = formatWaterTemp(68, socal, 6); // July, avg 68
    expect(result).not.toContain("for July");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "getTempComfortLabel is not a function"

**Step 3: Add the implementation**

Add to `lib/utils/coast-pulse-formatter.ts`:

```typescript
import { getSeasonalTempContext, type CoastalRegion } from "@/lib/constants/coastal-regions";

/**
 * Get comfort label from water temperature
 */
export function getTempComfortLabel(tempF: number): string {
  if (tempF < 50) return "cold";
  if (tempF < 55) return "chilly";
  if (tempF < 60) return "cool";
  if (tempF < 65) return "mild";
  if (tempF < 70) return "comfortable";
  if (tempF < 75) return "warm";
  return "tropical";
}

/**
 * Format water temperature with comfort and seasonal context
 */
export function formatWaterTemp(
  tempF: number,
  region: CoastalRegion,
  month: number
): string {
  const comfort = getTempComfortLabel(tempF);
  const seasonal = getSeasonalTempContext(tempF, region, month);

  if (seasonal) {
    return `Water ${Math.round(tempF)}°F, ${comfort} (${seasonal})`;
  }

  return `Water ${Math.round(tempF)}°F (${comfort})`;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add water temperature comfort and seasonal formatting"
```

---

## Task 6: Add Tide Status Interpretation

**Files:**
- Modify: `lib/utils/coast-pulse-formatter.ts`
- Modify: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Add failing tests**

Append to `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  // ... existing imports ...
  formatTideMessage,
} from "@/lib/utils/coast-pulse-formatter";

// ... existing tests ...

describe("formatTideMessage", () => {
  it("formats rising toward high", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 5.2,
      hoursUntil: 2,
      minsUntil: 15,
      currentHeight: 3.1,
      status: "Rising",
    });
    expect(result).toContain("Pushing in");
    expect(result).toContain("high in 2h 15m");
    expect(result).toContain("Beach breaks may back off");
  });

  it("formats near high tide", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 5.2,
      hoursUntil: 0,
      minsUntil: 20,
      currentHeight: 5.0,
      status: "Rising",
    });
    expect(result).toContain("Near high");
    expect(result).toContain("Fat and slow");
  });

  it("formats falling from high", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -0.5,
      hoursUntil: 4,
      minsUntil: 0,
      currentHeight: 3.5,
      status: "Falling",
    });
    expect(result).toContain("Draining out");
    expect(result).toContain("Reefs and points improving");
  });

  it("formats near low tide", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -0.5,
      hoursUntil: 0,
      minsUntil: 15,
      currentHeight: -0.3,
      status: "Falling",
    });
    expect(result).toContain("Near low");
    expect(result).toContain("shallow");
  });

  it("formats rising from low", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 4.8,
      hoursUntil: 5,
      minsUntil: 0,
      currentHeight: 0.5,
      status: "Rising",
    });
    expect(result).toContain("Filling in");
    expect(result).toContain("Sandbars coming alive");
  });

  it("notes extremely low tide", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -1.5,
      hoursUntil: 0,
      minsUntil: 30,
      currentHeight: -1.2,
      status: "Falling",
    });
    expect(result).toContain("Extremely low");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "formatTideMessage is not a function"

**Step 3: Add the implementation**

Add to `lib/utils/coast-pulse-formatter.ts`:

```typescript
interface TideData {
  nextTideName: string; // "High Tide" or "Low Tide"
  nextTideHeight: number;
  hoursUntil: number;
  minsUntil: number;
  currentHeight: number;
  status: "Rising" | "Falling" | string;
}

/**
 * Format tide status with interpretive context
 */
export function formatTideMessage(data: TideData): string {
  const {
    nextTideName,
    nextTideHeight,
    hoursUntil,
    minsUntil,
    currentHeight,
    status,
  } = data;

  const isGoingHigh = nextTideName.toLowerCase().includes("high");
  const isNear = hoursUntil === 0 && minsUntil <= 30;
  const totalMins = hoursUntil * 60 + minsUntil;

  // Time string
  const timeStr =
    hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;

  // Extreme tide warnings
  if (currentHeight < 0 || nextTideHeight < 0) {
    if (currentHeight < -0.5 || nextTideHeight < -0.5) {
      return `Extremely low, ${nextTideHeight.toFixed(1)}ft low in ${timeStr}. Exposed rocks likely.`;
    }
  }

  if (currentHeight > 6 || nextTideHeight > 6) {
    return `King tide range, ${nextTideHeight.toFixed(1)}ft ${isGoingHigh ? "high" : "low"} in ${timeStr}. Reduced beach access.`;
  }

  // Near tide states (within 30 min)
  if (isNear) {
    if (isGoingHigh) {
      return `Near high, ${currentHeight.toFixed(1)}ft. Fat and slow at most spots.`;
    } else {
      return `Near low, ${currentHeight.toFixed(1)}ft. Watch for shallow sections.`;
    }
  }

  // Transitional states
  if (status === "Rising") {
    if (currentHeight < 1.5) {
      // Rising from low
      return `Filling in, rising for ${timeStr}. Sandbars coming alive.`;
    }
    // Rising toward high
    return `Pushing in, high in ${timeStr}. Beach breaks may back off.`;
  }

  if (status === "Falling") {
    if (currentHeight > 3) {
      // Falling from high
      return `Draining out, dropping for ${timeStr}. Reefs and points improving.`;
    }
    // Falling toward low
    return `Draining fast, ${nextTideHeight.toFixed(1)}ft low in ${timeStr}. Reefs and points improving.`;
  }

  // Fallback
  return `${nextTideName} in ${timeStr} @ ${nextTideHeight.toFixed(1)}ft.`;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add interpretive tide message formatting"
```

---

## Task 7: Add Main Buoy Message Formatter

**Files:**
- Modify: `lib/utils/coast-pulse-formatter.ts`
- Modify: `__tests__/utils/coast-pulse-formatter.test.ts`

**Step 1: Add failing tests**

Append to `__tests__/utils/coast-pulse-formatter.test.ts`:

```typescript
import {
  // ... existing imports ...
  formatBuoyMessage,
} from "@/lib/utils/coast-pulse-formatter";

// ... existing tests ...

describe("formatBuoyMessage", () => {
  it("formats complete NOAA data with all fields", () => {
    const result = formatBuoyMessage({
      heightFt: 1.6,
      periodS: 13,
      direction: "SW",
      waterTempF: 63,
      lat: 32.75,
      lon: -117.25,
    });
    expect(result).toContain("Groundswell");
    expect(result).toContain("1.6ft @ 13s");
    expect(result).toContain("SW");
    expect(result).toContain("63°F");
  });

  it("handles missing direction", () => {
    const result = formatBuoyMessage({
      heightFt: 2.4,
      periodS: 17,
      direction: null,
      waterTempF: 65,
      lat: 32.75,
      lon: -117.25,
    });
    expect(result).toContain("Long-period groundswell");
    expect(result).toContain("2.4ft @ 17s");
    expect(result).not.toContain("null");
  });

  it("handles missing water temp", () => {
    const result = formatBuoyMessage({
      heightFt: 1.1,
      periodS: 12,
      direction: "W",
      waterTempF: null,
      lat: 32.75,
      lon: -117.25,
    });
    expect(result).not.toContain("°F");
    expect(result).not.toContain("null");
  });

  it("adapts to different regions", () => {
    // NorCal coordinates
    const norcal = formatBuoyMessage({
      heightFt: 3.0,
      periodS: 14,
      direction: "NW",
      waterTempF: 54,
      lat: 38.0,
      lon: -123.0,
    });
    expect(norcal).toContain("Direct hit");

    // Florida coordinates
    const florida = formatBuoyMessage({
      heightFt: 2.0,
      periodS: 10,
      direction: "SE",
      waterTempF: 78,
      lat: 26.0,
      lon: -80.1,
    });
    expect(florida).toContain("east-facing");
  });

  it("falls back gracefully for unknown regions", () => {
    const result = formatBuoyMessage({
      heightFt: 2.0,
      periodS: 12,
      direction: "W",
      waterTempF: 60,
      lat: 45.0, // Pacific NW edge
      lon: -124.0,
    });
    expect(result).toContain("2.0ft @ 12s");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: FAIL with "formatBuoyMessage is not a function"

**Step 3: Add the implementation**

Add to `lib/utils/coast-pulse-formatter.ts`:

```typescript
import { detectCoastalRegion } from "@/lib/constants/coastal-regions";

interface BuoyData {
  heightFt: number;
  periodS: number;
  direction: string | null;
  waterTempF: number | null;
  lat: number;
  lon: number;
}

/**
 * Format complete buoy message with interpretive commentary
 */
export function formatBuoyMessage(data: BuoyData): string {
  const { heightFt, periodS, direction, waterTempF, lat, lon } = data;

  const region = detectCoastalRegion(lat, lon);
  const month = new Date().getMonth();

  const parts: string[] = [];

  // 1. Period-based energy label + measurements
  const periodLabel = getPeriodLabel(periodS);

  // Combine period label with height context
  if (periodS >= 12) {
    // Groundswell - lead with that
    parts.push(`${periodLabel}, ${heightFt.toFixed(1)}ft @ ${periodS}s`);
  } else if (periodS < 9) {
    // Wind swell - note the choppiness
    parts.push(`${periodLabel}, ${heightFt.toFixed(1)}ft @ ${periodS}s`);
  } else {
    // Mid-period - neutral framing
    parts.push(`${periodLabel}, ${heightFt.toFixed(1)}ft @ ${periodS}s`);
  }

  // 2. Direction with context (if available)
  if (direction && region) {
    const dirContext = getSwellDirectionContext(direction, region);
    if (dirContext) {
      parts.push(`${direction}. ${dirContext}`);
    } else {
      parts.push(direction);
    }
  } else if (direction) {
    parts.push(direction);
  }

  // 3. Condition note based on size + period
  const conditionNote = getHeightConditionNote(heightFt, periodS);
  parts.push(conditionNote);

  // 4. Water temp with seasonal context (if available)
  if (waterTempF != null && region) {
    parts.push(formatWaterTemp(waterTempF, region, month));
  } else if (waterTempF != null) {
    parts.push(`Water ${Math.round(waterTempF)}°F`);
  }

  return parts.join(". ").replace(/\.\./g, ".").replace(/\. \./g, ".");
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/coast-pulse-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/coast-pulse-formatter.ts __tests__/utils/coast-pulse-formatter.test.ts
git commit -m "feat: add main formatBuoyMessage with full interpretive output"
```

---

## Task 8: Integrate into Coast Pulse API Route

**Files:**
- Modify: `app/api/coast-pulse/route.ts:620-680` (fetchLiveNDBCData function)
- Modify: `app/api/coast-pulse/route.ts:688-777` (fetchLiveCDIPData function)
- Modify: `app/api/coast-pulse/route.ts:779-831` (fetchTideData function)

**Step 1: Update NDBC formatter call**

In `app/api/coast-pulse/route.ts`, find `fetchLiveNDBCData` function (around line 621) and update the message formatting:

Replace the message construction (lines ~640-661):

```typescript
// OLD:
const parts: string[] = [];
if (observation.wave_height_m != null) {
  const heightFt = observation.wave_height_m * 3.28084;
  parts.push(`${heightFt.toFixed(1)}ft`);
}
// ... etc
const message = parts.length > 0 ? parts.join(", ") : "Live data available";
```

With:

```typescript
// NEW:
import { formatBuoyMessage } from "@/lib/utils/coast-pulse-formatter";

// Inside fetchLiveNDBCData:
const heightFt = observation.wave_height_m != null
  ? observation.wave_height_m * 3.28084
  : null;
const periodS = observation.wave_period_s ?? null;
const waterTempF = observation.water_temp_c != null
  ? (observation.water_temp_c * 9 / 5) + 32
  : null;
const direction = observation.wave_direction_deg != null
  ? degreesToCardinal(observation.wave_direction_deg)
  : null;

const message = heightFt != null && periodS != null
  ? formatBuoyMessage({
      heightFt,
      periodS,
      direction,
      waterTempF,
      lat: station.lat,
      lon: station.lon,
    })
  : "Live data available";
```

**Step 2: Update CDIP formatter call**

In `fetchLiveCDIPData` function (around line 730), update:

```typescript
// OLD:
const parts: string[] = [];
if (latest.significantWaveHeight != null) {
  parts.push(`${latest.significantWaveHeight.toFixed(1)}ft`);
}
// ... etc
const message = parts.length > 0 ? parts.join(", ") : "Live CDIP data";
```

With:

```typescript
// NEW:
const message = latest.significantWaveHeight != null && latest.peakWavePeriod != null
  ? formatBuoyMessage({
      heightFt: latest.significantWaveHeight,
      periodS: latest.peakWavePeriod,
      direction: latest.peakWaveDirection != null
        ? degreesToCardinal(latest.peakWaveDirection)
        : null,
      waterTempF: null, // CDIP doesn't provide water temp
      lat: stationLat,
      lon: stationLon,
    })
  : "Live CDIP data";
```

**Step 3: Update tide formatter call**

In `fetchTideData` function (around line 813), update:

```typescript
// OLD:
const message = `${nextTide.name} in ${timeStr} @ ${nextTide.height.toFixed(1)}ft. ${heightStr}`;
```

With:

```typescript
// NEW:
import { formatTideMessage } from "@/lib/utils/coast-pulse-formatter";

const message = formatTideMessage({
  nextTideName: nextTide.name,
  nextTideHeight: nextTide.height,
  hoursUntil,
  minsUntil,
  currentHeight: currentHeight ?? 0,
  status: tideStatus,
});
```

**Step 4: Add import at top of file**

At the top of `app/api/coast-pulse/route.ts`, add:

```typescript
import { formatBuoyMessage, formatTideMessage } from "@/lib/utils/coast-pulse-formatter";
```

**Step 5: Run E2E test to verify integration**

Run: `yarn test:e2e e2e/coast-pulse-intel.spec.ts`
Expected: PASS (existing tests should still pass with new message formats)

**Step 6: Commit**

```bash
git add app/api/coast-pulse/route.ts
git commit -m "feat: integrate enhanced buoy and tide message formatters into Coast Pulse API"
```

---

## Task 9: Manual Verification

**Step 1: Start dev server**

Run: `yarn dev`

**Step 2: Open Coast Pulse in browser**

Navigate to home page with location set to San Diego area.

**Step 3: Verify NOAA/CDIP messages**

Check that buoy messages now show:
- Period-based labels (e.g., "Groundswell", "Long-period groundswell")
- Direction context (e.g., "Filling in south-facing reefs")
- Condition notes (e.g., "Favorable for longboards")
- Water temp with comfort level (e.g., "Water 63°F (mild)")

**Step 4: Verify Tide messages**

Check that tide messages now show:
- Interpretive status (e.g., "Draining out", "Pushing in")
- Surf impact context (e.g., "Reefs and points improving")

**Step 5: Take screenshot for PR**

Capture before/after comparison for documentation.

**Step 6: Commit any fixes**

If any adjustments needed:
```bash
git add -A
git commit -m "fix: adjust enhanced messaging based on manual testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Coastal regions constants | `lib/constants/coastal-regions.ts` |
| 2 | Wave height interpretation | `lib/utils/coast-pulse-formatter.ts` |
| 3 | Wave period interpretation | `lib/utils/coast-pulse-formatter.ts` |
| 4 | Swell direction context | `lib/utils/coast-pulse-formatter.ts` |
| 5 | Water temp formatting | `lib/utils/coast-pulse-formatter.ts` |
| 6 | Tide message formatting | `lib/utils/coast-pulse-formatter.ts` |
| 7 | Main buoy message formatter | `lib/utils/coast-pulse-formatter.ts` |
| 8 | API route integration | `app/api/coast-pulse/route.ts` |
| 9 | Manual verification | N/A |

**Estimated commits:** 9
**New files:** 2 (`coastal-regions.ts`, `coast-pulse-formatter.ts`)
**New test files:** 2
**Modified files:** 1 (`route.ts`)
