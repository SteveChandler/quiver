# Components Directory Architecture

## Overview

The `/components` directory implements a comprehensive, scalable component system for the Quiver surf community platform. Built on React + TypeScript with Radix UI primitives and Tailwind CSS, it follows modern design patterns including DRY principles, composition patterns, and a robust design system.

> Deprecation Notice: Direct Supabase queries in client components are deprecated. Use the centralized data gateway instead:
>
> ```ts
> import { data } from "@/lib/data/client";
> // Example
> const beaches = await data.beaches.getAll();
> ```
>
> For server-side operations, use server actions or add API routes and call them via the gateway.

## Architecture Principles

### **Component Design Patterns**

#### **Composition Over Inheritance**

- Components are composed of smaller, reusable parts
- Higher-order components (HOCs) for cross-cutting concerns
- Render prop patterns for flexible data sharing
- Compound component patterns for complex UI groups

#### **Props Interface Standardization**

```typescript
// Standard interface pattern
interface ComponentProps {
  // Required props first
  data: DataType;
  onAction: (param: Type) => void;

  // Optional configuration
  variant?: "default" | "compact" | "detailed";
  size?: "sm" | "md" | "lg";

  // Display options
  loading?: boolean;
  error?: string | null;
  className?: string;

  // Behavioral flags
  disabled?: boolean;
  autoRefresh?: boolean;

  // Legacy support (when needed)
  legacy_prop_support?: boolean;
}
```

#### **TypeScript Excellence**

- Generic interfaces for reusable form components
- Strict type safety with proper inference
- Zod schema integration for runtime validation
- Variant props using `class-variance-authority`

#### **Coordinate Naming Conventions**

**CRITICAL**: Coordinate naming must be consistent to prevent mapping bugs.

**Standard Naming**:
```typescript
// CORRECT: lat, lon, latitude, longitude
// INCORRECT: lng (do not use in new code)
```

**Database to Component Mapping**:
```typescript
// Database schema (beaches table)
interface Beach {
  center_lat: number;  // Database field
  center_lng: number;  // Database field (PostGIS legacy)
}

// Component props (use full names)
interface BeachIntelSectionProps {
  latitude: number;   // Full name for clarity
  longitude: number;  // Full name for clarity (NOT lng)
}

// CORRECT mapping pattern - Beach has lat/lon columns
<BeachIntelSection
  latitude={beach.lat}   // Beach.lat from database
  longitude={beach.lon}  // Beach.lon from database (NOT lng!)
  beachId={beach.id}
/>
```

**API Parameters** (use short names):
```typescript
// API call parameters
const params = {
  lat: beach.lat,   // Short form - direct from Beach
  lon: beach.lon,   // Short form (NOT lng!)
  radius: 5,
};
```

**Validation Required**:
```typescript
import { validateCoordinates } from '@/lib/coordinate-validation';

// Development warnings
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    validateCoordinates(latitude, longitude, `Component: ${name}`);
  }
}, [latitude, longitude, name]);
```

**Common Pitfalls**:
1. Using `lng` instead of `lon`
2. Assuming `beach.latitude` exists (use `beach.lat` instead)
3. Swapping latitude and longitude values
4. Not validating coordinates before API calls

**See**: [COORDINATE_CONVENTIONS.md](/docs/COORDINATE_CONVENTIONS.md) for comprehensive guide.


---

## Directory Structure & Component Domains

### **Root Level Components** - Global Utilities

#### Core Application Components

- **`app-header.tsx`** - Main navigation header with auth state
- **`beach-search.tsx`** - Comprehensive beach discovery with forecasting
- **`beach-detail.tsx`** - Beach information aggregation wrapper
- **`profile-view.tsx`** - User profile display and management
- **`page-tracker.tsx`** - Authenticated page view tracking (see below)

#### Form & Data Entry

- **`add-board-dialog.tsx`** - Surfboard creation modal with validation
- **`edit-profile-form.tsx`** - User profile editing with standardized field schema
- **`edit-profile-modal.tsx`** - Modal wrapper for profile editing

#### Content Display

- **`beach-card.tsx`** - Beach information cards with forecast previews
- **`board-card.tsx`** - Surfboard display cards
- **`session-card.tsx`** - Session activity cards with social features
- **`user-avatar.tsx`** - Consistent user avatar display
- **`user-stats.tsx`** - User statistics and analytics display
- **`home-beach-selector.tsx`** - Beach selection dropdown for home beach preference

#### Interactive Features

- **`favorite-button.tsx`** - Beach favoriting with state management
- **`comments-modal.tsx`** - Session commenting interface
- **`session-comments.tsx`** - Comment thread management

