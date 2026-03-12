# Quiver Screen & State Planner

> **The Bridge Between PRD and Implementation**
>
> This document defines all UI states for every screen in Quiver, ensuring consistent, polished experiences across Zero, Loading, Error, and Ideal states.

---

## Design System Quick Reference

### Semantic Tokens
- **Primary**: Ocean Blue `--primary` (H 196 S 100% L 47%), `#0077B6`
- **Accent**: Sunset Orange `#FF7F11`
- **Background**: `--background`, Sandy Beige `#F5F5DC` for warmth
- **Text**: `--foreground` (charcoal), `muted-foreground` (gray-600)
- **Destructive**: `--destructive` (mid-tone red)
- **Success**: `green-600`
- **Warning**: `yellow-600` / `amber-500`

### Typography
- **H1**: Space Grotesk Bold, `text-5xl` → `text-7xl`
- **H2**: Space Grotesk Bold, `text-4xl` → `text-5xl`
- **H3/Card**: Space Grotesk Medium, `text-2xl`
- **Body**: DM Sans, `text-base` → `text-xl`
- **Min size**: 14px

### Spacing
- Base unit: 4px
- Section padding: `py-20`
- Content gutters: `px-4` → `px-6` → `px-8`
- Card padding: `p-6`

### Motion (from `lib/constants/animations.ts`)
- **Fast**: 0.3s (hover, press)
- **Standard**: 0.6s (fade-in)
- **Slow**: 0.8s (stagger entrance)
- **Hero**: 1s (landing page)

### Components
- **Loading**: `<CenteredLoadingSpinner>`, `<Skeleton>`, domain-specific skeletons
- **Error**: `<Alert variant="destructive">` with retry action
- **Empty**: Centered icon (48-64px gray-400) + heading + description + CTA

---

## Feature 1: Personalized Surf Forecasting

### 1.1 Home Screen - Forecast Dashboard

**Screen Purpose**: Primary landing for authenticated users showing personalized forecast for home beach.

#### Zero State (First Time User, No Home Beach Set)
```
┌─────────────────────────────────────────┐
│  [Nav Bar]                              │
├─────────────────────────────────────────┤
│                                         │
│     🏖️ (MapPin icon, 64px, gray-400)   │
│                                         │
│     Set Your Home Beach                 │
│     (text-xl font-semibold gray-900)    │
│                                         │
│     Get personalized forecasts by       │
│     selecting your favorite spot        │
│     (text-sm gray-600)                  │
│                                         │
│     [🔍 Find a Beach] (Primary CTA)     │
│                                         │
├─────────────────────────────────────────┤
│  "Nearby Beaches" Section               │
│  (Shows 3 nearest beaches as fallback)  │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Icon: `MapPin` from Lucide, `h-16 w-16 text-gray-400`
- Heading: `text-xl font-semibold text-gray-900`
- Description: `text-sm text-gray-600 mt-2 max-w-xs text-center`
- CTA: Primary button with Search icon, `bg-primary text-primary-foreground px-6 py-3 rounded-lg`
- Container: `flex flex-col items-center justify-center py-12`

#### Loading State
```
┌─────────────────────────────────────────┐
│  [Nav Bar]                              │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │  ████████████ (beach name)        │  │
│  │  ████ (location)                  │  │
│  │                                   │  │
│  │  ┌─────────┐ ┌─────────┐         │  │
│  │  │ ░░░░░░░ │ │ ░░░░░░░ │         │  │
│  │  │ ░░░░░░░ │ │ ░░░░░░░ │         │  │
│  │  │ ░░░░░░░ │ │ ░░░░░░░ │         │  │
│  │  └─────────┘ └─────────┘         │  │
│  │  (Wave + Wind skeleton cards)    │  │
│  │                                   │  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  │  (Tide chart skeleton)           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ░░░░░░░░░░░░░ (Best Time skeleton)     │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Use `<ForecastLoadingSkeleton>` component
- Skeleton pulses: `animate-pulse bg-gray-200 rounded`
- Beach name skeleton: `h-6 w-48`
- Location skeleton: `h-4 w-24 mt-2`
- Stat cards: `h-24 w-full rounded-lg`
- Chart area: `h-32 w-full rounded-lg`

