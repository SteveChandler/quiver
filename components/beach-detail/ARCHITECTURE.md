# Beach Detail Components Architecture

## 🎯 **PURPOSE**

The beach detail components create a comprehensive beach profile page with forecasts, community activity, live cams, and quick actions for session planning.

## 📁 **COMPONENT STRUCTURE**

```
components/beach-detail/
├── amenities-badges.tsx         # Data-driven CCC amenity badges (grouped by category)
├── beach-breadcrumb.tsx        # Beach location breadcrumb navigation
├── cams-section.tsx          # Live camera feed (iframe, HLS, or video)
├── hls-video-player.tsx      # HLS video playback via hls.js / native
├── recent-sessions-section.tsx # Community sessions display
├── visual/beach-visual-hero.tsx # Beach media, public call, and beach-day facts
├── visual/beach-week.tsx        # Week forecast tiles
├── water-quality-badge.tsx      # EPA water quality status badge (expandable)
└── ...                       # Additional components for tabs and features
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Data Flow Pattern**

```typescript
Beach Page → Individual Components → Actions/Navigation
     ↓             ↓                    ↓
   Props      Local State         Server Actions
```

### **Beach page layouts**

- `zine` remains on water temperature and tides subpages and the Mexico and international beach routes.
- `visual` serves `/[state]/[city]/[beach]` through `BeachDetailClient` and `BeachDetail`.

The visual layout renders, in order: breadcrumb; `BeachVisualHero` with the H1, public call, and beach-day facts; `BeachActions` with Watch or app handoff when a window exists, plus Share; the hourly chart when forecast points exist beside `BeachDayColumn`; `BeachWeek` after client hydration when week data exists; nearby spots; Reviews, Intel, and Sessions tabs; then About, amenities, forecast details, the optional full hourly table, FAQ, and related guides. The existing indexable blocks and structured data remain on the page.

The public call comes from `getPublicSurfCall`, is labeled "for most surfers," and can show a call, "No call today/tomorrow," or "Surf call unavailable." The week tile for the call's local day uses that public call's word (or "No call") in place of its forecast tier. The H1 still contains the beach name and "Surf Forecast" wording. The week has no per-day water temperature; water temperature belongs to beach-day facts and the water-temp subpage. Water quality only reports advisories or closures, never "Clean" for missing or non-advisory data. The hero's beach-day low and the Beach Day column use only interior three-point turning points from `getTideMetaData`, excluding incomplete first and last samples. The week's lows come separately from `extractMergedTideSchedule(forecasts)` in `lib/utils/beach-week.ts`, which selects the first low matching each tile's local date.

For a signed-out visitor, `NATIVE_SELECTED_WINDOW_WATCH` determines whether a selected window is labeled "Watch" or "Open in the app." The button is absent without a watch window; Share remains visible. The visual page has no sticky or inline signup CTA or content-page app handoff CTA.

## 📊 **COMPONENT RESPONSIBILITIES**

### **AmenitiesBadges**

- **Purpose**: Renders data-driven amenity badges from CCC Coastal Commission data
- **Props**: `amenities: BeachAmenities | Partial<BeachAmenities> | null`
- **Features**:
  - Groups active flags by category (Access, Facilities, Recreation, Terrain)
  - Shows distance to nearest source
  - Falls back to keyword-derived data for non-CA beaches
- **Data Source**: `mv_beach_amenities` materialized view (SSR)

### **BeachVisualHero**

- **Purpose**: Visual layout hero with beach media, the H1, public surf call, surf facts, and optional beach-day facts.
- **Inputs**: Beach and media data, selected forecast context, public call, water temperature, interior tide low for today, and advisory status.
- **Media**: After mount, `HomeHeroMedia` restores the available viewpoint remembered under its `storageKey`. When nothing is remembered or that viewpoint is unavailable, the beach default priority is cam → photo → swell → satellite, subject to availability.

### **CamsSection**

- **Purpose**: Renders the live camera feed for a beach, supporting multiple embed strategies
- **Props**: `beachId: string`
- **Data Source**: Fetches `camera_url` from `/api/beaches/{beachId}/sources`
- **Rendering Logic**:
  1. Passes `camera_url` through `buildCamEmbed()` (`lib/media/cam-embed.ts`) to determine embed kind
  2. Renders based on `kind`:
     - `"iframe"` -- standard iframe embed (YouTube, Vimeo, HDOnTap, generic)
     - `"hls"` -- dynamically imports `HLSVideoPlayer` (code-split, SSR disabled)
     - `"video"` -- native `<video>` element for .mp4/.webm/.ogg
     - `"none"` -- section hidden entirely
  3. Falls back to hiding the section if embed is blocked or URL is invalid
- **Features**:
  - Refresh button to re-fetch sources
  - "Open cam" link to the original URL
  - "Suggest a cam" mailto link when no camera URL exists
  - Loading state with spinner while sources are fetched

### **HLSVideoPlayer**

- **Purpose**: Client component for HLS (`.m3u8`) live stream playback
- **Props**: `src: string, title?: string`
- **File**: `hls-video-player.tsx`
- **Browser Strategy**:
  - **Safari**: Uses native HLS support via `<video src>` (no library needed, no CORS issues)
  - **Chrome / Firefox**: Dynamically imports `hls.js` (code-split) to parse and play HLS streams
- **Error Handling**: Up to 3 automatic retries on fatal network errors; renders nothing on permanent failure
- **Cleanup**: Destroys hls.js instance and detaches video element on unmount or `src` change
- **CORS**: Surfline HLS streams are CORS-blocked in Chrome/Firefox, so the `src` prop receives a proxy URL (`/api/hls-proxy/...`) rather than the direct CDN URL. Safari can play either. The proxy rewrite happens in `buildCamEmbed()`, not in this component.

### **WaterQualityBadge**

- **Purpose**: Displays EPA water quality status with expandable details
- **Props**: `waterQuality: WaterQuality | null`
- **Features**:
  - Color-coded status (green/amber/red)
  - Expandable details with sample data
  - EPA source link
  - Renders nothing for unknown/null status
- **Data Source**: `beach_water_quality` table (SSR)

## 🔄 **DATA INTEGRATION**

### **Camera / HLS Integration**

```
camera_url (from beaches.sources)
  → buildCamEmbed(url)                    # lib/media/cam-embed.ts
     ├─ YouTube / Vimeo / HDOnTap → iframe
     ├─ .mp4 / .webm / .ogg      → video
     ├─ .m3u8 (Surfline)          → hls (proxied via /api/hls-proxy/...)
     ├─ .m3u8 (Surfchex, others)  → hls (direct URL, no CORS issue)
     └─ unknown                   → iframe attempt or "none"
  → CamsSection renders the appropriate player
