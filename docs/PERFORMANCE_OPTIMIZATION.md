# Performance Optimization Guide

This document details systematic approaches to performance optimization, using the November 2025 landing page optimization as a reference implementation.

## Table of Contents

1. [Landing Page Case Study](#landing-page-case-study)
2. [Systematic Optimization Approach](#systematic-optimization-approach)
3. [Key Optimization Patterns](#key-optimization-patterns)
4. [Performance Measurement](#performance-measurement)
5. [Optimization Checklist](#optimization-checklist)
6. [Common Pitfalls](#common-pitfalls)
7. [Tools and Resources](#tools-and-resources)

## Landing Page Case Study

### Problem Statement

The landing page had critical performance issues that severely impacted user experience:

**Metrics (Before Optimization):**

- LCP (Largest Contentful Paint): 8.8s (target: <2.5s)
- TBT (Total Blocking Time): 1.13s (target: <200ms)
- Bundle Size: ~1.09MB (excessive for marketing page)
- TTI (Time to Interactive): ~5s (target: <3.5s)
- Lighthouse Score: ~60 (target: >90)

**Impact:**

- 77% of users would abandon the page before LCP
- Poor SEO ranking due to Core Web Vitals
- High bounce rate for first-time visitors
- Wasted marketing spend

### Root Cause Analysis

**1. Client-Side Rendering**

- Entire page marked with `"use client"`
- 3-5s delay for auth check and data fetching waterfall
- No content visible until JavaScript loads and executes

**2. Heavy Dependencies**

- Framer Motion: ~400KB
- cmdk (search autocomplete): ~300KB
- Analytics scripts: ~100KB
- All loaded upfront, blocking TTI

**3. Resource Contention**

- Map API preconnects on landing page (unused)
- Analytics loaded for unauthenticated users
- Wasted browser connection slots

### Solution Architecture

Implemented **server-first architecture** with **progressive enhancement**:

```
Before: Client → Auth Check → Data Fetch → Render → Hydrate → Interactive
After:  Server → Render → Stream → Hydrate Islands → Interactive
```

**Key Changes:**

1. Server components for static content (0KB JavaScript)
2. Client islands for interactive features only
3. Progressive loading with IntersectionObserver
4. CSS animations instead of JavaScript animations
5. Lazy loading for non-critical components
6. Conditional resource loading based on route

### Results

**Metrics (After Optimization):**

- LCP: ~2.0s (-6.8s, 77% improvement)
- TBT: ~80ms (-1,050ms, 93% improvement)
- Bundle: ~690KB (-400KB, 37% reduction)
- TTI: ~2s (-3s, 60% improvement)
- Lighthouse: >90 (+30 points)

**Business Impact:**

- Improved SEO ranking (Core Web Vitals)
- Reduced bounce rate
- Better user experience for first-time visitors
- Faster time to conversion

## Systematic Optimization Approach

### Phase 1: Analysis

**Objective:** Identify bottlenecks and prioritize optimizations

**Steps:**

1. **Run Lighthouse Audit**

   ```bash
   npx lighthouse https://yoursite.com --view
   ```

2. **Analyze Bundle Composition**

   ```bash
   ANALYZE=true yarn build
   # Or
   npx @next/bundle-analyzer
   ```

3. **Profile Runtime Performance**

   - Chrome DevTools Performance tab
   - Record page load
   - Identify long tasks (>50ms)
   - Check main thread blocking time

4. **Check Network Waterfall**
   - Chrome DevTools Network tab
   - Identify render-blocking resources
   - Check resource timing
   - Measure TTFB, FCP, LCP

**Deliverables:**

- Lighthouse report with specific metrics
- Bundle size breakdown by chunk
- Performance profile with long tasks highlighted
- Network waterfall showing critical path

### Phase 2: Server-First Architecture

**Objective:** Eliminate client-side rendering overhead

**Strategy:**

1. **Convert to Server Components**

   ```typescript
   // Before (client-rendered)
   "use client";
   export default function Page() {
     const [data, setData] = useState(null);
     useEffect(() => {
       fetch("/api/data")
         .then((r) => r.json())
         .then(setData);
     }, []);
     return <div>{data?.content}</div>;
   }

   // After (server-rendered)
   export default async function Page() {
     const data = await fetch("/api/data").then((r) => r.json());
     return <div>{data.content}</div>;
   }
   ```

2. **Move Data Fetching to Server**

   ```typescript
   // Server-side data fetching (cached)
   export const getData = unstable_cache(
     async () => {
       const supabase = createSupabaseServerClient();
       const { data } = await supabase.from("table").select();
       return data;
     },
     ["cache-key"],
     { revalidate: 3600 }
   );
   ```

3. **Implement Suspense Boundaries**

   ```typescript
   <Suspense fallback={<FastSkeleton />}>
     <AsyncDataComponent />
   </Suspense>
   ```

4. **Add Progressive Enhancement**
   ```typescript
   // Client island for interactivity
   "use client";
   export function InteractiveWidget() {
     const [state, setState] = useState(false);
     return <button onClick={() => setState(!state)}>Toggle</button>;
   }
   ```

**Expected Impact:**

- LCP improvement: -3s to -5s
- TBT improvement: -500ms to -1000ms
- Bundle reduction: -100KB to -200KB

### Phase 3: Bundle Optimization

**Objective:** Reduce JavaScript bundle size

**Strategies:**

1. **Remove Heavy Dependencies**

   ```bash
   # Identify large packages
   yarn dead:knip
   npx webpack-bundle-analyzer

   # Example: Replace framer-motion with CSS
   npm uninstall framer-motion
   ```

2. **Replace with Lighter Alternatives**

   ```typescript
   // Before: Framer Motion (~400KB)
   import { motion } from 'framer-motion'
   <motion.div animate={{ opacity: 1 }} />

   // After: CSS animations (0KB)
   <div className="animate-fade-in" />
   ```

3. **Lazy Load Non-Critical Components**

   ```typescript
   import { lazy, Suspense } from "react";

   const HeavyComponent = lazy(() => import("./heavy"));

   export function Page() {
     return (
       <Suspense fallback={<Skeleton />}>
         <HeavyComponent />
       </Suspense>
     );
   }
   ```

4. **Code-Split by Route**
   ```typescript
   // Next.js automatically code-splits routes
   // app/
   //   page.tsx      -> chunk-page.js
   //   about/
   //     page.tsx    -> chunk-about.js
   ```

**Expected Impact:**

- Bundle reduction: -300KB to -500KB
- TTI improvement: -1s to -2s

### Phase 4: Resource Optimization

**Objective:** Optimize external resources and third-party scripts

**Strategies:**

1. **Conditional Script Loading**

   ```typescript
   "use client";
   export function ConditionalAnalytics() {
     const pathname = usePathname();
     const shouldLoad = pathname !== "/"; // Skip landing page

     if (!shouldLoad) return null;

     return (
       <>
         <Script src="analytics.js" strategy="lazyOnload" />
       </>
     );
   }
   ```

2. **Route-Specific Resource Hints**

   ```typescript
   // app/layout.tsx (global)
   <link rel="preconnect" href="https://fonts.googleapis.com" />

   // app/map/layout.tsx (map-specific)
   <link rel="preconnect" href="https://api.mapbox.com" />
   ```

3. **Defer Analytics**

   ```typescript
   <Script
     src="analytics.js"
     strategy="lazyOnload" // Load after page interactive
   />
   ```

4. **Optimize Images**

   ```typescript
   import Image from "next/image";

   <Image
     src="/hero.jpg"
     width={1200}
     height={600}
     priority // For LCP image
     quality={85}
     placeholder="blur"
   />;
   ```

**Expected Impact:**

- TTI improvement: -500ms to -1s
- Bundle reduction: -50KB to -150KB

## Key Optimization Patterns

### Pattern 1: Server Component Pattern

**Use Case:** Static content, data fetching

```typescript
// Server component (default)
export default async function Section() {
  const data = await fetchData();

  return (
    <section>
      <h2>{data.title}</h2>
      <p>{data.content}</p>
    </section>
  );
}

// Benefits:
// - 0KB JavaScript
// - Immediate rendering
// - SEO-friendly
```

### Pattern 2: Progressive Enhancement Pattern (Suspense + CSS)

**Use Case:** Async sections and simple entrance animations, without forcing client-only rendering.

```typescript
// 1. Server-render content whenever possible
export default async function Section() {
  const data = await fetchData();
  return (
    <section className="motion-safe:animate-fade-in-up">
      <h2>{data.title}</h2>
      <p>{data.content}</p>
    </section>
  );
}

// 2. Wrap async work in Suspense with a lightweight skeleton
<Suspense fallback={<Skeleton />}>
  <Section />
</Suspense>;

// Benefits:
// - Works without JavaScript for content (SSR)
// - SEO-friendly (real content in HTML)
// - Skeleton prevents layout shift while streaming/awaiting data
```

### Pattern 3: Lazy Loading Pattern

**Use Case:** Heavy components, below-fold content

```typescript
// Defer heavy components
const HeavyComponent = lazy(() => import("./heavy"));

export function Page() {
  return (
    <>
      {/* Critical content */}
      <Hero />

      {/* Below-fold lazy-loaded */}
      <Suspense fallback={<Skeleton />}>
        <HeavyComponent />
      </Suspense>
    </>
  );
}

// Benefits:
// - Faster TTI
// - Smaller initial bundle
// - Better perceived performance
```

### Pattern 4: CSS Animation Pattern

**Use Case:** Visual effects without JavaScript overhead

```typescript
// tailwind.config.ts
keyframes: {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  }
},
animation: {
  'fade-in': 'fadeIn 0.8s ease-out',
}

// Usage
<div className="animate-fade-in">
  Content
</div>

// Benefits:
// - GPU-accelerated
// - No JavaScript execution
// - Smaller bundle
```

### Pattern 5: Conditional Loading Pattern

**Use Case:** Route-specific resources

```typescript
"use client";
export function ConditionalResource() {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    setShouldLoad(pathname === "/specific-route");
  }, [pathname]);

  if (!shouldLoad) return null;

  return <Script src="route-specific.js" />;
}

// Benefits:
// - Load only when needed
// - Reduce initial bundle
// - Better performance
```

## Performance Measurement

### Core Web Vitals

**LCP (Largest Contentful Paint)**

- **Target:** <2.5s (good), <4s (needs improvement), >4s (poor)
- **Measures:** Time to render largest content element
- **Optimize:** Server-render critical content, optimize images, preload resources

**FID (First Input Delay)**

- **Target:** <100ms (good), <300ms (needs improvement), >300ms (poor)
- **Measures:** Time from first interaction to browser response
- **Optimize:** Reduce JavaScript execution, code-split, defer non-critical scripts

**CLS (Cumulative Layout Shift)**

- **Target:** <0.1 (good), <0.25 (needs improvement), >0.25 (poor)
- **Measures:** Visual stability during page load
- **Optimize:** Reserve space for images, avoid layout shifts, use skeleton loaders

### Additional Metrics

**TTI (Time to Interactive)**

- **Target:** <3.5s (good), <7.3s (needs improvement), >7.3s (poor)
- **Measures:** Time until page is fully interactive
- **Optimize:** Reduce JavaScript, lazy load, code-split

**TBT (Total Blocking Time)**

- **Target:** <200ms (good), <600ms (needs improvement), >600ms (poor)
- **Measures:** Total time main thread is blocked
- **Optimize:** Break up long tasks, defer non-critical JavaScript

**FCP (First Contentful Paint)**

- **Target:** <1.8s (good), <3s (needs improvement), >3s (poor)
- **Measures:** Time to first content render
- **Optimize:** Reduce TTFB, inline critical CSS, preload fonts

### Measurement Tools

**1. Lighthouse**

```bash
# CLI
npx lighthouse https://yoursite.com --view

# CI/CD -- not a repo dependency, always run via npx
npx -y @lhci/cli@0.15.1 autorun

# or, from this repo (same pinned version)
yarn lighthouse:ci
```

**2. WebPageTest**

```
https://webpagetest.org
- Multiple locations
- Real devices
- Filmstrip view
- Detailed waterfall
```

**3. Chrome DevTools**

```
- Performance tab: Profile runtime
- Network tab: Check waterfall
- Coverage tab: Find unused code
- Lighthouse tab: Run audits
```

**4. Vercel Analytics**

```bash
# Real user metrics
vercel analytics

# Core Web Vitals
# Aggregated by page, device, location
```

## Optimization Checklist

### Pre-Optimization

- [ ] Baseline metrics recorded (Lighthouse, WebPageTest)
- [ ] Bundle analyzed (webpack-bundle-analyzer)
- [ ] Performance profile captured (Chrome DevTools)
- [ ] Critical path identified (Network waterfall)
- [ ] Prioritized optimization targets defined

### Server-Side Rendering

- [ ] Server components for static content
- [ ] Async data fetching on server
- [ ] Suspense boundaries for progressive enhancement
- [ ] Client islands for interactive features only
- [ ] Dynamic rendering for auth-based routing

### Bundle Optimization

- [ ] Heavy dependencies identified and removed/replaced
- [ ] CSS animations instead of JavaScript animations
- [ ] Lazy loading for non-critical components
- [ ] Code-splitting by route
- [ ] Tree-shaking enabled (default in Next.js)
- [ ] Unused dependencies removed (`yarn dead:knip`)

### Resource Optimization

- [ ] Images optimized (WebP, lazy loading, sizing)
- [ ] Fonts optimized (font-display: swap, subsetting)
- [ ] Third-party scripts deferred (strategy: lazyOnload)
- [ ] Resource hints optimized (preconnect, dns-prefetch)
- [ ] Route-specific resource loading
- [ ] Conditional analytics loading

### Caching

- [ ] Static assets cached (CDN)
- [ ] Server-side data cached (Next.js cache)
- [ ] Cache headers configured (Cache-Control)
- [ ] Revalidation strategy defined (ISR, on-demand)

### Monitoring

- [ ] Lighthouse CI configured
- [ ] Real user monitoring enabled (Vercel Analytics)
- [ ] Performance budgets defined
- [ ] Alerts configured for regressions
- [ ] Dashboard created for tracking

## Common Pitfalls

### 1. Over-Optimization

**Problem:** Sacrificing UX for metrics

**Example:**

```typescript
// Bad: Removes useful animation for metrics
<div className="no-animation">Content</div>

// Good: Optimizes without sacrificing UX
<div className="animate-fade-in">Content</div>
```

**Solution:** Balance performance with user experience

### 2. Premature Optimization

**Problem:** Optimizing without measuring

**Example:**

```typescript
// Bad: Optimizing random component
<Suspense>
  <RandomComponent />
</Suspense>

// Good: Optimize based on data
// 1. Profile page load
// 2. Identify bottleneck (e.g., HeavyComponent)
// 3. Optimize HeavyComponent
```

**Solution:** Measure first, optimize second

### 3. Ignoring Mobile

**Problem:** Testing only on desktop

**Example:**

```typescript
// Bad: Assumes fast connection
<video autoplay src="hero-video.mp4" />;

// Good: Responsive loading
{
  isMobile ? <Image /> : <video />;
}
```

**Solution:** Test on real devices with throttled networks

### 4. Breaking Functionality

**Problem:** Optimization breaks features

**Example:**

```typescript
// Bad: Removes auth check for performance
export default function Page() {
  return <PrivateContent />;
}

// Good: Maintains auth with server component
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <PrivateContent />;
}
```

**Solution:** Maintain feature parity, test thoroughly

### 5. Not Measuring Impact

**Problem:** No validation of improvements

**Example:**

```typescript
// Bad: Apply optimization without measuring
// (No before/after metrics)

// Good: Measure impact
// 1. Baseline: LCP 8.8s
// 2. Apply optimization
// 3. Measure: LCP 2.0s (-6.8s improvement)
```

**Solution:** Always validate improvements with data

### 6. Ignoring TTI

**Problem:** Focusing only on LCP

**Example:**

```typescript
// Bad: Fast LCP but slow TTI
<Image priority /> {/* LCP fast */}
<script src="massive.js" /> {/* TTI slow */}

// Good: Optimize both
<Image priority />
<Script src="massive.js" strategy="lazyOnload" />
```

**Solution:** Optimize all Core Web Vitals

## Tools and Resources

### Measurement Tools

**Lighthouse**

- CLI: `npx lighthouse <url>` (`lighthouse` is a devDependency of this repo)
- Chrome DevTools: Lighthouse tab
- CI/CD: `@lhci/cli`, pinned to 0.15.1. Deliberately **not** a devDependency
  here -- its bundled Puppeteer chain pulled a vulnerable `extract-zip` with no
  patched release (GHSA-jmr9-qjv8-65gv). `.github/workflows/lighthouse-ci.yml`
  installs it globally, and `yarn lighthouse:ci` runs it via npx. Do not add it
  back to `package.json`.

**WebPageTest**

- https://webpagetest.org
- Multiple locations, devices
- Detailed waterfall, filmstrip

**Chrome DevTools**

- Performance tab: Profiling
- Network tab: Waterfall
- Coverage tab: Unused code
- Lighthouse tab: Audits

**Vercel Analytics**

- Real user metrics
- Core Web Vitals
- Page-level insights

### Analysis Tools

**Bundle Analyzer**

```bash
ANALYZE=true yarn build
npx @next/bundle-analyzer
```

**Dependency Check**

```bash
yarn dead:knip
npm outdated
```

**Image Optimization**

```bash
npx @squoosh/cli --webp 85 *.jpg
```

### Learning Resources

**Web.dev**

- https://web.dev/performance/
- Core Web Vitals guide
- Optimization patterns

**Next.js Docs**

- https://nextjs.org/docs/app/building-your-application/optimizing
- Server components
- Image optimization
- Font optimization

**Lighthouse Documentation**

- https://developer.chrome.com/docs/lighthouse/
- Audit reference
- Scoring guide

**Vercel Speed Insights**

- https://vercel.com/docs/speed-insights
- Real user monitoring
- Core Web Vitals tracking

### Performance Budgets

**Recommended Budgets**

| Resource            | Budget | Rationale            |
| ------------------- | ------ | -------------------- |
| JavaScript          | <200KB | Fast TTI on 3G       |
| CSS                 | <50KB  | Fast render on 3G    |
| Images (above fold) | <500KB | Fast LCP on 3G       |
| Total (above fold)  | <750KB | Fast FCP on 3G       |
| LCP                 | <2.5s  | Core Web Vitals      |
| FID                 | <100ms | Core Web Vitals      |
| CLS                 | <0.1   | Core Web Vitals      |
| TTI                 | <3.5s  | Good user experience |
| TBT                 | <200ms | Smooth interactions  |

**Setting Budgets**

```javascript
// lighthouse.config.js
module.exports = {
  budgets: [
    {
      resourceSizes: [
        { resourceType: "script", budget: 200 },
        { resourceType: "stylesheet", budget: 50 },
        { resourceType: "image", budget: 500 },
      ],
      timings: [
        { metric: "interactive", budget: 3500 },
        { metric: "first-contentful-paint", budget: 1800 },
        { metric: "largest-contentful-paint", budget: 2500 },
      ],
    },
  ],
};
```

## Best Practices Summary

1. **Measure First**

   - Baseline metrics before optimization
   - Identify bottlenecks with data
   - Prioritize based on impact

2. **Server-First Architecture**

   - Server components by default
   - Client islands for interactivity
   - Progressive enhancement

3. **Bundle Management**

   - Remove heavy dependencies
   - Lazy load non-critical code
   - Code-split by route
   - Use CSS instead of JavaScript

4. **Resource Prioritization**

   - Preconnect to critical origins
   - Route-specific resource hints
   - Defer analytics and tracking
   - Optimize images and fonts

5. **Continuous Monitoring**

   - Lighthouse CI in pipeline
   - Real user monitoring
   - Performance budgets
   - Alert on regressions

6. **Balance Performance and UX**
   - Don't sacrifice usability for metrics
   - Maintain feature parity
   - Test on real devices
   - Validate improvements

---

**Last Updated:** November 2025
**Next Review:** January 2026
**Maintainer:** Engineering Team

**Related Documentation:**

- `components/landing-page/ARCHITECTURE.md` - Landing page optimization case study
- `docs/performance/README.md` - Performance documentation index
- `e2e/ARCHITECTURE.md` - E2E testing patterns