#### Tracking & Analytics

##### **PageTracker** (Page View Tracking)

- **Location**: `components/page-tracker.tsx`
- **Purpose**: Tracks page view events for authenticated users
- **Features**:
  - Fires `page_view` events to `/api/events` on navigation
  - Maps pathnames to human-readable page names
  - Generates per-browser-session IDs for session grouping
  - Skips duplicate events for the same path plus safe attribution tuple
  - Adds launch campaign metadata for landing, plans, blog index, and blog posts
  - Supports authenticated and anonymous tracking through `useTrackEvent`

**Integration:**

```typescript
// In providers.tsx or root layout
import { PageTracker } from '@/components/page-tracker';

function Providers({ children }) {
  return (
    <AuthProvider>
      <PageTracker />
      {children}
    </AuthProvider>
  );
}
```

**Page Name Mapping:**

| Pathname Pattern | Page Name |
|-----------------|-----------|
| `/home`, `/dashboard` | `home` |
| `/beach/*` | `beach_detail` |
| `/map` | `map` |
| `/profile/*` | `profile` |
| `/session/*` | `session` |
| `/plans` | `plans` |
| `/blog` | `blog_index` |
| `/blog/*` | `blog_post` |
| `/onboarding/*` | `onboarding` |
| `/` | `landing` |

**Event Payload:**

```typescript
{
  eventType: 'page_view',
  metadata: {
    page: 'beach_detail',
    referrer: '/home',
    session_id: 'uuid-v4',
  }
}
```

**Privacy Considerations:**
- Respects `allow_implicit_tracking` profile setting
- Rate limited: 60 requests/minute per user
- Caches denials only; allowed consent is rechecked before each recorded event
- Authenticated PostHog consent is revalidated when the tab becomes visible or focused, with capture disabled while the owner-only lookup is pending
- Initial auth resolution remains fail-closed, while later sign-in/sign-up loading transitions preserve the resolved tracking decision so outcome events are not dropped

---

### **`/auth`** - Authentication System

#### Core Authentication Components

- **`sign-in-form.tsx`** - Traditional sign-in form with dual authentication methods
  - Google OAuth with "Continue with Google" button
  - Email/password authentication
  - Redirect URL preservation through OAuth flow
  - Loading states and error handling for both methods
- **`sign-up-form.tsx`** - User registration form with dual authentication methods
  - Google OAuth with "Continue with Google" button
  - Email/password registration with display name
  - Email verification modal for traditional sign-up
  - Consistent UX with sign-in form

#### When to Use Each Pattern

**Public pages** (no auth required):

- Discovery and acquisition pages (`/map`, `/beach/[slug]`, `/forecast`)
- SEO-important pages where you want to show value first
- Use `PublicContentGate` for soft content gating (teaser → sign-up prompt)

**Traditional Protected Routes** for:

- User-specific content (profiles, journals, settings)
- Pages with no preview value
- Admin/dashboard areas
- Example: `/profile`, `/journal`, `/discover`

#### Patterns

- Form validation with react-hook-form + Zod
- Error handling and loading states
- Secure credential handling
- OAuth integration with Google and Email Magic Links
- Preview-based authentication for growth optimization

---

### **`/beach`** - Beach Data Management

#### Components

- **`beach-review-form.tsx`** - 5-category beach rating system
- **`beach-review-summary.tsx`** - Aggregate review statistics
- **`beach-reviews-list.tsx`** - Review display with moderation

#### Features

- **Multi-category Rating System**: Wave quality, crowd density, parking, accessibility, overall
- **Rich Review Interface**: Title, content, visit date, photo support
- **Real-time Updates**: Live review aggregation and statistics

---

### **`/beach-detail`** - Beach Information Display

#### Components

- **`beach-header.tsx`** - Beach name and basic info display
- **`beach-hero.tsx`** - Hero section with map integration
- **`beach-quick-actions.tsx`** - Fast action buttons (plan, log, favorite)
- **`cams-section.tsx`** - Live camera feed with multi-format support (iframe, HLS, video)
- **`hls-video-player.tsx`** - HLS stream playback via hls.js (Chrome/Firefox) or native (Safari)
- **`conditions-ticker.tsx`** (`components/conditions/`) - Reusable at-a-glance conditions strip (waves, swell, wind, water temp, tide)

#### Architecture

- Modular sections for flexible layout composition
- Consistent data flow patterns
- Responsive design with mobile optimization
- Integration with forecast and social systems
- HLS live cam playback with CORS proxy for Surfline streams (see `app/api/ARCHITECTURE.md` for proxy details)
- Camera URL classification via `buildCamEmbed()` in `lib/media/cam-embed.ts`
- Code-split: `HLSVideoPlayer` loaded via `next/dynamic` (SSR disabled), hls.js loaded via dynamic `import()`

