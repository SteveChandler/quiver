# Home Page Design Refactor Plan

**Last Updated:** October 2025
**Status:** Phase 1 Complete ✅ (Oct 23, 2025)
**Pattern:** AllTrails-inspired design (matching beach detail page)
**Objective:** Apply consistent design language from beach detail page refactor to home page

---

## Executive Summary

This document outlines a comprehensive design refactor for the home page to match the AllTrails-inspired design patterns successfully implemented in the beach detail page. The goal is to create visual consistency across the application while improving usability, accessibility, and brand presence.

---

## Current State Analysis

### Existing Home Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Welcome Section                                             │
│   - User greeting (variable text sizes)                    │
│   - Action buttons (flex layout)                           │
├─────────────────────────────────────────────────────────────┤
│ Best Conditions Near You (conditional)                     │
│   - Horizontal scrolling cards                             │
│   - Beach recommendations                                   │
├─────────────────────────────────────────────────────────────┤
│ Tabs Navigation                                             │
│   [Forecast] [Nearby] [Local Intel]                        │
│                                                             │
│   Tab Content:                                              │
│   - Forecast: Home beach conditions                        │
│   - Nearby: Beach list with filters                        │
│   - Community: Recent sessions                             │
└─────────────────────────────────────────────────────────────┘
```

### Current Implementation Details

**File:** [components/home-screen/index.tsx](../components/home-screen/index.tsx)

**Issues Identified:**
1. Inconsistent typography sizing (responsive but not aligned with AllTrails spec)
2. Variable spacing system (8/10/12 instead of consistent 6/8)
3. Tab styling doesn't match beach detail tabs
4. Button layout uses flex instead of grid
5. Missing AllTrails-style visual polish (hover states, transitions)
6. Inconsistent color usage for badges and states

---

## Design Reference: Beach Detail Page

### Key Patterns from Beach Detail Refactor

The beach detail page refactor (commits [55c1d0e](commit/55c1d0e) through [bbe8b32](commit/bbe8b32)) established these patterns:

#### 1. Typography System
- Headings: `font-roboto font-bold`
- Beach name (H1): `text-4xl leading-[44px]`
- Section headings (H2): `text-2xl font-roboto font-bold`
- Body text: `text-base` (16px)
- Metadata: `text-sm text-gray-600`

#### 2. Color Palette
- Primary actions: `ocean-blue` (#0077B6)
- Hover states: `ocean-blue-dark` (#006699)
- Difficulty badges:
  - Beginner: `bg-blue-50 text-ocean-blue border-transparent`
  - Intermediate: `bg-orange-50 text-orange-600 border-transparent`
  - Advanced: `bg-red-50 text-red-600 border-transparent`

#### 3. Spacing System (8px base)
- Section spacing: `mb-6` (24px)
- Major sections: `mb-8` (32px)
- Card gaps: `gap-4` (16px)
- Tight spacing: `gap-2` (8px)

#### 4. Component Patterns
- Grid layouts: `grid grid-cols-2 md:grid-cols-4 gap-3`
- Button heights: `h-12` (48px)
- Border radius: `rounded-md` (8px)
- Hover transitions: `transition-all duration-200`
- Active states: `active:scale-[0.98]`

#### 5. Tab Navigation Style
- Border-bottom design: `border-b-2 border-gray-200`
- Active indicator: `border-ocean-blue text-ocean-blue font-semibold`
- Padding: `py-3 px-6` (desktop), `py-2 px-2` (mobile)
- Hover: `hover:bg-gray-50 hover:text-gray-900`

---

## Proposed Design Improvements

### Phase 1: Typography & Visual Hierarchy

**Objective:** Establish consistent AllTrails-style typography

#### Welcome Section Improvements

**Before:**
```tsx
<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
</h2>
<p className="text-muted-foreground text-base sm:text-lg lg:text-xl">
  The waves are looking good today. Ready to catch some?
