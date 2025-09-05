# Migration Plan - Step-by-Step Implementation

## Migration Overview

**Duration**: 4 weeks  
**Approach**: Incremental, reversible changes  
**Validation**: Test-driven migration with rollback points  

## Week 1: Foundation & Quick Wins

### Day 1: Environment Setup
```bash
# 1. Remove unused dev dependencies (15 min)
npm uninstall @next/bundle-analyzer @playwright/mcp @testing-library/dom \
  @types/jest jest-environment-jsdom postcss postcss-load-config ts-node

# 2. Pin version ranges (10 min)
npm install @hookform/resolvers@3.3.4 @supabase/ssr@0.5.1 \
  @supabase/supabase-js@2.45.4 react-hook-form@7.53.2 --save-exact

# 3. Set up bundle analyzer (5 min)
ANALYZE=true npm run build
```

**Validation**:
- [ ] `npm install` completes without errors
- [ ] Build succeeds and generates bundle analysis
- [ ] All tests pass: `npm test && npm run test:e2e`

**Deliverables**:
- Cleaned `package.json`  
- Bundle size baseline metrics
- Stable test environment

### Day 2: Type System Fixes
```bash
# 1. Regenerate database types (5 min)
npx supabase gen types typescript --local > types/database.ts

# 2. Fix TypeScript strict mode errors (30 min)
npm run typecheck:strict-unused 2> type-errors.txt
# Fix each error individually
```

**Specific Fixes**:
```typescript
// types/intel.ts - Add missing exports
export type IntelPostTag = Database['public']['Tables']['intel_post_tags']['Row'];
export type IntelPostWithUser = Database['public']['Tables']['intel_posts']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

// test-utils/gamification-test-helpers.ts - Remove unused vars
export const mockGameData = (userId: string) => {
  // Remove: const columns = ['id', 'user_id'];
  // Remove: const makeThenable = (value: any) => ({ then: () => value });
  // Remove: const args = Array.from(arguments);
  return { userId, points: 100, badges: [] };
};
```

**Validation**:
- [ ] `npx tsc --noEmit --strict` produces zero errors
- [ ] Database types include all recent schema changes
- [ ] Test suite passes with strict type checking

### Day 3-4: Data Gateway Foundation
```typescript
// lib/data/client.ts - Create unified data access point
import { 
  getBeachesAction, 
  getBeachAction, 
  searchBeachesAction 
} from '@/actions/beach-actions';

export const data = {
  beaches: {
    getAll: async (filters?: BeachFilters) => getBeachesAction(filters),
    getById: async (id: string) => getBeachAction(id),
    search: async (query: string) => searchBeachesAction(query),
    getNearby: async (lat: number, lng: number) => getNearbyBeachesAction(lat, lng)
  },
  sessions: {
    getAll: async (filters?: SessionFilters) => getSessionsAction(filters),
    create: async (data: SessionCreate) => createSessionAction(data),
    update: async (id: string, data: SessionUpdate) => updateSessionAction(id, data),
    delete: async (id: string) => deleteSessionAction(id)
  }
  // Add other domains as needed
};
```

**High-Impact Migration Targets** (Day 4):
```typescript
// components/discover/beach-list.tsx - BEFORE
const supabase = createClient();
const { data: beaches } = await supabase.from('beaches').select('*');

// AFTER
import { data } from '@/lib/data/client';
const beaches = await data.beaches.getAll();
```

**Migration Priority List**:
1. `components/discover/beach-list.tsx` (high traffic)
2. `components/forecast/forecast-widget.tsx` (high traffic)  
3. `app/beach/[id]/page.tsx` (SEO critical)
4. `components/journal/session-form.tsx` (core feature)
5. `app/discover/page.tsx` (landing funnel)

**Validation**:
- [ ] Gateway exports all necessary functions
- [ ] 5 target files successfully migrated
- [ ] Full test suite passes
- [ ] No performance regression

### Day 5: Initial Dead Code Removal
```typescript
// Remove high-confidence unused exports
// actions/analytics-actions.ts
- updateSessionPrivacy (line 293) ❌ REMOVE

// actions/intel-actions.ts  
- deleteIntelPost (line 561) ❌ REMOVE
- default export (line 165) ❌ REMOVE

// actions/session-media-actions.ts
- cleanupOrphanedMediaAction (line 286) ❌ REMOVE
- batchUpdatePhotoCaptionsAction (line 320) ❌ REMOVE
```

