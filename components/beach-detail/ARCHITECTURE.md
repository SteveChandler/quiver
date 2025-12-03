# Beach Detail Components Architecture

## 🎯 **PURPOSE**

The beach detail components create a comprehensive beach profile page with forecasts, community activity, and quick actions for session planning.

## 📁 **COMPONENT STRUCTURE**

```
components/beach-detail/
├── beach-header.tsx          # Sticky navigation header with back button
├── beach-hero.tsx            # Hero section with map image and beach info
├── beach-quick-actions.tsx   # Plan/Log session buttons + favorite
├── todays-forecast.tsx       # Today's forecast with calibration
├── detailed-swell-modal.tsx  # Detailed swell/forecast modal dialog
├── recent-sessions-section.tsx # Community sessions display
└── ...                       # Additional components for tabs and features
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Data Flow Pattern**

```typescript
Beach Page → Individual Components → Actions/Navigation
     ↓             ↓                    ↓
   Props      Local State         Server Actions
```

### **Component Hierarchy**

```
BeachDetailPage
├── BeachHeader (navigation)
├── BeachHero (visual header)
├── BeachQuickActions (CTAs)
├── TodaysForecast (forecast data)
├── RecentSessionsSection (social content)
└── DetailedSwellModal (detailed view)
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **BeachHeader**

- **Purpose**: Sticky navigation with beach name
- **Props**: `beachName: string`
- **Features**:
  - Back navigation to map
  - Sticky positioning (z-index: 10)
  - Mobile-first responsive design

### **BeachHero**

- **Purpose**: Visual hero section with beach information
- **Props**: `beach: Beach, mapImageUrl: string`
- **Features**:
  - Map image background with gradient overlay
  - Beach name, location, and star ratings
  - Hardcoded review count (128 reviews)
  - Responsive image handling

### **BeachQuickActions**

- **Purpose**: Primary action buttons for user engagement
- **Props**: `beach: Beach, isAuthenticated: boolean`
- **Features**:
  - Plan Session / Log Session buttons
  - Favorite button integration
  - Authentication-aware routing
  - Equal-width button layout

### **TodaysForecast**

- **Purpose**: Forecast display with community calibration
- **Props**: `forecast: Forecast | undefined`
- **Features**:
  - Modern forecast card layout
  - Community-adjusted forecast display
  - Forecast calibration integration
  - Wave height, wind, water temp display
  - Fallback for missing data

### **DetailedSwellModal**

- **Purpose**: Modal with comprehensive swell information
- **Props**: `forecast, isOpen, onClose, selectedDate`
- **Features**:
  - Full-screen modal on mobile
  - Gradient header design
  - Accordion-based detailed swell data
  - Swell 1, Swell 2, and Wind Wave sections
  - Color-coded information sections

## 🔄 **DATA INTEGRATION**

### **Forecast Integration**

```typescript
// Community-adjusted forecasts
const { beachAccuracy } = useForecastCalibration({
  beachId: forecast?.beach_id,
});

// Displays both raw and adjusted forecasts
<AdjustedForecastDisplay
  rawForecast={forecast}
  beachAccuracy={beachAccuracy}
  compact={true}
/>;
```

### **Coach Pick (temporary replacement for Best Times)**

- The `5 Day Outlook` section currently shows `CoachCard` in place of the previous Best Times chip list.
- Best Times fetching and UI have been removed here temporarily due to instability, to focus on actionable recommendations for growth.
- When reinstating Best Times, follow the documented MV/RPC/why‑breakdown pattern previously described.

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
- `@/components/forecast/adjusted-forecast-display` - Community forecasts
- `@/hooks/use-forecast-calibration` - Forecast accuracy data

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

### **Integration Testing**

- Navigation flow testing
- Session creation workflows
- Forecast calibration integration

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

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive forecast and community features  
**Next Review**: After social sharing implementation
