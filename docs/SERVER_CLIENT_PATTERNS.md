# Server vs Client Component Patterns

## Overview

This guide establishes clear patterns for when to use server components vs client components in the Quiver Next.js App Router application. Following these patterns ensures optimal performance, proper hydration, and minimal bundle size.

## Default Pattern: Server First

**Default Rule**: All components are server components unless they explicitly need client-side features.

```tsx
// ✅ Server Component (default)
// No "use client" directive needed
export default async function BeachPage({
  params,
}: {
  params: { id: string };
}) {
  const beach = await getBeachById(params.id);

  return (
    <div>
      <h1>{beach.name}</h1>
      <ForecastDisplay beachId={beach.id} />
    </div>
  );
}
```

## When to Use "use client"

Add `"use client"` directive only when you need:

### 1. React Hooks

```tsx
"use client";

import { useState, useEffect } from "react";

export function InteractiveMap() {
  const [center, setCenter] = useState([32.715, -117.161]);

  useEffect(() => {
    // Client-side effect
  }, []);

  return <MapComponent center={center} />;
}
```

### 2. Event Handlers

```tsx
"use client";

export function FavoriteButton({ beachId }: { beachId: string }) {
  const handleClick = async () => {
    await toggleFavorite(beachId);
  };

  return <button onClick={handleClick}>❤️</button>;
}
```

### 3. Browser APIs

```tsx
"use client";

export function LocationDetector() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation(pos.coords);
    });
  }, []);

  return (
    <div>
      {location?.latitude}, {location?.longitude}
    </div>
  );
}
```

### 4. Context Providers/Consumers

```tsx
"use client";

import { useAuth } from "@/context/auth-context";

export function UserProfile() {
  const { user } = useAuth();

  return <div>{user?.email}</div>;
}
```

### 5. Third-Party Libraries with Client Dependencies

```tsx
"use client";

import { motion } from "framer-motion";

export function AnimatedCard() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      Content
    </motion.div>
  );
}
```

## Server Component Benefits

Server components provide significant advantages:

### 1. Reduced Bundle Size

```tsx
// ✅ Server component - lodash not shipped to client
import { groupBy } from "lodash";

export default function SessionStats({ sessions }) {
  const grouped = groupBy(sessions, "beach_id");

  return (
    <div>
      {Object.entries(grouped).map(([beachId, sessions]) => (
        <StatsCard key={beachId} sessions={sessions} />
      ))}
    </div>
  );
}
```

### 2. Direct Database Access

```tsx
// ✅ Server component - direct Supabase access
import { createClient } from "@/lib/supabase/server";

export default async function BeachList() {
  const supabase = createClient();
  const { data: beaches } = await supabase
    .from("beaches")
    .select("*")
    .limit(10);

  return (
    <ul>
      {beaches?.map((beach) => (
        <BeachCard key={beach.id} beach={beach} />
      ))}
    </ul>
  );
}
```

### 3. Better SEO

```tsx
// ✅ Server component - content available for SEO
export default async function BeachDetailPage({ params }) {
  const beach = await getBeachById(params.id);

  return (
    <>
      <h1>{beach.name}</h1>
      <meta name="description" content={beach.description} />
      <p>{beach.description}</p>
    </>
  );
}
```

## Hybrid Pattern: Server Component with Client Islands

**Best Practice**: Wrap client components with server components to minimize client JavaScript.

```tsx
// app/beach/[id]/page.tsx - Server Component
import { ClientFavoriteButton } from "./client-favorite-button";

export default async function BeachPage({ params }) {
  const beach = await getBeachById(params.id);
  const forecast = await getForecast(params.id);

  return (
    <div>
      {/* Server-rendered content */}
      <h1>{beach.name}</h1>
      <p>{beach.description}</p>

      {/* Client island for interactivity */}
      <ClientFavoriteButton
        beachId={beach.id}
        initialFavorited={beach.is_favorited}
      />

      {/* More server-rendered content */}
      <ForecastTable data={forecast} />
    </div>
  );
}
```

## Streaming with Suspense

Use Suspense boundaries to stream server components:

```tsx
// ✅ Server component with streaming
import { Suspense } from "react";

export default function BeachPage({ params }) {
  return (
    <div>
      <BeachHeader beachId={params.id} />

      <Suspense fallback={<ForecastSkeleton />}>
        <ForecastDisplay beachId={params.id} />
      </Suspense>

      <Suspense fallback={<SessionsSkeleton />}>
        <RecentSessions beachId={params.id} />
      </Suspense>
    </div>
  );
}

// This can be a server component that fetches data
async function ForecastDisplay({ beachId }: { beachId: string }) {
  const forecast = await getForecast(beachId);
  return <ForecastTable data={forecast} />;
}
```

## Data Fetching Patterns

### Server Components (Preferred)

```tsx
// ✅ Server component - async/await directly
export default async function SessionList() {
  const sessions = await getSessions();

  return (
    <ul>
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </ul>
  );
}
```

### Client Components (When Necessary)