**Systematic Process**:
1. Search codebase for each function: `rg "functionName" --type ts`
2. Verify no imports: `rg "import.*functionName" --type ts`  
3. Remove function and update exports
4. Run tests: `npm test`

**Validation**:
- [ ] 20+ unused exports removed
- [ ] No new TypeScript errors
- [ ] All tests continue passing

## Week 2: Data Access Migration

### Day 1: Beaches Domain Complete
```typescript
// Target files for beaches domain:
components/beach/beach-card.tsx
components/beach/beach-search.tsx  
components/discover/beach-filters.tsx
components/map/beach-markers.tsx
app/beach/[id]/page.tsx
app/discover/page.tsx

// Migration pattern:
// OLD: Direct Supabase calls
const supabase = createClient();
const { data: beaches } = await supabase
  .from('beaches')
  .select('*, reviews(rating)')
  .limit(20);

// NEW: Via data gateway
import { data } from '@/lib/data/client';
const beaches = await data.beaches.getAll({ 
  includeReviews: true, 
  limit: 20 
});
```

### Day 2: Sessions Domain Complete
```typescript
// Target files for sessions domain:
components/journal/session-form.tsx
components/journal/session-list.tsx  
components/journal/session-stats.tsx
components/session/session-wizard.tsx
app/journal/page.tsx
app/journal/[id]/page.tsx

// Enhanced gateway functions:
export const data = {
  sessions: {
    getAll: async (filters?: SessionFilters) => getSessionsAction(filters),
    getById: async (id: string) => getSessionAction(id),
    create: async (sessionData: SessionCreate) => createSessionAction(sessionData),
    update: async (id: string, data: SessionUpdate) => updateSessionAction(id, data),
    delete: async (id: string) => deleteSessionAction(id),
    getStats: async (userId: string) => getSessionStatsAction(userId),
    getRecent: async (userId: string, limit = 10) => getRecentSessionsAction(userId, limit)
  }
};
```

### Day 3: User/Profile Domain Complete  
```typescript
// Target files for user/profile domain:
components/profile/profile-form.tsx
components/profile/avatar-upload.tsx
components/user/user-card.tsx
components/social/follow-button.tsx
app/profile/page.tsx
app/settings/page.tsx

// Profile gateway functions:
export const data = {
  users: {
    getProfile: async (userId?: string) => getProfileAction(userId),
    updateProfile: async (data: ProfileUpdate) => updateProfileAction(data),
    uploadAvatar: async (file: File) => uploadAvatarAction(file),
    follow: async (userId: string) => followUserAction(userId),
    unfollow: async (userId: string) => unfollowUserAction(userId),
    getFollowers: async (userId: string) => getFollowersAction(userId),
    getFollowing: async (userId: string) => getFollowingAction(userId)
  }
};
```

### Day 4: Social Features Domain Complete
```typescript
// Target files for social domain:
components/social/activity-feed.tsx
components/social/user-list.tsx
components/intel/intel-form.tsx
components/intel/intel-card.tsx
app/page.tsx (activity feed)
app/intel/page.tsx

// Social gateway functions:
export const data = {
  social: {
    getActivityFeed: async (userId?: string) => getActivityFeedAction(userId),
    getIntelPosts: async (filters?: IntelFilters) => getIntelPostsAction(filters),
    createIntelPost: async (data: IntelPostCreate) => createIntelPostAction(data),
    updateIntelPost: async (id: string, data: IntelPostUpdate) => updateIntelPostAction(id, data),
    likePost: async (postId: string) => likeIntelPostAction(postId),
    unlikePost: async (postId: string) => unlikeIntelPostAction(postId)
  }
};
```

### Day 5: Forecast & Content Domains
```typescript
// Target files for forecast domain:
components/forecast/forecast-widget.tsx
components/forecast/forecast-chart.tsx
components/forecast/tide-chart.tsx
components/weather/weather-widget.tsx
app/forecast/[beachId]/page.tsx

// Forecast gateway functions:
export const data = {
  forecast: {
    get: async (beachId: string, days = 7) => getForecastAction(beachId, days),
    getTides: async (beachId: string, date?: string) => getTideDataAction(beachId, date),
    getBuoy: async (buoyId: string) => getBuoyDataAction(buoyId),
    getWeather: async (beachId: string) => getWeatherDataAction(beachId)
  },
  gamification: {
    getUserXP: async (userId: string) => getUserXPAction(userId),
    getUserBadges: async (userId: string) => getUserBadgesAction(userId),
    getLeaderboard: async () => getXPLeaderboardAction()
  }
};
```