---

### **`/buoy`** - Oceanographic Data Display

#### Components

- **`buoy-card.tsx`** - NOAA buoy data display cards
- **`measurement-display.tsx`** - Individual measurement components
- **`status-indicators.tsx`** - Data freshness and quality indicators
- **`tides-display.tsx`** - Tide timing and height displays
- **`index.ts`** - Barrel exports for clean imports

#### Features

- **Real-time Data Integration**: NOAA NDBC buoy network
- **Comprehensive Measurements**: Temperature, wind, waves, pressure, tides
- **Quality Indicators**: Data freshness, source reliability, connection status
- **Responsive Design**: Compact, default, and detailed view modes

---

### **`/city`** - City-Level Surf Destination Pages

#### Components

- **`city-map-view.tsx`** - Full-width interactive map with beach list
- **`quick-actions-bar.tsx`** - Horizontal navigation row with quick links
- **`session-timing-modules.tsx`** - Three-card tactical timing advice grid
- **`about-accordion.tsx`** - Collapsible editorial content section
- **`guides-by-intent-grid.tsx`** - 2x2 grid of intent-based beach guides
- **`planning-checklist.tsx`** - Actionable session planning checklist

#### Features

- **Editorial-First Design**: Rich storytelling about city surf culture
- **Interactive Beach Discovery**: Map + list integration with navigation
- **Tactical Surf Intelligence**: Session timing, wind, tide, marine layer advice
- **Intent-Based Navigation**: Filter beaches by goals (beginner, less-crowded, tide-dependent)
- **Actionable Planning**: Quick links and checklists for preparation

#### Architecture

For detailed component specifications, data flow, and integration patterns, see [`/components/city/ARCHITECTURE.md`](/components/city/ARCHITECTURE.md).

---

### **`/forecast`** - Weather & Surf Forecasting

#### Core Forecast Components

- **`forecast-display.tsx`** - Primary forecast visualization
- **`forecast-display-with-transparency.tsx`** - Enhanced transparency features
- **`forecast-table.tsx`** - Unified tabular forecast component with standard/simplified variants

#### Transparency & Data Quality

- **`forecast-data-source-indicator.tsx`** - Data source transparency
- **`forecast-fallback-messaging.tsx`** - Fallback data explanation
- **`confidence-score-explanation.tsx`** - Confidence scoring system
- **`forecast-accuracy-card.tsx`** - Historical accuracy tracking

#### Specialized Components

- **`tide-chart-recharts.tsx`** - Professional tide visualization
- **`forecast-feedback-form.tsx`** - User accuracy feedback system
- **`session-forecast-comparison.tsx`** - Forecast vs actual comparison

#### Architecture Features

- **Multi-source Integration**: NOAA WaveWatch III, CO-OPS, NDBC
- **Transparency Framework**: Clear data source indication
- **Confidence Scoring**: Multi-factor accuracy assessment
- **Mobile Optimization**: Touch-friendly, responsive design
- **Accessibility**: WCAG compliant with screen reader support

---

### **`/home-screen`** - Dashboard Interface

#### Components

- **`index.tsx`** - Main dashboard orchestrator with single vertical feed layout
- **`bottom-nav.tsx`** - Fixed mobile bottom navigation (md:hidden)
- **`greeting-section.tsx`** - Time-aware personalized greeting
- **`hero-recommendation.tsx`** - Top surf recommendation card with orange accents
- **`primary-actions.tsx`** - "I'm at the beach" / "Plan Weekend" CTA buttons
- **`top-spots-carousel.tsx`** - Horizontal carousel of additional spots
- **`compact-spot-card.tsx`** - Card component for carousel spots
- **`use-home-data.ts`** - Centralized data management hook

#### Personalization Components

- **`first-session-cta.tsx`** - Activation card for zero-session users
  - Shows "I Just Surfed" CTA button
  - Routes to `/sessions/new?mode=log&quick=true`
  - Replaces personalization progress card for new users
- **`personalization-progress.tsx`** - Gradient progress card showing personalization journey
  - Three stages: Getting Started (0 sessions) → Learning (1-4) → Personalized (5+)
  - Auto-hides when `activeLayers >= 3` and `confidence > 0.8`
  - Dismissible with 7-day cooldown via `safe-storage`
  - Props: `status: PersonalizationStatus | null`

#### Layout Architecture

Single vertical feed with dark gradient header section:

```
HomeScreen (Container)
+-- Dark Gradient Header (from-[#0f172a] to-[#1e293b])
|   +-- GreetingSection (white/translucent text)
|   +-- HeroRecommendation (orange score badge #f97316)
|   +-- PrimaryActions (translucent buttons)
+-- Content Section (default background)
|   +-- TopSpotsCarousel
|   +-- CoastPulse (dark bg #1e1e1e, vertical timeline)
|   +-- ProfileStrength
+-- BottomNav (mobile-only, fixed, orange active state)
```

#### Design Tokens

- Header gradient: `bg-gradient-to-b from-[#0f172a] to-[#1e293b]`
- Primary accent: `#f97316` (orange)
- Coast Pulse background: `#1e1e1e`
- Translucent elements: `bg-white/10`, `border-white/20`
- Muted text: `text-white/80`

#### Features

- **Single Vertical Feed**: No tabs, continuous scroll experience
- **Dark Theme Header**: High-contrast visual impact
- **Discovery-Based Personalization**: User location and preference driven
- **Mobile Bottom Navigation**: Safe area handling, 44px touch targets
- **Real-time Updates**: Live coast conditions via CoastPulse

For detailed documentation, see [`/components/home-screen/ARCHITECTURE.md`](/components/home-screen/ARCHITECTURE.md).

---

### **`/intel`** - Community Intelligence System

#### Core Components

- **`intel-dashboard.tsx`** - Main intelligence interface
- **`intel-feed.tsx`** - Community intelligence feed
- **`intel-map.tsx`** - Map-based intelligence display
- **`beach-intel-section.tsx`** - Beach-specific intelligence

#### Management Components

- **`intel-post-form.tsx`** - Intelligence creation form
- **`intel-post-modal.tsx`** - Post detail modal
- **`intel-filters.tsx`** - Filtering and search interface
- **`index.ts`** - Barrel exports

#### Intelligence Types

- **Parking**: Availability and restrictions
- **Hazards**: Safety warnings and conditions
- **Crowd**: Real-time crowd density
- **Conditions**: Live surf conditions
- **Access**: Beach access information
- **Other**: General community updates

#### Features

- **Geospatial Intelligence**: Location-based posts
- **Community Confirmation**: Crowd-sourced verification
- **Auto-expiring Posts**: Smart expiration (1-7 days)
- **Rich Media**: Photo support with compression

---

### **`/journal`** - Session Journaling & Analytics

#### Components

- **`journal-view.tsx`** - Main journaling interface
- **`calendar-heatmap.tsx`** - Visual session activity calendar
- **`session-analytics.tsx`** - Statistical analysis dashboard
- **`session-annotation-modal.tsx`** - Session detail editing

#### Features

- **Visual Analytics**: Heatmaps, trends, statistics
- **Export Capabilities**: PDF generation with charts
- **Privacy Controls**: Session visibility management
- **Rich Annotations**: Photos, notes, condition tracking

---

### **`/landing-page`** - Marketing & Conversion

#### Core Sections

- **`hero-section.tsx`** - Video background with CTA
- **`features-section.tsx`** - Product feature highlights
- **`forecast-section.tsx`** - Live forecast demonstration
- **`cta-section.tsx`** - Conversion call-to-action
- **`footer-section.tsx`** - Site footer with links

#### Marketing Components

- **`personalization-showcase.tsx`** - Personalization marketing section
  - Shows generic vs personalized forecast comparison
  - Targets anonymous visitors
  - Demonstrates value of creating account and logging sessions

#### Utility Components

- **`section-wrapper.tsx`** - Consistent section layout
- **`feature-card.tsx`** - Individual feature display
- **`index.ts`** - Clean component exports

#### Architecture

- **Performance Optimized**: Lazy loading, progressive enhancement
- **SEO Optimized**: Structured data, meta tags
- **Conversion Focused**: A/B testing ready, analytics integration
- **Responsive**: Mobile-first design principles

---

### **`/gamification`** - User Engagement & Progression System

#### Core Components

- **`user-xp-card.tsx`** - User experience points display with level progression
- **`badge-gallery.tsx`** - Badge collection and achievement display
- **`badge-icon.tsx`** - Individual badge rendering with rarity styling
- **`xp-toast-system.tsx`** - XP gain notifications and feedback
- **`gamification-test-page.tsx`** - Testing interface for gamification features

#### Features

- **XP System**: Points awarded for session completion, streaks, community engagement
- **Badge System**: Achievement unlocks with common/rare/epic/legendary tiers
- **Level Progression**: Visual progression indicators and next level goals
- **Social Recognition**: Public badge display and leaderboard integration
- **Streak Tracking**: Daily/weekly/monthly session streaks with bonus XP