</p>
```

**After:**
```tsx
<h2 className="text-4xl font-roboto font-bold leading-[44px] text-gray-900">
  Hey, {user ? profile?.full_name || "Surfer" : "Guest"}!
</h2>
<p className="text-base text-gray-600 mt-3">
  The waves are looking good today. Ready to catch some?
</p>
```

**Changes:**
- Fixed heading size to `text-4xl` (36px) across all breakpoints
- Added `font-roboto` for brand consistency
- Updated subtext to consistent `text-base`
- Applied proper text colors: `text-gray-900` (headings), `text-gray-600` (body)
- Added `mt-3` for proper spacing

#### Section Heading Updates

**Best Conditions Section:**
```tsx
<h3 className="text-2xl font-roboto font-bold text-gray-900">
  Best Conditions Near You
</h3>
<p className="text-sm text-gray-600">
  Top surf spots within 10 miles right now
</p>
```

**Changes:**
- Applied `text-2xl font-roboto font-bold` to all section headings
- Consistent color scheme

---

### Phase 2: Tab Navigation Enhancement

**Objective:** Match beach detail page tab styling

#### Current Tab Implementation
```tsx
<TabsList className="grid grid-cols-3 w-full mx-auto h-12 sm:h-14">
  <TabsTrigger value="forecast" className="text-sm sm:text-base">
    Forecast
  </TabsTrigger>
  {/* ... */}
</TabsList>
```

#### Proposed AllTrails-Style Tabs
```tsx
<TabsList className="w-full justify-start border-b-2 border-gray-200 mb-6 rounded-none bg-transparent p-0 h-auto">
  <TabsTrigger
    value="forecast"
    className={tabTriggerClasses}
  >
    Forecast
  </TabsTrigger>
  {/* ... */}
</TabsList>
```

**Tab Trigger Classes:**
```tsx
const tabTriggerClasses =
  "rounded-none border-b-2 border-transparent -mb-0.5 " + // Overlap border
  "px-2 py-2 sm:px-6 sm:py-3 " + // Responsive padding
  "text-xs sm:text-base font-medium text-gray-600 " + // Typography
  "transition-all duration-200 " + // Smooth transitions
  "hover:bg-gray-50 hover:text-gray-900 " + // Hover state
  "data-[state=active]:border-ocean-blue " + // Active border
  "data-[state=active]:text-ocean-blue " + // Active text
  "data-[state=active]:font-semibold " + // Active weight
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none"; // Remove defaults
```

**Visual Specification:**
- **Inactive tabs:** gray-600 text, medium weight (500)
- **Active tab:** ocean-blue text and 2px bottom border, semibold (600)
- **Hover:** gray-50 background, gray-900 text
- **Transitions:** 0.2s ease for all state changes
- **Negative margin:** -mb-0.5 to overlap container border

---

### Phase 3: Action Button Grid Redesign

**Objective:** Implement AllTrails button grid pattern

#### Current Button Layout
```tsx
<div className="flex gap-2">
  <Button
    onClick={() => router.push("/sessions/new?mode=plan")}
    className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90"
  >
    Plan Session
  </Button>
  <Button
    onClick={() => router.push("/sessions/new?mode=log")}
    variant="outline"
    className="flex-1"
  >
    Log Session
  </Button>
</div>
```

#### Proposed Grid Layout
```tsx
<div className="grid grid-cols-2 gap-3 my-5">
  <Button
    onClick={() => router.push("/sessions/new?mode=plan")}
    className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue-dark active:scale-[0.98] transition-all"
  >
    <BookOpen className="h-5 w-5 mr-2" />
    Plan Session
  </Button>
  <Button
    onClick={() => router.push("/sessions/new?mode=log")}
    variant="outline"
    className="h-12 px-5 text-base font-medium rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
  >
    <Plus className="h-5 w-5 mr-2" />
    Log Session
  </Button>
