# AllTrails UX Flows: Detailed Analysis & Quiver Implementation Guide

**Date**: January 2025  
**Last Updated**: January 2025 (Implementation Status Review)  
**Purpose**: Screen-by-screen UX flow analysis from AllTrails with Quiver adaptation recommendations  
**Source**: AllTrails competitor research (public observation & support docs)

## Implementation Status Summary

**Overall Progress**: 1 of 10 Major Flows Fully Implemented

### ✅ Fully Implemented Flows
1. **Search Autocomplete Flow** - Complete with preview cards, keyboard navigation, debouncing

### 🔶 Partially Implemented Flows
2. **Beach Detail Flow** - Strong implementation, missing some AllTrails features (GPX export, print)
3. **Review Submission Flow** - Implemented with 5-category rating system (better than AllTrails)
4. **Session Logging Flow** - Comprehensive implementation with conditions, photos, ratings
5. **Social Interaction Flows** - Full social platform (follow, like, comment, feed)

### ❌ Not Yet Implemented Flows
6. **Advanced Filter Panel** - No filter drawer component found
7. **Save to Lists Flow** - Only single "favorite" functionality exists
8. **Offline Maps Flow** - Only PWA caching, no premium offline download
9. **Custom Route Builder Flow** - Not implemented
10. **Premium Upgrade Flow** - No subscription system implemented

### Key Deviations from AllTrails
- **Better**: 5-category review system vs. single rating
- **Better**: Full social platform vs. minimal social features
- **Better**: Real-time activity feeds with comments
- **Missing**: Multi-list save system, GPX export, offline maps

---

## Table of Contents

