# Navigation Header Refactor Implementation Guide

## Overview

This guide provides step-by-step instructions for refactoring Quiver's navigation header to adopt AllTrails-inspired patterns while maintaining Quiver's brand identity and design principles.

**Current State:** Simple logo + user avatar dropdown
**Target State:** Prominent search bar + navigation links + enhanced user actions

---

## Design System Mapping: AllTrails → Quiver

### Color Translations

| AllTrails Pattern | AllTrails Color | Quiver Equivalent | Quiver Value |
|------------------|-----------------|-------------------|--------------|
| Primary Brand | `#428A13` (green) | Ocean Blue | `#0077B6` |
| Primary Hover | `#3B7A11` (dark green) | Ocean Blue Dark | `#006699` |
| Text Primary | `#262626` | Foreground | `hsl(222.2 84% 4.9%)` |
| Text Secondary | `#404040` | Muted Foreground (60%) | `hsl(215.4 16.3% 46.9%)` |
| Text Muted | `#737373` | Muted Foreground | `hsl(215.4 16.3% 46.9%)` |
| Placeholder | `#A3A3A3` | Muted Foreground (lighter) | Use `text-muted-foreground` |
| Border/Divider | `#E5E5E5` | Border | `hsl(214.3 31.8% 91.4%)` |
| Background Neutral | `#F5F5F5` | Muted | `hsl(210 40% 96.1%)` |
| Focus Ring | `rgba(66, 138, 19, 0.1)` | Ocean Blue Ring | `rgba(0, 119, 182, 0.1)` |
| Error/Notification | `#FF4444` | Destructive | `hsl(0 84.2% 60.2%)` |

### Typography Mapping

| AllTrails | Quiver Equivalent | Tailwind Classes |
|-----------|-------------------|------------------|
| 15px medium | Body text | `text-base font-medium` (Open Sans) |
| 14px semibold | Button text | `text-sm font-semibold` (Roboto) |
| Logo text | Brand heading | `text-xl font-bold text-primary` (Roboto) |
| 12px regular | Small labels | `text-xs` (Open Sans) |

---

## Component Specifications

### 1. Navigation Container

**Desktop (≥768px):**
```
Position: sticky
Top: 0
Width: 100%
Height: 64px
Background: bg-background/95 backdrop-blur
Border-bottom: border-b border-border
Box-shadow: shadow-sm (0 2px 4px rgba(0,0,0,0.08))
Z-index: z-50
Padding: px-6 lg:px-8
```

**Mobile (<768px):**
```
Height: 56px
Padding: px-4
Safe-area-inset-top: env(safe-area-inset-top, 0px)
```

**Implementation:**
```tsx
<header className="sticky top-0 z-50 w-full border-b border-border
  bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
  pb-2 pt-[calc(var(--app-safe-area-top)+1.5rem)] md:py-0 shadow-sm">
```

### 2. Inner Container

**Structure:**
```
Max-width: 1440px (AllTrails) → Use Quiver's home-container pattern (1280px)
Display: flex
Align-items: center
Justify-content: space-between
Height: 100%
Margin: 0 auto
```

**Implementation:**
```tsx
<div className="home-container flex items-center justify-between h-full
  md:h-16">
```

### 3. Logo Section (Left)

**Specifications:**
```
Display: flex
Align-items: center
Gap: 40px (desktop), 24px (mobile)
```

**Logo:**
- Text: "Quiver"
- Font: Roboto Bold
- Size: `text-xl md:text-2xl`
- Color: `text-primary`
- Hover: `hover:text-primary/90 transition-colors duration-300`

**Implementation:**
```tsx
<div className="flex items-center gap-6 md:gap-10">
  <Link href="/" className="flex items-center space-x-2 group">
    <div className="text-xl md:text-2xl font-bold text-primary
      transition-colors duration-300 hover:text-primary/90">
      Quiver
    </div>
  </Link>
  {/* Search bar next */}
</div>
```

### 4. Search Bar (Center - NEW FEATURE)

**Desktop Container:**
```
Max-width: 600px
Width: 100% (flexible)
Height: 44px
Margin: 0 (handled by flex spacing)
```