</div>
```

**Button Specifications:**

| Button Type | Height | Background | Text | Padding | Border | Font |
|-------------|--------|------------|------|---------|--------|------|
| **Primary** | 48px | ocean-blue | white | 0 24px | none | 16px/600 |
| **Secondary** | 48px | white | gray-700 | 0 20px | 1px gray-300 | 16px/500 |

**Interaction States:**
- **Hover (Primary):** `bg-ocean-blue-dark` (#006699)
- **Hover (Secondary):** `bg-gray-50`
- **Active:** `scale(0.98)` with transition
- **Focus:** 2px ocean-blue outline with 2px offset

**Icon Sizing:**
- Icon size: 20px × 20px (`h-5 w-5`)
- Icon margin: 8px right (`mr-2`)

---

### Phase 4: Forecast Tab Card Refinements

**Objective:** Polish forecast display with consistent styling

#### Beach Header Card

**Current:**
```tsx
<Card className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white">
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center justify-between">
      {/* ... */}
    </CardTitle>
  </CardHeader>
</Card>
```

**Enhanced:**
```tsx
<Card className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white rounded-lg border-0 shadow-md">
  <CardHeader className="pb-3 pt-4 px-5">
    <CardTitle className="flex items-center justify-between text-xl font-roboto font-bold">
      <div className="flex items-center space-x-2">
        <MapPin className="h-5 w-5" />
        <span>{effectiveBeach.name}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleViewBeach}
        className="text-ocean-blue h-9 px-4 text-sm font-semibold hover:bg-white/90 transition-all"
      >
        View Details
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </CardTitle>
  </CardHeader>
</Card>
```

#### KPI Tile Grid

**Current:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* KPI Tiles */}
</div>
```

**Specification:**
- **Grid:** 2 columns mobile, 4 columns desktop
- **Gap:** 16px (`gap-4`)
- **Tile height:** Auto (flexible)
- **Tile padding:** 16px (`p-4`)
- **Border radius:** 8px (`rounded-md`)

**KPI Tile Color Scheme:**
| Metric | Background | Text | Border |
|--------|------------|------|--------|
| Wave Height | blue-50 | blue-600 | transparent |
| Wind Speed | green-50 | green-600 | transparent |
| Water Temp | cyan-50 | cyan-600 | transparent |
| Confidence | purple-50 | purple-600 | transparent |

---

### Phase 5: Best Conditions Cards Enhancement

**Objective:** Apply AllTrails card styling patterns

#### Section Header
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h3 className="text-2xl font-roboto font-bold text-gray-900">
      Best Conditions Near You
    </h3>
    <p className="text-sm text-gray-600 mt-1">
      Top surf spots within 10 miles right now
    </p>
  </div>
</div>
```

#### Card Improvements

**Hover Effects:**
```tsx
className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-pointer
  hover:shadow-lg transition-all duration-200
  active:scale-[0.99]
  snap-start rounded-lg"
```

**Badge Consistency:**

Update skill level badge colors to match beach detail page:

```tsx
function getSkillLevelColor(level: string): string {
  const colors: Record<string, string> = {
    Beginner: "bg-blue-50 text-ocean-blue border-transparent",
    Intermediate: "bg-orange-50 text-orange-600 border-transparent",
    Advanced: "bg-red-50 text-red-600 border-transparent",
    Expert: "bg-red-50 text-red-700 border-transparent",
  };
  return colors[level] || colors.Intermediate;
}
```

**Card Layout Refinements:**
- **Image height:** 192px (`h-48`)
- **Card width:** 280px mobile, 320px tablet+
- **Border radius:** 12px (`rounded-lg`)
- **Shadow:** Default shadow-sm, hover shadow-lg
- **Padding:** 16px (`p-4`)

---

### Phase 6: Color & Badge Consistency

**Objective:** Unify color usage across home page components

#### Badge Color System

**Difficulty/Skill Level:**
```tsx
// Beginner/Easy
className="bg-blue-50 text-ocean-blue border-transparent"