#### XP Sources

- Session completion (base XP)
- First session milestone
- Streak achievements (3, 7, 30 days)
- Social sharing and community contributions
- Beach reviews and helpful content

---

### **`/home`** - Home Beach Personalization

#### Components

- **`HomeBeachSelector.tsx`** - Beach selection dropdown (moved to root)
- **`HomeBeachTile.tsx`** - Profile stats tile showing home beach (in `/profile`)

#### Integration Points

- **Profile Page**: Tile displays current home beach or "-" if unset
- **Edit Profile**: Selector allows changing home beach preference
- **Forecast Tab**: Uses home beach for personalized forecasts

#### Data Flow

- **Canonical Field**: `profiles.home_beach_id` (FK to beaches.id)
- **API Endpoint**: `/api/me/profile` returns `{ id, home_beach_id }`
- **Update Action**: `updateProfile({ home_beach_id })` via profile actions
- **Cache Invalidation**: `revalidateTag("profile")` after updates

---

### **`/map`** - Interactive Mapping

#### Core Components

- **`interactive-map.tsx`** - Mapbox-powered beach discovery
- **`map-content.tsx`** - Map interface orchestrator
- **`map-toolbar.tsx`** - Single `/map` toolbar with search, location, swell toggle, and region/filter dropdown

#### Interface Components

- **`map-header.tsx`** - Search and view controls
- **`nearby-beach-scroll.tsx`** - Horizontal beach browser

#### Features

- **Interactive Mapping**: Mapbox GL JS integration
- **Real-time Search**: Instant beach filtering
- **Geolocation**: User location detection and fallbacks
- **Forecast Integration**: Live conditions on map markers

---

### **`/media`** - Media Management

#### Components

- **`session-photo-gallery.tsx`** - Photo gallery with lightbox
- **`session-photo-upload.tsx`** - Multi-photo upload with compression
- **`storage-usage-widget.tsx`** - Storage quota management

#### Features

- **Image Compression**: Automatic size optimization
- **Storage Management**: Quota tracking and warnings
- **Progressive Upload**: Background processing
- **Metadata Handling**: EXIF data preservation

---

### **`/profile`** - User Profile Management

#### Components

- **`basic-profile-form.tsx`** - Core profile information editing
- **`profile-edit-form.tsx`** - Comprehensive profile editor
- **`boards-manager.tsx`** - Surfboard collection management
- **`profile-preferences.tsx`** - User preferences and settings
- **`recent-sessions-list.tsx`** - Session history display
- **`user-comments.tsx`** - User's comment history
- **`HomeBeachTile.tsx`** - Home beach preference display tile

#### Data Schema Consistency

- **Instagram Field Standardization**: All profile components use consistent `instagram` field name
  - **Database Schema**: `profiles.instagram` (VARCHAR)
  - **Frontend Forms**: Form validation and display use `instagram` field
  - **Server Actions**: Direct field mapping without transformation
  - **Type Safety**: `Profile` interface uses `instagram: string | null`
  - **Test Coverage**: Comprehensive test suite validates field consistency

#### Features

- **Avatar Management**: Image upload and cropping with Supabase Storage
- **Equipment Tracking**: Surfboard collection with detailed specifications
- **Privacy Controls**: Granular visibility settings for profile information
- **Social Integration**: Following, followers, activity streams
- **Home Beach Integration**: Seamless beach preference management
- **Form Validation**: Real-time validation with Zod schemas

---

### **`/recommendations`** - Personalized Recommendation System

#### Components

- **`match-score-education.tsx`** - One-time educational popover explaining match scores
  - Wraps `PersonalizedBadge` component
  - Auto-dismisses after 8 seconds
  - Uses `safe-storage` for one-time display tracking
  - Shows tooltip explaining how match scores work

#### Features

- **Progressive Disclosure**: Educates users about personalization features
- **One-time Display**: Never shown again after initial view
- **Non-intrusive**: Auto-dismisses, doesn't block interaction

---

### **`/session-forms`** - Session Management

#### Core Form Components

- **`SessionForm.tsx`** - Main session creation orchestrator
- **`SessionFormWrapper.tsx`** - Form state management wrapper
- **`SessionFormHeader.tsx`** - Mode-specific headers

#### Form Sections

- **`LocationStep.tsx`** - Beach selection
- **`DateTimeStep.tsx`** - Session timing
- **`EquipmentStep.tsx`** - Gear selection
- **`ConditionsSection.tsx`** - Environmental conditions
- **`GoalsSection.tsx`** - Session objectives
- **`NotesSection.tsx`** - Additional information
- **`PhotoSelectionSection.tsx`** - Media upload