**Search Input Container:**
```
Display: flex relative
Background: bg-muted (matches AllTrails #F5F5F5)
Border: border border-transparent
Border-radius: rounded-full (pill shape = 24px)
Padding: px-4
Transition: all 200ms ease-in-out
```

**Focus State:**
```
Border-color: border-primary
Background: bg-background (white)
Ring: ring-4 ring-primary/10
```

**Search Icon:**
```
Position: absolute left-4
Size: h-5 w-5
Color: text-muted-foreground
Transform: top-1/2 -translate-y-1/2
```

**Input Field:**
```
Border: none
Background: transparent
Font-size: text-sm
Line-height: leading-tight
Padding: pl-9 pr-4 (account for icon)
Width: full
Placeholder: text-muted-foreground
Text: text-foreground
Focus: outline-none (ring handled by container)
```

**Implementation:**
```tsx
<div className="hidden md:flex flex-1 max-w-[600px] mx-8">
  <div className="relative w-full group">
    <div className="flex items-center h-11 px-4 bg-muted border
      border-transparent rounded-full transition-all duration-200
      focus-within:bg-background focus-within:border-primary
      focus-within:ring-4 focus-within:ring-primary/10">
      <Search className="absolute left-4 h-5 w-5 text-muted-foreground
        pointer-events-none" />
      <input
        type="text"
        placeholder="Search beaches, spots, or sessions..."
        className="flex-1 bg-transparent border-none outline-none
          text-sm pl-9 pr-4 text-foreground placeholder:text-muted-foreground"
        aria-label="Search Quiver"
      />
    </div>
  </div>
</div>

{/* Mobile: Search icon button instead */}
<button className="md:hidden p-2 rounded-full hover:bg-muted
  transition-colors" aria-label="Search">
  <Search className="h-5 w-5 text-muted-foreground" />
</button>
```

### 5. Navigation Links (Center-Right - NEW FEATURE)

**Desktop Only (≥768px):**
```
Display: flex
Align-items: center
Gap: 32px (lg screens), 24px (md screens)
```

**Link Specifications:**
```
Font-size: text-sm
Font-weight: font-medium
Color: text-muted-foreground (60% opacity equivalent)
Hover: text-primary
Active: text-primary font-semibold
Transition: all 200ms ease
```

**Suggested Links for Quiver:**
- "Discover" → Map/Beach discovery
- "Sessions" → User sessions/logs
- "Community" → Social features

**Dropdown Arrow (if needed):**
```
Size: h-3 w-3
Margin-left: ml-1.5
Transform: rotate-0 (closed), rotate-180 (open)
Transition: transform 200ms ease
```

**Implementation:**
```tsx
<nav className="hidden lg:flex items-center gap-8">
  <Link href="/map" className="text-sm font-medium text-muted-foreground
    hover:text-primary transition-colors duration-200">
    Discover
  </Link>
  <Link href="/sessions" className="text-sm font-medium text-muted-foreground
    hover:text-primary transition-colors duration-200">
    Sessions
  </Link>
  <Link href="/community" className="text-sm font-medium text-muted-foreground
    hover:text-primary transition-colors duration-200">
    Community
  </Link>
</nav>
```

### 6. Right Section (User Actions)

**Container:**
```
Display: flex
Align-items: center
Gap: 20px (desktop), 16px (mobile)
Margin-left: auto
```

#### Notification Bell Icon (NEW - Extracted from Dropdown)

**Specifications:**
```
Size: h-6 w-6
Color: text-foreground/70
Position: relative (for badge)
Hover: text-foreground transition-colors
```

**Notification Badge:**
```
Position: absolute -top-1 -right-1
Size: h-5 w-5 (or min-w-5 for larger numbers)
Background: bg-destructive
Text: text-destructive-foreground text-xs font-semibold
Border-radius: rounded-full
Border: border-2 border-background
Display: Conditionally (only if count > 0)
```

**Implementation:**
```tsx
{user && (
  <Link href="/inbox" className="relative p-2 rounded-full
    hover:bg-muted transition-colors" aria-label="Notifications">
    <Bell className="h-6 w-6 text-foreground/70
      hover:text-foreground transition-colors" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 flex items-center
        justify-center h-5 min-w-5 px-1 bg-destructive
        text-destructive-foreground text-xs font-semibold rounded-full
        border-2 border-background">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </Link>
)}
```

