# Landing Page: "Show Spots Near Me" Location Prompt

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contextual "Show spots near me" button to the surf highlights section so non-local users can upgrade from IP-based to precise browser geolocation without an unsolicited prompt.

**Architecture:** A small inline button renders next to the section heading when precise location hasn't been granted. Clicking triggers `requestPreciseLocation()` from the existing `LocationContext`. On success, `coordsKey` updates automatically, triggering a beach refetch with precise coordinates. No new hooks, providers, or API routes needed.

**Tech Stack:** React, Framer Motion, Lucide icons, existing LocationContext

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `components/landing-page/surf-highlights-section.tsx` | Modify | Add location prompt button + wiring |
| `__tests__/components/landing-page/surf-highlights-location-prompt.test.tsx` | Create | Unit tests for prompt visibility, click behavior, state transitions |

**No new files beyond the test.** All behavior lives in `SurfHighlightsSection` using existing `LocationContext` APIs.

---

## How It Works

```
User lands on page
  ↓
LocationContext resolves IP location (or default)
  ↓
SurfHighlightsSection fetches beaches with IP coords
  → isNearby=false (global fallback) or isNearby=true (IP was close enough)
  ↓
If !hasPreciseLocation:
  Show "Show spots near me" button below heading
  ↓
User clicks button
  → requestPreciseLocation() fires
  → Browser geolocation prompt appears
  ↓
If GRANTED:
  → browserCoords update in LocationContext
  → location.coordinates changes
  → coordsKey changes
  → fetchBeaches re-runs automatically (useCallback dep)
  → isNearby likely becomes true
  → Button disappears (hasPreciseLocation = true)
  ↓
If DENIED:
  → locationError set in LocationContext
  → Show inline error text, keep current beaches
  → Button stays visible for retry
```

---

## Chunk 1: Implementation

### Task 1: Write failing tests for the location prompt

**Files:**
- Create: `__tests__/components/landing-page/surf-highlights-location-prompt.test.tsx`

**Context:** The component uses `useLocationSafe()` from `context/location-context.tsx` which returns `{ location, requestPreciseLocation, hasPreciseLocation, locationError, clearError }`. We mock the context to test prompt visibility and interactions.

- [ ] **Step 1: Write test file with three core test cases**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";

// Mock the location context
const mockRequestPreciseLocation = jest.fn();
const mockClearError = jest.fn();

let mockLocationCtx: Record<string, unknown> = {};

jest.mock("@/context/location-context", () => ({
  useLocationSafe: () => mockLocationCtx,
}));

// Mock useDataFetcher to avoid real API calls
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({
    data: { spots: [], isNearby: false },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// Mock framer-motion to simplify rendering (filter motion-specific props to avoid DOM warnings)
jest.mock("framer-motion", () => ({
  motion: {
    h2: ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h2 {...props}>{children}</h2>
    ),
    div: ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  useInView: () => true,
  useReducedMotion: () => false,
}));

// Mock next/link and Skeleton to isolate the component under test
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocationCtx = {
    location: {
      displayName: "Unknown",
      coordinates: { lat: 38.9, lon: -77.0 },
      source: "ip" as const,
      isLoading: false,
    },
    hasPreciseLocation: false,
    requestPreciseLocation: mockRequestPreciseLocation,
    locationError: null,
    clearError: mockClearError,
  };
});

