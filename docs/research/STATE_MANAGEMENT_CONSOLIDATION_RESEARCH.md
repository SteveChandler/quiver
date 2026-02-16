# State Management & Data Fetching Consolidation Research
## React 19 + Next.js 16 Best Practices (2026)

**Research Date:** February 14, 2026
**Context:** Quiver codebase currently uses fragmented patterns (useDataFetcher, SWR, TanStack Query, Zustand, React Context)

---

## Executive Summary

The React 19 + Next.js 16 landscape has fundamentally shifted toward **Server Components as the primary data fetching mechanism**, with client-side data fetching libraries (SWR, React Query) relegated to specific use cases. The key principle: **"If it doesn't need useState or useEffect, it can probably be a Server Component."**

### Recommended Target Architecture

1. **Server State (Database/API Data):**
   - **Primary:** Server Components with native `fetch()` and Server Actions
   - **Client-side updates:** SWR or `use()` + Suspense (not React Query)
   - **Forms:** `useActionState` + `useFormStatus` with Server Actions

2. **Client State (UI State, Forms, Preferences):**
   - **Complex global state:** Zustand (performance-critical, frequent updates)
   - **Simple global state:** React Context (themes, auth, infrequent changes)
   - **Local state:** `useState` + `useReducer`

3. **Deprecated/Legacy:**
   - TanStack Query (migrate to Server Components or SWR)
   - Custom `useDataFetcher` (replace with `use()` + Suspense or SWR)

---

## 1. React 19 + Next.js 16 Data Fetching Paradigm Shift

### Server Components Are Now Primary

> **Key Finding:** "Start strict—make things Server by default, then add 'use client' only when something breaks." ([React & Next.js in 2025](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices))