#### User Avatar & Dropdown

**Avatar Specifications:**
```
Size: h-9 w-9 (36px)
Border-radius: rounded-full
Border: border-2 border-transparent
Cursor: cursor-pointer
Transition: all 200ms ease
```

**Hover State:**
```
Border-color: border-primary
Ring: ring-3 ring-primary/10
```

**Implementation (Keep existing but enhance):**
```tsx
<DropdownMenuTrigger asChild>
  <Button variant="ghost" className="relative h-9 w-9 rounded-full
    border-2 border-transparent hover:border-primary
    hover:ring-3 hover:ring-primary/10 transition-all duration-200">
    <UserAvatar
      src={profile?.avatar_url}
      name={profile?.full_name}
      email={user?.email}
      size="sm"
      isLoading={profileLoading}
    />
  </Button>
</DropdownMenuTrigger>
```

**Dropdown Menu Updates:**
- Remove Notifications item (now a top-level icon)
- Keep: User info, Profile link, Log out
- Optional additions: Settings, Preferences

#### Guest State (Not Logged In)

**Container:**
```
Display: flex
Gap: 16px
```

**Log In Link:**
```
Font-size: text-sm
Font-weight: font-medium
Color: text-muted-foreground
Hover: text-primary
```

**Sign Up Button:**
```
Height: h-10 (40px)
Padding: px-5
Background: bg-primary
Color: text-primary-foreground
Border-radius: rounded-full (pill shape)
Font-size: text-sm
Font-weight: font-semibold
Hover: bg-primary/90
Shadow: shadow-sm
Transition: all 200ms ease
Active: scale-98
```

**Implementation:**
```tsx
<div className="flex items-center gap-4">
  <Link href="/auth/sign-in">
    <Button variant="ghost" size="sm" className="text-sm font-medium">
      Log In
    </Button>
  </Link>
  <Link href="/auth/sign-up">
    <Button size="sm" className="bg-primary hover:bg-primary/90
      text-primary-foreground rounded-full px-5 h-10 font-semibold
      shadow-sm transition-all duration-200 active:scale-98">
      Sign Up
    </Button>
  </Link>
</div>
```

### 7. Mobile Hamburger Menu (Optional Enhancement)

**Display Rules:**
```
Display: hidden (desktop ≥768px)
Display: flex (mobile <768px)
```

**Specifications:**
```
Width: w-6 h-6
Position: relative
Margin: ml-4
```

**Hamburger Lines:**
```
Width: w-6
Height: h-0.5
Background: bg-foreground
Border-radius: rounded-sm
Transition: all 300ms ease
```

**Implementation:**
```tsx
<button className="md:hidden p-2 rounded-md hover:bg-muted
  transition-colors" aria-label="Menu">
  <Menu className="h-6 w-6" />
</button>
```

---

## Responsive Behavior

### Breakpoints (Tailwind Standard)

| Breakpoint | Size | Behavior |
|-----------|------|----------|
| `sm` | 640px | - |
| `md` | 768px | Show search bar, hide hamburger |
| `lg` | 1024px | Show navigation links |
| `xl` | 1280px | Full layout with optimal spacing |

### Mobile (<768px)

**Layout:**
```
┌─────────────────────────────────┐
│ Logo    [Search]  [Bell]  Avatar│
└─────────────────────────────────┘
```

**Changes:**
- Search bar → Search icon button
- Navigation links → Hidden (moved to hamburger or bottom nav)
- Spacing reduced: `gap-4` instead of `gap-8`
- Height: 56px

### Tablet (768px-1024px)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Logo  [Search Bar........]  [Bell]  Avatar  │
└─────────────────────────────────────────────┘
```

**Changes:**
- Search bar visible but compact
- Navigation links still hidden
- Notification bell visible

### Desktop (≥1024px)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Logo [Search Bar.......]  Discover Sessions  [Bell] Avatar│
└──────────────────────────────────────────────────────────┘
```

**Full Features:**
- All elements visible
- Optimal spacing
- Hover states active

---

## Dropdown Menus Specification

### Container