// Intermediate/Moderate
className="bg-orange-50 text-orange-600 border-transparent"

// Advanced/Expert
className="bg-red-50 text-red-600 border-transparent"
```

**Status Indicators:**
```tsx
// Success/Good conditions
className="bg-green-50 text-green-600 border-green-200"

// Warning/Moderate
className="bg-yellow-50 text-yellow-600 border-yellow-200"

// Info/Neutral
className="bg-cyan-50 text-cyan-600 border-transparent"

// Danger/Poor conditions
className="bg-red-50 text-red-600 border-red-200"
```

#### Primary Color Usage

**All primary actions should use:**
- Background: `bg-ocean-blue` (#0077B6)
- Hover: `bg-ocean-blue-dark` (#006699) or `hover:bg-ocean-blue/90`
- Active: `active:bg-ocean-blue-dark`
- Focus: `focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2`

**Text links:**
- Default: `text-ocean-blue`
- Hover: `hover:text-ocean-blue-dark hover:underline`

---

### Phase 7: Spacing & Layout Refinements

**Objective:** Apply consistent 8px spacing system

#### Spacing Scale (8px base)

```tsx
// Section spacing
space-y-6  // 24px between components
mb-8       // 32px for major section breaks

// Card/component spacing
gap-4      // 16px grid gaps
gap-3      // 12px button gaps
gap-2      // 8px inline element gaps

// Internal padding
p-4        // 16px card padding
px-6 py-3  // 24px/12px button padding
```

#### Container Structure

**Main Content Container:**
```tsx
<main className="flex-1 home-container py-6 sm:py-8 lg:py-10
  space-y-8 overflow-auto pt-6">
  {/* content */}
</main>
```

**Centered Content Sections:**
```tsx
<section className="centered-container space-y-6">
  {/* section content */}
</section>
```

---

### Phase 8: Accessibility & Responsive Design

**Objective:** Ensure WCAG AA compliance and mobile optimization

#### Touch Target Requirements

All interactive elements must meet **44px × 44px minimum**:

- Buttons: `h-12` (48px) ✅
- Tabs: `py-3` = 48px total ✅
- Cards: Full card clickable ✅
- Icon buttons: Minimum 44px ✅

#### Keyboard Navigation

**Tab Navigation:**
```tsx
// Add keyboard support for tab switching
onKeyDown={(e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // Handle arrow key navigation
  }
}}
```

**Focus Indicators:**
```tsx
// Ensure visible focus rings
className="focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
```

#### Screen Reader Support

**ARIA Labels:**
```tsx
<nav aria-label="Home page sections">
  <TabsList role="tablist">
    <TabsTrigger role="tab" aria-selected={activeTab === "forecast"}>
      Forecast
    </TabsTrigger>
  </TabsList>
</nav>
```

**Live Regions:**
```tsx
<div aria-live="polite" aria-atomic="true">
  {forecastLoading ? "Loading forecast..." : "Forecast loaded"}
