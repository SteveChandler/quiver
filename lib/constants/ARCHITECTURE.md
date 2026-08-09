# Constants Library Architecture

## 🎯 **PURPOSE**

The `/lib/constants` directory provides centralized configuration and constant values used throughout the Quiver surf community platform, ensuring consistency and maintainability across the application.

## 📁 **DIRECTORY STRUCTURE**

```
lib/constants/
├── animations.ts                # Motion and animation configurations
├── beach-coordinates.ts         # ⚠️ DEPRECATED - Legacy static beach coordinates (use beaches table)
├── cdip-stations.ts            # CDIP buoy station configurations
├── content.ts                  # Static content for pages (About, Privacy, Features)
├── coverage-areas.ts           # Geographic coverage area definitions
├── features.ts                 # Feature flags and configurations
├── intel.ts                    # Community intel post configurations
├── map-presets.ts              # Map display presets and configurations
├── seo.ts                      # SEO metadata and configurations
├── session-form-constants.ts   # Session form configurations
└── ui.ts                       # UI-related constants and themes
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Configuration Centralization Pattern**

```typescript
ApplicationConstants
├── Static Data (beach coordinates, CDIP stations)
├── Configuration Objects (animations, map presets)
├── Content Management (static page content)
├── Feature Flags (environment-based toggles)
└── UI Standards (themes, spacing, breakpoints)
```

### **Type-Safe Configuration**

```typescript
// Strongly typed configuration objects
interface ConfigObject {
  readonly [key: string]: Readonly<ConfigValue>;
}

// Immutable constant declarations
export const CONFIGURATION = {
  setting: value,
} as const;
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **animations.ts** (Motion Standards)

- **Purpose**: Standardized animation variants and durations
- **Features**:
  - Framer Motion animation variants
  - Consistent timing standards
  - Staggered animation patterns
  - Hero and viewport animations

**Animation Patterns:**

```typescript
export const ANIMATION_VARIANTS = {
  // Standard fade up animation
  fadeUpSlow: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 },
  },

  // Parameterized animations
  fadeUpWithDelay: (delay: number = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay },
  }),

  // Staggered list animations
  staggerItem: (index: number, duration: number = 0.6) => ({
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration, delay: index * 0.1 },
  }),
};

export const DURATIONS = {
  fast: 0.3,
  standard: 0.6,
  slow: 0.8,
  hero: 1,
} as const;
```

### **beach-coordinates.ts** (Geographic Data) ⚠️ DEPRECATED

- **Status**: ⚠️ **DEPRECATED** - Retained only for historical session map images of deleted beaches
- **Purpose**: Legacy static coordinate data for 27 hardcoded surf beaches
- **Migration**: Use the `beaches` table directly via server actions or Supabase queries instead
- **Why deprecated**: All active beaches now have NOT NULL lat/lon columns in the database, eliminating the need for this hardcoded dictionary
- **Remaining use case**: Historical session data referencing beaches that no longer exist in the `beaches` table

**Coordinate Structure:**

```typescript
interface BeachCoordinates {
  lat: number;
  lng: number;
}

export const beachCoordinates: Record<string, BeachCoordinates> = {
  "la jolla shores": { lat: 32.8507, lng: -117.2726 },
  "windansea beach": { lat: 32.8217, lng: -117.2837 },
  "sunset cliffs": { lat: 32.7351, lng: -117.2519 },
  // ... more beaches
};

export const beachNames = Object.keys(beachCoordinates);
```

### **cdip-stations.ts** (Buoy Configuration)

- **Purpose**: CDIP buoy station metadata and API configuration
- **Features**:
  - Comprehensive station metadata
  - API endpoint configurations
  - Quality validation thresholds
  - Regional station groupings

**Station Configuration:**

```typescript
export const CDIP_STATIONS: Record<string, CDIPStationConfig> = {
  "100": {
    id: "100",
    name: "Torrey Pines Outer",
    latitude: 32.921,
    longitude: -117.39,
    deployDepth: 550, // meters
    hullType: "3-meter discus buoy",
    parameters: ["wave", "weather", "drifter"],
  },
  // ... more stations
};

// API Configuration
export const CDIP_API_CONFIG = {
  baseUrl: "http://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json",
  endpoints: {
    waveData:
      '?station_id,time,waveHs,waveTp,waveTa,waveDp&waveFlagPrimary=1&time>max(time)-1days&station_id="{stationId}"',
    metadata:
      '?station_id,metaStationName,latitude,longitude&station_id="{stationId}"&distinct()',
  },
  // ... more configuration
} as const;
```