**Positioning:**
```
Position: absolute
Top: calc(100% + 8px)
Alignment: align-end (right-aligned)
Background: bg-popover
Border-radius: rounded-xl (12px)
Shadow: shadow-lg (0 4px 24px rgba(0,0,0,0.12))
Border: border border-border
Min-width: min-w-56 (220px)
Padding: p-2 (8px)
Z-index: z-[1001]
```

### Menu Items

**Specifications:**
```
Height: h-10 (40px)
Padding: px-4
Display: flex items-center
Font-size: text-sm
Color: text-popover-foreground
Hover: bg-accent
Border-radius: rounded-md
Transition: background 200ms ease
Cursor: cursor-pointer
```

### Menu Divider

**Specifications:**
```
Height: h-px
Background: bg-border
Margin: my-2
```

**Implementation (use shadcn/ui components):**
```tsx
<DropdownMenuContent className="w-56" align="end" forceMount>
  <DropdownMenuLabel className="font-normal">
    <div className="flex flex-col space-y-1">
      <p className="text-sm font-medium">{profile?.full_name || "Surfer"}</p>
      <p className="text-xs text-muted-foreground">{user?.email}</p>
    </div>
  </DropdownMenuLabel>
  <DropdownMenuSeparator />
  <DropdownMenuItem asChild>
    <Link href="/profile" className="cursor-pointer">
      <User className="mr-2 h-4 w-4" />
      <span>Profile</span>
    </Link>
  </DropdownMenuItem>
  {/* Remove Notifications item - now top-level icon */}
  <DropdownMenuSeparator />
  <DropdownMenuItem className="cursor-pointer text-destructive
    focus:text-destructive" onClick={handleSignOut}>
    <LogOut className="mr-2 h-4 w-4" />
    <span>Log out</span>
  </DropdownMenuItem>
</DropdownMenuContent>
```

---

## Animation & Motion Specifications

### Timing Functions (from Quiver constants)

```typescript
// Use existing DURATIONS from lib/constants/animations.ts
const TRANSITIONS = {
  fast: '200ms ease-out',      // Hover states
  standard: '300ms ease-in-out', // Focus transitions
  slow: '400ms ease-in-out',    // Dropdown animations
};
```

### Hover Interactions

**Links:**
```css
transition: color 200ms ease-out
hover:text-primary
```

**Buttons:**
```css
transition: all 200ms ease-out
hover:bg-primary/90
hover:scale-105
```

**Icons:**
```css
transition: color 200ms ease-out
hover:text-foreground
```

**Avatar:**
```css
transition: all 200ms ease-out
hover:border-primary
hover:ring-3 hover:ring-primary/10
```

### Focus States

**Search Input:**
```css
focus-within:bg-background
focus-within:border-primary
focus-within:ring-4 focus-within:ring-primary/10
transition: all 200ms ease-in-out
```

**Buttons/Links:**
```css
focus-visible:ring-2
focus-visible:ring-primary
focus-visible:ring-offset-2
```

### Active/Press States

**Buttons:**
```css
active:scale-98
transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Dropdown Animations

**Menu Container:**
```
Initial: opacity-0 scale-95
Animate: opacity-100 scale-100
Duration: 200ms ease-out
```

**Implementation (shadcn/ui handles this):**
shadcn's DropdownMenu components include Radix UI animations by default.

### Reduced Motion Support

**Implementation:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

Already present in `app/globals.css`.

---

## Accessibility Requirements

### Keyboard Navigation

**Tab Order:**
1. Logo link
2. Search input
3. Navigation links (Discover, Sessions, Community)
4. Search icon button (mobile)
5. Notification bell (if authenticated)
6. User avatar dropdown trigger
7. Sign In / Sign Up buttons (if guest)

**Focus Indicators:**
- All interactive elements: `focus-visible:ring-2 focus-visible:ring-primary`
- Search input: Handled by container focus-within state
- Dropdown items: Native focus styling from shadcn/ui

### ARIA Labels

**Required:**
```tsx
// Search input
<input aria-label="Search Quiver" />

// Search icon button (mobile)
<button aria-label="Search">...</button>

// Notification bell
<button aria-label="Notifications">...</button>
<button aria-label="Notifications, 3 unread">...</button> // With count

// Menu button (mobile)
<button aria-label="Menu" aria-expanded="false">...</button>

