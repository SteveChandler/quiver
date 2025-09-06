# Performance Baseline - Bundle & Runtime Metrics

## Current Performance Status

**Assessment Date**: September 3, 2025  
**Environment**: Production build analysis  
**Status**: ⚠️ **BASELINE NEEDED** - No systematic performance monitoring  

## Bundle Analysis (To Be Established)

### Build Output Analysis Required
```bash
# Commands to establish baseline
ANALYZE=true npm run build
npm run lighthouse
npm run perf:audit
```

**Current Gaps**:
- 🚨 No bundle size monitoring in CI
- 🚨 No Core Web Vitals tracking  
- 🚨 No performance regression detection
- ✅ Bundle analyzer configured but not routinely used

### Estimated Bundle Characteristics
Based on dependencies and app size:

**Predicted Bundle Sizes**:
```typescript
const ESTIMATED_BUNDLE_SIZES = {
  // Framework overhead
  'Next.js runtime': '~400kb',
  'React + React-DOM': '~350kb', 
  
  // UI Framework
  'Radix UI components': '~300kb',
  'Tailwind CSS runtime': '~50kb',
  'Framer Motion': '~500kb',
  
  // Maps & Visualization  
  'Mapbox GL': '~2.3MB',
  'Recharts': '~800kb',
  
  // Application code
  'Components (224 files)': '~800kb',
  'Hooks & utilities': '~200kb',
  'Actions & API': '~300kb',
  
  // Total estimated: ~5.0MB (uncompressed)
  // Total estimated: ~1.5MB (gzipped)
};
```

### Tree Shaking Analysis
**Current Import Patterns** (needs audit):
```typescript
// ✅ Good patterns (found in some places)
import { Button } from '@/components/ui/button';
import { getBeaches } from '@/actions/beach-actions';

// ❌ Potentially problematic patterns (need investigation)
import * as RadixDialog from '@radix-ui/react-dialog';
import lodash from 'lodash';
```

## Runtime Performance (Estimated)

### Page Load Characteristics

**Route Performance Estimates**:
| Route | Estimated LCP | FID | CLS | Notes |
|-------|--------------|-----|-----|--------|
| `/` | 2.0s | <100ms | <0.1 | Landing page, optimized |
| `/discover` | 4.0s | <200ms | 0.2 | Heavy map loading |
| `/forecast/[id]` | 3.0s | <150ms | <0.1 | Charts + external APIs |
| `/journal` | 2.5s | <100ms | <0.1 | Data-heavy but cached |
| `/profile` | 2.0s | <100ms | <0.1 | Simple form interface |

**Current Issues**:
- Map routes likely slow due to Mapbox GL bundle size
- Forecast pages dependent on external API response time
- No actual measurements to validate estimates

### Network Performance

**External API Dependencies**:
```typescript
const API_PERFORMANCE_CHARACTERISTICS = {
  'NOAA WaveWatch III': {
    averageResponseTime: '800ms',
    reliability: '95%',
    caching: '30 minutes',
    impact: 'High - blocks forecast display'
  },
  'NOAA Tide Service': {
    averageResponseTime: '400ms', 
    reliability: '98%',
    caching: '60 minutes',
    impact: 'Medium - secondary information'
  },
  'NDBC Buoys': {
    averageResponseTime: '600ms',
    reliability: '90%',
    caching: '15 minutes', 
    impact: 'Medium - real-time conditions'
  },
  'Mapbox APIs': {
    averageResponseTime: '200ms',
    reliability: '99%',
    caching: '24 hours',
    impact: 'High - map functionality'
  }
};
```

### Database Performance

**Supabase PostgreSQL Characteristics**:
- **Connection Pool**: Managed by Supabase  
- **Query Performance**: Generally <100ms for indexed queries
- **Realtime Latency**: ~200-500ms for subscription updates
- **RLS Overhead**: Minimal with proper patterns

**Performance-Critical Queries**:
```sql  
-- Beach discovery (spatial query)
SELECT * FROM beaches 
WHERE ST_DWithin(location, ST_Point($1, $2), $3)
ORDER BY ST_Distance(location, ST_Point($1, $2))
LIMIT 20;

-- Session history (user-specific, indexed)
SELECT s.*, b.name as beach_name 
FROM sessions s 
JOIN beaches b ON s.beach_id = b.id 
WHERE s.user_id = $1 
ORDER BY s.session_date DESC 
LIMIT 50;

-- Activity feed (complex social query)
SELECT af.* FROM activity_feed af
JOIN user_follows uf ON af.user_id = uf.followed_id
WHERE uf.follower_id = $1
ORDER BY af.created_at DESC
LIMIT 20;
```

## Current Performance Gaps

### 1. Measurement Infrastructure 🚨
**Missing**:
- Bundle size tracking in CI
- Core Web Vitals monitoring
- Performance regression alerts
- Real User Monitoring (RUM)

**Impact**: No visibility into performance regressions

### 2. Optimization Opportunities 🚨
**Client-Side Rendering Overuse**:
- 219 components marked with "use client"  
- Opportunities for Server Side Rendering (SSR)
- Static generation potential not fully utilized

**Bundle Optimization**:
- Heavy dependencies (Mapbox: 2.3MB, Framer Motion: 500kb)
- Potential for code splitting not implemented
- Image optimization opportunities

### 3. Caching Strategy 🚨  
**Current Gaps**:
- No shared cache between components
- Duplicate API requests common
- Browser caching not optimized
- CDN not configured for assets

## Performance Testing Strategy