#### Quick Log Components

- **`QuickLocationTimeStep.tsx`** - Streamlined beach + time selection step
  - Combines location and time in single step
  - Used in quick log mode (`?mode=log&quick=true`)
- **`QuickRatingStep.tsx`** - Streamlined rating + notes step
  - Star rating with optional notes
  - Final step in quick log wizard

#### Advanced Features

- **`GearSuggestionsSection.tsx`** - AI-powered board recommendations
- **`OptimalTimesSection.tsx`** - Forecast-based timing optimization
- **`GroupInvitationsSection.tsx`** - Social session planning

#### UI Components

- **`FormNavigation.tsx`** - Step navigation controls
- **`ProgressIndicator.tsx`** - Visual progress tracking

#### Architecture

- **Multi-step Wizard**: Progressive form completion
- **Quick Log Mode**: 2-step streamlined flow for rapid session logging
- **State Management**: Centralized form state
- **Validation**: Real-time field validation
- **Mode Support**: Plan vs Log session workflows

---

### **`/skeletons`** - Loading States

#### Components

- **`beach-card-skeleton.tsx`** - Beach card loading placeholders
- **`buoy-conditions-skeleton.tsx`** - Weather data loading states
- **`map-skeleton.tsx`** - Map interface loading skeleton

#### Patterns

- **Consistent Dimensions**: Match actual component sizes
- **Animated Loading**: Subtle shimmer effects
- **Accessibility**: Screen reader friendly loading states

---

### **`/social`** - Social Features

#### Core Components

- **`activity-feed.tsx`** - Real-time activity stream
- **`unified-community-feed.tsx`** - Combined social feed
- **`follow-button.tsx`** - User following functionality
- **`followers-modal.tsx`** - Follower/following lists
- **`user-profile-modal.tsx`** - Quick profile preview
- **`user-social-stats.tsx`** - Social statistics display

#### Features

- **Activity Tracking**: Likes, comments, follows, sessions
- **Real-time Updates**: Live activity feeds
- **Social Connections**: Follow/unfollow system
- **Privacy Respect**: User-controlled visibility

---

### **`/ui`** - Design System Foundation

#### Form Components

- **`form.tsx`** - React Hook Form integration
- **`form-layout.tsx`** - Standardized form layouts
- **`form-fields.tsx`** - Reusable form field components
- **`input.tsx`** - Base input component
- **`textarea.tsx`** - Multi-line text input
- **`select.tsx`** - Dropdown selection
- **`checkbox.tsx`** - Boolean input
- **`radio-group.tsx`** - Single selection groups
- **`switch.tsx`** - Toggle controls
- **`slider.tsx`** - Range inputs

#### Layout & Navigation

- **`card.tsx`** - Content containers
- **`dialog.tsx`** - Modal dialogs
- **`sheet.tsx`** - Slide-out panels
- **`drawer.tsx`** - Mobile-optimized drawers
- **`tabs.tsx`** - Tabbed interfaces
- **`accordion.tsx`** - Collapsible content
- **`sidebar.tsx`** - Navigation sidebars
- **`navigation-menu.tsx`** - Main navigation
- **`breadcrumb.tsx`** - Breadcrumb navigation
- **`pagination.tsx`** - Page navigation

#### Interactive Elements

- **`button.tsx`** - Primary interaction component
- **`badge.tsx`** - Status and category indicators
- **`alert.tsx`** - User notifications
- **`alert-dialog.tsx`** - Confirmation dialogs
- **`tooltip.tsx`** - Contextual help
- **`popover.tsx`** - Floating content
- **`hover-card.tsx`** - Hover interactions
- **`context-menu.tsx`** - Right-click menus
- **`dropdown-menu.tsx`** - Action menus
- **`menubar.tsx`** - Menu bar interface
- **`command.tsx`** - Command palette

#### Data Display

- **`table.tsx`** - Tabular data display
- **`avatar.tsx`** - User avatars
- **`calendar.tsx`** - Date selection
- **`chart.tsx`** - Data visualization with Recharts
- **`progress.tsx`** - Progress indicators
- **`skeleton.tsx`** - Loading placeholders
- **`separator.tsx`** - Visual separators
- **`scroll-area.tsx`** - Custom scrollbars

#### Specialized Components

- **`star-rating.tsx`** - Rating display and input
- **`loading-spinner.tsx`** - Loading indicators
- **`loading-states.tsx`** - Comprehensive loading patterns
- **`forecast-preview.tsx`** - Weather preview cards
- **`forecast-data-transparency.tsx`** - Data source indicators
- **`tide-direction.tsx`** - Tide flow indicators
- **`wave-period-display.tsx`** - Wave period visualization