// User avatar
<Button aria-label="User menu">...</Button>
```

### Color Contrast

**Verify WCAG AA (4.5:1 for normal text):**
- Ocean Blue (#0077B6) on white: ✅ 4.55:1
- Foreground text on background: ✅ >7:1
- Muted foreground on background: ✅ >4.5:1
- Destructive (red badge) on white: ✅ >4.5:1

### Screen Reader Considerations

**Dropdown Menu:**
- Use semantic `<nav>` for navigation links
- DropdownMenu components include proper ARIA attributes
- Notification count announced with aria-label

**Search:**
- Label or aria-label required
- Use `role="search"` on container if needed

### Touch Targets (Mobile)

**Minimum Size: 44×44px**
- Buttons: `h-10 px-5` ≥ 40px (acceptable)
- Icon buttons: `p-2` with icon `h-6 w-6` = 40×40px (acceptable)
- Avatar: `h-9 w-9` = 36px (⚠️ Add padding: `p-1.5` = 42px total)

**Spacing:**
- Minimum gap between touch targets: 8px
- Implementation: `gap-4` (16px) ✅

---

## Implementation Phases

### Phase 1: Search Bar Integration

**Goal:** Add prominent search functionality

**Steps:**

1. **Update `components/app-header.tsx`:**
   - Add Search icon import from lucide-react
   - Create search bar component between logo and right actions
   - Implement desktop/mobile variants (bar vs. icon)
   - Add state management for search input
   - Connect to search functionality (route to /search or filter)

2. **Test:**
   - Desktop: Full search bar visible
   - Mobile: Search icon button visible
   - Focus states working
   - Keyboard navigation functional

**Estimated Effort:** 2-3 hours

---

### Phase 2: Navigation Links

**Goal:** Add primary navigation links to header

**Steps:**

1. **Define Navigation Structure:**
   - Review app routes: Map, Sessions, Community, Profile
   - Decide which links belong in header vs. bottom navigation
   - Suggested: Discover (map), Sessions, Community in header

2. **Update `components/app-header.tsx`:**
   - Add navigation section between search and right actions
   - Implement active state detection (pathname matching)
   - Add responsive behavior (hide on mobile/tablet)
   - Preserve query parameters in navigation

3. **Test:**
   - Active states correct on each page
   - Hover states working
   - Hidden on mobile (<1024px)
   - Links functional and accessible

**Estimated Effort:** 2 hours

---

### Phase 3: Notification Bell Extraction

**Goal:** Promote notifications from dropdown to top-level icon

**Steps:**

1. **Update `components/app-header.tsx`:**
   - Add Bell icon import (already exists)
   - Create standalone notification button with badge
   - Position between navigation links and user avatar
   - Link to `/inbox` page
   - Remove Notifications item from user dropdown menu

2. **Styling:**
   - Match AllTrails pattern with absolute-positioned badge
   - Use Quiver destructive color for badge
   - Add hover states and transitions

3. **Test:**
   - Badge displays correctly with count
   - Badge hidden when count = 0
   - Link navigates to inbox
   - Real-time updates working (subscription already exists)

**Estimated Effort:** 1-2 hours

---

### Phase 4: Enhanced Styling & Polish

**Goal:** Match AllTrails visual quality with Quiver branding

**Steps:**

1. **Typography:**
   - Verify font families (Roboto for UI, Open Sans for body)
   - Adjust font weights and sizes per spec
   - Ensure consistency across breakpoints

2. **Spacing & Layout:**
   - Fine-tune gaps and padding
   - Verify max-width container behavior
   - Test at all breakpoints (mobile, tablet, desktop, wide)

3. **Hover & Focus States:**
   - Add smooth transitions to all interactive elements
   - Verify focus-visible rings on all interactive elements
   - Test avatar hover with border + ring effect

4. **Button Styles:**
   - Update Sign Up button to rounded-full
   - Adjust padding and hover states
   - Add active press state (scale-98)

5. **Accessibility:**
   - Add all required aria-labels
   - Test keyboard-only navigation
   - Verify color contrast
   - Test with screen reader (VoiceOver/NVDA)

**Estimated Effort:** 3-4 hours

---

### Phase 5: Mobile Enhancements (Optional)

**Goal:** Improve mobile experience with hamburger menu or slide-out

**Steps:**

1. **Mobile Search Modal:**
   - Clicking search icon opens full-screen search modal
   - Includes recent searches, suggestions
   - Smooth animation (slide up from bottom)

2. **Mobile Navigation Menu (if desired):**
   - Add hamburger menu button
   - Implement slide-out drawer for navigation links
   - Include user info and quick actions
   - Use Quiver's motion patterns

3. **Test:**
   - Smooth animations
   - Touch-friendly targets
   - No layout shifts
   - Backdrop blur working

**Estimated Effort:** 4-6 hours

---

## Testing Checklist

### Visual Testing

- [ ] Desktop (≥1024px): All elements visible and properly spaced
- [ ] Tablet (768px-1024px): Search bar visible, nav links hidden
- [ ] Mobile (<768px): Search icon, notification, avatar visible
- [ ] Logo displays correctly at all breakpoints
- [ ] Colors match Quiver brand (ocean blue, not green)
- [ ] Typography uses correct fonts and sizes
- [ ] Shadows and borders consistent with design system

### Interaction Testing

- [ ] Search input focus state works (ring, background change)
- [ ] Navigation links highlight on hover
- [ ] Active route detection working
- [ ] Notification badge displays correct count
- [ ] Notification badge hidden when count = 0
- [ ] Avatar hover state (border + ring)
- [ ] Sign Up button hover and active states
- [ ] All links navigate correctly
- [ ] Query parameters preserved in navigation

### Accessibility Testing

- [ ] Tab order logical and complete
- [ ] All interactive elements reachable via keyboard
- [ ] Focus indicators visible on all elements
- [ ] All buttons/icons have aria-labels
- [ ] Notification count announced to screen readers
- [ ] Touch targets minimum 40×40px (mobile)
- [ ] Color contrast WCAG AA compliant
- [ ] Screen reader announces all content correctly
- [ ] Reduced motion preference respected

### Responsive Testing

- [ ] No horizontal scroll at any breakpoint
- [ ] Safe area insets working on iOS/Android
- [ ] Layout doesn't break between breakpoints
- [ ] Touch targets adequate on mobile
- [ ] Dropdown menus position correctly on all screen sizes
- [ ] Test on iPhone (notch/dynamic island)
- [ ] Test on Android (various screen sizes)

### Performance Testing

- [ ] No layout shifts during load
- [ ] Smooth animations at 60fps
- [ ] Backdrop blur performs well
- [ ] No unnecessary re-renders
- [ ] Subscription doesn't cause performance issues

### Cross-Browser Testing

- [ ] Chrome/Edge (Chromium)
- [ ] Safari (macOS and iOS)
- [ ] Firefox
- [ ] Chrome/Safari (Android)

---

## Code Organization

### File Structure

```
components/
  app-header.tsx (primary file to modify)
  user-avatar.tsx (keep existing)
  ui/
    dropdown-menu.tsx (shadcn - no changes)
    button.tsx (shadcn - no changes)
    badge.tsx (shadcn - no changes)