### Core Web Vitals Monitoring
```typescript
// Add to E2E tests
export const measureWebVitals = async (page: Page) => {
  const vitals = await page.evaluate(() => {
    return new Promise(resolve => {
      const vitals = {};
      
      // Largest Contentful Paint
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        vitals.lcp = entries[entries.length - 1].startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay  
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        vitals.fid = entries[0].processingStart - entries[0].startTime;
      }).observe({ entryTypes: ['first-input'] });
      
      // Cumulative Layout Shift
      let cls = 0;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
        vitals.cls = cls;
      }).observe({ entryTypes: ['layout-shift'] });
      
      setTimeout(() => resolve(vitals), 5000);
    });
  });
  
  return vitals;
};
```

### Bundle Size Monitoring
```typescript
// scripts/monitor-bundle-size.js
const { execSync } = require('child_process');
const fs = require('fs');

// Build and analyze
execSync('ANALYZE=true npm run build');

// Parse bundle analyzer output
const bundleStats = JSON.parse(fs.readFileSync('.next/analyze/client.json'));

// Extract key metrics
const metrics = {
  totalSize: bundleStats.parsedSize,
  gzipSize: bundleStats.gzipSize,
  largestChunks: bundleStats.assets
    .sort((a, b) => b.parsedSize - a.parsedSize)
    .slice(0, 10),
  timestamp: new Date().toISOString()
};

// Compare with baseline
const baseline = JSON.parse(fs.readFileSync('performance/baseline.json'));
const regression = (metrics.totalSize - baseline.totalSize) / baseline.totalSize;

if (regression > 0.1) { // 10% increase
  console.error(`Bundle size regression: ${(regression * 100).toFixed(1)}%`);
  process.exit(1);
}
```

## Optimization Targets

### Bundle Size Targets
```typescript
const PERFORMANCE_TARGETS = {
  bundleSize: {
    firstLoad: '<1.2MB', // 20% reduction from estimated 1.5MB
    totalApp: '<4.0MB',   // 20% reduction from estimated 5.0MB
    largestChunk: '<800kb', // No single chunk over 800kb
    thirdParty: '<60%'      // Third party code <60% of bundle
  },
  
  coreWebVitals: {
    lcp: '<2.5s',    // Google "Good" threshold
    fid: '<100ms',   // Google "Good" threshold  
    cls: '<0.1',     // Google "Good" threshold
    ttfb: '<600ms'   // Time to First Byte
  },
  
  buildPerformance: {
    buildTime: '<3min',      // CI build time
    typeCheck: '<30s',       // TypeScript checking
    linting: '<15s',         // ESLint execution
    testing: '<2min'         // Jest test suite
  }
};
```

### Optimization Strategies

**1. Bundle Optimization (High Impact)**:
```typescript
// Dynamic imports for heavy components
const MapComponent = dynamic(() => import('./MapComponent'), {
  loading: () => <MapSkeleton />,
  ssr: false // Client-side only for map
});

// Route-based code splitting
const ForecastPage = dynamic(() => import('./ForecastPage'), {
  loading: () => <PageSkeleton />
});
```

**2. Image Optimization**:
```typescript
// Use Next.js Image component with optimization
import Image from 'next/image';

<Image
  src={beachPhoto}
  alt="Beach photo"
  width={400}
  height={300}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

**3. Server-Side Rendering Optimization**:
```typescript
// Convert client components to RSC where possible
// Before: 'use client' component
export default function BeachList({ beaches }) {
  return (
    <div>
      {beaches.map(beach => <BeachCard key={beach.id} beach={beach} />)}
    </div>
  );
}

// After: Server component (no 'use client')
// Interactive behavior in separate client component
```

## Monitoring Implementation Plan

### Week 1: Baseline Establishment
1. **Bundle Analysis Setup**:
   - Configure bundle analyzer in CI
   - Generate baseline metrics
   - Set up size regression alerts

2. **Performance Testing Integration**:
   - Add Core Web Vitals to E2E tests
   - Create performance test suite
   - Establish passing thresholds

### Week 2: Real User Monitoring  
1. **RUM Implementation**:
   - Add Vercel Speed Insights enhancement
   - Custom performance tracking
   - Error rate monitoring

2. **Build Performance**:
   - CI build time tracking
   - Type check performance monitoring
   - Test execution time tracking

### Week 3: Optimization Implementation
1. **Bundle Optimizations**:
   - Dynamic imports for heavy components
   - Code splitting implementation
   - Tree shaking verification

2. **Runtime Optimizations**:
   - Image optimization audit
   - Caching strategy implementation
   - Database query optimization

### Week 4: Validation & Alerting
1. **Performance Validation**:
   - Before/after comparison
   - Regression testing
   - User acceptance testing

2. **Monitoring Setup**:
   - Performance dashboards
   - Automated alerts
   - Regular reporting

## Success Metrics

### Quantitative Targets
- **Bundle Size**: Reduce first load by 15-20%
- **Core Web Vitals**: All routes meet "Good" thresholds
- **Build Time**: Improve by 10-15%
- **API Response Time**: 95th percentile <2s
- **Database Query Time**: 95th percentile <200ms

### Qualitative Improvements
- **Developer Experience**: Faster local builds and deployments
- **User Experience**: Faster page loads and smoother interactions  
- **Operational Excellence**: Proactive performance monitoring
- **Business Impact**: Better SEO scores, improved conversion rates

---

## Summary

**Current Status**: No systematic performance monitoring (HIGH RISK)  
**Priority**: Establish baseline measurements immediately  
**Optimization Potential**: High - estimated 15-25% improvement possible  
**Implementation Risk**: Low - mostly tooling and measurement  
**Timeline**: 4 weeks to full performance monitoring and optimization

**Critical Next Steps**:
1. Run bundle analysis to establish baseline  
2. Add Core Web Vitals to E2E test suite
3. Implement CI performance monitoring
4. Begin systematic optimization based on measurements