#### Error State
```
┌─────────────────────────────────────────┐
│  [Nav Bar]                              │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │  Scripps Beach                    │  │
│  │  La Jolla, CA                     │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ⚠️ (AlertTriangle, red)     │  │  │
│  │  │                             │  │  │
│  │  │ Forecast Unavailable        │  │  │
│  │  │ (text-lg font-semibold)     │  │  │
│  │  │                             │  │  │
│  │  │ We couldn't load the latest │  │  │
│  │  │ forecast data. This might   │  │  │
│  │  │ be temporary.               │  │  │
│  │  │                             │  │  │
│  │  │ [↻ Try Again] [View Basic]  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Error Variants**:
1. **Network Error**: "Couldn't connect to forecast service"
2. **Rate Limited**: "Too many requests. Try again in a few minutes" (Clock icon, yellow)
3. **No Coverage**: "Forecast data not available for this beach" (MapPin icon, gray)
4. **Stale Data**: Shows basic data with warning banner

**Design Specs**:
- Use `<ForecastErrorStateCard>` component
- Error container: `bg-red-50 border border-red-200 rounded-lg p-6`
- Icon: `AlertTriangle h-12 w-12 text-red-500`
- Heading: `text-lg font-semibold text-red-900`
- Description: `text-sm text-red-700 mt-2`
- Actions: Primary "Try Again" + Ghost "View Basic Data"

#### Ideal State (Populated)
```
┌─────────────────────────────────────────┐
│  [Nav Bar]                              │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │  🏠 Scripps Beach                 │  │
│  │  La Jolla, CA                     │  │
│  │                                   │  │
│  │  ┌─────────────┬─────────────┐   │  │
│  │  │ 🌊 WAVES   │ 💨 WIND     │   │  │
│  │  │ 3-5 ft    │ 8 mph SW    │   │  │
│  │  │ 14s @ NW  │ Offshore    │   │  │
│  │  │ ⭐ Great! │ ✓ Good      │   │  │
│  │  └─────────────┴─────────────┘   │  │
│  │                                   │  │
│  │  🌡️ 65°F Water | 72°F Air        │  │
│  │                                   │  │
│  │  ───────── Tide Chart ─────────  │  │
│  │  [Visual tide graph for 24hrs]   │  │
│  │                                   │  │
│  │  ✨ BEST TIME TO SURF             │  │
│  │  Today 6:30 AM - 9:00 AM         │  │
│  │  Score: 85/100                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📅 12-Day Forecast →                   │
│  [Horizontal scroll of daily cards]     │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Beach header: `text-2xl font-bold` with home icon badge
- Stat cards: `bg-white rounded-lg p-4 shadow-sm border border-gray-100`
- Wave height: `text-3xl font-bold text-primary`
- Quality badge: `<Badge variant="blue">` for good, `variant="secondary"` for fair
- Best time highlight: `bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg`
- Score display: Circular progress or large number with `/100`

---

### 1.2 Beach Detail - Forecast Tab

**Screen Purpose**: Detailed forecast view for any beach.

#### Zero State
N/A - Beach pages always have data from database (name, location, etc.)

#### Loading State
```
┌─────────────────────────────────────────┐
│  ← Back    Scripps Beach    [♡] [↗]    │
├─────────────────────────────────────────┤
│  [Beach Hero Image]                     │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├─────────────────────────────────────────┤
│  [Forecast] [Intel] [Info]              │
├─────────────────────────────────────────┤
│  Current Conditions                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │ ░░░░░░░ │  │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │ ░░░░░░░ │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  Hourly Forecast                        │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────┘
```

#### Error State
Same pattern as Home Screen forecast error, displayed within the Forecast tab content area.

#### Ideal State
```
┌─────────────────────────────────────────┐
│  ← Back    Scripps Beach    [♡] [↗]    │
├─────────────────────────────────────────┤
│  [Beach Hero Image with gradient]       │
│  "Perfect morning glass expected"       │
├─────────────────────────────────────────┤
│  [Forecast✓] [Intel] [Info]             │
├─────────────────────────────────────────┤
│  Current (Updated 5 min ago)            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 🌊 3-5ft│ │ 💨 8mph │ │ 🌊 Mid  │  │
│  │ 14s NW  │ │ SW Off  │ │ Rising  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  Your Score: 85/100 ★★★★☆              │
│  "Great for intermediate surfers"       │
│                                         │
│  ───────── Hourly ─────────            │
│  6AM  7AM  8AM  9AM  10AM  11AM →       │
│  [Visual timeline with conditions]      │
│                                         │
│  ───────── Tide Chart ─────────        │
│  [Interactive 24hr tide graph]          │
│                                         │
│  ───────── 7-Day Outlook ─────────     │
│  [Daily forecast cards]                 │
└─────────────────────────────────────────┘
```

---

## Feature 2: Session Logging (Surf Journal)

### 2.1 Session List / Journal View

#### Zero State (No Sessions Logged)
```
┌─────────────────────────────────────────┐
│  My Sessions              [+ Log]       │
├─────────────────────────────────────────┤
│                                         │
│     📔 (BookOpen icon, 64px, gray-400) │
│                                         │
│     No Sessions Yet                     │
│     (text-xl font-semibold gray-900)    │
│                                         │
│     Start tracking your surf journey    │
│     by logging your first session       │
│     (text-sm gray-600 max-w-xs)         │
│                                         │
│     [🏄 Log Your First Session]         │
│     (Primary CTA)                       │
│                                         │
│     ────────────────────────────        │
│                                         │
│     💡 Pro tip: Add photos to capture   │
│     memories and track progression      │
│     (text-xs gray-500 italic)           │
│                                         │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Icon: `BookOpen` or `Calendar` from Lucide
- Pro tip: `bg-blue-50 border border-blue-100 rounded-lg p-4 mt-6`
- Tip icon: `Lightbulb h-4 w-4 text-blue-500`

#### Loading State
```
┌─────────────────────────────────────────┐
│  My Sessions              [+ Log]       │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ ░░░░░░ ░░░░░░░░░░░░░░░          │  │
│  │ ░░░░░░░░░ ░░░░                  │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ ░░░░░░ ░░░░░░░░░░░░░░░          │  │
│  │ ░░░░░░░░░ ░░░░                  │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ ░░░░░░ ░░░░░░░░░░░░░░░          │  │
│  │ ░░░░░░░░░ ░░░░                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Use `<ListItemSkeleton count={5}>` or custom session card skeleton
- Each skeleton: `h-24 rounded-lg animate-pulse bg-gray-100`
- Stagger animation: 0.1s delay per item