app/
  globals.css (verify motion classes exist)
  layout.tsx (no changes needed)

lib/
  constants/
    animations.ts (reference for timing values)
  utils/
    navigation-utils.ts (keep preserveQueryParams helper)
```

### New Components (Optional for Organization)

If header becomes too complex, consider extracting:

```typescript
// components/header/search-bar.tsx
export function SearchBar() {
  // Desktop search bar with focus states
}

// components/header/mobile-search-button.tsx
export function MobileSearchButton() {
  // Mobile search icon button
}

// components/header/navigation-links.tsx
export function NavigationLinks() {
  // Primary navigation links
}

// components/header/notification-bell.tsx
export function NotificationBell({ count }: { count: number }) {
  // Notification icon with badge
}
```

**Benefits:**
- Cleaner code organization
- Easier testing
- Better reusability
- Follows Quiver's modularity principle

---

## Integration with Existing Features

### Bottom Navigation (Mobile)

**Current State:**
- Bottom nav includes: Home, Map, Discover, Profile
- Auto-hides after inactivity

**Changes:**
- Top nav focuses on search and global actions
- Bottom nav remains for primary app sections
- No conflicts - complementary navigation systems

### User Profile Hook

**Current Implementation:**
```typescript
const { profile, loading } = useUserProfile({
  userId: user?.id,
  enabled: !!user,
});
```

**No changes needed** - continues to power avatar display.

### Notifications Subscription

**Current Implementation:**
```typescript
useSessionInvitationsSubscription(user?.id, user?.email, refetchUnreadCount);
```

**No changes needed** - real-time updates continue to work.
Badge will update automatically when subscription triggers refetch.

### Authentication State

**Current Pattern:**
```typescript
const { user, isLoading, signOut } = useAuth();
```

**No changes needed** - conditional rendering already in place.

---

## Performance Considerations

### Optimization Strategies

1. **Debounce Search Input:**
   ```typescript
   const [searchQuery, setSearchQuery] = useState('');
   const debouncedSearch = useDebounce(searchQuery, 300);

   useEffect(() => {
     if (debouncedSearch) {
       // Fetch search results
     }
   }, [debouncedSearch]);
   ```

2. **Memoize Navigation Items:**
   ```typescript
   const navItems = useMemo(() => [
     { name: 'Discover', href: '/map' },
     { name: 'Sessions', href: '/sessions' },
     { name: 'Community', href: '/community' },
   ], []);
   ```

3. **Lazy Load Search Results:**
   - Don't fetch until user types
   - Show skeleton/spinner while loading
   - Cancel previous requests on new input

4. **Optimize Backdrop Blur:**
   - Already implemented: `supports-[backdrop-filter]:bg-background/60`
   - Fallback to solid background on unsupported browsers

5. **Minimize Re-renders:**
   - Extract static elements to separate components
   - Use React.memo for expensive components
   - Avoid inline object/array creation

### Performance Budget

| Metric | Target | Notes |
|--------|--------|-------|
| Header load time | <100ms | Should not block page render |
| Search input lag | <50ms | Debounce helps |
| Dropdown open | <200ms | Smooth animation |
| Avatar image load | <500ms | Use next/image optimization |
| Notification fetch | <1s | Background request, not blocking |

---

## Migration Strategy

### Safe Rollout

**Step 1: Feature Flag (Optional)**
```typescript
// If you want gradual rollout
const useNewHeader = process.env.NEXT_PUBLIC_NEW_HEADER === 'true';