#### Utility Components

- **`no-ssr.tsx`** - Client-side only rendering
- **`use-mobile.tsx`** - Mobile detection hook
- **`use-toast.ts`** - Toast notification system
- **`toast.tsx`** - Toast message components
- **`toaster.tsx`** - Toast manager
- **`sonner.tsx`** - Enhanced toast system

---

## Design System Architecture

### **Design Token System**

#### Color Palette

```typescript
// Brand colors
--ocean-blue: #0077B6;
--sandy-beige: #F4F1E8;
--dark-grey: #2D3748;

// Semantic colors
--primary: ocean-blue;
--secondary: sandy-beige;
--accent: #FF7F11;
--destructive: #DC2626;
--success: #16A34A;
--warning: #D97706;
```

#### Typography Scale

- **Font Families**: DM Sans (body), Space Grotesk (headings), Space Mono (monospace)
- **Scale**: Modular scale with consistent line heights
- **Responsive**: Fluid typography with clamp() functions

#### Spacing System

- **Base Unit**: 4px (0.25rem)
- **Scale**: 0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64
- **Component Spacing**: Consistent internal spacing patterns

### **Component Composition Patterns**

#### Compound Components

```typescript
// Example: Card composition
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
```

#### Render Props Pattern

```typescript
// Example: Data fetching with render props
<DataFetcher url="/api/beaches">
  {({ data, loading, error }) =>
    loading ? (
      <Skeleton />
    ) : error ? (
      <ErrorDisplay error={error} />
    ) : (
      <BeachList beaches={data} />
    )
  }
</DataFetcher>
```

#### Higher-Order Components

```typescript
// Example: Authentication wrapper
const withAuth = (Component) => (props) => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  if (!user) return <SignInPrompt />;
  return <Component {...props} user={user} />;
};
```

### **Responsive Design System**

#### Breakpoints

```typescript
const breakpoints = {
  sm: "640px", // Mobile landscape
  md: "768px", // Tablet portrait
  lg: "1024px", // Tablet landscape / Desktop
  xl: "1280px", // Large desktop
  "2xl": "1536px", // Extra large desktop
};
```

#### Mobile-First Approach

- All components designed mobile-first
- Progressive enhancement for larger screens
- Touch-friendly interactions (44px minimum touch targets)
- Optimized for thumb navigation

#### Container Patterns

```typescript
// Responsive container classes
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

// Responsive grid
.grid-responsive {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## Performance Architecture

### **Optimization Strategies**

#### Code Splitting

- Lazy loading for non-critical components
- Route-based code splitting
- Component-level splitting for large features

#### Memoization Patterns

```typescript
// Component memoization
const ExpensiveComponent = React.memo(
  ({ data, onAction }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Custom comparison logic
    return prevProps.data.id === nextProps.data.id;
  }
);

// Hook memoization
const useExpensiveCalculation = (data) => {
  return useMemo(() => {
    return expensiveCalculation(data);
  }, [data]);
};
```

#### Virtual Scrolling

- Implemented for long lists (session feeds, beach lists)
- Windowing for large data sets
- Intersection Observer for lazy loading

### **Data Flow Patterns**

#### State Management

- React Context for global state
- Local state for component-specific data
- React Query for server state management
- Zustand for complex client state

#### Data Fetching

```typescript
// Standardized data fetching pattern
const useDataFetcher = (fetchFn) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
};
```

## Accessibility Architecture

### **WCAG 2.1 AA Compliance**

#### Semantic HTML

- Proper heading hierarchy (h1-h6)
- Meaningful landmarks and regions
- Form labels and descriptions
- Button vs link semantics

#### ARIA Implementation

```typescript
// Example: Enhanced button component
<Button
  aria-label="Add beach to favorites"
  aria-pressed={isFavorited}
  aria-describedby="favorite-help-text"
>
  <Heart className={isFavorited ? "fill-red-500" : ""} />
  <span className="sr-only">
    {isFavorited ? "Remove from" : "Add to"} favorites
  </span>