### **content.ts** (Static Content Management)

- **Purpose**: Centralized content for static pages
- **Features**:
  - About page content structure
  - Privacy policy comprehensive text
  - Feature descriptions and benefits
  - Structured content with TypeScript safety

**Content Structure:**

```typescript
export const ABOUT_CONTENT = {
  hero: {
    title: "I built Quiver because...",
    subtitle: "Wrong about the swell...",
  },
  problem: [
    "I was checking five different apps...",
    "The worst part?...",
  ],
  solution: {
    intro: "So I started building...",
    stats: [
      { value: "279", label: "beaches" },
      // ... more stats
    ],
    closer: "Every forecast is built from NOAA buoy data...",
  },
  whatsNext: [
    "Quiver is early...",
    "If the forecast was off...",
  ],
  cta: {
    title: "Come check it out.",
    subtitle: "Free. No credit card...",
    primaryLabel: "Check the forecast",
    primaryHref: "/",
    secondaryLabel: "Drop me a line",
    secondaryHref: "mailto:support@quiversurf.app",
  },
} as const;

export const PRIVACY_CONTENT = {
  hero: {
    title: "Privacy Policy",
    subtitle: "How we protect and handle your data",
    lastUpdated: "January 15, 2025",
  },
  dataCategories: {
    categories: [
      {
        name: "Standard Identity Data",
        description: "includes name, alias, address...",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests",
      },
      // ... more categories
    ],
  },
  // ... more sections
} as const;
```

### **coverage-areas.ts** (Geographic Coverage)

- **Purpose**: Defines geographic coverage areas and validation
- **Features**:
  - San Diego county boundaries
  - Coverage validation functions
  - Distance calculations
  - Out-of-area search detection

### **features.ts** (Feature Flags)

- **Purpose**: Environment-based feature toggling
- **Features**:
  - Development vs production features
  - A/B testing configurations
  - Gradual rollout management
  - Environment-specific behaviors

### **intel.ts** (Community Intel Configuration)

- **Purpose**: Configuration for community intel posts
- **Features**:
  - Intel post tag definitions
  - Confidence scoring systems
  - Expiry rules and timeframes
  - Tag-specific configurations

**Intel Configuration:**

```typescript
export const INTEL_TAGS = {
  waves: {
    label: "Waves",
    description: "Current wave conditions",
    icon: "🌊",
    color: "blue",
    priority: 1,
    defaultExpiry: 6, // hours
    requiresConfirmation: false,
  },
  // ... more tags
} as const;

export const getConfidenceLevel = (confirmations: number) => {
  if (confirmations >= 3) return "high";
  if (confirmations >= 1) return "medium";
  return "low";
};
```

### **map-presets.ts** (Map Display Configuration)

- **Purpose**: Standardized map display configurations
- **Features**:
  - Responsive map sizing presets
  - Use case-specific configurations
  - Consistent map appearances
  - Performance-optimized settings

**Map Preset System:**

```typescript
export const MAP_IMAGE_PRESETS = {
  BEACH_CARD_SMALL: {
    width: 300,
    height: 200,
    zoom: 13,
  },
  BEACH_CARD_LIST: {
    width: 400,
    height: 250,
    zoom: 14,
  },
  BEACH_DETAIL_HERO: {
    width: 800,
    height: 400,
    zoom: 15,
  },
  SESSION_CARD: {
    width: 350,
    height: 200,
    zoom: 14,
  },
} as const;

export function getMapImageOptions(
  presetOrOptions: MapImagePreset | MapImageOptions
): MapImageOptions {
  if (typeof presetOrOptions === "string") {
    return MAP_IMAGE_PRESETS[presetOrOptions];
  }
  return presetOrOptions;
}
```

### **session-form-constants.ts** (Form Configuration)

- **Purpose**: Session form configuration and validation
- **Features**:
  - Form mode configurations
  - Rating descriptions and scales
  - Step definitions and flows
  - Validation rules and messages

**Form Configuration:**