```tsx
"use client";

import { useDataFetcher } from "@/hooks/use-data-fetcher";

export function DynamicSessionList({ filters }) {
  const fetchSessions = useCallback(async () => {
    return await getSessionsAction(filters);
  }, [filters]);

  const { data, loading, error } = useDataFetcher(fetchSessions);

  if (loading) return <Skeleton />;
  if (error) return <Error error={error} />;

  return (
    <ul>
      {data?.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </ul>
  );
}
```

## Common Patterns in Quiver

### Page Structure

```tsx
// app/beach/[id]/page.tsx - Server Component (default)
export default async function BeachPage({ params }) {
  const beach = await getBeachById(params.id);

  // Generate metadata for SEO
  return (
    <div>
      <BeachDetailView beach={beach} />
    </div>
  );
}

export async function generateMetadata({ params }) {
  const beach = await getBeachById(params.id);
  return {
    title: `${beach.name} - Surf Forecast | Quiver`,
    description: beach.description,
  };
}
```

### Layout with Auth Provider

```tsx
// app/layout.tsx - Server Component wrapping client providers
import { AuthProvider } from "@/context/auth-context";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Client provider for auth state */}
        <AuthProvider>
          {/* Server-rendered header */}
          <AppHeader />

          {/* Main content can be server or client */}
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Protected Routes

```tsx
// middleware.ts - Server middleware
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && request.nextUrl.pathname.startsWith("/profile")) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  return response;
}
```

## Performance Checklist

When deciding server vs client component:

- [ ] Does it need React hooks? → Client
- [ ] Does it need event handlers? → Client
- [ ] Does it access browser APIs? → Client
- [ ] Can it be static/server-rendered? → Server
- [ ] Does it fetch data on load? → Prefer Server
- [ ] Is it used in multiple client components? → Consider Server
- [ ] Does it need real-time updates? → Client
- [ ] Is it above the fold? → Prefer Server (better LCP)

## Migration Strategy

### Converting Client to Server

1. Remove `"use client"` directive
2. Replace `useState` with server-side data fetching
3. Replace `useEffect` with direct async calls
4. Extract interactive parts to separate client components

```tsx
// Before - Client component
"use client";

import { useState, useEffect } from "react";

export function BeachList() {
  const [beaches, setBeaches] = useState([]);

  useEffect(() => {
    fetch("/api/beaches")
      .then((r) => r.json())
      .then(setBeaches);
  }, []);

  return (
    <ul>
      {beaches.map((b) => (
        <BeachCard key={b.id} beach={b} />
      ))}
    </ul>
  );
}

// After - Server component
export default async function BeachList() {
  const beaches = await getBeaches();

  return (
    <ul>
      {beaches.map((b) => (
        <BeachCard key={b.id} beach={b} />
      ))}
    </ul>
  );
}
```

## Anti-Patterns to Avoid

### ❌ Don't: Mark entire pages as client unnecessarily

```tsx
// ❌ Bad - Entire page is client-side
"use client";

export default function BeachPage() {
  const [favorited, setFavorited] = useState(false);

  return (
    <div>
      <h1>Beach Name</h1>
      <button onClick={() => setFavorited(!favorited)}>❤️</button>
      <ForecastTable />
    </div>
  );
}
```

```tsx
// ✅ Good - Only interactive part is client
export default async function BeachPage() {
  const beach = await getBeach();

  return (
    <div>
      <h1>{beach.name}</h1>
      <ClientFavoriteButton beachId={beach.id} />
      <ForecastTable forecast={beach.forecast} />
    </div>
  );
}
```

### ❌ Don't: Use client components for static content

```tsx
// ❌ Bad - No need for client component
"use client";

export function StaticContent() {
  return <div>This content never changes</div>;
}
```

```tsx
// ✅ Good - Server component (default)
export function StaticContent() {
  return <div>This content never changes</div>;
}
```

### ❌ Don't: Fetch data client-side when server-side is possible

```tsx
// ❌ Bad - Client-side data fetching
"use client";

export function SessionList() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetchSessions().then(setSessions);
  }, []);

  return (
    <ul>
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </ul>
  );
}
```

```tsx
// ✅ Good - Server-side data fetching
export default async function SessionList() {
  const sessions = await getSessions();

  return (
    <ul>
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </ul>
  );
}
```

## Testing Considerations

### Server Components

```typescript
// Test via integration/E2E
test("Beach page renders forecast", async ({ page }) => {
  await page.goto("/beach/1");
  await expect(page.locator("h1")).toContainText("Ocean Beach");
});
```

### Client Components

```typescript
// Test via Jest/React Testing Library
test("Favorite button toggles state", async () => {
  render(<FavoriteButton beachId="1" />);
  const button = screen.getByRole("button");

  await user.click(button);
  expect(button).toHaveAttribute("aria-pressed", "true");
});
```

## Resources

- [Next.js Server Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Next.js Client Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)

---

**Last Updated:** October 3, 2025  
**Next.js Version:** 14.2.32  
**Pattern Status:** Production ready