</div>
```

#### Mobile Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Mobile | < 640px | 2-col grids, reduced padding, larger touch targets |
| Tablet | 640-1024px | 3-col grids, medium padding |
| Desktop | > 1024px | 4-col grids, full padding |

**Responsive Typography:**
```tsx
// Maintain base sizes, adjust only for extreme cases
h1: text-3xl sm:text-4xl  // 30px → 36px
h2: text-xl sm:text-2xl   // 20px → 24px
body: text-base           // 16px (fixed)
```

---

## Implementation Checklist

### Phase 1: Foundation (1 hour) ✅ **COMPLETE - 2025-10-23**
- [x] Update welcome section typography
- [x] Apply consistent spacing system
- [x] Update section headings to AllTrails style
- [x] Test responsive behavior at all breakpoints

### Phase 2: Navigation (1 hour)
- [ ] Refactor tab styling to match beach detail
- [ ] Add hover and active states
- [ ] Test tab switching animations
- [ ] Verify keyboard navigation

### Phase 3: Actions (30 minutes)
- [ ] Convert button flex to grid layout
- [ ] Apply AllTrails button specs
- [ ] Add hover/active states
- [ ] Test button interactions

### Phase 4: Forecast Tab (1 hour)
- [ ] Polish beach header card
- [ ] Refine KPI tile grid
- [ ] Update forecast display styling
- [ ] Test data loading states

### Phase 5: Best Conditions (45 minutes)
- [ ] Update section header styling
- [ ] Refine card hover effects
- [ ] Fix badge color consistency
- [ ] Test horizontal scrolling

### Phase 6: Polish (30 minutes)
- [ ] Audit all color usage
- [ ] Ensure badge consistency
- [ ] Apply final spacing adjustments
- [ ] Cross-browser testing

### Phase 7: Accessibility (30 minutes)
- [ ] Verify touch target sizes
- [ ] Test keyboard navigation
- [ ] Add missing ARIA labels
- [ ] Test with screen reader

### Phase 8: Testing & Documentation (1 hour)
- [ ] E2E test updates
- [ ] Visual regression testing
- [ ] Update component tests
- [ ] Document changes

---

## Testing Strategy

### Visual Regression Testing

**Screenshot Comparison:**
- Home page before/after at all breakpoints
- Tab switching behavior
- Hover states on buttons and cards
- Loading states

**Tools:**
- Playwright screenshots
- Manual QA checklist

### Accessibility Testing

**WCAG AA Compliance:**
- [ ] Color contrast ratios ≥ 4.5:1
- [ ] Touch targets ≥ 44px
- [ ] Keyboard navigation functional
- [ ] Screen reader announcements correct
- [ ] Focus indicators visible

**Tools:**
- axe DevTools
- Lighthouse accessibility audit
- Manual keyboard testing

### Responsive Testing

**Breakpoints to test:**
- iPhone SE (375px)
- iPhone 14 Pro (393px)
- Tablet (768px)
- Desktop (1280px)
- Large desktop (1920px)

**Browsers:**
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

### E2E Test Updates

**Required test updates:**

```typescript
// e2e/home.spec.ts

test('action buttons have correct styling', async ({ page }) => {
  await page.goto('/');

  // Verify grid layout
  const buttonContainer = page.locator('div.grid.grid-cols-2');
  await expect(buttonContainer).toBeVisible();

  // Verify button heights
  const planButton = page.getByRole('button', { name: /plan session/i });
  const buttonBox = await planButton.boundingBox();
  expect(buttonBox?.height).toBeGreaterThanOrEqual(48);
});

test('tabs use AllTrails styling', async ({ page }) => {
  await page.goto('/');

  const tabsList = page.locator('[role="tablist"]');
  await expect(tabsList).toHaveClass(/border-b-2 border-gray-200/);

  const activeTab = page.locator('[role="tab"][aria-selected="true"]');
  await expect(activeTab).toHaveClass(/border-ocean-blue/);
});
```

---

## Success Metrics

### Visual Consistency
- [ ] All headings use Roboto font
- [ ] Consistent spacing throughout (8px system)
- [ ] Ocean-blue primary color on all CTAs
- [ ] Matching badge colors with beach detail page

### User Experience
- [ ] Improved visual hierarchy
- [ ] Clearer call-to-action buttons
- [ ] Smoother transitions and hover states
- [ ] Better touch targets for mobile

### Accessibility
- [ ] WCAG AA compliance maintained
- [ ] All interactive elements keyboard accessible
- [ ] Proper focus indicators
- [ ] Screen reader friendly

### Performance
- [ ] No regression in load times
- [ ] Smooth animations (60fps)
- [ ] No layout shifts (CLS)

---

## Design Tokens Reference

### Typography Scale
```tsx
// Headings
font-roboto font-bold