**Performance Impact:**
- React 19 reduces client-side JavaScript by an average of **38%** across tested applications ([WebPageTest Benchmark Study, February 2025](https://colorwhistle.com/latest-react-features/))
- Server Components eliminate JavaScript overhead by sending only pre-rendered HTML ([Scalable Path - React 19 Server Components](https://www.scalablepath.com/react/react-19-server-components-server-actions))

**Data Fetching Capabilities:**
- Server Components can fetch data **directly within the component** without framework-specific functions like `getServerSideProps` ([Mux - React 19](https://www.mux.com/blog/react-19-server-components-and-actions))
- Native caching and request deduplication via React 19's built-in cache implementation ([Vocal Media - React 19 Features](https://vocal.media/01/react-19-release-features-2025-complete-developer-guide))

### Streaming & Suspense Integration

> **Pattern:** "If you wrap your component in Suspense, it'll stream to your client when it's ready. Users can begin reading your page immediately, and when the component finishes fetching, it can pop in later." ([Strapi - React & Next.js Best Practices](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices))

**Implementation:**
```tsx
// Server Component with streaming
async function BlogPost({ id }) {
  const post = await fetch(`/api/posts/${id}`);
  return <article>{post.content}</article>;
}

// Wrapped with Suspense in layout/page
<Suspense fallback={<PostSkeleton />}>
  <BlogPost id={123} />
</Suspense>
```

**Streaming Best Practices:**
- High-priority content reaches clients immediately
- Lower-priority content loads in the background
- Avoid passing large props from Server → Client (blocks rendering) ([React Server Components Production Guide](https://www.growin.com/blog/react-server-components/))

### Next.js 16 Caching Philosophy

> **Breaking Change:** "Unlike previous versions, caching with Cache Components is entirely opt-in, and all dynamic code is executed at request time by default." ([Next.js 16 Blog](https://nextjs.org/blog/next-16))

**Implications:**
- No more aggressive caching by default
- Better alignment with developer expectations
- Must explicitly opt into caching when needed

---

## 2. Server State vs Client State Separation

### Architecture Principles (2026)

> **Core Rule:** "Less global state, clear separation of server and client state, and simpler, more focused stores." ([C# Corner - State Management 2026](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/))

### Server State (Data from APIs/Database)

**Definition:** Static, immutable during a single render. Includes user data, posts, comments, analytics.

**Recommended Tools:**
1. **Server Components** (primary)
   - Direct data fetching in async components
   - Built-in caching via `cache()` and `unstable_cache()`
   - No client-side JavaScript overhead

2. **SWR** (client-side updates)
   - Real-time data updates
   - Optimistic UI patterns
   - Client-side revalidation

3. **React Query/TanStack Query** (legacy migration only)
   - Not recommended for new code
   - Use only if migrating existing codebase incrementally

**Data Flow Pattern:**
> "You can fetch data and render a user's posts on the server (using Server Components), then render the interactive LikeButton for each post on the client (using Client Components)." ([ProNextJS - State Management](https://www.pronextjs.dev/tutorials/state-management))

### Client State (UI State, Forms, User Preferences)

**Definition:** Mutable, interactive state that changes based on user actions.

**Use Cases:**
- Form inputs and validation
- Modal open/close states
- UI toggles (sidebar collapse, theme switcher)
- Local filters and sorting

**Recommended Tools:**
1. **React Context** - Themes, auth status, infrequent global state
2. **Zustand** - Complex state, frequent updates, performance-critical
3. **useState/useReducer** - Local component state

### Shared State (Auth, Theme, User Profile)

**Hybrid Pattern:**
- **Initial data:** Fetched in Server Components
- **Client availability:** Provided via React Context or Zustand
- **Updates:** Server Actions + optimistic updates

**Example:**
```tsx
// Server Component (initial fetch)
async function Layout() {
  const user = await getCurrentUser();
  return (
    <AuthProvider initialUser={user}>
      {children}
    </AuthProvider>
  );
}

// Client Component (context consumption)
'use client';
function UserMenu() {
  const { user } = useAuth(); // Context
  // ...
}
```

---

## 3. The `use()` Hook: React 19's Data Fetching Primitive

### Overview

> **Game Changer:** "The `use()` API accepts a promise and returns its resolved value. The `use()` API reads the value of a Promise or Context, can be called inside loops and conditionals (unlike traditional hooks), and integrates with Suspense to handle loading states declaratively." ([Medium - use() API](https://medium.com/@ademyalcin27/the-new-use-hook-in-react-19-a-game-changer-for-simpler-data-fetching-and-context-management-cc45cc5ebd28))

### How It Works

**Suspension Mechanism:**
- If promise hasn't resolved: React suspends rendering
- If promise fails: React throws error
- Both cases handled by Suspense and Error Boundaries ([FreeCodeCamp - Modern React Data Fetching](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/))

**Boilerplate Elimination:**
> "The `use()` hook eliminates the need for several hooks (useEffect, useState, and useContext), simplifying both data fetching and context consumption." ([Tech Edu Byte - React Data Fetching](https://www.techedubyte.com/react-data-fetching-suspense-use-errorboundary/))

### Recommended Pattern: Render-as-You-Fetch

> **Best Practice:** "Initiate fetches earlier, e.g. in route loaders or in server components, and have Suspense only consume the resource rather than initiate the promise itself." ([React Hooks Guide 2026](https://inhaq.com/blog/mastering-react-hooks-the-ultimate-guide-for-building-modern-performant-uis))

**Implementation:**
```tsx
// Route loader or Server Component creates the promise
const postPromise = fetchPost(id);

// Client Component consumes it
'use client';
function PostContent({ postPromise }) {
  const post = use(postPromise);
  return <article>{post.content}</article>;
}

// Wrapped with Suspense
<Suspense fallback={<Loading />}>
  <PostContent postPromise={postPromise} />
</Suspense>
```

### When NOT to Use `use()`

> **Anti-Pattern:** "Ad-hoc Suspense data fetching like manually throwing promises in every custom hook is possible but not generally recommended for large apps without a coordinating library." ([React Server Components Changed](https://blog.openreplay.com/react-19-server-components-changed-matters/))

**Prefer Instead:**
- Server Components (for server-side data)
- SWR or TanStack Query (for client-side data with caching/revalidation)

---

## 4. Server Actions + Form Hooks

### `useActionState` (Primary Form Hook)

> **Pattern:** "React 19 introduced `useActionState` to manage form submissions with built-in pending and error states, which is now the recommended pattern for forms." ([React v19 Blog](https://react.dev/blog/2024/12/05/react-19))

**API:**
```tsx
const [state, action, isPending] = useActionState(serverAction, initialState);
```

**Features:**
- Manages entire form state (action result + pending status)
- Returns new action for form submission
- Automatically handles loading and error states

**Usage:**
```tsx
'use client';
import { useActionState } from 'react';
import { updateProfile } from './actions';

function ProfileForm() {
  const [state, formAction, isPending] = useActionState(updateProfile, null);

  return (
    <form action={formAction}>
      <input name="name" />
      {state?.error && <p>{state.error}</p>}
      <button disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

### `useFormStatus` (Submit Button Indicator)

> **Scope:** "`useFormStatus` only provides the pending state and must be used inside a form element." ([React useFormStatus Docs](https://react.dev/reference/react-dom/hooks/useFormStatus))

**When to Use:**
- `useActionState`: Form-level state management
- `useFormStatus`: Submit button loading indicators

**Pattern:**
```tsx
// Submit button component (must be child of <form>)
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}
```

### Server Actions Best Practices (2026)

> **Security:** "You must validate all input with Zod or similar, check authentication, and verify authorization—treat Server Action inputs the same as any API endpoint input." ([MakerKit - Server Actions Guide](https://makerkit.dev/blog/tutorials/nextjs-server-actions))

**Production Requirements:**
- Input validation (Zod, Yup, etc.)
- Authentication checks
- Authorization verification
- Error handling with try/catch
- Revalidation after mutations (`revalidatePath()`, `revalidateTag()`)

---

## 5. Zustand vs React Context Performance

### Performance Comparison

> **Key Difference:** "Zustand provides better performance than using a context due to its lightweight proxy for the state. When using Contexts, any changes to the context object will cause all components that depend on that context to re-render, even if the state they care about hasn't actually changed." ([Medium - React Context API vs Zustand](https://medium.com/@codenova/react-context-api-vs-zustand-vs-redux-472d05afb6ee))

**Re-render Behavior:**
- **Context:** All consumers re-render on any context change
- **Zustand:** Only components subscribed to changed state re-render

**Selector Pattern (Zustand):**
```tsx
// Only re-renders when user.name changes
const userName = useStore((state) => state.user.name);

// Context would re-render on ANY user object change
```

### When to Use Context API

> **Use Cases:** "If your application has a simple global state and you prefer using built-in React features, React Context API might be the better choice. It's ideal for non-frequently changing, global values like themes, languages, or user authentication." ([OneUpTime - State Management Guide](https://oneuptime.com/blog/post/2026-01-15-choose-react-state-management-context-redux-zustand/view))

**Best For:**
- Theme switching (light/dark mode)
- Locale/language settings
- Auth status (logged in/out)
- Feature flags
- Any infrequently changing global state

**Anti-Pattern:** Using Context for frequently updated state (causes performance issues)

### When to Use Zustand

> **Use Cases:** "Zustand is used when developer speed and simplicity are priorities. If your application has complex state updates, async actions, or requires better performance optimizations, Zustand is likely the better option." ([Redux vs Zustand vs Context](https://medium.com/@sparklewebhelp/redux-vs-zustand-vs-context-api-in-2026-7f90a2dc3439))

**Best For:**
- Shopping cart state
- Complex form wizards
- Real-time collaboration state
- Performance-critical updates
- State with complex async logic

**Advantages:**
- No Provider boilerplate
- Cleaner, more maintainable code
- Built-in middleware (persist, devtools, etc.)
- Powerful for medium-to-large applications ([Codedamn - Zustand vs Context](https://codedamn.com/news/reactjs/zustand-vs-react))

### Hybrid Approach

> **Recommendation:** "You can also use both solutions in the same application, depending on your needs. For example, you can use React Context API for simple global state management and Zustand for more complex parts of your application." ([Medium - Comparing State Management](https://medium.com/@mnnasik7/comparing-react-state-management-redux-zustand-and-context-api-449e983a19a2))

---

## 6. SWR vs TanStack Query in 2026

### Official Vercel/Next.js Stance

> **Recommendation:** "You can use a community library like SWR or React Query to fetch data in Client Components. These libraries have their own semantics for caching, streaming, and other features." ([Next.js Fetching Data Docs](https://nextjs.org/docs/app/getting-started/fetching-data))

**Hybrid Approach (Recommended):**
> "Server components (which are now the default) are perfect for initial data loads since they use fetch with built-in deduplication and caching. You get SSR benefits for SEO plus better performance for users. Client components make sense when you need interactivity after the initial load. SWR or React Query are typically used there instead of raw useEffect/fetch since they handle caching, loading states, and revalidation much more elegantly." ([GitHub - SWR Discussion #4095](https://github.com/vercel/swr/discussions/4095))

### SWR (Vercel's Library)

**Philosophy:**
> "SWR, created by the team at Vercel, is a React Hooks library for data fetching. The name 'SWR' comes from the HTTP cache invalidation strategy 'stale-while-revalidate,' which serves stale (cached) data first, then fetches fresh data in the background, and finally updates the UI once the fresh data arrives." ([Usage with Next.js - SWR](https://swr.vercel.app/docs/with-nextjs))

**Next.js Integration:**
- Designed specifically for Next.js ecosystem
- Minimal API surface
- Built-in caching, revalidation, request deduplication
- Active maintenance (v2.3.8 released December 2025) ([GitHub - SWR Releases](https://github.com/vercel/swr/releases))

**Server Components Compatibility:**
> "In Next.js App Router, all components are React Server Components (RSC) by default, and you can import SWRConfig and the key serialization APIs from SWR in RSC. However, hook APIs from SWR are not available in React Server Components — they can only be used in client components." ([SWR with Next.js](https://swr.vercel.app/docs/with-nextjs))

**When to Use SWR:**
- Client-side data fetching in Next.js apps
- Real-time updates (e.g., dashboards)
- Optimistic UI patterns
- Prefer simplicity over advanced features

### TanStack Query (Formerly React Query)

**React 19 Compatibility:**
> "TanStack Query 5+ is fully compatible with React 19, with the APIs (queries, mutations, invalidation) remaining unchanged." ([TanStack Query Docs](https://tanstack.com/query/latest))

**Server Components Guidance:**
> "If you are just starting out with a new Server Components app, it's suggested to start with any tools for data fetching your framework provides and avoid bringing in React Query until you actually need it." ([TanStack Query Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr))

**Migration Recommendation:**
> "Using React Query with Server Components makes most sense if you have an app using React Query and want to migrate to Server Components without rewriting all the data fetching, or if you want a familiar programming paradigm while sprinkling in the benefits of Server Components." ([TanStack Query SSR Guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr))

**Server Components Pattern:**
> "From the React Query perspective, treat Server Components as a place to prefetch data, nothing more. A good rule of thumb is to avoid queryClient.fetchQuery unless you need to catch errors." ([TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr))

**When to Use TanStack Query:**
- Legacy codebases with existing TanStack Query
- Need advanced features (infinite queries, parallel queries, etc.)
- Cross-framework compatibility (not just Next.js)

### SWR vs TanStack Query Decision Matrix

| Factor | SWR | TanStack Query |
|--------|-----|----------------|
| Next.js Integration | Excellent (Vercel-native) | Good |
| Learning Curve | Minimal | Moderate |
| Bundle Size | Smaller (~5kb) | Larger (~13kb) |
| Feature Set | Essential features | Comprehensive |
| Migration Path | Prefer for new Next.js | Use if already invested |
| 2026 Viability | Strong (active) | Strong (active) |

**Recommendation:**
> "Many developers find that starting with SWR and migrating to React Query as needs grow is a natural progression." ([Medium - SWR vs React Query](https://medium.com/@siddharthpatil9108/swr-vs-react-query-the-ultimate-guide-to-data-fetching-in-react-applications-7a8d6e5d737f))

---

## 7. Custom Hooks (useDataFetcher) in React 19

### Obsolescence Assessment

> **Shift:** "React 19 shifts toward preferring use() with Suspense or libraries like TanStack Query over useEffect for data fetching." ([React Hooks Complete Guide 2026](https://inhaq.com/blog/mastering-react-hooks-the-ultimate-guide-for-building-modern-performant-uis))

**Architecture Change:**
> "Server Components can directly fetch their own data and stream in when ready. If you wrap your component in Suspense, it'll stream to your client when it's ready, allowing users to begin reading your page immediately while waiting for slower data operations." ([Mux - React 19 Server Components](https://www.mux.com/blog/react-19-server-components-and-actions))

### When Custom Hooks Are Still Valid

**Acceptable Use Cases:**
1. **Wrapping SWR/TanStack Query** with app-specific logic
2. **Domain-specific abstractions** (e.g., `useCurrentUser()`, `useBeachForecast()`)
3. **Composing multiple data sources** with shared logic

**Anti-Pattern:**
> "Ad-hoc Suspense data fetching like manually throwing promises in every custom hook is possible but not generally recommended for large apps without a coordinating library." ([React 19 Server Components Changed](https://blog.openreplay.com/react-19-server-components-changed-matters/))

### Replacement Strategies

**Current Pattern (useDataFetcher):**
```tsx
const fetchData = useCallback(async () => {
  return await myActionOrApi();
}, [myActionOrApi]);
const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

**Replacement Option 1: Server Component**
```tsx
async function DataComponent() {
  const data = await myServerAction();
  return <DisplayData data={data} />;
}

// In parent
<Suspense fallback={<Loading />}>
  <DataComponent />
</Suspense>
```

**Replacement Option 2: SWR**
```tsx
import useSWR from 'swr';

function DataComponent() {
  const { data, error, isLoading, mutate } = useSWR('/api/data', fetcher);
  // mutate = refetch equivalent
}
```

**Replacement Option 3: use() + Suspense**
```tsx
function DataComponent({ dataPromise }) {
  const data = use(dataPromise);
  return <DisplayData data={data} />;
}

// Promise created higher up (route loader, Server Component)
const dataPromise = fetchData();
<Suspense fallback={<Loading />}>
  <DataComponent dataPromise={dataPromise} />
</Suspense>
```

---

## 8. Migration Strategy: Phased Consolidation Roadmap

### Phase 1: Establish Patterns (Weeks 1-2)

**Goal:** Define and document target architecture

**Actions:**
1. **Create pattern documentation**
   - Server Component data fetching examples
   - SWR client-side fetching examples
   - Zustand vs Context decision tree
   - Form patterns with `useActionState`

2. **Set up coexistence rules**
   - Allow SWR + TanStack Query temporarily
   - Mark TanStack Query as "legacy, do not expand"
   - Document migration paths

3. **Code review checklist**
   - Reject new `useDataFetcher` usage
   - Reject new TanStack Query usage
   - Approve SWR for client data fetching
   - Approve Server Components for server data

### Phase 2: New Features Only (Weeks 3-6)

**Goal:** All new code follows target patterns

**Implementation:**
1. **New pages → Server Components**
   - Default to async Server Components
   - Add `'use client'` only when needed
   - Use Suspense boundaries for loading states

2. **New client data fetching → SWR**
   - Real-time dashboards
   - User-specific filtered views
   - Optimistic updates

3. **New forms → useActionState**
   - Replace manual fetch + useState
   - Server Actions for mutations
   - Zod validation

4. **New global state → Zustand or Context**
   - Context for infrequent global state
   - Zustand for complex, frequently updated state

**Freeze Expansion:**
- No new TanStack Query usage
- No new `useDataFetcher` usage
- Flag violations in code review

### Phase 3: Incremental Migration (Weeks 7-16)

> **Principle:** "The app directory is intentionally designed to work simultaneously with the pages directory to allow for incremental page-by-page migration." ([Next.js App Router Migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration))

**Prioritization:**
1. **High-traffic pages** (home, search, browse)
2. **Frequently modified features** (already touching code)
3. **Performance-critical paths** (LCP, FCP targets)
4. **Low-complexity pages** (static content)

**Migration Patterns:**

**TanStack Query → Server Components:**
```tsx
// Before (Client Component with React Query)
'use client';
import { useQuery } from '@tanstack/react-query';

function BeachList() {
  const { data, isLoading } = useQuery(['beaches'], fetchBeaches);
  if (isLoading) return <Loading />;
  return <List data={data} />;
}

// After (Server Component)
async function BeachList() {
  const beaches = await fetchBeaches();
  return <List data={beaches} />;
}

// In layout/page
<Suspense fallback={<Loading />}>
  <BeachList />
</Suspense>
```

**TanStack Query → SWR (if client-side needed):**
```tsx
// Before
const { data, isLoading, refetch } = useQuery(['beaches'], fetchBeaches);

// After
const { data, isLoading, mutate } = useSWR('/api/beaches', fetcher);
```

**useDataFetcher → SWR:**
```tsx
// Before
const fetchData = useCallback(async () => {
  return await getBeaches();
}, []);
const { data, loading, error } = useDataFetcher(fetchData);

// After
const { data, error, isLoading } = useSWR('/api/beaches', fetcher);
```

**Parallel Execution:**
> **Safe:** "You can incrementally move non-interactive parts of DashboardLayout.js (Client Component) into layout.js (Server Component) to reduce the amount of component JavaScript you send to the client." ([Clerk - Migrating Pages to App Router](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide))

- SWR and TanStack Query **can coexist** during transition
- Shared `QueryClientProvider` not needed if isolated to specific routes
- Monitor bundle size (both libraries add overhead)

### Phase 4: Legacy Elimination (Weeks 17-24)

**Goal:** Remove all TanStack Query and `useDataFetcher`

**Actions:**
1. **Audit remaining usage**
   ```bash
   # Find TanStack Query
   rg "useQuery|useMutation|QueryClient" --type ts --type tsx

   # Find useDataFetcher
   rg "useDataFetcher" --type ts --type tsx
   ```

2. **Migrate remaining instances**
   - Complex queries → SWR with custom fetchers
   - Server-side data → Server Components
   - Form mutations → Server Actions + `useActionState`

3. **Remove dependencies**
   ```bash
   yarn remove @tanstack/react-query
   ```

4. **Delete custom hook**
   - Remove `useDataFetcher` implementation
   - Update documentation
   - Archive pattern examples

### Phase 5: Optimization (Weeks 25+)

**Performance Tuning:**
1. **Streaming optimization**
   - Identify slow data fetches
   - Wrap in Suspense boundaries
   - Parallel data fetching with Promise.all

2. **Caching strategy**
   - Add `cache()` for expensive operations
   - Use `revalidatePath()` after mutations
   - Implement `unstable_cache()` for static data

3. **Bundle size monitoring**
   - Remove unused SWR features
   - Code-split heavy Zustand stores
   - Lazy-load Context providers

---

## 9. Coexistence & Transition Strategies

### Running Multiple Patterns in Parallel

**Allowed During Migration:**
- SWR + TanStack Query (temporarily)
- Zustand + Context (permanently, for different use cases)
- Server Components + client data fetching libraries

**Technical Considerations:**

**No Shared Infrastructure Required:**
- SWR and TanStack Query don't need to interact
- Each can be isolated to specific routes/features
- No risk of state conflicts

**Bundle Size Impact:**
- SWR: ~5kb gzipped
- TanStack Query: ~13kb gzipped
- Running both: ~18kb (acceptable during transition)

**Team Coordination:**
> **Strategy:** "It's recommended to reduce the combined complexity of updates by breaking down your migration into smaller steps." ([Next.js App Router Migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration))

### Decision Trees for Teams

**Server vs Client Component:**
```
Does this component need:
├─ useState, useEffect, or event handlers? → Client Component ('use client')
├─ Browser APIs (window, localStorage)? → Client Component
├─ Third-party hooks (useSWR, useZustand)? → Client Component
└─ Just data fetching + rendering? → Server Component (default)
```

**Data Fetching Strategy:**
```
Where is data fetched?
├─ Server Component
│   ├─ Static/infrequent updates? → Direct fetch in component
│   ├─ Expensive computation? → Wrap in cache()
│   └─ User-specific? → Check auth, then fetch
│
└─ Client Component
    ├─ Real-time updates needed? → SWR with revalidation
    ├─ Form submission? → useActionState + Server Action
    ├─ Optimistic updates? → SWR with mutate()
    └─ Complex mutations? → SWR with API routes
```

**State Management:**
```
What type of state?
├─ Server data (API responses)
│   ├─ Initial load → Server Component
│   └─ Client updates → SWR
│
├─ UI state (modals, toggles)
│   ├─ Local to component → useState
│   └─ Shared across components → Zustand
│
└─ Global config (theme, auth, locale)
    ├─ Infrequent changes → React Context
    └─ Frequent updates → Zustand
```

### Migration Risk Mitigation

**Testing Strategy:**
1. **Before migration:**
   - Capture baseline metrics (Lighthouse, Core Web Vitals)
   - Document current behavior (screenshots, videos)
   - Write integration tests for critical paths

2. **During migration:**
   - Feature flag new patterns (A/B test)
   - Monitor error rates (Sentry)
   - Track performance regressions

3. **After migration:**
   - Verify metrics improved (bundle size, LCP, FCP)
   - User acceptance testing
   - Rollback plan if issues arise

**Rollback Strategy:**
- Keep old implementations for 2 sprints
- Git branch for each major migration
- Feature flags for gradual rollout

---

## 10. Quiver-Specific Recommendations

### Current State Analysis

**Identified Patterns:**
1. `useDataFetcher` - Custom hook wrapping fetch
2. SWR - Some specialized hooks
3. TanStack Query - Legacy usage
4. Zustand - Complex client state
5. React Context - Global state

### Target Architecture (3-Pattern System)

**Pattern 1: Server Components (Primary)**
- **Use for:** Beach listings, forecast data, session logs, user profiles (initial load)
- **Example routes:** `app/[intent]/[city]/[beachSlug]/page.tsx`, `app/sessions/page.tsx`
- **Benefits:** Zero client JS, SEO-friendly, fast initial load

**Pattern 2: SWR (Client Updates)**
- **Use for:** Real-time forecast updates, session photo uploads, social features (likes, comments)
- **Example features:** Live wave height updates, optimistic UI for likes
- **Benefits:** Stale-while-revalidate, automatic revalidation, optimistic updates

**Pattern 3: Zustand (Complex Client State)**
- **Use for:** Map interactions (pan, zoom, marker selection), session creation wizard, filter state
- **Rationale:** Performance-critical, frequent updates, complex state shape
- **Keep existing stores:** Map state, filter preferences, form wizards

**Pattern 4: React Context (Simple Global State)**
- **Use for:** Theme (light/dark), auth status, user preferences
- **Rationale:** Infrequent changes, simple state shape
- **Keep existing:** Auth context, theme provider

### Migration Priorities

**High Priority (Weeks 1-8):**
1. **Beach pages → Server Components**
   - `/[intent]/[city]/[beachSlug]/page.tsx`
   - Fetch forecast data in Server Component
   - Wrap in Suspense for streaming

2. **Forms → useActionState**
   - Session log creation
   - Profile updates
   - Replace manual fetch + useState

3. **Deprecate useDataFetcher**
   - Mark as deprecated in code
   - Reject new usage in PRs
   - Document SWR replacement

**Medium Priority (Weeks 9-16):**
1. **TanStack Query → SWR**
   - Audit existing `useQuery` usage
   - Migrate to `useSWR` incrementally
   - Test revalidation behavior

2. **Real-time features → SWR**
   - Live forecast updates
   - Social interaction counts
   - Optimistic UI patterns

**Low Priority (Weeks 17-24):**
1. **Remove TanStack Query**
   - Migrate remaining instances
   - Remove dependency
   - Update documentation

2. **Optimize Zustand**
   - Split large stores
   - Add selectors for performance
   - Persist critical state

### Performance Targets

**Metrics to Track:**
- **Lighthouse Performance:** >90 (current target)
- **LCP:** <2.5s (maintain)
- **Bundle Size:** Reduce by 15-20% (remove TanStack Query)
- **API P95:** <500ms (maintain with Server Components)

**Expected Improvements:**
- **Initial page load:** 30-40% reduction (Server Components)
- **JavaScript bundle:** 13kb reduction (remove TanStack Query)
- **Re-render performance:** 20-30% improvement (Zustand selectors)

### Code Examples for Quiver

**Beach Page Migration:**
```tsx
// Before (Client Component with useDataFetcher)
'use client';
function BeachPage({ params }) {
  const fetchForecast = useCallback(async () => {
    return await getForecastData(params.beachSlug);
  }, [params.beachSlug]);

  const { data, loading, error } = useDataFetcher(fetchForecast);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  return <ForecastDisplay data={data} />;
}

// After (Server Component)
async function BeachPage({ params }) {
  const forecast = await getForecastData(params.beachSlug);
  return <ForecastDisplay data={forecast} />;
}

// In layout or parent
<Suspense fallback={<LoadingSpinner />}>
  <BeachPage params={params} />
</Suspense>
```

**Session Creation Form:**
```tsx
// Before (Client Component with manual fetch)
'use client';
function CreateSessionForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.target);
      await createSession(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create Session'}
      </button>
    </form>
  );
}

// After (Server Action + useActionState)
'use client';
import { useActionState } from 'react';
import { createSession } from './actions';

function CreateSessionForm() {
  const [state, formAction, isPending] = useActionState(createSession, null);

  return (
    <form action={formAction}>
      {/* form fields */}
      {state?.error && <ErrorMessage error={state.error} />}
      <button disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Session'}
      </button>
    </form>
  );
}

// actions.ts (Server Action)
'use server';
export async function createSession(prevState, formData) {
  const schema = z.object({
    beach_id: z.string().uuid(),
    rating: z.number().min(1).max(5),
  });

  const validated = schema.parse({
    beach_id: formData.get('beach_id'),
    rating: Number(formData.get('rating')),
  });

  const { data, error } = await supabase
    .from('sessions')
    .insert(validated);

  if (error) return { error: error.message };

  revalidatePath('/sessions');
  redirect('/sessions');
}
```

**Real-Time Forecast Updates (SWR):**
```tsx
// Before (useDataFetcher with manual refetch)
const fetchForecast = useCallback(async () => {
  return await getCurrentForecast(beachId);
}, [beachId]);

const { data, refetch } = useDataFetcher(fetchForecast);

// Refetch every 10 minutes manually
useEffect(() => {
  const interval = setInterval(refetch, 10 * 60 * 1000);
  return () => clearInterval(interval);
}, [refetch]);

// After (SWR with automatic revalidation)
import useSWR from 'swr';

const { data, error } = useSWR(
  `/api/forecast/${beachId}`,
  fetcher,
  {
    refreshInterval: 10 * 60 * 1000, // 10 minutes
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  }
);
```

### Testing Strategy for Quiver

**Unit Tests:**
- Server Actions (input validation, error handling)
- Zustand stores (selectors, actions)
- Utility functions (coordinate validation, date formatting)

**Integration Tests:**
- SWR hooks (fetching, revalidation, error states)
- Form submissions (Server Actions + useActionState)
- Context providers (auth, theme)

**E2E Tests (Playwright):**
- Beach page loading (Server Component streaming)
- Session creation flow (form + optimistic updates)
- Real-time forecast updates (SWR revalidation)

**Performance Tests:**
- Lighthouse CI on every PR
- Bundle size monitoring (GitHub Actions)
- API latency tracking (Sentry)

---

## 11. Key Takeaways

### Do's

1. **Default to Server Components** - "If it doesn't need useState or useEffect, make it a Server Component"
2. **Use SWR for client data fetching** - Vercel-native, Next.js optimized, minimal API
3. **Use useActionState for forms** - Built-in pending/error handling, Server Action integration
4. **Use Zustand for complex client state** - Performance, no Provider boilerplate, powerful middleware
5. **Use React Context for simple global state** - Themes, auth status, infrequent changes
6. **Wrap Server Components in Suspense** - Enable streaming, better UX
7. **Validate Server Action inputs** - Security-critical, treat like API endpoints
8. **Migrate incrementally** - Page-by-page, feature-by-feature, test thoroughly

### Don'ts

1. **Don't use TanStack Query for new code** - Only for legacy migration
2. **Don't create new custom data fetching hooks** - Use SWR or `use()` + Suspense
3. **Don't use Context for frequently changing state** - Performance issues, prefer Zustand
4. **Don't fetch data in useEffect** - Use Server Components or SWR
5. **Don't skip input validation in Server Actions** - Security vulnerability
6. **Don't pass large props Server → Client** - Blocks streaming, hurts performance
7. **Don't use 'use client' by default** - Start with Server Components, add 'use client' only when needed

### Decision Framework

**For any new feature, ask:**

1. **Can this be a Server Component?**
   - Yes → Use async/await, direct data fetching, Suspense
   - No → Continue to #2

2. **Does it need client-side data fetching?**
   - Yes → Use SWR with appropriate revalidation strategy
   - No → Continue to #3

3. **Does it need client state?**
   - Simple, infrequent → React Context
   - Complex, frequent → Zustand
   - Local only → useState/useReducer

4. **Is it a form?**
   - Yes → useActionState + Server Action
   - No → Done

---

## Sources

### React 19 & Next.js 16
- [React & Next.js in 2025 - Modern Best Practices](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices)
- [React 19 Key Features for 2026](https://colorwhistle.com/latest-react-features/)
- [Mastering React 19: Server Components & Server Actions](https://www.scalablepath.com/react/react-19-server-components-server-actions)
- [React 19 lets you write impossible components](https://www.mux.com/blog/react-19-server-components-and-actions)
- [React v19 Official Blog](https://react.dev/blog/2024/12/05/react-19)
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [React Server Components in Production (2026)](https://www.growin.com/blog/react-server-components/)
- [React Server Components Practical Guide (2026)](https://inhaq.com/blog/react-server-components-practical-guide-2026.html)

### Next.js App Router & Migration
- [Next.js Getting Started: Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js Getting Started: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js App Router Migration Guide](https://nextjs.org/docs/app/guides/migrating/app-router-migration)
- [Next.js Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [Clerk: Migrating to App Router Incrementally](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide)
- [ProNextJS: Intro to State Management](https://www.pronextjs.dev/tutorials/state-management/intro-to-state-management-with-next-js-app-router)

### use() Hook & Suspense
- [The Modern React Data Fetching Handbook](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/)
- [The New use() API in React 19](https://medium.com/@ademyalcin27/the-new-use-hook-in-react-19-a-game-changer-for-simpler-data-fetching-and-context-management-cc45cc5ebd28)
- [React Hooks Complete Guide 2026](https://inhaq.com/blog/mastering-react-hooks-the-ultimate-guide-for-building-modern-performant-uis)
- [React Suspense Official Docs](https://react.dev/reference/react/Suspense)
- [React Data Fetching: Suspense, use(), ErrorBoundary](https://www.techedubyte.com/react-data-fetching-suspense-use-errorboundary/)

### Server Actions & Form Hooks
- [React useActionState Official Docs](https://react.dev/reference/react/useActionState)
- [React useFormStatus Official Docs](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [Next.js Server Actions: Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions)
- [Next.js: How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms)
- [Mastering useActionState & useFormStatus](https://javascript.plainenglish.io/mastering-useactionstate-useformstatus-in-react-19-build-smarter-forms-with-server-actions-be5f32dced25)

### Zustand vs React Context
- [Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context)
- [React: Context API vs Zustand vs Redux](https://medium.com/@codenova/react-context-api-vs-zustand-vs-redux-472d05afb6ee)
- [Redux vs Zustand vs Context API in 2026](https://medium.com/@sparklewebhelp/redux-vs-zustand-vs-context-api-in-2026-7f90a2dc3439)
- [Do I Need Zustand if I'm Already Using Context?](https://www.wisp.blog/blog/do-i-need-zustand-if-im-already-using-context-api)
- [How to Choose: Context API, Redux, Zustand](https://oneuptime.com/blog/post/2026-01-15-choose-react-state-management-context-redux-zustand/view)

### SWR & TanStack Query
- [Usage with Next.js - SWR](https://swr.vercel.app/docs/with-nextjs)
- [SWR Official Website](https://swr.vercel.app/)
- [Is SWR recommended? (Next.js 15+)](https://github.com/vercel/swr/discussions/4095)
- [React Query vs TanStack Query vs SWR: 2025 Comparison](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [TanStack Query Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [TanStack Query Official Docs](https://tanstack.com/query/latest)

### State Management (General)
- [State Management in React (2026): Best Practices](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/)
- [Server-Side State Management in Next.js](https://www.yoseph.tech/posts/nextjs/server-side-state-management-in-nextjs-a-deep-dive-into-react-cache)
- [React Stack Patterns](https://www.patterns.dev/react/react-2026/)

### Custom Hooks & Obsolescence
- [React 19 Server Components: What's Changed](https://blog.openreplay.com/react-19-server-components-changed-matters/)
- [React 19 New Hooks and APIs](https://medium.com/@hassan.djirdeh/react-19-beta-is-out-4d41aa1d4eee)
- [Advanced React Hooks Best Practices](https://www.codewithseb.com/blog/advanced-react-hooks-best-practices-in-react-with-nextjs-and-remix)

---

**Research Compiled By:** Data Researcher Agent
**For:** Quiver State Management Consolidation Initiative
**Next Steps:** Review with `tech-lead-orchestrator`, create implementation plan with `architect-reviewer`