```

**Why a proxy?** Surfline's HLS CDN (`hls.cdn-surfline.com`) blocks cross-origin requests. Chrome and Firefox require hls.js which makes XHR/fetch calls subject to CORS. The server-side proxy at `/api/hls-proxy/[...path]` fetches upstream with the required `Referer` header and returns the response with `Access-Control-Allow-Origin: *`.

**Path-based proxy design**: The proxy URL encodes the upstream hostname and path (`/api/hls-proxy/<hostname>/<path>`). This means relative segment URLs inside `.m3u8` manifests (e.g., `segment_001.ts`) resolve through the proxy automatically without rewriting manifest content.

### **Coach Pick (temporary replacement for Best Times)**

- The `5 Day Outlook` section currently shows `CoachCard` in place of the previous Best Times chip list.
- Best Times fetching and UI have been removed here temporarily due to instability, to focus on actionable recommendations for growth.
- When reinstating Best Times, follow the documented MV/RPC/why-breakdown pattern previously described.

```typescript
type WindowWithWhy = {
  label: string;
  score: number;
  why?: {
    ts_utc: string;
    wind: number;
    tide: number;
    swell: number;
    period: number;
    height: number;
  } | null;
};

// Peak-hour breakdown
const { data } = await supabase
  .from("v_beach_hourly_scores")
  .select(
    "ts_utc, wind_score, tide_score, swell_dir_score, period_score, height_score, score_0_100"
  )
  .eq("beach_id", beach.id)
  .gte("ts_utc", startIso)
  .lt("ts_utc", endIso)
  .order("score_0_100", { ascending: false })
  .limit(1);