**Week 2 Validation Checkpoints**:
- [ ] Day 1: Beaches domain fully migrated, tests pass
- [ ] Day 2: Sessions domain fully migrated, tests pass  
- [ ] Day 3: User/profile domain fully migrated, tests pass
- [ ] Day 4: Social features fully migrated, tests pass
- [ ] Day 5: All domains migrated, comprehensive test validation

## Week 3: Code Quality & Testing

### Day 1-2: Complete Dead Code Removal
```typescript
// Systematic removal of remaining unused exports
// Use knip output as checklist:

// components/ui/use-toast.ts:77:14 - unused reducer
// hooks/use-beach-reviews.ts:31:17 - unused hook  
// lib/constants/animations.ts:42:14 - unused DURATIONS
// lib/utils/loading-utils.tsx:* - entire file unused (0% coverage)
// lib/utils/navigation-utils.ts:* - most functions unused
// lib/utils/toast-utils.ts:* - entire file unused (0% coverage)
```

**Removal Process**:
1. **Batch 1** (Day 1): Remove entire unused files
2. **Batch 2** (Day 1): Remove unused functions from partially used files  
3. **Batch 3** (Day 2): Clean up unused type definitions
4. **Validation** (Day 2): Full regression testing

### Day 3: Fix Flaky E2E Tests
```typescript
// e2e/home-beach.spec.ts - Fix race conditions
test('setting home beach updates everywhere', async ({ page }) => {
  await page.goto('/profile');
  await page.waitForLoadState('load');
  
  // ✅ Wait for form to be interactive
  await page.waitForSelector('[data-testid="home-beach-select"]:not([disabled])');
  
  await page.selectOption('[data-testid="home-beach-select"]', 'malibu-123');
  
  // ✅ Wait for optimistic update
  await page.waitForSelector('[data-testid="home-beach-selected"][data-value="malibu-123"]');
  
  // ✅ Wait for realtime subscription to propagate
  await waitForRealtimeUpdate(page, 3000);
  
  await page.goto('/dashboard');
  await page.waitForLoadState('load');
  
  // ✅ Now safe to assert
  await expect(page.locator('[data-testid="current-home-beach"]')).toHaveText('Malibu');
});
```

**Priority Flaky Test Fixes**:
1. `e2e/home-beach.spec.ts` - Home beach selection flow
2. `e2e/profile.spec.ts` - Profile edit and avatar upload
3. `e2e/auth-flow.spec.ts` - Sign in/out, password reset
4. `e2e/session-wizard-completion.spec.ts` - Session logging workflow

### Day 4: Test Coverage Improvements
```typescript
// Add tests for 0% coverage utilities
// lib/utils/loading-utils.tsx
describe('loading-utils', () => {
  it('shows loading spinner with correct props', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    expect(container.firstChild).toHaveClass('animate-spin');
  });
});

// lib/utils/toast-utils.ts
describe('toast-utils', () => {
  it('shows success toast with message', () => {
    showSuccessToast('Test message');
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});
```

### Day 5: Performance Test Integration
```typescript
// Add performance validation to critical E2E tests
test('dashboard performance meets production standards', async ({ page }) => {
  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('load');
  
  // Measure Core Web Vitals
  const vitals = await page.evaluate(() => {
    return new Promise(resolve => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries.find(entry => entry.entryType === 'largest-contentful-paint');
        const fid = entries.find(entry => entry.entryType === 'first-input');
        const cls = entries.find(entry => entry.entryType === 'layout-shift');
        
        resolve({
          lcp: lcp?.startTime || 0,
          fid: fid?.processingStart || 0,  
          cls: cls?.value || 0
        });
      }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      
      // Fallback timeout
      setTimeout(() => resolve({ lcp: 0, fid: 0, cls: 0 }), 5000);
    });
  });
  
  // Production thresholds
  expect(vitals.lcp).toBeLessThan(2500);  // 2.5s LCP
  expect(vitals.fid).toBeLessThan(100);   // 100ms FID
  expect(vitals.cls).toBeLessThan(0.1);   // 0.1 CLS
});
```