#### Error State
```
┌─────────────────────────────────────────┐
│  My Sessions              [+ Log]       │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │  ⚠️ Couldn't Load Sessions        │  │
│  │                                   │  │
│  │  There was a problem loading      │  │
│  │  your sessions. Please try again. │  │
│  │                                   │  │
│  │  [↻ Retry]                        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  My Sessions (23)         [+ Log]       │
├─────────────────────────────────────────┤
│  December 2025                          │
│  ┌───────────────────────────────────┐  │
│  │ 📷 Scripps Beach                  │  │
│  │ Dec 8 • 2hr 15min • ★★★★☆        │  │
│  │ "Perfect morning glass, got..."   │  │
│  │ 🏄 Shortboard • 🌊 4-5ft          │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Blacks Beach                      │  │
│  │ Dec 5 • 1hr 45min • ★★★★★        │  │
│  │ 🏄 Fish • 🌊 3-4ft                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  November 2025                          │
│  ┌───────────────────────────────────┐  │
│  │ 📷📷📷 Trestles                   │  │
│  │ Nov 28 • 3hr • ★★★★★              │  │
│  │ "Thanksgiving dawn patrol..."     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Month headers: `text-sm font-semibold text-gray-500 uppercase tracking-wide`
- Session card: `bg-white rounded-lg p-4 shadow-sm border border-gray-100`
- Photo indicator: Small thumbnails or camera icons with count
- Star rating: Filled stars in `text-yellow-400`, empty in `text-gray-300`
- Board tag: `<Badge variant="outline">` with board icon
- Clickable: `hover:shadow-md transition-shadow cursor-pointer`

---

### 2.2 Session Wizard (Multi-Step)

#### Step 1: Beach Selection

**Zero State** (Search field empty):
```
┌─────────────────────────────────────────┐
│  ← Log Session         Step 1 of 5      │
├─────────────────────────────────────────┤
│                                         │
│  Where did you surf?                    │
│  (text-xl font-semibold)                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search beaches...              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Recent Beaches                         │
│  ┌─────────────────────────────────┐   │
│  │ 🏖️ Scripps Beach               │   │
│  │ 🏖️ Blacks Beach                │   │
│  │ 🏖️ Windansea                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📍 Or use my location                  │
│                                         │
├─────────────────────────────────────────┤
│  [Back]                    [Next →]     │
└─────────────────────────────────────────┘
```

**Loading State** (Searching):
```
┌───────────────────────────────────────┐
│ 🔍 "scripps"              [×]         │
└───────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ○ Searching...                      │
│ (Spinner + "Finding beaches...")    │
└─────────────────────────────────────┘
```

**Error State** (Search failed):
```
┌─────────────────────────────────────┐
│ ⚠️ Search unavailable               │
│ Type the full beach name or         │
│ select from recent beaches          │
└─────────────────────────────────────┘
```

**Ideal State** (Search results):
```
┌───────────────────────────────────────┐
│ 🔍 "scripps"              [×]         │
└───────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ✓ Scripps Beach                     │
│   La Jolla, CA                      │
├─────────────────────────────────────┤
│   Scripps Pier                      │
│   La Jolla, CA                      │
└─────────────────────────────────────┘
```

#### Step 2: Date & Time

```
┌─────────────────────────────────────────┐
│  ← Log Session         Step 2 of 5      │
├─────────────────────────────────────────┤
│                                         │
│  When was your session?                 │
│                                         │
│  Date                                   │
│  ┌───────────────────────────────────┐  │
│  │ 📅 December 8, 2025               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Time                                   │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Start       │  │ End         │      │
│  │ 6:30 AM     │  │ 8:45 AM     │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  Duration: 2 hours 15 minutes           │
│  (Auto-calculated, green check)         │
│                                         │
├─────────────────────────────────────────┤
│  [← Back]                  [Next →]     │
└─────────────────────────────────────────┘
```

**Error State** (Invalid time range):
```
⚠️ End time must be after start time
(text-sm text-red-600 with AlertCircle icon)
```

#### Step 3: Conditions

```
┌─────────────────────────────────────────┐
│  ← Log Session         Step 3 of 5      │
├─────────────────────────────────────────┤
│                                         │
│  How were the conditions?               │
│                                         │
│  Wave Size                              │
│  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐  │
│  │ <2ft││2-3ft││3-4ft││4-5ft││ 5ft+│  │
│  └─────┘└─────┘└──✓──┘└─────┘└─────┘  │
│                                         │
│  Crowd Level                            │
│  😌 Empty ────●──────── 🤯 Packed       │
│           [Moderate]                    │
│                                         │
│  Wind Conditions                        │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │ Offshore││ Light   ││ Onshore │     │
│  │    ✓    ││         ││         │     │
│  └─────────┘└─────────┘└─────────┘     │
│                                         │
│  How would you rate this session?       │
│  ★ ★ ★ ★ ☆                              │
│                                         │
├─────────────────────────────────────────┤
│  [← Back]                  [Next →]     │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Segmented buttons: `<ToggleGroup>` from shadcn/ui
- Selected state: `bg-primary text-primary-foreground`
- Slider: Custom range input with emoji labels
- Star rating: Interactive, `text-yellow-400` filled, `text-gray-300` empty
- Touch targets: Minimum 44px height