describe("SurfHighlightsSection location prompt", () => {
  it("shows 'Show spots near me' button when precise location not granted", () => {
    render(<SurfHighlightsSection />);
    expect(screen.getByRole("button", { name: /show spots near me/i })).toBeInTheDocument();
  });

  it("hides the button when precise location is already granted", () => {
    mockLocationCtx.hasPreciseLocation = true;
    render(<SurfHighlightsSection />);
    expect(screen.queryByRole("button", { name: /show spots near me/i })).not.toBeInTheDocument();
  });

  it("calls requestPreciseLocation when button is clicked", async () => {
    mockRequestPreciseLocation.mockResolvedValue(undefined);
    render(<SurfHighlightsSection />);
    fireEvent.click(screen.getByRole("button", { name: /show spots near me/i }));
    expect(mockRequestPreciseLocation).toHaveBeenCalledTimes(1);
  });

  it("shows error message when location is denied", () => {
    mockLocationCtx.locationError = "Location access was denied";
    render(<SurfHighlightsSection />);
    expect(screen.getByText(/location access was denied/i)).toBeInTheDocument();
  });

  it("shows 'Locating...' text while requesting", async () => {
    // Make requestPreciseLocation hang (never resolve) to observe intermediate state
    mockRequestPreciseLocation.mockReturnValue(new Promise(() => {}));
    render(<SurfHighlightsSection />);
    fireEvent.click(screen.getByRole("button", { name: /show spots near me/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /locating/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /locating/i })).toBeDisabled();
    });
  });

  it("hides button when location context is unavailable", () => {
    mockLocationCtx = null as unknown as Record<string, unknown>;
    render(<SurfHighlightsSection />);
    expect(screen.queryByRole("button", { name: /show spots near me/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/landing-page/surf-highlights-location-prompt.test.tsx --no-coverage`
Expected: FAIL — "Show spots near me" button not found in DOM

---

### Task 2: Implement the location prompt button

**Files:**
- Modify: `components/landing-page/surf-highlights-section.tsx`

- [ ] **Step 3: Add imports and state wiring**

At the top of the file, add the `MapPin` import:

```diff
-import { ChevronRight } from "lucide-react";
+import { ChevronRight, MapPin } from "lucide-react";
```

Inside `SurfHighlightsSection()`, after the existing `locationCtx` line (line 39), extract the new context fields:

```ts
  const locationCtx = useLocationSafe();
  const location = locationCtx?.location;
  const hasPreciseLocation = locationCtx?.hasPreciseLocation ?? false;
  const requestPreciseLocation = locationCtx?.requestPreciseLocation;
  const locationError = locationCtx?.locationError ?? null;
  const clearError = locationCtx?.clearError;
```

Add requesting state:

```ts
  const [requesting, setRequesting] = useState(false);
```

Add the handler:

```ts
  const handleRequestLocation = async () => {
    if (!requestPreciseLocation) return;
    clearError?.();
    setRequesting(true);
    try {
      await requestPreciseLocation();
    } finally {
      setRequesting(false);
    }
  };
```

- [ ] **Step 4: Add the button to the section header**

Replace the existing `<motion.h2>` block (lines 149-160) with:

```tsx
        {/* Section header */}
        <div className="mb-10 md:mb-12">
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white text-left"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={
              shouldReduceMotion
                ? {}
                : { opacity: isInView ? 1 : 0, y: isInView ? 0 : 16 }
            }
            transition={{ duration: 0.5, ease: easeOutQuart }}
          >
            {isNearby ? "Local surf favorites near you" : "Popular surf spots"}
          </motion.h2>

          {!hasPreciseLocation && requestPreciseLocation && !loading && !locationLoading && (
            <motion.div
              className="mt-3 flex items-center gap-3 flex-wrap"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={shouldReduceMotion ? {} : { opacity: isInView ? 1 : 0 }}
              transition={{ duration: 0.4, ease: easeOutQuart, delay: 0.2 }}
            >
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={requesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/[0.08] text-[#9AABC6] hover:bg-white/[0.14] hover:text-white border border-white/[0.1] transition-all duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              >
                <MapPin size={14} />
                {requesting ? "Locating\u2026" : "Show spots near me"}
              </button>
              {locationError && (
                <span className="text-sm text-amber-400/80">
                  {locationError}
                </span>
              )}
            </motion.div>
          )}
        </div>
```

**Important:** Remove the `mb-10 md:mb-12` from the old `<motion.h2>` className since it's now on the wrapper `<div>`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/components/landing-page/surf-highlights-location-prompt.test.tsx --no-coverage`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Run existing surf-highlights tests to check for regressions**

Run: `npx jest --testPathPattern="landing" --no-coverage`
Expected: All existing landing page tests still pass

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add components/landing-page/surf-highlights-section.tsx __tests__/components/landing-page/surf-highlights-location-prompt.test.tsx
git commit -m "feat: add 'Show spots near me' location prompt to landing page surf highlights"
```

---

### Task 3: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 9: Add changelog entry**

Under `## [Unreleased]` → `### Added`:

```markdown
- Landing page "Show spots near me" button — contextual geolocation prompt in surf highlights section upgrades IP-based location to precise browser coordinates for regionally relevant beach results
```

- [ ] **Step 10: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add landing page location prompt to changelog"
```

---

## Verification

After implementation, verify manually:

1. **Load landing page in incognito** — should see "Popular surf spots" header with "Show spots near me" button below
2. **Click the button** — browser prompt appears, button shows "Locating..."
3. **Grant permission** — beaches refetch, header changes to "Local surf favorites near you", button disappears
4. **Deny permission** — amber error text appears inline, beaches unchanged
5. **Reload after granting** — button reappears because `hasPreciseLocation` resets to `false` on every page load (LocationContext does not auto-request browser geolocation on mount — it only reads the IP cookie)