## Week 4: Validation & Deployment

### Day 1-2: Comprehensive Regression Testing
```typescript
// Full test suite validation
npm run test:coverage      // Unit/integration tests
npm run test:e2e          // E2E test suite  
npm run typecheck:strict-unused  // Type checking
npm run lint              // Code quality
npm run build             // Build validation
```

**Regression Checklist**:
- [ ] All unit tests pass (aim for >95% success rate)
- [ ] All E2E tests pass (aim for 100% success rate)
- [ ] No TypeScript errors in strict mode
- [ ] No ESLint errors or warnings
- [ ] Production build succeeds without warnings
- [ ] Bundle size improvement validated

### Day 3: Performance Impact Analysis
```bash
# Before/after bundle analysis
ANALYZE=true npm run build
# Compare bundle sizes, identify largest changes
# Validate Core Web Vitals in staging environment
# Measure build time improvements
```

**Performance Validation**:
- [ ] Bundle size reduced by target percentage (15%+)
- [ ] Build time improved by target percentage (10%+)  
- [ ] No performance regressions in critical user flows
- [ ] Core Web Vitals maintain or improve scores

### Day 4: Documentation & Knowledge Transfer
```markdown
# Update relevant architecture docs
- ARCHITECTURE.md - Add data gateway pattern
- lib/ARCHITECTURE.md - Document new data layer
- CHANGELOG.md - Record all changes made
- docs/CONSOLIDATION_RESULTS.md - Migration outcomes
```

**Documentation Updates**:
- [ ] Architecture docs reflect new patterns
- [ ] Code comments explain gateway usage  
- [ ] CHANGELOG.md records all changes
- [ ] Team training materials updated

### Day 5: Final Validation & Deployment
```bash
# Final validation checklist
npm run dead:all          # Verify dead code removal
npm test                  # Final test run
npm run build:analyze     # Final bundle analysis
npm run lighthouse        # Performance audit
```

**Go/No-Go Checklist**:
- [ ] All success metrics achieved
- [ ] No critical functionality broken
- [ ] Performance improvements validated
- [ ] Documentation complete
- [ ] Rollback plan ready
- [ ] Team approval obtained

## Rollback Procedures

### Emergency Rollback (Any Day)
```bash
# 1. Revert to previous commit
git log --oneline -n 10  # Find pre-migration commit
git revert <commit-hash> # Revert specific changes

# 2. Restore dependencies  
git checkout HEAD~1 -- package.json package-lock.json
npm install

# 3. Validate rollback
npm test && npm run test:e2e
```

### Selective Rollback (By Workstream)
```bash
# Data Gateway Rollback
git revert <data-gateway-commits>
# Find and replace: import { data } from '@/lib/data/client'
# Restore: const supabase = createClient() patterns

# Dependency Rollback
git checkout HEAD~1 -- package.json package-lock.json
npm install

# Dead Code Rollback
git revert <dead-code-removal-commits>
# Restore accidentally removed functions from git history
```

## Success Criteria & Validation

### Week-by-Week Success Metrics
**Week 1**: 
- ✅ Clean dependencies, bundle baseline, data gateway foundation
- 📊 Bundle size baseline established
- 🧪 5 files successfully migrated to gateway

**Week 2**:
- ✅ All data access via unified gateway  
- 📊 Zero direct `createClient()` calls in components
- 🧪 Full test suite passes

**Week 3**:
- ✅ <20 unused exports remaining
- 📊 100% E2E test pass rate
- 🧪 Performance tests integrated

**Week 4**:
- ✅ All target metrics achieved
- 📊 Bundle size reduced 15%+, build time improved 10%+
- 🧪 Ready for production deployment

---

## Migration Team Responsibilities

### Lead Developer
- Execute data gateway migration
- Review all code changes
- Validate performance improvements
- Make go/no-go deployment decisions

### QA Engineer  
- Execute comprehensive regression testing
- Validate E2E test stability improvements
- Performance testing validation
- User acceptance testing

### DevOps Engineer
- CI/CD pipeline updates
- Bundle analysis integration
- Performance monitoring setup
- Deployment coordination

**This migration plan ensures systematic, low-risk consolidation while maintaining Quiver's production-ready status and comprehensive test coverage.**