#### Step 4: Board & Notes

```
┌─────────────────────────────────────────┐
│  ← Log Session         Step 4 of 5      │
├─────────────────────────────────────────┤
│                                         │
│  Which board did you ride?              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🏄 6'2" Shortboard        [✓]  │   │
│  │    Channel Islands              │   │
│  ├─────────────────────────────────┤   │
│  │ 🏄 5'8" Fish                   │   │
│  │    Lost Surfboards              │   │
│  ├─────────────────────────────────┤   │
│  │ + Add a board to your quiver    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Notes (optional)                       │
│  ┌───────────────────────────────────┐  │
│  │ Perfect morning glass. Got some  │  │
│  │ good waves on the inside...      │  │
│  │                                  │  │
│  │                                  │  │
│  │                         0/500    │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [← Back]                  [Next →]     │
└─────────────────────────────────────────┘
```

**Zero State** (No boards in quiver):
```
┌─────────────────────────────────────────┐
│  Which board did you ride?              │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     🏄 (Surfboard icon, gray)    │  │
│  │                                   │  │
│  │     No boards in your quiver     │  │
│  │                                   │  │
│  │     [+ Add Your First Board]     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Or skip for now →                      │
└─────────────────────────────────────────┘
```

#### Step 5: Photos & Review

```
┌─────────────────────────────────────────┐
│  ← Log Session         Step 5 of 5      │
├─────────────────────────────────────────┤
│                                         │
│  Add Photos (optional)                  │
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 📷  │ │ 📷  │ │ +   │ │     │      │
│  │[img]│ │[img]│ │ Add │ │     │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│  2 of 5 photos                          │
│                                         │
│  ─────────── Review ───────────         │
│                                         │
│  📍 Scripps Beach                       │
│  📅 Dec 8, 2025 • 6:30-8:45 AM         │
│  🌊 3-4 ft • Offshore • ★★★★☆          │
│  🏄 6'2" Shortboard                     │
│                                         │
├─────────────────────────────────────────┤
│  [← Back]           [✓ Save Session]    │
└─────────────────────────────────────────┘
```

**Loading State** (Uploading photos):
```
┌─────┐ ┌─────┐ ┌─────┐
│ ✓   │ │ ○   │ │ +   │
│[img]│ │ 45% │ │ Add │
└─────┘ └─────┘ └─────┘
Uploading photo 2 of 2...
```

**Error State** (Upload failed):
```
┌─────┐ ┌─────┐
│ ✓   │ │ ⚠️  │
│[img]│ │Retry│
└─────┘ └─────┘
Failed to upload. Tap to retry.
```

**Success State** (Session saved):
```
┌─────────────────────────────────────────┐
│                                         │
│     ✨ (Celebration animation)          │
│                                         │
│     Session Logged!                     │
│     +50 XP earned                       │
│                                         │
│     [📤 Share Session]                  │
│     [View in Journal]                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Feature 3: Beach Discovery

### 3.1 Beach Discovery List

#### Zero State (No search, location unavailable)
```
┌─────────────────────────────────────────┐
│  Discover Beaches         [🗺️ Map]     │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search beaches or locations... │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📍 Enable location for nearby spots    │
│  [Allow Location Access]                │
│                                         │
│  ─────────── Popular Spots ───────────  │
│                                         │
│  California                             │
│  ┌───────────────────────────────────┐  │
│  │ [img] Scripps Beach               │  │
│  │ La Jolla • Beach Break            │  │
│  │ ★ 4.5 (127 reviews)               │  │
│  └───────────────────────────────────┘  │
│  ... more beaches                       │
└─────────────────────────────────────────┘
```

#### Loading State
```
┌─────────────────────────────────────────┐
│  Discover Beaches         [🗺️ Map]     │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 🔍 "san diego"                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  │ ░░░░░░░░░░░░░░░               │   │
│  │ ░░░░░░░░░░░░░░░░░░            │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  │ ░░░░░░░░░░░░░░░               │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