</Button>
```

#### Keyboard Navigation

- Tab order management
- Focus trap for modals
- Escape key handling
- Arrow key navigation for complex components

#### Screen Reader Support

- Descriptive alt text for images
- Live regions for dynamic content
- Skip links for navigation
- Status announcements

### **Focus Management**

```typescript
// Focus management hook
const useFocusManagement = () => {
  const restoreFocus = useRef(null);

  const saveFocus = () => {
    restoreFocus.current = document.activeElement;
  };

  const restoreFocusElement = () => {
    if (restoreFocus.current?.focus) {
      restoreFocus.current.focus();
    }
  };

  return { saveFocus, restoreFocusElement };
};
```

## Testing Architecture

### **Testing Strategy**

#### Unit Testing

- Jest + React Testing Library
- Component behavior testing
- Hook testing with renderHook
- Utility function testing

#### Integration Testing

- Component integration tests
- API integration testing
- Form workflow testing
- Navigation flow testing

#### Visual Testing

- Storybook for component showcase
- Chromatic for visual regression
- Accessibility testing with axe-core

#### E2E Testing

- Playwright for critical user journeys
- Cross-browser testing
- Mobile device testing
- Performance testing

### **Testing Patterns**

```typescript
// Example: Component test pattern
describe("BeachCard", () => {
  it("renders beach information correctly", () => {
    render(
      <BeachCard
        name="Ocean Beach"
        distance="2.1 miles"
        rating={4.5}
        reviewCount={127}
        imageUrl="/beach.jpg"
      />
    );

    expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
    expect(screen.getByText("2.1 miles")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Ocean Beach");
  });

  it("handles click events", async () => {
    const onViewDetails = jest.fn();

    render(
      <BeachCard
        name="Ocean Beach"
        onViewDetails={onViewDetails}
        // ... other props
      />
    );

    await user.click(screen.getByRole("button", { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledWith();
  });
});
```

## Development Guidelines

### **Component Development**

#### File Structure

```
ComponentName/
+-- index.ts           // Barrel export
+-- ComponentName.tsx  // Main component
+-- ComponentName.test.tsx
+-- ComponentName.stories.tsx
+-- types.ts          // Component-specific types
+-- hooks.ts          // Component-specific hooks
```

#### Naming Conventions

- **PascalCase** for components and interfaces
- **camelCase** for functions and variables
- **kebab-case** for file names
- **UPPER_SNAKE_CASE** for constants

#### Props Design

```typescript
// Good: Clear, typed props interface
interface BeachCardProps {
  // Required props (no defaults)
  beach: Beach;
  onViewDetails: (beach: Beach) => void;

  // Optional props with defaults
  variant?: "compact" | "detailed";
  showForecast?: boolean;
  className?: string;

  // Behavioral props
  loading?: boolean;
  disabled?: boolean;
}

// Component with proper defaults
export function BeachCard({
  beach,
  onViewDetails,
  variant = "compact",
  showForecast = true,
  className,
  loading = false,
  disabled = false,
}: BeachCardProps) {
  // Implementation
}
```

### **Import/Export Patterns**

#### Barrel Exports

```typescript
// components/forecast/index.ts
export { ForecastDisplay } from "./forecast-display";
export { TideChart } from "./tide-chart-recharts";
export { ConfidenceScoreExplanation } from "./confidence-score-explanation";
export type { ForecastDisplayProps } from "./forecast-display";
```

#### Clean Imports

```typescript
// Good: Clean barrel imports
import {
  ForecastDisplay,
  TideChart,
  ConfidenceScoreExplanation,
} from "@/components/forecast";

// Good: Specific UI imports
import { Button, Card, CardContent } from "@/components/ui";
```

## Future Roadmap

### **Planned Enhancements**

#### Component Library Package

- Extractable design system package
- Standalone component documentation
- NPM package for reuse across projects

#### Advanced Patterns

- Compound component refactoring
- Headless component implementations
- Advanced TypeScript patterns (branded types, template literals)

#### Performance Improvements

- Bundle size optimization
- Tree shaking improvements
- Runtime performance monitoring

#### Accessibility Enhancements

- Advanced ARIA patterns
- Voice control support
- High contrast mode
- Reduced motion preferences

### **Component Priorities**

#### High Priority

1. **Enhanced Form System** - More complex validation patterns
2. **Advanced Data Visualization** - Interactive charts and graphs
3. **Real-time Collaboration** - Live session planning
4. **Mobile App Components** - React Native compatibility

#### Medium Priority

1. **Animation System** - Consistent motion design
2. **Theme System** - Dark mode and custom themes
3. **Internationalization** - Multi-language support
4. **Component Documentation** - Interactive documentation site

## Conclusion

The `/components` directory represents a mature, scalable component architecture that balances flexibility with consistency. It provides a solid foundation for the Quiver platform while remaining extensible for future requirements. The design system ensures visual consistency, the TypeScript integration provides type safety, and the testing strategy ensures reliability across the platform.

The architecture supports both rapid development and long-term maintainability, making it suitable for a growing development team and evolving product requirements.