```

### **Session Integration**

```typescript
// Community sessions display
sessions.map((session) => (
  <SessionCardWrapper
    key={session.id}
    session={session}
    isOwner={false}
    showUserInfo={true}
  />
));
```

## 🎨 **DESIGN PATTERNS**

### **Responsive Layout**

- Mobile-first design approach
- Flexible button layouts (`flex-1` pattern)
- Responsive image handling with Next.js Image
- Grid layouts for forecast data

### **Color Coding**

```typescript
// Forecast sections use consistent color schemes
const colorSchemes = {
  ocean: "bg-ocean-blue/10 border-ocean-blue/20",
  blue: "bg-blue-50/70 border-blue-200",
  cyan: "bg-cyan-50/70 border-cyan-200",
  teal: "bg-teal-50/70 border-teal-200",
  emerald: "bg-emerald-50/70 border-emerald-200",
};
```

### **Loading States**

- Consistent loading spinner (`Loader2`)
- Skeleton placeholders where appropriate
- Graceful error handling with fallbacks

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Code Splitting**

- `HLSVideoPlayer` is loaded via `next/dynamic` with `ssr: false`, so hls.js (~60KB gzipped) is only downloaded on pages that actually display an HLS cam
- hls.js itself is dynamically imported inside the component, further deferring the load until a non-Safari browser needs it

### **Image Optimization**

- Next.js Image component with `fill` prop
- Gradient overlays for text readability
- Proper alt text for accessibility

### **Conditional Rendering**

- Early returns for loading/error states
- Conditional forecast displays
- Authentication-aware button rendering

## 🔗 **EXTERNAL DEPENDENCIES**

### **Core Dependencies**

- `@/components/ui/*` - Shadcn UI components
- `@/components/session-card-wrapper` - Session display
- `@/hooks/use-forecast-calibration` - Forecast accuracy data
- `@/lib/media/cam-embed` - Camera URL classification and proxy rewriting
- `hls.js` - HLS stream parsing for Chrome/Firefox (dynamic import)

### **Navigation Dependencies**

- `next/link` for client-side navigation
- `lucide-react` for consistent iconography

## 📱 **MOBILE CONSIDERATIONS**

### **Touch-Friendly Design**

- Large tap targets for buttons
- Responsive button layouts
- Modal optimization for mobile screens

### **Responsive Breakpoints**

- `sm:` for small screens
- `md:` for medium screens
- Flexible layouts with CSS Grid and Flexbox

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Test authentication state handling
- Verify empty state displays
- Check forecast data rendering
- Test modal open/close functionality

### **Cam Embed Testing**

- Unit tests for `buildCamEmbed()` covering all URL patterns (`__tests__/lib/media/cam-embed.test.ts`)
- Surfline proxy URL rewrite verified in tests
- Invalid/malformed URL returns `{ kind: "none" }`

### **Integration Testing**

- Navigation flow testing
- Session creation workflows
- Forecast calibration integration
- `e2e/guest-anonymous-cta-reduction.spec.ts` covers the signed-out public call, Share/Watch, absent signup asks, and visual sections.
- `e2e/usage-critical.spec.ts` checks the guest beach Share surface.
- `e2e/prod-readonly/guest-ui.spec.ts` accepts the visual public call as stable guest content.
- `__tests__/components/beach-detail/visual/` covers the visual hero, week, hourly chart, and beach-day column; `__tests__/lib/utils/public-surf-call.test.ts` and `__tests__/lib/seo/tide-interior-extremes.test.ts` cover their source rules.

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Real-time session updates
- Beach photo galleries
- Enhanced review system
- Social sharing capabilities

### **Performance Improvements**

- Image lazy loading optimization
- Component code splitting
- Forecast data caching

---

**Last Updated**: February 2026
**Status**: Production-ready with comprehensive forecast, community features, live HLS cam playback, CCC amenities, and EPA water quality
**Next Review**: After social sharing implementation