#### Error State (Search failed)
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │     🔍 (Search icon, gray-400)   │  │
│  │                                   │  │
│  │     Search Unavailable            │  │
│  │     Please try again later        │  │
│  │                                   │  │
│  │     [↻ Retry]                     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Empty State (No results)
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │ 🔍 "xyzabc123"                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     🔍 (Search icon, gray-400)   │  │
│  │                                   │  │
│  │     No Surf Spots Found           │  │
│  │                                   │  │
│  │     Try a different search term   │  │
│  │     or browse by location         │  │
│  │                                   │  │
│  │     [Browse All Locations]        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  Discover Beaches         [🗺️ Map]     │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 🔍 "san diego"           [×]      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  12 beaches found                       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [📷 Beach img]                    │  │
│  │ Scripps Beach                     │  │
│  │ La Jolla • Beach Break            │  │
│  │ ★ 4.5 (127) • 🌊 3-4ft today     │  │
│  │ [Beginner Friendly] [Parking]     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [📷 Beach img]                    │  │
│  │ Blacks Beach                      │  │
│  │ La Jolla • Beach Break            │  │
│  │ ★ 4.8 (89) • 🌊 4-5ft today      │  │
│  │ [Advanced] [Nude Beach ⚠️]        │  │
│  └───────────────────────────────────┘  │
│  ...                                    │
└─────────────────────────────────────────┘
```

---

### 3.2 Interactive Map View

#### Loading State
```
┌─────────────────────────────────────────┐
│  [List] [Map ✓]           [Filter]      │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │                                   │  │
│  │         ○ Loading map...          │  │
│  │                                   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Use `<MapSkeleton>` with pulsing bg    │
└─────────────────────────────────────────┘
```

#### Error State (Map failed to load)
```
┌─────────────────────────────────────────┐
│                                         │
│     🗺️ (Map icon, gray-400)            │
│                                         │
│     Map Unavailable                     │
│                                         │
│     [↻ Reload Map] [View List]          │
│                                         │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  [List] [Map ✓]           [Filter]      │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │            MAP CANVAS             │  │
│  │                                   │  │
│  │   📍        📍                    │  │
│  │       📍          📍              │  │
│  │                                   │  │
│  │  📍    📍                📍      │  │
│  │                                   │  │
│  │                  📍               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Selected: Scripps Beach           │  │
│  │ 🌊 3-4ft • Score: 85/100          │  │
│  │ [View Details →]                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Feature 4: Community Intelligence (Local Intel)

### 4.1 Intel Feed (Beach Detail - Intel Tab)

#### Zero State (No intel for this beach)
```
┌─────────────────────────────────────────┐
│  [Forecast] [Intel ✓] [Info]            │
├─────────────────────────────────────────┤
│                                         │
│     💬 (MessageCircle icon, gray-400)  │
│                                         │
│     No Local Intel Yet                  │
│                                         │
│     Be the first to share what's        │
│     happening at this spot              │
│                                         │
│     [📝 Share Intel]                    │
│                                         │
└─────────────────────────────────────────┘
```