```typescript
export type SessionFormMode = "plan" | "log";

export const FORM_SECTIONS = {
  datetime: {
    plan: {
      title: "When do you want to surf?",
      description: "Plan your upcoming session",
    },
    log: {
      title: "When did you surf?",
      description: "Record your completed session",
    },
  },
  // ... more sections
} as const;

export const RATING_DESCRIPTIONS = {
  wave_quality: {
    1: "Poor - Messy, unsurfable conditions",
    2: "Fair - Rideable but not great",
    3: "Good - Solid, fun waves",
    4: "Very Good - Excellent conditions",
    5: "Epic - Perfect waves, unforgettable session",
  },
  // ... more rating types
} as const;
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Tree Shaking Support**

```typescript
// Named exports for optimal tree shaking
export const ANIMATION_VARIANTS = {
  /* ... */
};
export const DURATIONS = {
  /* ... */
};

// Avoid default exports for better bundling
// export default { variants, durations }; // ❌ Avoid this
```

### **Lazy Loading for Large Datasets**

```typescript
// Large content objects with lazy imports
export const getLargeContentSection = async (section: string) => {
  const { content } = await import(`./content-sections/${section}`);
  return content;
};
```

### **Const Assertions for Type Safety**

```typescript
// Use const assertions for immutable objects
export const CONFIG = {
  setting: "value",
  number: 42,
} as const; // Ensures readonly and literal types
```

## 🔧 **USAGE PATTERNS**

### **Animation Integration**

```typescript
import { ANIMATION_VARIANTS, DURATIONS } from "@/lib/constants/animations";

function AnimatedComponent() {
  return (
    <motion.div
      {...ANIMATION_VARIANTS.fadeUpSlow}
      transition={{
        ...ANIMATION_VARIANTS.fadeUpSlow.transition,
        duration: DURATIONS.slow,
      }}
    >
      Content
    </motion.div>
  );
}
```

### **Content Management**

```typescript
import { ABOUT_CONTENT } from "@/lib/constants/content";

function AboutPage() {
  return (
    <div>
      <h1>{ABOUT_CONTENT.hero.title}</h1>
      <p>{ABOUT_CONTENT.hero.subtitle}</p>
      {ABOUT_CONTENT.problem.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}
```

### **Geographic Validation**

```typescript
// ⚠️ DEPRECATED EXAMPLE - DO NOT USE FOR NEW CODE
// Use the beaches table directly instead of beachCoordinates dictionary
import { beachCoordinates } from "@/lib/constants/beach-coordinates";
import { isWithinSanDiegoCoverage } from "@/lib/constants/coverage-areas";

function validateBeachLocation(beachName: string) {
  const coords = beachCoordinates[beachName.toLowerCase()];
  if (!coords) return { valid: false, reason: "Beach not found" };

  const inCoverage = isWithinSanDiegoCoverage(coords.lat, coords.lng);
  return { valid: inCoverage, coords };
}
```

### **Feature Flag Usage**

```typescript
import { FEATURE_FLAGS } from "@/lib/constants/features";

function ConditionalFeature() {
  if (!FEATURE_FLAGS.NEW_SESSION_PLANNER) {
    return <LegacyComponent />;
  }

  return <NewSessionPlanner />;
}
```

## 🧪 **TESTING STRATEGIES**

### **Constant Validation Testing**

- Verify all coordinate values are valid
- Test API configuration completeness
- Validate content structure integrity
- Check feature flag consistency

### **Integration Testing**

- Test constant usage in components
- Verify map preset functionality
- Test animation variant applications
- Validate content rendering

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Dynamic content management system
- User-customizable map presets
- Advanced feature flag system
- Internationalization support
- Theme customization constants

### **Performance Improvements**

- Content delivery optimization
- Dynamic constant loading
- Memory usage optimization
- Bundle size reduction

## 🏆 **BEST PRACTICES**

### **Constant Definition Guidelines**

1. **Immutability**: Use `as const` for immutable objects
2. **Type Safety**: Leverage TypeScript for compile-time validation
3. **Organization**: Group related constants logically
4. **Naming**: Use descriptive, consistent naming conventions
5. **Documentation**: Include JSDoc comments for complex configurations

### **Maintenance Guidelines**

1. **Centralization**: Keep related constants together
2. **Versioning**: Update version comments when constants change
3. **Validation**: Include validation functions where appropriate
4. **Testing**: Maintain test coverage for critical constants
5. **Performance**: Consider bundle impact of large constant objects

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive constant management  
**Next Review**: After internationalization implementation