1. [Discovery & Search Flow](#1-discovery--search-flow)
2. [Trail/Beach Detail Flow](#2-trailbeach-detail-flow)
3. [Navigation & Actions Flow](#3-navigation--actions-flow)
4. [Review Submission Flow](#4-review-submission-flow)
5. [Save/Bookmark Flow](#5-savebookmark-flow)
6. [Offline Maps Flow](#6-offline-maps-flow)
7. [Session Planning & Logging Flow](#7-session-planning--logging-flow)
8. [Custom Route Builder Flow](#8-custom-route-builder-flow)
9. [Social Interaction Flows](#9-social-interaction-flows)
10. [Premium Upgrade Flow](#10-premium-upgrade-flow)

---

## 1. Discovery & Search Flow

### AllTrails: Explore & Search User Journey

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Landing / Home Page (Logged In)                    │
├─────────────────────────────────────────────────────────────┤
│ Screen Elements:                                            │
│ • Prominent search bar: "Search by city, park, or trail"   │
│ • Hero section with featured trails                        │
│ • Navigation: Explore, Saved, Profile                      │
│                                                             │
│ User Actions:                                               │
│ • Type in search bar → Autocomplete suggestions appear      │
│ • Click "Explore" → Navigate to explore page               │
│ • Click featured trail → Direct to trail detail            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Explore / Search Results Page                      │
├─────────────────────────────────────────────────────────────┤
│ Layout: Two-pane (Desktop) / Map-first (Mobile)            │
│                                                             │
│ Left Pane: Trail List                Right Pane: Map       │
│ ┌─────────────────────┐              ┌──────────────────┐  │
│ │ [Filter Bar]        │              │  [Map with       │  │
│ │ Distance▼ Activity▼ │              │   clustered      │  │
│ │ Difficulty▼ Length▼ │              │   markers]       │  │
│ │ [All Filters]       │              │                  │  │
│ ├─────────────────────┤              │  Zoom controls   │  │
│ │ Trail Card 1        │              │  3D toggle       │  │
│ │ [Photo] Name        │              │  My Location     │  │
│ │ ★4.7 Hard 10mi      │              │  Route Builder   │  │
│ ├─────────────────────┤              └──────────────────┘  │
│ │ Trail Card 2        │                                    │
│ │ [Photo] Name        │                                    │
│ │ ★4.5 Moderate 5mi   │                                    │
│ └─────────────────────┘                                    │
│ [Load More...]                                              │
│                                                             │
│ Interactions:                                               │
│ • Scroll list → Infinite scroll loads more cards           │
│ • Click card → Navigate to trail detail page               │
│ • Click map marker → Show preview card popup               │
│ • Click cluster → Zoom in and split cluster                │
│ • Drag map → Results update to visible area (optional)     │
│ • Apply filters → List updates in real-time                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Filter Refinement                                  │
├─────────────────────────────────────────────────────────────┤
│ User clicks "All Filters" → Drawer opens                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Advanced Filters                                 [X]│    │
│ │─────────────────────────────────────────────────────│    │
│ │ Elevation                                           │    │
│ │ [Min: 0 ft] [Max: 5000 ft]                         │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Suitability                                         │    │
│ │ ☐ Dog-friendly  ☐ Kid-friendly                     │    │
│ │ ☐ Wheelchair accessible  ☐ Stroller-friendly       │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Attractions                                         │    │
│ │ ☐ Waterfalls  ☐ Views  ☐ Wildflowers  ☐ Lakes     │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Route Type                                          │    │
│ │ ☐ Loop  ☐ Out & back  ☐ Point-to-point            │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Trail Traffic                                       │    │
│ │ ☐ Light  ☐ Moderate  ☐ Heavy                       │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Rating                                              │    │
│ │ [3.0] ──●─── [5.0] stars minimum                   │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Clear All]                    [Apply Filters]      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Filter Behavior:                                            │
│ • Real-time preview of result count as user selects        │
│ • "Apply Filters" closes drawer and updates list           │
│ • Filters persist across session (URL params)              │
│ • "Clear All" resets to default view                       │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver Current State

```
┌─────────────────────────────────────────────────────────────┐
│ Current Quiver Discovery Flow                               │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Landing Page                                        │
│ • Hero with video background                               │
│ • Call-to-action: "Find Your Spot"                         │
│ • Social feed preview                                       │
│                                                             │
│ Step 2: Map Page (/map)                                    │
│ • Full-screen map with beach markers                       │
│ • Location search bar (basic text input)                   │
│ • No visible filters                                        │
│ • Click marker → Beach detail page                         │
│                                                             │
│ ✅ Strengths:                                               │
│ • Clean, focused map interface                             │
│ • Fast marker rendering                                     │
│ • Mobile-optimized touch controls                          │
│                                                             │
│ ❌ Gaps vs. AllTrails:                                      │
│ • No two-pane layout option                                │
│ • No autocomplete suggestions                              │
│ • No filter panel (quick or advanced)                      │
│ • No map marker preview popups                             │
│ • No infinite scroll list view                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver Recommended Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Recommended: Enhanced Explore Page (/explore)              │
├─────────────────────────────────────────────────────────────┤
│ Layout: Hybrid (List + Map)                                │
│                                                             │
│ Desktop:                                                    │
│ ┌───────────────────┬─────────────────────────────────┐    │
│ │ Beach List (40%)  │ Map View (60%)                  │    │
│ │ ┌───────────────┐ │ ┌─────────────────────────────┐ │    │
│ │ │ Search bar    │ │ │                             │ │    │
│ │ │ with autocmp  │ │ │   [Interactive Map]         │ │    │
│ │ └───────────────┘ │ │                             │ │    │
│ │ [Quick Filters]   │ │   🔵🔵🔵 Beach markers      │ │    │
│ │ Break▼ Diff▼     │ │                             │ │    │
│ │ [All Filters]     │ │   Conditions overlay        │ │    │
│ │ ─────────────────│ │                             │ │    │
│ │ Beach Card 1      │ │   [Zoom] [3D] [📍 Me]      │ │    │
│ │ 🟢 GOOD NOW      │ │                             │ │    │
│ │ Swami's Beach     │ │                             │ │    │
│ │ ⭐4.8 Int Reef   │ │                             │ │    │
│ │ 4-5ft SW          │ │                             │ │    │
│ │ ─────────────────│ │                             │ │    │
│ │ Beach Card 2      │ │                             │ │    │
│ │ [Load more...]    │ │                             │ │    │
│ └───────────────────┴─────────────────────────────────┘    │
│                                                             │
│ Mobile (Swipeable):                                         │
│ • Default: Map full-screen                                 │
│ • Swipe up → Beach list drawer (50% height)               │
│ • Pull down → Back to full map                             │
│ • Tap marker → Preview card (bottom sheet)                 │
│                                                             │
│ Key Enhancements:                                           │
│ 1. Search autocomplete with beach previews                 │
│ 2. Quick filter bar (break type, difficulty, conditions)   │
│ 3. Advanced filter drawer (swell, wind, tide, crowd)       │
│ 4. Live condition indicators ("GOOD NOW", "FAIR", "POOR")  │
│ 5. Map marker clusters for performance                     │
│ 6. Preview cards on marker tap (no navigation)             │
│ 7. Infinite scroll on list                                 │
│ 8. URL state persistence (filters, zoom, position)         │
└─────────────────────────────────────────────────────────────┘
```

---

### Implementation: Search Autocomplete Flow ✅ IMPLEMENTED

**Status**: ✅ **COMPLETE** (January 2025)

```typescript
// User Flow: Type in search bar → See suggestions → Select beach

┌─────────────────────────────────────────────────────────────┐
│ User types: "swa"                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ After 300ms debounce:                                       │
│ • API call: GET /api/beaches/search?query=swa               │
│ • Shows loading spinner in search bar                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Dropdown appears with suggestions:                          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Surf Spots                                           │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ → Swami's Beach                               [→]   │    │
│ │   Encinitas, CA · Point Break · ⭐4.8               │    │
│ │   🟢 GOOD (based on rating)                         │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ → Swamis State Beach                          [→]   │    │
│ │   Encinitas, CA · Reef Break · ⭐4.5                │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ User Actions:                                               │
│ • Arrow keys → Navigate suggestions (keyboard)              │
│ • Enter → Select highlighted suggestion                     │
│ • Click → Select suggestion                                 │
│ • Esc → Close dropdown & clear query                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ User selects "Swami's Beach":                               │
│ • Navigate to /beach/swamis (detail page)                  │
│ • OR call onSelect callback (custom behavior)               │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Files:**

1. **`components/beach/beach-search-autocomplete.tsx`** - Main autocomplete component
   - Uses shadcn/ui Command component for dropdown UI
   - Beach preview cards with name, location, break type, rating
   - Condition badges: GOOD (≥4.0), FAIR (3.0-4.0), POOR (<3.0)
   - Full keyboard navigation (arrow keys, enter, escape)
   - Customizable props: placeholder, onSelect, showCurrentConditions, maxResults

2. **`hooks/use-beach-autocomplete.ts`** - Custom hook for autocomplete logic
   - 300ms debounced search (configurable via `debounceMs` option)
   - State management: query, suggestions, loading, selectedIndex, isOpen
   - Keyboard event handlers with proper event prevention
   - Integration with existing `/api/beaches/search` endpoint
   - Returns: `{ query, suggestions, loading, isOpen, selectedIndex, setQuery, handleKeyDown, handleSelect, setIsOpen, clearSearch }`

3. **Integration Points:**
   - `components/beach-search.tsx` - Beach search page (3 instances replaced)
   - `components/home-screen/beach-search-bar.tsx` - Home screen search bar

**Test Coverage:**
- ✅ Component tests: `__tests__/components/beach/beach-search-autocomplete.test.tsx` (26 passing)
- ✅ Hook tests: `__tests__/hooks/use-beach-autocomplete.test.ts` (28 passing)
- ✅ E2E tests: `e2e/beach-search-autocomplete.spec.ts` (comprehensive suite)

**Key Features:**
- ✅ Instant suggestions after 2 characters
- ✅ Debounced API calls (reduces server load by ~80%)
- ✅ Loading indicators during fetch
- ✅ Empty state with helpful messaging
- ✅ Keyboard navigation with visual feedback
- ✅ Click-based selection
- ✅ Accessibility (ARIA attributes, proper semantic roles)
- ✅ Responsive design (mobile & desktop)
- ✅ Condition indicators (optional via prop)

**Performance:**
- Debouncing reduces API calls from ~5 per word to 1-2 per search
- Command component virtualizes long lists for smooth scrolling
- Optimistic UI updates for instant feedback

---

## 2. Trail/Beach Detail Flow

### AllTrails: Trail Detail Page Journey

```
┌─────────────────────────────────────────────────────────────┐
│ User arrives at Trail Detail Page                          │
│ Source: Search result click, Map marker click, Direct link │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Step 1: Page Load & First Impression (Above Fold)          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [Header]                                             │    │
│ │ ← Map > Yosemite NP > Half Dome                     │    │
│ │                                                       │    │
│ │ Half Dome via John Muir Trail                       │    │
│ │ ⭐ 4.9 (2,572 reviews) · Hard · 26.6 mi              │    │
│ │ Yosemite National Park                               │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Hero Section]                                       │    │
│ │ ┌──────────────┬──────────┬──────────┐              │    │
│ │ │ [Large Photo]│[Photo 2] │[Photo 3] │              │    │
│ │ │              │          │          │              │    │
│ │ │  ▶ Play      │          │[Map View]│              │    │
│ │ │  (152 photos)│          │          │              │    │
│ │ └──────────────┴──────────┴──────────┘              │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Stats Bar]                                          │    │
│ │ 📏 26.6 mi  📈 1,440 ft  ⏱️ 10 hrs  🔁 Out & Back  │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Action Buttons]                                     │    │
│ │ [🧭 Get directions] [🎯 Hit the trail] [🔖 Save]    │    │
│ │ [↗️ Share] [🖨️ Print]                               │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Tab Navigation]                                     │    │
│ │ [Overview] [Conditions] [Reviews] [Hit Trail] [Near]│    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ User Scan Time: 3-5 seconds                                │
│ Decision Points:                                            │
│ • Rating high enough? (⭐ 4.9) → Trust signal              │
│ • Difficulty appropriate? (Hard) → Skill match             │
│ • Distance acceptable? (26.6 mi) → Time commitment         │
│ • Good photos? → Visual appeal                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Content Exploration (User scrolls or tabs)         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Tab 1: Overview (Default)                                  │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Description                                          │    │
│ │ "This challenging out-and-back hike takes you to..."│    │
│ │                                                       │    │
│ │ Plan Your Visit                                      │    │
│ │ ✅ Dogs on leash  ✅ Kid-friendly  ⛔ No shade       │    │
│ │                                                       │    │
│ │ What Reviewers Say (AI Summary)                      │    │
│ │ "Most hikers praise the stunning views but warn..."  │    │
│ │                                                       │    │
│ │ Weather & Conditions                                 │    │
│ │ 🌡️ 72°F  🌤️ Partly cloudy  💨 5 mph               │    │
│ │ Trail Conditions: [Peak Premium]                     │    │
│ │                                                       │    │
│ │ Top Sights                                           │    │
│ │ 🏔️ Vernal Falls (3.2 mi)                            │    │
│ │ 🏔️ Nevada Falls (5.8 mi)                            │    │
│ │ 🏔️ Sub Dome (12.1 mi)                               │    │
│ │                                                       │    │
│ │ Route Map                                            │    │
│ │ [Interactive map with trail highlighted]            │    │
│ │ [Download GPX] [View in 3D]                          │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Tab 2: Conditions (Requires Login)                        │
│ • Recent trail reports from community                      │
│ • Snow/ice/water crossing updates                          │
│ • Parking availability                                      │
│                                                             │
│ Tab 3: Reviews (Requires Login)                            │
│ • Sort by: Recent, Highest rated, Most helpful             │
│ • Filter by activity type                                  │
│ • Read reviews with photos                                 │
│                                                             │
│ Tab 4: Hit the trail (Premium Paywall)                    │
│ • Download offline map                                      │
│ • Send to Garmin                                            │
│ • Export GPX/GeoJSON                                        │
│                                                             │
│ Tab 5: Nearby                                              │
│ • Similar trails in the area                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: User Decision & Action                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Decision Path A: "I want to hike this"                     │
│ → Click "Hit the trail" button                             │
│ → Modal opens (see Navigation Flow section)                │
│                                                             │
│ Decision Path B: "Save for later"                          │
│ → Click bookmark icon                                       │
│ → Add to list (see Save Flow section)                      │
│                                                             │
│ Decision Path C: "Need more info"                          │
│ → Switch to Reviews tab                                     │
│ → Read community experiences                                │
│ → Check conditions tab for recent reports                   │
│                                                             │
│ Decision Path D: "Not for me"                              │
│ → Click breadcrumb to return to search                     │
│ → Or click "Nearby" to see alternatives                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Beach Detail Page Current Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver Beach Detail Page (Current Implementation)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ✅ Well-Implemented Areas:                                  │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [Breadcrumb] Map > San Diego > Swami's Beach        │    │
│ │                                                       │    │
│ │ Swami's Beach                                        │    │
│ │ ⭐ 4.8 (87 reviews) · Intermediate · Reef            │    │
│ │ Encinitas, California                                │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Photo Gallery] (3 photos + map thumbnail)          │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Stats Grid]                                         │    │
│ │ Break Type: Reef   Best Swell: SW                    │    │
│ │ Best Wind: E       Preferred Tide: Mid-High          │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Actions]                                            │    │
│ │ [🧭 Get Directions] [📊 Log Session] [📅 Plan]      │    │
│ │ [⭐ Favorite] [🏠 Set as Home Beach]                │    │
│ │─────────────────────────────────────────────────────│    │
│ │ [Tabs]                                               │    │
│ │ [Overview][Forecast][Reviews][Intel][Sessions]       │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ ✅ Strengths over AllTrails:                                │
│ • 5-category review system (vs. single rating)             │
│ • Live forecast integration (10-day NOAA)                  │
│ • Social sessions feed on beach page                       │
│ • Real-time conditions with buoy data                      │
│ • Home beach feature (personal connection)                 │
│                                                             │
│ 🔶 Partial Implementations:                                 │
│ • AI summary: Not implemented (AllTrails has this)         │
│ • Top sights/POIs: Not implemented                         │
│ • Weather integration: Forecast tab (not overview)         │
│ • Parking/amenities: Basic tags only                       │
│                                                             │
│ ❌ Missing vs. AllTrails:                                   │
│ • No "Hit the trail" style action modal                    │
│ • No GPX/KML export                                         │
│ • No print/PDF option                                       │
│ • No offline download (premium)                            │
│ • No similar spots section                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### Recommended Enhancement: "Surf Now" Action Modal

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "Log Session" or "Plan Session" button         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Modal Opens: "Surf Swami's Beach"                          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │                                                       │    │
│ │ Quick Actions                                        │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │ [📍 Get Directions]                                  │    │
│ │ Opens Apple Maps / Google Maps / Waze               │    │
│ │                                                       │    │
│ │ [📊 Log Session] (Primary CTA)                       │    │
│ │ Record your session now → Full form                  │    │
│ │                                                       │    │
│ │ [📅 Plan Session]                                    │    │
│ │ Schedule for later → Date picker + forecast         │    │
│ │                                                       │    │
│ │ Advanced Options                                     │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │ [💾 Save Offline] 🔒 Premium                        │    │
│ │ Download beach + 7-day forecast + photos            │    │
│ │                                                       │    │
│ │ [📥 Export GPX]                                      │    │
│ │ Download location for GPS device                     │    │
│ │                                                       │    │
│ │ [🖨️ Print Session Card] 🔒 Premium                 │    │
│ │ Waterproof PDF with tide times & forecast            │    │
│ │                                                       │    │
│ │ [↗️ Share Spot]                                      │    │
│ │ Send to friends → Link or Instagram story            │    │
│ │                                                       │    │
│ │ [🔔 Set Alert] 🔒 Premium                           │    │
│ │ Notify me when conditions are good                   │    │
│ │                                                       │    │
│ │                                    [Close]           │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Behavior:                                                   │
│ • Focus on primary action (Log/Plan)                       │
│ • Premium features show lock icon + upgrade prompt         │
│ • Track which actions are most used                        │
│ • Modal remembers last action (smart default)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Navigation & Actions Flow

### AllTrails: "Hit the Trail" Modal Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "Hit the trail" button or Navigation icon      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Modal: "Hit the Trail - Half Dome"                         │
│ ┌─────────────────────────────────────────────────────┐    │
│ │                                                       │    │
│ │ [📱 Download in app] 🔒 Plus                        │    │
│ │ Get offline maps & wrong-turn alerts                 │    │
│ │                                                       │    │
│ │ [⌚ Send to Garmin] 🔒 Plus                          │    │
│ │ Sync trail to your GPS device                        │    │
│ │                                                       │    │
│ │ [📲 Open in app]                                     │    │
│ │ Deep link to AllTrails mobile app                    │    │
│ │                                                       │    │
│ │ [📥 Export map file]                                 │    │
│ │ Download GPX or GeoJSON                              │    │
│ │                                                       │    │
│ │                                                       │    │
│ │ Premium features locked? → [Upgrade to Plus]         │    │
│ │                                                       │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ User Flow for Free User clicking Premium action:           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ You need AllTrails Plus to download offline maps    │    │
│ │                                                       │    │
│ │ ✅ Download unlimited trails for offline use        │    │
│ │ ✅ Get wrong-turn alerts while hiking                │    │
│ │ ✅ Print custom trail maps                           │    │
│ │ ✅ Remove ads                                        │    │
│ │                                                       │    │
│ │ $35.99/year (Save 40%) or $5.99/month               │    │
│ │                                                       │    │
│ │ [Start free trial]          [Maybe later]           │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key Observations:**
- Clear hierarchy: Free actions first, premium below
- Premium features show lock icon immediately
- Upgrade prompt includes value props + social proof
- Free alternative (GPX export) always available

---

## 4. Review Submission Flow

### AllTrails: Review Submission Journey

```
┌─────────────────────────────────────────────────────────────┐
│ Entry Points:                                               │
│ 1. "Write a review" button on trail page                   │
│ 2. Post-activity prompt in mobile app                      │
│ 3. Reviews tab → "Add Review" button                       │
│                                                             │
│ Prerequisite: User must be logged in                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Review Form (Modal or Full Page)                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Write a Review - Half Dome Trail                     │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Overall Rating *                                     │    │
│ │ ⭐⭐⭐⭐⭐ (Click to rate)                              │    │
│ │                                                       │    │
│ │ Activity Type *                                      │    │
│ │ [Hiking ▼] Backpacking, Trail Running, etc.         │    │
│ │                                                       │    │
│ │ Trail Conditions                                     │    │
│ │ ☐ Muddy  ☐ Snow  ☐ Icy  ☐ Bugs                     │    │
│ │ ☐ Overgrown  ☐ Clear  ☐ Rocky                       │    │
│ │                                                       │    │
│ │ When did you hike? *                                 │    │
│ │ [📅 Select date] (Calendar picker)                   │    │
│ │                                                       │    │
│ │ Your Review                                          │    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ Share your experience...                      │   │    │
│ │ │                                               │   │    │
│ │ │ What did you like? What should others know?  │   │    │
│ │ │ (Optional, 500 char max)                     │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ │                                                       │    │
│ │ Add Photos (Optional)                                │    │
│ │ [📷 Upload] Drag and drop or browse                  │    │
│ │ [   ] [   ] [   ] (Max 10 photos)                   │    │
│ │                                                       │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │                                                       │    │
│ │ By submitting, you agree to our Community Guidelines│    │
│ │                                                       │    │
│ │ [Cancel]                        [Submit Review]      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Validation:                                                 │
│ • Rating required (1-5 stars)                              │
│ • Activity type required                                    │
│ • Date required (cannot be future)                         │
│ • Text optional but encouraged                             │
│ • Photos optional, compressed on upload                    │
│                                                             │
│ On Submit:                                                  │
│ 1. Show loading state ("Submitting review...")             │
│ 2. Upload photos to storage (if any)                       │
│ 3. Create review record in database                        │
│ 4. Update trail's aggregate rating                         │
│ 5. Show success message: "Review published!"               │
│ 6. Close modal and refresh reviews tab                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Beach Review Flow (Current)

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver Beach Review Submission                              │
│                                                             │
│ ✅ Current Implementation (Better than AllTrails):          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Rate Swami's Beach                                   │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ 5-Category Rating System:                            │    │
│ │                                                       │    │
│ │ Overall Experience                                   │    │
│ │ ⭐⭐⭐⭐⭐                                              │    │
│ │                                                       │    │
│ │ Wave Quality                                         │    │
│ │ ⭐⭐⭐⭐⭐                                              │    │
│ │                                                       │    │
│ │ Crowd Level                                          │    │
│ │ ⭐⭐⭐⭐⭐                                              │    │
│ │                                                       │    │
│ │ Parking                                              │    │
│ │ ⭐⭐⭐⭐⭐                                              │    │
│ │                                                       │    │
│ │ Accessibility                                        │    │
│ │ ⭐⭐⭐⭐⭐                                              │    │
│ │                                                       │    │
│ │ Review Text (Optional)                               │    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ Share your experience...                      │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ │                                                       │    │
│ │ [Submit Review]                                      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 🔶 Potential Enhancements:                                  │
│ • Add photo upload capability                              │
│ • Add date picker (when visited)                           │
│ • Add conditions tags (crowded, clean, good swell)         │
│ • Add helpful voting on reviews (like AllTrails)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Save/Bookmark Flow

### AllTrails: Save to List Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks bookmark icon on trail card or detail page     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ First-time user: Auto-create "Favorites" list              │
│ • Bookmark icon fills → Green checkmark animation           │
│ • Toast: "Saved to Favorites"                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Existing user with multiple lists:                         │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Save to List                                    [X]  │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ ✓ Favorites (12 trails)                              │    │
│ │ ☐ To-Do (5 trails)                                   │    │
│ │ ☐ Summer 2025 (8 trails)                             │    │
│ │ ☐ Yosemite Trip (3 trails)                           │    │
│ │                                                       │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │                                                       │    │
│ │ [+ Create New List]                                  │    │
│ │                                                       │    │
│ │                              [Done]                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ User Actions:                                               │
│ • Click checkbox → Add/remove from list (instant)          │
│ • Click "Create New List" → Inline input appears           │
│ • Enter list name → List created and trail added           │
│ • Click "Done" → Modal closes                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Accessing Saved Lists                                      │
│                                                             │
│ Path: User Profile → Saved Tab                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ My Lists                                             │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Favorites (12) ────────────────── [•••]              │    │
│ │ [Trail card] [Trail card] [Trail card]               │    │
│ │                                                       │    │
│ │ To-Do (5) ─────────────────────── [•••]              │    │
│ │ [Trail card] [Trail card]                            │    │
│ │                                                       │    │
│ │ Summer 2025 (8) ───────────────── [•••]              │    │
│ │ [Trail card] [Trail card] [Trail card]               │    │
│ │                                                       │    │
│ │ [+ Create New List]                                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ List Actions (••• menu):                                   │
│ • Rename list                                              │
│ • Delete list                                              │
│ • Share list (public link)                                 │
│ • Export list (GPX file with all trails)                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Favorite/Save Flow (Current & Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ Current Quiver Implementation                               │
│                                                             │
│ ✅ Basic favorite functionality:                            │
│ • Single "favorite" button on beach cards                  │
│ • Star icon toggles on/off                                 │
│ • Favorites appear in /profile page                        │
│                                                             │
│ ❌ Missing vs. AllTrails:                                   │
│ • No multiple custom lists                                 │
│ • No list organization or categorization                   │
│ • No list sharing capability                               │
│ • No bulk export of favorite beaches                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Recommended: Multi-List System                             │
│                                                             │
│ User clicks bookmark on beach card:                        │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Save Swami's Beach                              [X]  │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ ✓ Favorites (23 spots)                               │    │
│ │ ☐ My Local Breaks (8 spots)                         │    │
│ │ ☐ Bucket List (12 spots)                            │    │
│ │ ☐ Costa Rica Trip 2025 (5 spots)                    │    │
│ │                                                       │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │ [+ Create New List]                                  │    │
│ │                                                       │    │
│ │                              [Done]                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Implementation:                                             │
│ • Database: spot_lists and spot_list_items tables         │
│ • Default "Favorites" list auto-created for all users     │
│ • Lists can be public (shareable) or private              │
│ • Each list has a unique URL: /lists/{list-id}            │
│ • List export → GPX file with all beach coordinates        │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Offline Maps Flow

### AllTrails: Offline Download Flow (Premium Feature)

```
┌─────────────────────────────────────────────────────────────┐
│ Entry Point: "Download for offline use" button             │
│ Location: Trail detail page or "Hit the trail" modal       │
│                                                             │
│ Prerequisite: AllTrails Plus/Peak subscription             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Free User Experience:                                       │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 🔒 Offline Maps - Plus Feature                      │    │
│ │                                                       │    │
│ │ Download trails and maps to use without cell service│    │
│ │                                                       │    │
│ │ ✅ Access maps, photos, and reviews offline         │    │
│ │ ✅ Get wrong-turn alerts while hiking                │    │
│ │ ✅ Never get lost on the trail                       │    │
│ │                                                       │    │
│ │ Join 1M+ AllTrails Plus members                      │    │
│ │                                                       │    │
│ │ $35.99/year or $5.99/month                           │    │
│ │                                                       │    │
│ │ [Start 7-day free trial]    [Learn more]            │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Plus Member Experience:                                     │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Download Half Dome Trail                            │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Map Type                                             │    │
│ │ ◉ AllTrails  ○ Topo  ○ Satellite                    │    │
│ │                                                       │    │
│ │ Download Area                                        │    │
│ │ ◉ Trail only (12 MB)                                 │    │
│ │ ○ Trail + 1 mile buffer (48 MB)                     │    │
│ │ ○ Trail + 2 mile buffer (120 MB)                    │    │
│ │                                                       │    │
│ │ Include                                              │    │
│ │ ☑ Trail photos (8 MB)                               │    │
│ │ ☑ Reviews (1 MB)                                    │    │
│ │ ☑ Top sights markers                                │    │
│ │                                                       │    │
│ │ Name this download (optional)                        │    │
│ │ [Half Dome - Summer 2025]                           │    │
│ │                                                       │    │
│ │ Total Size: ~29 MB                                   │    │
│ │ Storage Available: 2.3 GB                            │    │
│ │                                                       │    │
│ │ [Cancel]                        [Download]           │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Download Progress                                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Downloading Half Dome Trail                          │    │
│ │                                                       │    │
│ │ ████████████░░░░░░░░░░░░ 45%                        │    │
│ │                                                       │    │
│ │ Downloading map tiles...                             │    │
│ │ 234 / 520 tiles                                      │    │
│ │                                                       │    │
│ │ [Cancel Download]                                    │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Background behavior:                                        │
│ • Download continues if user minimizes app                 │
│ • Pause/resume on network loss/recovery                    │
│ • Notification when download complete                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Download Complete                                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ✅ Half Dome Trail ready for offline use             │    │
│ │                                                       │    │
│ │ 29 MB downloaded                                     │    │
│ │ Expires in 30 days (auto-refresh if online)         │    │
│ │                                                       │    │
│ │ [View offline maps]              [Done]             │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Accessing Offline Maps:                                    │
│ • Profile → Offline Maps                                   │
│ • Shows all downloaded trails with expiry dates            │
│ • Can delete to free up space                              │
│ • Auto-refresh when connected to WiFi                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Offline Caching (Recommended Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver Offline Surf Spots (Premium Feature)                │
│                                                             │
│ Entry Point: "Download Offline" button on beach page       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Download Configuration                                      │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Download Swami's Beach                               │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Include                                              │    │
│ │ ☑ Beach details & stats                             │    │
│ │ ☑ 7-day forecast (updates when online)              │    │
│ │ ☑ Tide chart                                        │    │
│ │ ☑ Top 20 reviews                                    │    │
│ │ ☑ Beach photos (compressed, 10 max)                │    │
│ │ ☑ Map tiles (1 mile radius)                        │    │
│ │                                                       │    │
│ │ Estimated Size: ~18 MB                               │    │
│ │ Storage Available: 1.8 GB                            │    │
│ │                                                       │    │
│ │ Cache Duration: 7 days                               │    │
│ │ (Auto-refresh when connected to WiFi)                │    │
│ │                                                       │    │
│ │ [Cancel]                        [Download]           │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Critical Surf-Specific Features:                           │
│ • Forecast snapshot with confidence scores                 │
│ • Tide predictions (works offline via algorithm)           │
│ • Safety info (rip currents, hazards)                      │
│ • Buoy data (latest snapshot before offline)               │
│ • Session history at this beach                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Offline Mode Active                                        │
│                                                             │
│ [Yellow Banner]                                             │
│ 📡 Offline mode - Showing cached data from 2 hours ago     │
│                                                             │
│ Beach page displays:                                        │
│ • All cached data visible                                  │
│ • Timestamp of last update                                 │
│ • "Refresh when online" button (disabled when offline)     │
│ • Forecast marked with ⚠️ "Cached - may be outdated"      │
│                                                             │
│ Limitations while offline:                                 │
│ • Cannot log new sessions (queued for upload)              │
│ • Cannot post reviews                                      │
│ • Cannot like/comment                                      │
│ • Can view all downloaded content                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Session Planning & Logging Flow

### AllTrails: Activity Recording (Mobile App)

```
┌─────────────────────────────────────────────────────────────┐
│ User Flow: Track Hike                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Step 1: Start Activity                                     │
│ • Open AllTrails app                                       │
│ • Navigate to trail detail page                            │
│ • Tap "Record" button                                      │
│ • OR: Open app → "Record" tab → "Start"                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Recording Activity                                   │    │
│ │                                                       │    │
│ │ Half Dome Trail                                      │    │
│ │                                                       │    │
│ │ [Map with GPS trail tracking]                        │    │
│ │ Your location: Blue dot                              │    │
│ │ Trail path: Green line                               │    │
│ │ Recorded path: Purple line                           │    │
│ │                                                       │    │
│ │ 🏃 3.2 mi   ⏱️ 1:24:33   📈 640 ft                  │    │
│ │                                                       │    │
│ │ [⏸️ Pause]                     [⏹️ Finish]           │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ During Recording:                                           │
│ • Real-time GPS tracking                                   │
│ • Distance, duration, elevation gain                       │
│ • Wrong-turn alerts (Plus members)                         │
│ • Battery optimization mode                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Complete Activity                                  │
│                                                             │
│ User taps "Finish" button                                  │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Activity Summary                                     │    │
│ │                                                       │    │
│ │ Half Dome via JMT                                    │    │
│ │ June 15, 2025 · 8:32 AM - 6:18 PM                   │    │
│ │                                                       │    │
│ │ [Map with recorded route]                            │    │
│ │                                                       │    │
│ │ Stats:                                               │    │
│ │ Distance: 26.4 mi                                    │    │
│ │ Duration: 9:46:22                                    │    │
│ │ Elevation Gain: 4,832 ft                             │    │
│ │ Moving Time: 8:32:15                                 │    │
│ │ Avg Pace: 19:23 min/mi                               │    │
│ │                                                       │    │
│ │ [📷 Add Photos] [✏️ Add Note] [⭐ Rate Trail]       │    │
│ │                                                       │    │
│ │ [Save]                         [Share]               │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Save & Share                                       │
│                                                             │
│ On Save:                                                    │
│ • Activity saved to "Completed" list                       │
│ • Appears on user profile                                  │
│ • Can be made public or private                            │
│ • GPX file auto-generated                                  │
│                                                             │
│ Share Options:                                             │
│ • Social media (Instagram, Facebook, Twitter)              │
│ • Direct message to friends                                │
│ • Export GPX file                                          │
│ • Generate shareable link                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Session Logging Flow (Current & Enhanced)

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver Session Logging                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ✅ Current Implementation:                                  │
│                                                             │
│ Entry Points:                                              │
│ 1. Beach page → "Log Session" button                      │
│ 2. Home page → "Quick Log" widget                         │
│ 3. Profile → "Log Session" FAB                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Log Surf Session                                     │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Beach * (Auto-filled if from beach page)             │    │
│ │ [Search beaches...]                                  │    │
│ │                                                       │    │
│ │ Date & Time *                                        │    │
│ │ [📅 Today, 8:00 AM ▼]                                │    │
│ │                                                       │    │
│ │ Conditions *                                         │    │
│ │ Wave Height: [4.5] ft                                │    │
│ │ Swell Direction: [SW ▼]                              │    │
│ │ Wind: [Offshore ▼]                                   │    │
│ │ Tide: [Mid ▼]                                        │    │
│ │                                                       │    │
│ │ Your Session                                         │    │
│ │ Board: [Lost Mayhem 5'10" ▼]                        │    │
│ │ Duration: [2] hours                                  │    │
│ │ Wave Count: [15] waves                               │    │
│ │                                                       │    │
│ │ Rating *                                             │    │
│ │ ⭐⭐⭐⭐⭐ How was your session?                       │    │
│ │                                                       │    │
│ │ Notes (Optional)                                     │    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ Best session in months! Caught some...        │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ │                                                       │    │
│ │ Photos (Optional)                                    │    │
│ │ [📷 Upload] [   ] [   ] [   ]                       │    │
│ │                                                       │    │
│ │ Privacy                                              │    │
│ │ ◉ Public  ○ Friends Only  ○ Private                 │    │
│ │                                                       │    │
│ │ [Cancel]                   [Log Session]             │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ ✅ Strengths:                                               │
│ • Rich condition capture (wave, swell, wind, tide)         │
│ • Board tracking (equipment history)                       │
│ • Photo upload integration                                 │
│ • Privacy controls                                         │
│ • Social sharing built-in                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 🔶 Recommended Enhancements:                                │
│                                                             │
│ 1. GPS Tracking (like AllTrails):                          │
│    • "Record Session" mode with live tracking              │
│    • Capture entry/exit points on beach                    │
│    • Track distance paddled (if GPS accurate)              │
│    • Auto-detect session duration                          │
│                                                             │
│ 2. Quick Log Templates:                                    │
│    • "Just Surfed" - minimal fields, fast entry            │
│    • "Detailed Log" - all fields                           │
│    • "Challenge Entry" - for gamification                  │
│                                                             │
│ 3. Auto-Fill from Forecast:                                │
│    • Pre-populate conditions from current forecast         │
│    • User can override if inaccurate                       │
│    • Show forecast vs. actual comparison                   │
│                                                             │
│ 4. Post-Session Prompts:                                   │
│    • Push notification: "How was your surf?"               │
│    • Quick rating → Expand for full form                   │
│    • Gamification: "🏆 New badge unlocked!"                │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Custom Route Builder Flow

### AllTrails: Custom Route Creation

```
┌─────────────────────────────────────────────────────────────┐
│ Entry Point: Explore page → "Build custom route" button    │
│ Location: Map controls (top right corner)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Route Builder Interface (Web Only)                         │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [<] Build Custom Route                          [X]  │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Left Panel:                Right Panel:              │    │
│ │ ┌─────────────────┐        ┌──────────────────────┐ │    │
│ │ │ Route Settings  │        │                      │ │    │
│ │ │                 │        │   [Interactive Map]  │ │    │
│ │ │ Name:           │        │                      │ │    │
│ │ │ [Morning Loop]  │        │   Your route: —      │ │    │
│ │ │                 │        │                      │ │    │
│ │ │ Activity:       │        │   OSM trails: ─ ─    │ │    │
│ │ │ [Hiking ▼]      │        │                      │ │    │
│ │ │                 │        │   📍 Start point     │ │    │
│ │ │ Route Type:     │        │                      │ │    │
│ │ │ ◉ Smart routing │        │   Click to add       │ │    │
│ │ │ ○ Freehand      │        │   waypoints          │ │    │
│ │ │                 │        │                      │ │    │
│ │ │ Distance: 5.2mi │        │   [Zoom controls]    │ │    │
│ │ │ Est. Time: 2h   │        │                      │ │    │
│ │ │                 │        └──────────────────────┘ │    │
│ │ │ [Undo] [Redo]   │                                  │    │
│ │ │ [Clear Route]   │                                  │    │
│ │ │                 │                                  │    │
│ │ │ [Save Draft]    │                                  │    │
│ │ │ [Export GPX]    │                                  │    │
│ │ │ [Save & Publish]│                                  │    │
│ │ └─────────────────┘                                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Drawing Modes:                                              │
│ 1. Smart Routing:                                          │
│    • Click waypoints on map                                │
│    • Auto-snaps to existing trails/paths from OSM          │
│    • Calculates elevation & distance                       │
│    • Shows trail type (paved, dirt, etc.)                  │
│                                                             │
│ 2. Freehand:                                               │
│    • Click and drag to draw custom path                    │
│    • No snapping - complete freedom                        │
│    • Useful for off-trail routes                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Save Custom Route                                          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Publish Custom Route                                 │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Route Name *                                         │    │
│ │ [Morning Loop at Yosemite]                           │    │
│ │                                                       │    │
│ │ Description                                          │    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ Great loop with valley views...               │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ │                                                       │    │
│ │ Activity Type                                        │    │
│ │ [Hiking ▼]                                           │    │
│ │                                                       │    │
│ │ Difficulty                                           │    │
│ │ ◉ Easy  ○ Moderate  ○ Hard                           │    │
│ │                                                       │    │
│ │ Privacy                                              │    │
│ │ ◉ Public (anyone can use)                            │    │
│ │ ○ Private (only me)                                  │    │
│ │ ○ Unlisted (only with link)                          │    │
│ │                                                       │    │
│ │ [Cancel]                        [Publish Route]      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ On Publish:                                                │
│ • Route saved to user profile                              │
│ • Appears in "My Custom Routes" section                    │
│ • GPX file generated automatically                         │
│ • Can be shared via link                                   │
│ • If public: searchable by other users                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Custom Session/Route Planner (Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver "Perfect Day" Session Planner                       │
│ (Surf-specific adaptation of route builder)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Use Case: Plan multi-spot surf days or surf trips          │
│                                                             │
│ Entry Point: Map page → "Plan Perfect Day" button          │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Perfect Day Planner                             [X]  │    │
│ │─────────────────────────────────────────────────────│    │
│ │ Left Panel:                Right Panel:              │    │
│ │ ┌─────────────────┐        ┌──────────────────────┐ │    │
│ │ │ Session Plan    │        │                      │ │    │
│ │ │                 │        │   [Map with beach    │ │    │
│ │ │ Name:           │        │    markers]          │ │    │
│ │ │ [Dawn Patrol +  │        │                      │ │    │
│ │ │  Backup Spots]  │        │   🔵 Spot 1          │ │    │
│ │ │                 │        │   🔵 Spot 2          │ │    │
│ │ │ Date:           │        │   🔵 Backup          │ │    │
│ │ │ [Jun 15, 2025]  │        │                      │ │    │
│ │ │                 │        │   Route: ——          │ │    │
│ │ │ Spots in Plan:  │        │                      │ │    │
│ │ │ ───────────────│        │   Click to add       │ │    │
│ │ │ 1. Swami's      │        │   spots              │ │    │
│ │ │    5:30am-7:00am│        │                      │ │    │
│ │ │    Dawn patrol  │        └──────────────────────┘ │    │
│ │ │    🟢 Good      │                                  │    │
│ │ │                 │                                  │    │
│ │ │ 2. Seaside      │                                  │    │
│ │ │    7:30am-9:00am│                                  │    │
│ │ │    If crowded   │                                  │    │
│ │ │    🔶 Fair      │                                  │    │
│ │ │                 │                                  │    │
│ │ │ 3. Cardiff Reef │                                  │    │
│ │ │    Backup       │                                  │    │
│ │ │    🔴 Poor      │                                  │    │
│ │ │                 │                                  │    │
│ │ │ Forecast:       │                                  │    │
│ │ │ 4-6ft SW        │                                  │    │
│ │ │ Offshore winds  │                                  │    │
│ │ │ High tide 8:00am│                                  │    │
│ │ │                 │                                  │    │
│ │ │ [Add Spot]      │                                  │    │
│ │ │ [Save Plan]     │                                  │    │
│ │ │ [Share]         │                                  │    │
│ │ └─────────────────┘                                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Features:                                                   │
│ • Drag spots to reorder                                    │
│ • Time estimates based on tide windows                     │
│ • Conditions forecast for each spot/time                   │
│ • Driving directions between spots                         │
│ • Total drive time calculated                              │
│ • Share plan with crew (group surf session)                │
│ • Export to calendar (Google, Apple)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Social Interaction Flows

### AllTrails: Social Features Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Following Users                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Step 1: Discover Users                                     │
│ • View another user's profile (from review, activity)      │
│ • See "Follow" button on profile header                    │
│                                                             │
│ Step 2: Click "Follow"                                     │
│ • Button changes to "Following" (checkmark)                 │
│ • User added to your "Following" list                      │
│ • You appear in their "Followers" list                     │
│ • No notification sent (silent follow)                     │
│                                                             │
│ Step 3: See Friend Activities                              │
│ • Home feed shows activities from followed users           │
│ • "John D. completed Half Dome Trail" (with photo)         │
│ • Can like/comment on activities                           │
└─────────────────────────────────────────────────────────────┘
```

**Note**: AllTrails has minimal social features compared to Quiver

---

### Quiver: Social Interaction Flows (Current - Superior)

```
┌─────────────────────────────────────────────────────────────┐
│ Follow → Like → Comment → Share Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ✅ Quiver's Comprehensive Social Features:                  │
│                                                             │
│ 1. Follow System                                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ User Profile                                         │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ @steve_surfer                                        │    │
│ │ 🏄 Intermediate Surfer · San Diego                   │    │
│ │                                                       │    │
│ │ 42 Sessions · 15 Followers · 28 Following            │    │
│ │                                                       │    │
│ │ [✓ Following ▼]  [Message]                          │    │
│ │ └─ Unfollow                                          │    │
│ │                                                       │    │
│ │ Recent Sessions →                                    │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 2. Session Feed (Home Page)                                │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Recent Activity                                      │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ @john_doe logged a session                     │   │    │
│ │ │ Swami's Beach · 2 hours ago                    │   │    │
│ │ │ ⭐⭐⭐⭐⭐ · 4-5ft SW · Epic session!           │   │    │
│ │ │ [Photo]                                        │   │    │
│ │ │                                                │   │    │
│ │ │ ❤️ 12  💬 3  ↗️ Share                         │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ │                                                       │    │
│ │ ┌───────────────────────────────────────────────┐   │    │
│ │ │ @sarah_surf planned a session                  │   │    │
│ │ │ Black's Beach · Tomorrow 6:00 AM               │   │    │
│ │ │ 🟢 Good conditions expected                    │   │    │
│ │ │                                                │   │    │
│ │ │ ❤️ 5  💬 Join?                                │   │    │
│ │ └───────────────────────────────────────────────┘   │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 3. Like Interaction                                        │
│ • Click heart → Turns red + count increments               │
│ • Optimistic UI update (instant feedback)                  │
│ • Real-time sync to database                               │
│ • Author sees notification: "Steve liked your session"     │
│                                                             │
│ 4. Comment Thread                                          │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 3 Comments                                           │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ @mike_surf: "Looks epic! What board did you ride?"  │    │
│ │ 1 hour ago · ❤️ Reply                               │    │
│ │                                                       │    │
│ │    @john_doe: "Lost Mayhem 5'10"! Perfect for it"   │    │
│ │    45 min ago · ❤️ Reply                            │    │
│ │                                                       │    │
│ │ @lisa_ocean: "Dawn patrol vibes 🌅"                 │    │
│ │ 30 min ago · ❤️ Reply                               │    │
│ │                                                       │    │
│ │ [Add a comment...]                                   │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 5. Share Options                                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Share Session                                        │    │
│ │ ───────────────────────────────────────────────────│    │
│ │ [📱 Instagram Story]    → Auto-generated card        │    │
│ │ [📘 Facebook]           → Rich preview               │    │
│ │ [🐦 Twitter/X]          → Text + link                │    │
│ │ [📋 Copy Link]          → Share URL                  │    │
│ │ [💬 Send to Friend]     → Direct message             │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Quiver Advantage**: Much richer social platform than AllTrails

---

## 10. Premium Upgrade Flow

### AllTrails: Paywall & Upgrade Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Trigger Points (where users hit paywall):                  │
│ 1. Download offline map                                     │
│ 2. Enable wrong-turn alerts                                │
│ 3. 3D map toggle                                           │
│ 4. Print/PDF export                                        │
│ 5. View conditions tab (some trails)                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Paywall Modal                                              │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 🔒 AllTrails Plus Required                          │    │
│ │                                                       │    │
│ │ Unlock offline maps and more premium features        │    │
│ │                                                       │    │
│ │ ✅ Download unlimited trails for offline use        │    │
│ │ ✅ Get wrong-turn alerts while hiking                │    │
│ │ ✅ Print custom trail maps                           │    │
│ │ ✅ View 3D terrain maps                              │    │
│ │ ✅ Remove all ads                                    │    │
│ │                                                       │    │
│ │ Trusted by 1,000,000+ outdoor enthusiasts            │    │
│ │ ⭐⭐⭐⭐⭐ 4.8/5 (23,421 reviews)                      │    │
│ │                                                       │    │
│ │ ┌───────────────┬───────────────┐                    │    │
│ │ │ Annual Plan   │ Monthly Plan  │                    │    │
│ │ │ $35.99/year   │ $5.99/month   │                    │    │
│ │ │ Save 40%!     │               │                    │    │
│ │ │ [Most Popular]│               │                    │    │
│ │ └───────────────┴───────────────┘                    │    │
│ │                                                       │    │
│ │ [Start 7-day FREE trial]                             │    │
│ │                                                       │    │
│ │ Cancel anytime · No commitment                       │    │
│ │                                                       │    │
│ │ [Maybe later]                                        │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Conversion Tactics:                                        │
│ • Free trial (7 days)                                      │
│ • Annual discount (40% off)                                │
│ • Social proof (1M+ users, 4.8★ rating)                    │
│ • Feature highlight (most-wanted features listed)          │
│ • Clear value prop ("unlimited" trails)                    │
│ • No commitment ("cancel anytime")                         │
│ • Easy exit ("Maybe later" vs aggressive lock-in)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ If user clicks "Start free trial":                         │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Complete Your Subscription                           │    │
│ │─────────────────────────────────────────────────────│    │
│ │                                                       │    │
│ │ Plan: Annual ($35.99/year)                           │    │
│ │ Free trial: 7 days                                   │    │
│ │ First charge: June 22, 2025                          │    │
│ │                                                       │    │
│ │ Payment Method                                       │    │
│ │ ◉ Credit Card                                        │    │
│ │ ○ PayPal                                             │    │
│ │ ○ Apple Pay                                          │    │
│ │                                                       │    │
│ │ [Card Number]                                        │    │
│ │ [MM/YY]  [CVV]                                       │    │
│ │ [ZIP Code]                                           │    │
│ │                                                       │    │
│ │ ☑ I agree to the Terms & Conditions                 │    │
│ │                                                       │    │
│ │ [Start Free Trial]                                   │    │
│ │                                                       │    │
│ │ You'll be charged $35.99 on June 22, 2025.          │    │
│ │ Cancel anytime before then to avoid charges.         │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ On Success:                                                │
│ • Redirect to original feature (offline download)          │
│ • Show success toast: "Welcome to AllTrails Plus! 🎉"     │
│ • Email confirmation sent                                  │
│ • Premium badge appears on profile                         │
└─────────────────────────────────────────────────────────────┘
```

---

### Quiver: Recommended Premium Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Quiver Premium Trigger Points:                             │
│ 1. Download offline spot                                    │
│ 2. Enable surf alerts                                      │
│ 3. Print session card                                      │
│ 4. Advanced filters (crowd level, specific swell)          │
│ 5. After 3rd session log (paywall on unlimited)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Paywall: Quiver Premium                                    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 🏄 Upgrade to Quiver Premium                         │    │
│ │                                                       │    │
│ │ Never miss a swell                                   │    │
│ │                                                       │    │
│ │ ✅ Download surf spots for offline use               │    │
│ │ ✅ Real-time surf alerts for your spots              │    │
│ │ ✅ Advanced swell & crowd filters                    │    │
│ │ ✅ Print waterproof session cards                    │    │
│ │ ✅ Unlimited session logs                            │    │
│ │ ✅ 3D wave visualization                             │    │
│ │ ✅ Priority support                                  │    │
│ │                                                       │    │
│ │ Join 500+ premium surfers                            │    │
│ │ ⭐⭐⭐⭐⭐ "Game-changer for dawn patrol!" - Mike S.  │    │
│ │                                                       │    │
│ │ ┌───────────────┬───────────────┐                    │    │
│ │ │ Annual Plan   │ Monthly Plan  │                    │    │
│ │ │ $39.99/year   │ $4.99/month   │                    │    │
│ │ │ Save 33%!     │               │                    │    │
│ │ │ [Best Value]  │               │                    │    │
│ │ └───────────────┴───────────────┘                    │    │
│ │                                                       │    │
│ │ [Start 14-day FREE trial]                            │    │
│ │                                                       │    │
│ │ Cancel anytime · Risk-free                           │    │
│ │                                                       │    │
│ │ [Continue with free]                                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Key Differences from AllTrails:                            │
│ • 14-day trial (vs 7-day) - more generous                  │
│ • Lower price point ($39.99 vs $35.99) - accessible        │
│ • Surf-specific value props                                │
│ • Social proof from surfers (not hikers)                   │
│ • "Continue with free" option (not "Maybe later")          │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: Key UX Flow Learnings

### What AllTrails Does Exceptionally Well

1. **Discovery**: Two-pane layout (list + map) reduces friction
2. **Filters**: Advanced filter drawer with smart defaults
3. **Detail Pages**: Progressive disclosure via tabs
4. **Offline Maps**: Seamless download UX with progress indicators
5. **GPX Export**: Always available (not paywalled)
6. **Custom Routes**: Intuitive builder with smart snapping
7. **Paywall**: Soft sell with free trial and clear value props
8. **Reviews**: Simple, fast submission with minimal required fields

---

### Where Quiver is Already Superior

1. **Social Features**: Full social platform (follow, like, comment, activity feed)
2. **Review Granularity**: 5-category rating system vs single rating
3. **Live Conditions**: Real-time buoy data and 10-day NOAA forecasts
4. **Session Context**: Rich metadata (board, wave count, conditions)
5. **Photo Integration**: Photos on sessions (not just standalone)
6. **Home Beach**: Personal connection feature
7. **Tabs Implementation**: Better organized than AllTrails

---

### Quick Wins for Quiver (Priority Implementation Order)

| Priority | Flow Enhancement | Effort | Impact | Status |
|----------|-----------------|--------|--------|--------|
| 🥇 #1 | Search autocomplete with previews | 1 week | HIGH | ✅ **COMPLETE** (Jan 2025) |
| 🥈 #2 | Advanced filter drawer | 1-2 weeks | HIGH | ⏳ Pending |
| 🥉 #3 | Multi-list save system | 1 week | HIGH | ⏳ Pending |
| #4 | "Surf Now" action modal | 3 days | MEDIUM | ⏳ Pending |
| #5 | GPX export | 1 week | MEDIUM | ⏳ Pending |
| #6 | Instagram share cards | 1-2 weeks | VERY HIGH | ✅ **COMPLETE** (Oct 2024) |
| #7 | Offline spot downloads (Premium) | 2-3 weeks | VERY HIGH | ⏳ Pending |
| #8 | Print/PDF export (Premium) | 1-2 weeks | MEDIUM | ⏳ Pending |
| #9 | Custom session planner | 3-4 weeks | MEDIUM | ⏳ Pending |
| #10 | Premium paywall & subscription | 1-2 weeks | HIGH | ⏳ Pending |

---

## Next Steps

1. **Prioritize flows** based on user feedback and analytics
2. **Prototype** key flows in Figma before implementation
3. **A/B test** new flows (especially paywall and filters)
4. **Measure** conversion rates at each step
5. **Iterate** based on drop-off points

---

**Last Updated**: January 2025
**Related Docs**: `ALLTRAILS_QUIVER_COMPARISON.md`, `BEACH_PAGE_DESIGN.md`, `DESIGN_PRINCIPLES.md`
**Owner**: Product & UX Teams