#### Loading State
```
┌─────────────────────────────────────────┐
│  [Forecast] [Intel ✓] [Info]            │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ ░░░░░ ░░░░░░░░░░░░               │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░        │  │
│  │ ░░░░ ░░░░░░░░                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ ░░░░░ ░░░░░░░░░░░░               │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Error State
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │ ⚠️ Couldn't load intel            │  │
│  │ [↻ Try Again]                     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  [Forecast] [Intel ✓] [Info]            │
├─────────────────────────────────────────┤
│  [+ Share Intel]              Filter ▼  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 👤 SurfDude42 • 2 hours ago       │  │
│  │                                   │  │
│  │ "Parking lot nearly full. Crowd   │  │
│  │ moderate on south peak. Clean     │  │
│  │ waist-high sets."                 │  │
│  │                                   │  │
│  │ [🅿️ Parking] [👥 Crowd]           │  │
│  │                                   │  │
│  │ 👍 12 confirmations               │  │
│  │ [👍 Confirm] [💬 Reply]           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 👤 WaveRider • 5 hours ago        │  │
│  │                                   │  │
│  │ "Dawn patrol was epic! Glass..."  │  │
│  │                                   │  │
│  │ [🌊 Conditions]                   │  │
│  │                                   │  │
│  │ 👍 8 confirmations                │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Intel card: `bg-white rounded-lg p-4 border border-gray-100`
- User avatar: `h-8 w-8 rounded-full`
- Category tags: `<Badge variant="outline">` with icons
- Timestamp: `text-xs text-gray-500`
- Confirmation count: `text-sm text-green-600 font-medium`

---

### 4.2 Post Intel Modal

```
┌─────────────────────────────────────────┐
│  ×                Share Intel           │
├─────────────────────────────────────────┤
│                                         │
│  📍 Scripps Beach                       │
│                                         │
│  What's happening?                      │
│  ┌───────────────────────────────────┐  │
│  │ Share current conditions,         │  │
│  │ parking, crowd level...           │  │
│  │                                   │  │
│  │                                   │  │
│  │                          0/280    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Categories (select all that apply)     │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │🌊 Waves ││👥 Crowd ││🅿️ Parking│     │
│  └────✓────┘└─────────┘└─────────┘     │
│  ┌─────────┐┌─────────┐                │
│  │🚧 Access││⚠️ Hazard │                │
│  └─────────┘└─────────┘                │
│                                         │
├─────────────────────────────────────────┤
│  [Cancel]              [Post Intel]     │
└─────────────────────────────────────────┘
```

**Loading State** (Submitting):
```
[Cancel]        [○ Posting...]
(Button disabled with spinner)
```

**Success State**:
```
Toast: "✓ Intel posted! +50 XP"
(Modal closes, feed refreshes)
```

**Error State**:
```
⚠️ Couldn't post intel. Please try again.
[Cancel]              [↻ Retry]
```

---

## Feature 5: Social Sharing

### 5.1 Share Card Generator

#### Zero State (No session selected)
N/A - Always accessed from a specific session

#### Loading State (Generating card)
```
┌─────────────────────────────────────────┐
│  ×                Create Share Card     │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │                                   │  │
│  │         ○ Generating...           │  │
│  │                                   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Design                                 │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                         │
│  Size                                   │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                         │
└─────────────────────────────────────────┘
```

#### Error State (Generation failed)
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │     ⚠️ Couldn't generate card     │  │
│  │                                   │  │
│  │     [↻ Try Again]                 │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  ×                Create Share Card     │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  [Generated Share Card Preview]   │  │
│  │                                   │  │
│  │  🏄 SURF SESSION                  │  │
│  │  Scripps Beach                    │  │
│  │  Dec 8, 2025                      │  │
│  │                                   │  │
│  │  🌊 3-4ft  💨 Offshore           │  │
│  │  ⏱️ 2h 15m  ★★★★☆               │  │
│  │                                   │  │
│  │  quiver.surf                      │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Design                                 │
│  [Photo✓] [Minimal] [Stats] [Wave]      │
│                                         │
│  Size                                   │
│  [1:1 ✓] [9:16] [16:9]                  │
│                                         │
├─────────────────────────────────────────┤
│  [📥 Download]    [📤 Share]            │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Preview container: `aspect-square bg-gray-100 rounded-lg overflow-hidden`
- Design selector: Toggle group with icons
- Size selector: Segmented control
- Share button: Primary CTA
- Download button: Secondary/outline

---

## Feature 6: Gamification & Progression

### 6.1 XP & Level Display (Profile)

#### Zero State (New user, 0 XP)
```
┌─────────────────────────────────────────┐
│  Your Progress                          │
├─────────────────────────────────────────┤
│                                         │
│  Level 1: Kook                          │
│  ═══════════════════════════════░░░░░  │
│  0 / 100 XP to Level 2                  │
│                                         │
│  ─────────── Get Started ───────────   │
│                                         │
│  🏄 Log your first session     +50 XP   │
│  📍 Set your home beach        +10 XP   │
│  🏄 Add a board to quiver      +30 XP   │
│                                         │
└─────────────────────────────────────────┘
```

#### Ideal State (Active user)
```
┌─────────────────────────────────────────┐
│  Your Progress                          │
├─────────────────────────────────────────┤
│                                         │
│  Level 5: Ripper                        │
│  ═══════════════════════════░░░░░░░░░  │
│  1,250 / 2,000 XP to Level 6            │
│                                         │
│  Recent XP                              │
│  • Logged session          +50 XP       │
│  • Posted intel            +50 XP       │
│  • Got 5 upvotes           +50 XP       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Badges (7 of 23)                       │
│  🏆 🌅 📸 🌊 🏄 📍 👥                   │
│  [View All Badges →]                    │
│                                         │
└─────────────────────────────────────────┘
```

**Design Specs**:
- Progress bar: `bg-gray-200 rounded-full h-3`, fill `bg-primary`
- Level name: `text-xl font-bold`
- XP text: `text-sm text-gray-600`
- Badges: Grid of emoji/icons, unlocked are full color, locked are grayscale
- Recent XP: List with right-aligned XP values in `text-green-600`

---

### 6.2 Badge Gallery

#### Loading State
```
┌─────────────────────────────────────────┐
│  ← Badges                               │
├─────────────────────────────────────────┤
│  ┌─────┐┌─────┐┌─────┐┌─────┐         │
│  │░░░░░││░░░░░││░░░░░││░░░░░│         │
│  │░░░░░││░░░░░││░░░░░││░░░░░│         │
│  └─────┘└─────┘└─────┘└─────┘         │
│  ┌─────┐┌─────┐┌─────┐┌─────┐         │
│  │░░░░░││░░░░░││░░░░░││░░░░░│         │
│  └─────┘└─────┘└─────┘└─────┘         │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  ← Badges                               │
├─────────────────────────────────────────┤
│  Unlocked (7)                           │
│  ┌─────┐┌─────┐┌─────┐┌─────┐         │
│  │ 🌅 ││ 📸 ││ 🌊 ││ 🏄 │         │
│  │Dawn ││Photo││Wave ││First│         │
│  │Ptrl ││Pro  ││Huntr││Sesh │         │
│  └─────┘└─────┘└─────┘└─────┘         │
│                                         │
│  Locked (16)                            │
│  ┌─────┐┌─────┐┌─────┐┌─────┐         │
│  │ 🔒 ││ 🔒 ││ 🔒 ││ 🔒 │         │
│  │???  ││???  ││???  ││???  │         │
│  └─────┘└─────┘└─────┘└─────┘         │
│                                         │
│  Tap a badge to see requirements        │
└─────────────────────────────────────────┘
```

**Badge Detail Modal**:
```
┌─────────────────────────────────────────┐
│           🌅                            │
│     Dawn Patrol                         │
│                                         │
│  "Log a session before 7 AM"            │
│                                         │
│  ✓ Unlocked Dec 5, 2025                 │
│                                         │
│  [Close]                                │
└─────────────────────────────────────────┘
```

---

## Feature 7: User Profile & Preferences

### 7.1 Profile View

#### Zero State (Profile incomplete)
```
┌─────────────────────────────────────────┐
│  My Profile              [✏️ Edit]      │
├─────────────────────────────────────────┤
│                                         │
│     [Default Avatar]                    │
│     (gray silhouette)                   │
│                                         │
│     SurfUser123                         │
│     Member since Dec 2025               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ⚠️ Complete your profile               │
│                                         │
│  Add info to get personalized           │
│  recommendations                        │
│                                         │
│  [ ] Set home beach                     │
│  [ ] Add experience level               │
│  [ ] Upload profile photo               │
│                                         │
│  [Complete Profile]                     │
│                                         │
└─────────────────────────────────────────┘
```

#### Loading State
```
┌─────────────────────────────────────────┐
│  My Profile              [✏️ Edit]      │
├─────────────────────────────────────────┤
│                                         │
│     ░░░░░ (avatar skeleton)             │
│                                         │
│     ░░░░░░░░░░░░░                       │
│     ░░░░░░░░░░░░░░░░░░░                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                         │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  My Profile              [✏️ Edit]      │
├─────────────────────────────────────────┤
│                                         │
│     [Profile Photo]                     │
│     (user's uploaded image)             │
│                                         │
│     WaveMaster_SD                       │
│     Intermediate • San Diego, CA        │
│     Member since Mar 2024               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Stats                                  │
│  23 Sessions | 12 Beaches | 127 XP     │
│                                         │
│  🏠 Home Beach: Scripps Beach           │
│                                         │
│  Preferences                            │
│  🌊 Medium waves • 🏖️ Beach breaks     │
│  👥 Moderate crowds                     │
│                                         │
│  My Quiver (3 boards)                   │
│  [🏄 6'2" Shortboard] [🏄 5'8" Fish]   │
│  [+ Add Board]                          │
│                                         │
└─────────────────────────────────────────┘
```

---

### 7.2 Onboarding Flow (6 Steps)

#### Step 1: Welcome
```
┌─────────────────────────────────────────┐
│                                         │
│     🌊                                  │
│                                         │
│  Welcome to Quiver!                     │
│  (text-3xl font-bold)                   │
│                                         │
│  Your personal surf companion           │
│  (text-lg text-gray-600)                │
│                                         │
│  Let's set up your profile to get       │
│  personalized forecasts and             │
│  recommendations.                       │
│                                         │
│  ○ ○ ○ ○ ○ ○ (progress dots)           │
│                                         │
│  [Get Started →]                        │
│                                         │
│  Skip for now                           │
│                                         │
└─────────────────────────────────────────┘
```

#### Step 2: Experience Level
```
┌─────────────────────────────────────────┐
│                                         │
│  What's your experience level?          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🏄 Beginner                       │  │
│  │ Just getting started, learning    │  │
│  │ to catch waves                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 🏄 Intermediate              ✓    │  │
│  │ Comfortable in various conditions │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 🏄 Advanced                       │  │
│  │ Can handle challenging waves      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 🏄 Expert                         │  │
│  │ Experienced in all conditions     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ● ○ ○ ○ ○ ○                           │
│  [← Back]              [Continue →]     │
└─────────────────────────────────────────┘
```

#### Step 3: Wave Preferences
```
┌─────────────────────────────────────────┐
│                                         │
│  What size waves do you prefer?         │
│                                         │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │ Small  ││ Medium ││ Large  │     │
│  │ 1-3ft  ││ 3-5ft  ││ 5ft+   │     │
│  │        ││   ✓    ││        │     │
│  └─────────┘└─────────┘└─────────┘     │
│                                         │
│  Preferred break type                   │
│  ┌─────────┐┌─────────┐┌─────────┐     │
│  │ Beach  ││ Point  ││ Reef   │     │
│  │   ✓    ││        ││        │     │
│  └─────────┘└─────────┘└─────────┘     │
│                                         │
│  ○ ● ○ ○ ○ ○                           │
│  [← Back]              [Continue →]     │
└─────────────────────────────────────────┘
```

#### Step 4: Home Beach
```
┌─────────────────────────────────────────┐
│                                         │
│  Set your home beach                    │
│  (Get quick access to your spot's       │
│   forecast)                             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search beaches...              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📍 Nearby                              │
│  ┌─────────────────────────────────┐   │
│  │ Scripps Beach - 2.3 mi          │   │
│  │ Blacks Beach - 3.1 mi           │   │
│  │ La Jolla Shores - 1.8 mi        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ○ ○ ● ○ ○ ○                           │
│  [← Back]     [Skip]   [Continue →]     │
└─────────────────────────────────────────┘
```

#### Step 5: Referral Code (Optional)
```
┌─────────────────────────────────────────┐
│                                         │
│  Have a referral code?                  │
│  (optional)                             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Enter 6-character code...         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  If a friend invited you, enter their   │
│  code to connect.                       │
│                                         │
│  ○ ○ ○ ● ○ ○                           │
│  [← Back]     [Skip]   [Continue →]     │
└─────────────────────────────────────────┘
```

**Validation States**:
- Valid code: ✓ Green check, "Code accepted!"
- Invalid code: ⚠️ Red, "Invalid code. Please check and try again."

#### Step 6: All Set!
```
┌─────────────────────────────────────────┐
│                                         │
│     🎉 (celebration animation)          │
│                                         │
│  You're all set!                        │
│  (text-3xl font-bold)                   │
│                                         │
│  Your personalized surf forecast        │
│  is ready.                              │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Today at Scripps Beach            │  │
│  │ Score: 78/100 - Good conditions   │  │
│  │ 3-4ft, offshore, mid tide         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ○ ○ ○ ○ ● ○                           │
│  [View Full Forecast]                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Feature 8: Referral & Attribution

### 8.1 Referral Dashboard

#### Zero State (No referrals yet)
```
┌─────────────────────────────────────────┐
│  ← Referrals                            │
├─────────────────────────────────────────┤
│                                         │
│  Your Referral Code                     │
│  ┌───────────────────────────────────┐  │
│  │        K9M2QZ           [📋]     │  │
│  │     (large, bold text)    Copy   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [📤 Share Code]                        │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│     👥 (Users icon, gray-400)          │
│                                         │
│     No Referrals Yet                    │
│                                         │
│     Share your code with friends        │
│     to start building your crew         │
│                                         │
└─────────────────────────────────────────┘
```

#### Ideal State
```
┌─────────────────────────────────────────┐
│  ← Referrals                            │
├─────────────────────────────────────────┤
│                                         │
│  Your Referral Code                     │
│  ┌───────────────────────────────────┐  │
│  │        K9M2QZ           [📋]     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [📤 Share Code]                        │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Your Referrals                         │
│                                         │
│  ┌──────────┬──────────┬──────────┐    │
│  │ Total    │ Pending  │ Active   │    │
│  │   12     │    3     │    9     │    │
│  └──────────┴──────────┴──────────┘    │
│                                         │
│  Recent                                 │
│  • SurfDude42 - Joined Dec 5           │
│  • WaveRider - Joined Dec 3            │
│  • BeachBum99 - Pending...             │
│                                         │
└─────────────────────────────────────────┘
```

---

## Global States & Components

### Authentication States

#### Unauthenticated Landing
```
┌─────────────────────────────────────────┐
│  [Logo]              [Login] [Sign Up]  │
├─────────────────────────────────────────┤
│                                         │
│  [Hero Image/Video]                     │
│                                         │
│  Find Your Perfect Wave                 │
│  (text-5xl → text-7xl font-bold)        │
│                                         │
│  Personalized forecasts, session        │
│  tracking, and local intel              │
│                                         │
│  [Get Started Free]                     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [Feature highlights...]                │
│                                         │
└─────────────────────────────────────────┘
```

#### Auth Loading
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│     [Quiver Logo]                       │
│                                         │
│     ○ Checking authentication...        │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

Use `<AuthLoader>` component with brand styling.

#### Auth Error
```
┌─────────────────────────────────────────┐
│                                         │
│     ⚠️ Session Expired                  │
│                                         │
│     Please log in again to continue     │
│                                         │
│     [Log In]                            │
│                                         │
└─────────────────────────────────────────┘
```

---

### Global Error Boundary

```
┌─────────────────────────────────────────┐
│                                         │
│     😔 Something Went Wrong             │
│                                         │
│     We hit an unexpected error.         │
│     Our team has been notified.         │
│                                         │
│     [↻ Try Again]  [Go Home]            │
│                                         │
│     Error ID: abc123                    │
│     (text-xs text-gray-400)             │
│                                         │
└─────────────────────────────────────────┘
```

---

### Offline State

```
┌─────────────────────────────────────────┐
│  ⚠️ You're Offline                      │
├─────────────────────────────────────────┤
│                                         │
│  Some features may be unavailable       │
│                                         │
│  [Dismiss]                              │
│                                         │
└─────────────────────────────────────────┘
```

Display as a toast/banner at top of screen.

---

## Implementation Checklist

For each screen state, ensure:

- [ ] **Zero State**: Clear guidance, friendly messaging, actionable CTA
- [ ] **Loading State**: Skeleton matches layout, no layout shift
- [ ] **Error State**: Icon + heading + description + retry action
- [ ] **Ideal State**: Complete data display, proper hierarchy
- [ ] **Accessibility**: Focus states, screen reader text, 44px touch targets
- [ ] **Animation**: Respects `prefers-reduced-motion`
- [ ] **Mobile**: Tested at 375px width minimum
- [ ] **Desktop**: Appropriate layout at 1200px+

---

## Files to Create/Modify

1. **New Components Needed**:
   - `components/states/zero-state.tsx` - Reusable zero state template
   - `components/states/error-state.tsx` - Reusable error state template
   - Domain-specific skeletons as needed

2. **Existing Components to Audit**:
   - All list views for empty states
   - All data-fetching components for loading/error
   - Form wizards for step transitions
   - Map components for loading/error

3. **Style Updates**:
   - Ensure consistent icon sizing (48-64px for empty states)
   - Verify color token usage
   - Animation timing consistency

---

*Document generated for Quiver MVP - December 2025*