return useNewHeader ? <NewAppHeader /> : <AppHeader />;
```

**Step 2: Branch Strategy**
- Create feature branch: `feature/nav-header-refactor`
- Implement Phase 1-4 in order
- Test thoroughly after each phase
- Request design review
- Merge to main when complete

**Step 3: Monitoring**
- Watch for error logs related to header
- Monitor performance metrics (Core Web Vitals)
- Gather user feedback on new search/navigation
- A/B test if desired (track engagement with search)

### Rollback Plan

**If issues arise:**
1. Git revert is straightforward - single component file
2. Feature flag allows instant disable
3. Keep old component as `app-header-legacy.tsx` temporarily

---

## Design Principles Alignment

### ✅ Simplicity & Consistency
- Uses Quiver's established token system
- Follows shadcn/ui component patterns
- Leverages existing hooks (useAuth, useUserProfile, useDataFetcher)
- No ad-hoc state management

### ✅ Modularity & Reusability (DRY)
- Reuses UserAvatar component
- Leverages shadcn/ui DropdownMenu
- Can extract sub-components for further modularity
- Follows component ARCHITECTURE.md patterns

### ✅ Performance by Design
- Memoized callbacks and data fetching
- Debounced search input
- Efficient re-render strategy
- GPU-accelerated animations
- Backdrop blur with fallback

### ✅ Security & Privacy by Default
- Authentication checks maintained
- Profile data fetched securely via existing hooks
- No inline auth logic
- Preserves query parameters safely

### ✅ Transparency & User Trust
- Clear navigation structure
- Visible notification indicators
- Search prominence improves discoverability
- Accessible to all users

### ✅ Comprehensive Testing & QA
- Detailed testing checklist provided
- Accessibility requirements specified
- Cross-browser testing planned
- E2E test scenarios defined (can add Playwright tests)

### ✅ Motion Design System
- Uses established DURATIONS constants
- Respects prefers-reduced-motion
- Smooth, purposeful animations
- Consistent with Session Wizard patterns
- 60fps target maintained

### ✅ Growth-Driven Product Focus
- Prominent search improves discovery
- Social features accessible via Community link
- Notifications prominently displayed
- Streamlined user experience reduces friction

---

## Quiver-Specific Customizations

### Beyond AllTrails Pattern

While AllTrails provides the structural inspiration, here are Quiver-specific enhancements:

1. **Beach Photo Integration:**
   - Consider adding a rotating beach photo in the background (subtle, blurred)
   - Matches landing page hero aesthetic
   - Performance: Use low-res, optimized images

2. **Active Session Indicator:**
   - If user has an active planned session, show mini indicator
   - Example: Small badge on Sessions link "1 active"
   - Drives engagement with session planning feature

3. **Home Beach Quick Link:**
   - If user has set a home beach, show mini icon/link in header
   - Quick access to favorite spot
   - Aligns with home beach feature prominence

4. **Surf Conditions Summary (Future):**
   - Consider mini forecast widget in header for home beach
   - Collapsed by default, expands on hover
   - High engagement potential

5. **Community Avatar Train:**
   - For Community link, show mini avatars of active users
   - Creates FOMO and social proof
   - Updates in real-time via subscription

---

## Final Implementation Checklist

### Before Starting
- [ ] Review this entire document
- [ ] Understand Quiver design principles
- [ ] Set up feature branch
- [ ] Verify local dev environment running
- [ ] Review current app-header.tsx code

### During Development
- [ ] Follow phases in order
- [ ] Test after each phase
- [ ] Commit frequently with clear messages
- [ ] Document any deviations from spec
- [ ] Take before/after screenshots

### Before Merging
- [ ] Complete all testing checklist items
- [ ] Run E2E tests (existing + new)
- [ ] Request design review
- [ ] Update CHANGELOG.md
- [ ] Update component documentation if needed
- [ ] Verify no performance regressions

### After Deployment
- [ ] Monitor error logs
- [ ] Check analytics for search usage
- [ ] Gather user feedback
- [ ] Plan Phase 5 (mobile enhancements) if needed

---

## Support & Questions

**Design Questions:**
- Reference: [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md)
- Reference: [STYLE_GUIDE.md](./STYLE_GUIDE.md)

**Component Patterns:**
- Reference: [components/ARCHITECTURE.md](../components/ARCHITECTURE.md)
- Reference: [components/ui/ARCHITECTURE.md](../components/ui/ARCHITECTURE.md)

**Motion & Animation:**
- Reference: [lib/constants/animations.ts](../lib/constants/animations.ts)

**Testing Guidance:**
- Reference: [e2e/ARCHITECTURE.md](../e2e/ARCHITECTURE.md)
- Reference: [test-utils/ARCHITECTURE.md](../test-utils/ARCHITECTURE.md)

---

## Appendix: Quick Reference

### Color Palette Quick Copy-Paste

```tsx
// Primary CTA
className="bg-primary hover:bg-primary/90 text-primary-foreground"

// Secondary/Ghost Button
className="text-muted-foreground hover:text-primary"

// Focus Ring
className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// Search Container
className="bg-muted focus-within:bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"

// Notification Badge
className="bg-destructive text-destructive-foreground"

// Muted Background
className="bg-muted"

// Border
className="border border-border"
```

### Icon Imports

```typescript
import {
  Search,      // Search bar and mobile button
  Bell,        // Notifications
  User,        // Profile link in dropdown
  LogOut,      // Sign out
  Menu,        // Mobile hamburger (if implemented)
  ChevronDown, // Dropdown indicators (if needed)
} from 'lucide-react';
```

### Common Tailwind Classes

```tsx
// Container
"home-container flex items-center justify-between h-full md:h-16"

// Sticky Header
"sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur"

// Pill Button
"rounded-full px-5 h-10 font-semibold shadow-sm"

// Icon Button
"p-2 rounded-full hover:bg-muted transition-colors"

// Focus Ring
"focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// Hover Scale
"transition-all duration-200 hover:scale-105 active:scale-98"
```

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Author:** Quiver Design Team (Claude AI)
**Review Status:** Ready for Implementation