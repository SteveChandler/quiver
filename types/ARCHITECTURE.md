# Types Architecture Documentation

## Overview

The `types/` directory contains comprehensive TypeScript type definitions for the Quiver surf app, providing type safety across the entire application stack. These types ensure data consistency, enable excellent developer experience, and support the app's evolution from a simple surf tracker to a comprehensive social surf platform.

## Architecture Structure

```
types/
├── api/                      # API request/response contract types (route payloads, RPC helpers)
├── database.ts              # Database schema types and interfaces
├── forecast.ts              # Forecast system types and domain models
└── ARCHITECTURE.md          # This documentation file
```

## Core Type Categories

### **1. Database Types (database.ts)**

**Purpose**: Complete TypeScript representation of the Supabase database schema.

#### **User & Profile Types**

```typescript
export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  // Social features
  followers_count: number;
  following_count: number;
  // Preferences
  notification_session_reminders: boolean;
  notification_community_replies: boolean;
  // Profile data
  bio: string | null;
  location: string | null;
  experience_level: string | null;
  home_beach_id: string | null; // User's preferred home beach for forecasts
  // Timestamps
  created_at: string;
  updated_at: string;
};
```

#### **Session Management Types**

```typescript
export type SessionStatus = "planned" | "completed" | "cancelled";

export type Session = {
  id: string;
  user_id: string; // Sole ownership field
  beach_id?: string;
  board_id?: string;
  status: SessionStatus;
  arrival_time: string; // Combined timestamp for date/time
  // Optional UI fields now persisted in DB
  rating?: number;
  description?: string;
  image_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  // Legacy fields for UI compatibility
  session_date?: string;
  start_time?: string;
  end_time?: string;
};
```

#### **Social Features Types**

```typescript
export type Comment = {
  id: string;
  session_id: string;
  parent_comment: string | null; // Threading support
  user_id: string;
  content: string;
  created_at: string;
};

export type SessionLike = {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
};

export type UserFollow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};
```

#### **Community Features Types**

```typescript
export type IntelPostTag =
  | "parking"
  | "hazard"
  | "crowd"
  | "conditions"
  | "access"
  | "other";

export type IntelPost = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  confirmations_count: number;
  is_active: boolean;
  expires_at?: string | null;
};
```

#### **Analytics & Insights Types**

```typescript
export type SessionAnalytics = {
  userId: string;
  totalSessions: number;
  completedSessions: number;
  totalHours: number;
  averageRating: number;
  favoriteBeach: string | null;
  monthlyStats: Array<{
    month: string;
    sessionCount: number;
    averageRating: number;
    totalHours: number;
  }>;
  // Detailed analytics
  waveHeightTrend: Array<{
    date: string;
    averageWaveHeight: number;
    sessionCount: number;
  }>;
};
```

#### **Gamification Types**

```typescript
export type XPSource =
  | "session_complete"
  | "first_session"
  | "streak_3_days"
  | "streak_7_days"
  | "streak_30_days"
  | "social_share"
  | "beach_review"
  | "community_help";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlock_criteria: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_displayed: boolean;
};

export type UserXP = {
  user_id: string;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  last_updated: string;
};

export type XPTransaction = {
  id: string;
  user_id: string;
  source: XPSource;
  amount: number;
  description: string;
  created_at: string;
};
```

### **2. Forecast Types (forecast.ts)**

**Purpose**: Domain-driven design for the forecast system with type safety and business logic.

#### **Brand Types for Type Safety**

```typescript
// Branded types prevent mixing incompatible values
export type ConfidenceScore = number & { readonly __brand: "ConfidenceScore" };
export type BeachId = string & { readonly __brand: "BeachId" };
export type Latitude = number & { readonly __brand: "Latitude" };
export type Longitude = number & { readonly __brand: "Longitude" };

// Factory functions with validation
export const createConfidenceScore = (score: number): ConfidenceScore => {
  if (score < 0 || score > 100)
    throw new Error("Confidence score must be 0-100");
  return score as ConfidenceScore;
};
```

#### **Core Domain Types**

```typescript
export interface Location {
  readonly latitude: Latitude;
  readonly longitude: Longitude;
}

export interface WeatherConditions {
  readonly airTemperature: string;
  readonly weatherCondition: string;
  readonly windSpeed: string;
  readonly windDirection: string;
}

export interface WaveConditions {
  readonly waveHeight: string | null;
  readonly wavePeriod: string | null;
  readonly waveDirection: string | null;
  readonly primarySwell: SwellComponent | null;
  readonly secondarySwell: SwellComponent | null;
  readonly windWave: SwellComponent | null;
}

export interface TideConditions {
  readonly status: TideStatus;
  readonly currentHeight: string;
  readonly nextTide: NextTideInfo;
}
```

#### **Data Source Integration Types**