// Sizes
text-4xl   // 36px - Main headings
text-2xl   // 24px - Section headings
text-xl    // 20px - Card titles
text-base  // 16px - Body text
text-sm    // 14px - Metadata
text-xs    // 12px - Labels
```

### Color Palette
```tsx
// Primary
ocean-blue: #0077B6
ocean-blue-dark: #006699

// Grays
gray-900: #171717 (headings)
gray-600: #525252 (body text)
gray-400: #A3A3A3 (muted)
gray-200: #E5E5E5 (borders)
gray-50: #FAFAFA (backgrounds)

// Status colors
blue-50/ocean-blue   // Info
green-50/green-600   // Success
yellow-50/yellow-600 // Warning
orange-50/orange-600 // Intermediate
red-50/red-600       // Danger/Advanced
```

### Spacing System (8px base)
```tsx
gap-2: 8px
gap-3: 12px
gap-4: 16px
mb-6: 24px
mb-8: 32px
px-5: 20px
px-6: 24px
py-3: 12px
```

### Border & Shadows
```tsx
// Borders
border: 1px
border-2: 2px
rounded-md: 8px
rounded-lg: 12px

// Shadows
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
shadow-md: 0 4px 6px rgba(0,0,0,0.1)
shadow-lg: 0 10px 15px rgba(0,0,0,0.1)

// Transitions
transition-all duration-200
```

---

## Files to Modify

### Primary Components
1. `components/home-screen/index.tsx` - Main home screen layout
2. `components/home-screen/forecast-tab.tsx` - Forecast display
3. `components/home-screen/best-conditions-cards.tsx` - Beach cards
4. `components/home-screen/nearby-tab.tsx` - Nearby beaches
5. `components/home-screen/community-tab.tsx` - Community content

### Test Files
1. `e2e/home.spec.ts` - E2E tests
2. `__tests__/components/home/HomeScreen.test.tsx` - Component tests

### Documentation
1. `CHANGELOG.md` - Record changes
2. `docs/HOME_PAGE_DESIGN_REFACTOR.md` - This document

---

## Risk Assessment

### Low Risk
- Typography updates (easily reversible)
- Color consistency (brand alignment)
- Spacing adjustments (visual only)

### Medium Risk
- Tab navigation refactor (user interaction)
- Button grid layout (responsive behavior)
- Card styling changes (affects multiple components)

### Mitigation Strategies
1. **Feature flags:** Use environment variable to toggle new design
2. **A/B testing:** Deploy to subset of users first
3. **Rollback plan:** Keep previous code in git history
4. **User feedback:** Monitor analytics for engagement changes

---

## Timeline

### Week 1: Foundation & Core Components
- Day 1-2: Typography and spacing updates
- Day 3: Tab navigation refactor
- Day 4: Button grid implementation
- Day 5: Testing and refinements

### Week 2: Polish & Launch
- Day 1-2: Forecast tab and card refinements
- Day 3: Color consistency and accessibility
- Day 4: E2E test updates
- Day 5: Final QA and deployment

**Total Estimated Effort:** 5-6 development days

---

## Success Criteria

### Must Have (Launch Blockers)
- [ ] All headings use AllTrails typography
- [ ] Tabs match beach detail styling
- [ ] Action buttons in grid layout with correct sizing
- [ ] Color consistency across all badges
- [ ] Touch targets ≥ 44px
- [ ] No accessibility regressions
- [ ] All E2E tests passing

### Nice to Have (Post-Launch)
- [ ] Advanced hover animations
- [ ] Skeleton loading states refinement
- [ ] Card swipe gestures for mobile
- [ ] Performance optimizations

---

## Post-Launch Monitoring

### Analytics to Track
1. **Engagement metrics:**
   - Tab switching frequency
   - Action button click-through rate
   - Time on home page

2. **User behavior:**
   - Scroll depth
   - Card interaction rates
   - Mobile vs desktop usage

3. **Technical metrics:**
   - Page load time
   - Core Web Vitals (LCP, FID, CLS)
   - Error rates

### Success Indicators
- No decrease in user engagement
- Improved clarity metrics (user surveys)
- Maintained or improved performance scores
- Positive user feedback

---

## References

### Internal Documentation
- [Beach Page Design](./BEACH_PAGE_DESIGN.md)
- [Design Principles](./DESIGN_PRINCIPLES.md)
- [AllTrails Layout Spec](./alltrails_layout_spec.md)
- [Style Guide](./STYLE_GUIDE.md)

### External Resources
- [AllTrails Trail Pages](https://www.alltrails.com) - Design inspiration
- [Material Design Tabs](https://m3.material.io/components/tabs) - Interaction patterns
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards

### Git References
- Beach detail refactor commits: [55c1d0e](commit/55c1d0e) through [bbe8b32](commit/bbe8b32)
- Landing page redesign: [1d4063b](commit/1d4063b)

---

## Appendix A: Before/After Comparisons

### Welcome Section

**Before:**
```tsx
<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Hey, {userName}!
</h2>
<p className="text-muted-foreground text-base sm:text-lg lg:text-xl">
  The waves are looking good today.