```typescript
export interface ForecastDataSource {
  readonly name: string;
  fetchData(location: Location, timeRange: TimeRange): Promise<any>;
  isAvailable(): boolean;
  getReliabilityScore(): ConfidenceScore;
}

export interface CDIPBuoyData {
  stationId: string;
  stationName: string;
  data: CDIPDataPoint[];
  dataSource: "CDIP";
  lastUpdated: string;
}

export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  forecast_at: string; // Canonical timestamptz column (Feb 2026)
  // Deprecated: forecast_date and forecast_time (text) remain in DB but
  // should not be used in new code. Use forecast_at instead.
  forecast_date: string;
  forecast_time: string;
  // Wave data
  wave_height: string | null;
  swell_1_height: string | null;
  swell_2_height: string | null;
  wind_wave_height: string | null;
  // Metadata
  confidence_score: number;
  data_source: "NOAA_NWS" | "CDIP" | "FALLBACK";
}
```

## Type Safety Patterns

### **Branded Types**

**Purpose**: Prevent mixing incompatible values of the same primitive type.

```typescript
// Without branded types (dangerous)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  // Easy to mix up parameters
}

// With branded types (safe)
function calculateDistance(
  lat1: Latitude,
  lng1: Longitude,
  lat2: Latitude,
  lng2: Longitude
) {
  // Type system prevents parameter confusion
}
```

**Benefits**:

- Compile-time validation
- Self-documenting code
- Prevents common bugs
- IDE autocomplete accuracy

### **Readonly Interfaces**

**Purpose**: Immutable data structures for predictable state management.

```typescript
export interface Location {
  readonly latitude: Latitude;
  readonly longitude: Longitude;
}

// Prevents accidental mutations
location.latitude = newLat; // Compile error
```

**Benefits**:

- Prevents accidental state mutations
- Enables better optimizations
- Clearer data flow
- Functional programming support

### **Union Types for State Management**

**Purpose**: Type-safe state representation with exhaustive checking.

```typescript
export type SessionStatus = "planned" | "completed" | "cancelled";
export type TideStatus =
  | "Rising"
  | "Falling"
  | "High Slack"
  | "Low Slack"
  | "Unknown";

// Exhaustive switch checking
function handleSessionStatus(status: SessionStatus) {
  switch (status) {
    case "planned":
      return "Planned";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    // TypeScript ensures all cases handled
  }
}
```

## Database Integration

### **Supabase Type Generation**

**Database Schema Mapping**:

```typescript
export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: Omit<Session, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Session, "id" | "created_at" | "updated_at">>;
      };
      // Full database schema typing
    };
    Enums: {
      session_status: SessionStatus;
      intel_post_tag: IntelPostTag;
    };
  };
};
```

**Benefits**:

- Full type safety from database to UI
- Automatic schema validation
- IDE autocomplete for database queries
- Compile-time database schema checks

### **Type-Safe Database Operations**

```typescript
// Type-safe Supabase queries
const { data, error } = await supabase
  .from("sessions")
  .select("*")
  .eq("user_id", userId)
  .returns<Session[]>(); // Full type inference
```

## Mobile-First Type Design

### **Performance-Oriented Types**

**Efficient Data Structures**:

```typescript
// Optimized for mobile data transfer
export type SessionPreview = Pick<
  Session,
  "id" | "beach_name" | "arrival_time" | "status" | "rating"
>;

// Lazy loading support
export type SessionWithDetails = Session & {
  beach: Beach;
  board: Board | null;
  user: Profile;
};
```

### **Offline-First Types**

**Sync-Ready Data Structures**:

```typescript
export type SyncableEntity = {
  id: string;
  created_at: string;
  updated_at: string;
  // Offline sync metadata
  local_id?: string;
  sync_status?: "pending" | "synced" | "conflict";
  last_sync?: string;
};
```

## Testing Integration

### **Type-Safe Test Data**

**Mock Data Types**:

```typescript
// Test data factories with full type safety
export const createMockSession = (overrides?: Partial<Session>): Session => ({
  id: "test-session-id",
  user_id: "test-user-id", // Sole ownership field
  status: "planned",
  arrival_time: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});
```

### **API Contract Testing**

**Response Type Validation**:

```typescript
// Ensure API responses match expected types
const response = await fetch("/api/sessions");
const sessions: Session[] = await response.json();
// TypeScript validates response structure
```

## Development Workflow

### **Type Evolution Strategy**

**Adding New Types**:

1. Define core domain types first
2. Add database integration types
3. Create derived/computed types
4. Update test utilities
5. Document usage patterns

**Type Migration Patterns**:

```typescript
// Deprecated type with migration path
/** @deprecated Use SessionWithDetails instead */
export type LegacySession = {
  // Old structure
};

// New type with compatibility
export type SessionWithDetails = Session & {
  // New structure with backward compatibility
};
```

### **Type Safety Validation**

**Compile-Time Checks**:

```typescript
// Utility types for validation
type RequiredFields<T> = {
  [K in keyof T]-?: T[K];
};

type SessionRequired = RequiredFields<Session>;
// Ensures all fields are defined
```

## Performance Considerations

### **Type Optimization**

**Bundle Size Impact**:

- Types have zero runtime impact
- Tree shaking removes unused types
- Brand types compile away completely

**Development Performance**:

- Fast TypeScript compilation
- Efficient IDE type checking
- Incremental type checking support

### **Memory Efficiency**

**Type-Driven Optimization**:

```typescript
// Memory-efficient types for large datasets
export type SessionSummary = Pick<
  Session,
  "id" | "beach_name" | "arrival_time" | "rating"
>;

// Streaming-friendly types
export type SessionStream = AsyncIterable<SessionSummary>;
```

## Implicit Preferences System

### **Overview**

The implicit preferences system tracks user behavior to learn surfing preferences without explicit input. Types are defined in `types/implicit-preferences.ts`.

### **Event Types**

```typescript
type ImplicitEventType =
  // Implicit preference learning events
  | 'beach_view'
  | 'discovery_click'
  | 'discovery_skip'
  | 'forecast_check'
  | 'location_update'
  // Engagement tracking events
  | 'page_view'
  | 'forecast_interaction'
  | 'session_action'
  | 'profile_update'
  | 'onboarding_step'
  | 'cta_click';
```

### **Event Weights**

Events are weighted for preference learning:

| Event | Weight | Purpose |
|-------|--------|---------|
| `location_update` | 10.0 | Strong signal of home location |
| `discovery_click` | 3.0 | Active interest in a beach |
| `forecast_check` | 2.5 | Engagement with specific beach |
| `beach_view` | 0.5 | Passive interest |
| `discovery_skip` | -1.0 | Negative signal |
| Engagement events | 0 | Tracking only, no learning |

### **Metadata Interfaces**

Each event type has specific metadata:

```typescript
// Page view tracking
interface PageViewMetadata {
  page: string;           // Page identifier
  referrer?: string;      // Previous page
  session_id?: string;    // Session grouping
}

// Onboarding funnel
interface OnboardingStepMetadata {
  step: number;           // Step number (1-4)
  step_name: string;      // Human-readable name
  completed?: boolean;    // Completion status
}

// Location signals
interface LocationUpdateMetadata {
  lat: number;
  lon: number;
  accuracy_m?: number;
}
```

### **Learned Preferences**

Computed from aggregated events:

```typescript
interface UserImplicitPreferences {
  user_id: string;
  inferred_wave_min_ft: number | null;
  inferred_wave_max_ft: number | null;
  break_type_weights: BreakTypeWeights;
  time_slot_weights: TimeSlotWeights;
  location_centroid_lat: number | null;
  location_centroid_lon: number | null;
  typical_travel_radius_miles: number | null;
  top_engaged_beach_ids: string[];
  confidence: number;
  event_count: number;
  last_computed_at: string;
}
```

### **LRU Cache Types**

Used by tracking services for permission caching:

```typescript
// In lib/services/tracking-cache.ts
interface TrackingPermissionCache {
  allowed: boolean;
  expires: number;  // Unix timestamp
}

// Configuration
const MAX_CACHE_ENTRIES = 5000;  // LRU eviction threshold
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes
```

### **Type Guards**

Runtime validation utilities:

```typescript
// Validate event type
function isValidEventType(type: string): type is ImplicitEventType;

// Metadata type guards
function isBeachViewMetadata(m: EventMetadata): m is BeachViewMetadata;
function isLocationUpdateMetadata(m: EventMetadata): m is LocationUpdateMetadata;
function isOnboardingStepMetadata(m: EventMetadata): m is OnboardingStepMetadata;
```

---

## Growth-Focused Type Design

### **Social Features Support**

**Community Types**:

- Activity feed aggregation types
- Social interaction tracking types
- Community content moderation types
- Viral sharing mechanism types

### **Analytics & Insights**

**Data Science Ready Types**:

```typescript
export type SessionAnalytics = {
  // User behavior analytics
  userId: string;
  totalSessions: number;
  retentionMetrics: {
    day1: number;
    day7: number;
    day30: number;
  };
  engagementScore: number;
};
```

### **Scalability Considerations**

**Future-Proof Types**:

- Extensible interface design
- Version-compatible type unions
- Backward-compatible type evolution
- Plugin-friendly type architecture

## Security & Privacy

### **Data Protection Types**

**Privacy-Aware Types**:

```typescript
export type PublicProfile = Omit<
  Profile,
  "email" | "phone_number" | "notification_preferences"
>;

export type SessionPrivacyLevel = "public" | "friends" | "private";
```

### **Input Validation Types**

**Security-First Validation**:

```typescript
// Input sanitization types
export type SanitizedInput<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K];
} & { __sanitized: true };
```

## Quality Checklist

Before adding new types:

- [ ] **Type Safety**: Full TypeScript strict mode compliance
- [ ] **Performance**: Zero runtime overhead
- [ ] **Documentation**: Clear JSDoc comments and examples
- [ ] **Testing**: Type-safe test utilities created
- [ ] **Database Integration**: Supabase schema compatibility
- [ ] **Mobile Optimization**: Efficient data structures
- [ ] **Security**: Privacy-aware type design
- [ ] **Future-Proof**: Extensible and version-compatible

---

**Last Updated**: February 2026
**Status**: Production-ready comprehensive type system
**Next Review**: After major feature additions or database schema changes

**Key Principles**: Type safety, performance, extensibility, and developer experience that supports the app's growth from simple surf tracking to comprehensive social platform with full compile-time guarantees.