</p>
<div className="flex gap-2">
  <Button className="flex-1 bg-ocean-blue">Plan Session</Button>
  <Button variant="outline" className="flex-1">Log Session</Button>
</div>
```

**After:**
```tsx
<h2 className="text-4xl font-roboto font-bold leading-[44px] text-gray-900">
  Hey, {userName}!
</h2>
<p className="text-base text-gray-600 mt-3">
  The waves are looking good today.
</p>
<div className="grid grid-cols-2 gap-3 my-5">
  <Button className="h-12 px-6 text-base font-semibold rounded-md
    bg-ocean-blue hover:bg-ocean-blue-dark active:scale-[0.98] transition-all">
    <BookOpen className="h-5 w-5 mr-2" />
    Plan Session
  </Button>
  <Button variant="outline" className="h-12 px-5 text-base font-medium
    rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all">
    <Plus className="h-5 w-5 mr-2" />
    Log Session
  </Button>
</div>
```

### Tab Navigation

**Before:**
```tsx
<TabsList className="grid grid-cols-3 w-full mx-auto h-12 sm:h-14">
  <TabsTrigger value="forecast" className="text-sm sm:text-base">
    Forecast
  </TabsTrigger>
</TabsList>
```

**After:**
```tsx
<TabsList className="w-full justify-start border-b-2 border-gray-200 mb-6
  rounded-none bg-transparent p-0 h-auto">
  <TabsTrigger value="forecast" className="rounded-none border-b-2
    border-transparent -mb-0.5 px-2 py-2 sm:px-6 sm:py-3 text-xs sm:text-base
    font-medium text-gray-600 transition-all duration-200
    hover:bg-gray-50 hover:text-gray-900
    data-[state=active]:border-ocean-blue
    data-[state=active]:text-ocean-blue
    data-[state=active]:font-semibold">
    Forecast
  </TabsTrigger>
</TabsList>
```

---

## Appendix B: Component Inventory

### Components Requiring Updates

| Component | Priority | Effort | Risk |
|-----------|----------|--------|------|
| HomeScreen index | High | 2h | Low |
| Tab navigation | High | 1.5h | Medium |
| Action buttons | High | 1h | Low |
| ForecastTab | Medium | 1.5h | Low |
| BestConditionsCards | Medium | 1h | Low |
| NearbyTab | Low | 1h | Low |
| CommunityTab | Low | 30m | Low |

### Components Not Requiring Changes

- BeachSearchBar (already styled consistently)
- NearbyBeachChips (minor updates only)
- HomeBeachBanner (already matches design)

---

**Document Maintained By:** Quiver Development Team
**Last Review:** January 2025
**Next Review:** After implementation completion

**Status:** ✅ Ready for implementation
