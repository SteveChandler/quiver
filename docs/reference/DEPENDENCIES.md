# Dependency Management

## Package Manager: Yarn Classic (1.x)

This project uses **Yarn Classic (1.x)** exclusively for dependency management.

### Why Yarn?
- Consistent lock file format across team
- Faster installs with offline caching
- Better deterministic dependency resolution
- Industry-standard for React/Next.js projects

### Enforcement
npm is disabled via `.npmrc` with `engine-strict=true`. The `package.json` engines field enforces:
```json
{
  "engines": {
    "node": ">=18.0.0 <23.0.0",
    "yarn": "^1.22.0",
    "npm": "please-use-yarn"
  }
}
```

### Installation
```bash
# Install dependencies
yarn install

# Add a package
yarn add <package-name>

# Add a dev dependency
yarn add -D <package-name>

# Remove a package
yarn remove <package-name>
```

---

## Progressive Web App (PWA)

### Current Library: @ducanh2912/next-pwa

We use **@ducanh2912/next-pwa** (v10.2.9) instead of the original `next-pwa` package.

**Migration Date:** 2025-10-30

#### Why the Modern Fork?
- ✅ **Active Maintenance**: Actively maintained with Next.js 14+ support
- ✅ **Better Compatibility**: Designed for modern Next.js App Router
- ✅ **Cleaner Warnings**: Better peer dependency handling
- ✅ **Modern Webpack 5**: Built for webpack 5 from the ground up
- ⚠️ **Original Unmaintained**: `next-pwa@5.6.0` hasn't been updated since 2021

#### Configuration
PWA is configured in `next.config.mjs`:
- **Production Only**: PWA disabled in development (`disable: !isProd`)
- **Auto-registration**: Service worker auto-registers on page load
- **Skip Waiting**: New service workers activate immediately
- **Runtime Caching**: Aggressive caching for forecasts, beaches, buoys, images

#### Caching Strategy
| Resource | Strategy | Cache Duration | Rationale |
|----------|----------|----------------|-----------|
| Forecast API | NetworkFirst | 30 minutes | Fresh data priority, short cache for offline |
| Beach API | NetworkFirst | 1 hour | Semi-static data with offline fallback |
| Buoy API | NetworkFirst | 15 minutes | Real-time data, minimal staleness |
| Images | StaleWhileRevalidate | 7 days | Serve fast, update in background |
| Static Assets | CacheFirst | 1 year | Immutable, permanent cache |

---

## Known Peer Dependency Warnings

### Expected & Safe to Ignore

#### 1. Webpack Peer Dependencies
**Warnings:**
```
warning "@ducanh2912/next-pwa > workbox-webpack-plugin@7.1.0" has unmet peer dependency "webpack@^4.4.0 || ^5.91.0"
warning " > @ducanh2912/next-pwa@10.2.9" has unmet peer dependency "webpack@>=5.9.0"
```

**Why This Happens:**
- Next.js 14+ bundles webpack internally
- Location: `node_modules/next/dist/compiled/webpack`
- PWA plugins use Next.js's bundled webpack instance

**Impact:** None - PWA functionality works correctly

**Should We Fix?**
No. Installing webpack globally would be redundant and could cause version conflicts with Next.js's internal webpack.

---

#### 2. @radix-ui/react-portal Peer Dependency
**Warning:**
```
warning " > onborda@1.2.5" has unmet peer dependency "@radix-ui/react-portal@>=1.1.1"
```

**Status:** ✅ **False Positive** - `@radix-ui/react-portal@1.1.3` is installed
- Yarn's peer dependency resolution doesn't always detect transitive dependencies
- Confirmed present in `node_modules`

**Should We Fix?**
No action needed. The dependency is correctly installed.

---

#### 3. @testing-library/dom Peer Dependency
**Warning:**
```
warning " > @testing-library/user-event@14.6.1" has unmet peer dependency "@testing-library/dom@>=7.21.4"
```

**Status:** ✅ **False Positive** - `@testing-library/dom@10.4.1` is installed
- Version 10.4.1 exceeds the required >=7.21.4
- Yarn heuristics sometimes miss this

**Should We Fix?**
No action needed. The dependency is correctly installed.

---

#### 4. Workspaces Warning
**Warning:**
```
warning Workspaces can only be enabled in private projects.
```

**Status:** ✅ **Already Correct** - `package.json` has `"private": true`
- This is informational noise
- Project is already configured correctly

**Should We Fix?**
No action needed. Already configured correctly.

---

#### 5. Deprecated Packages (Informational)
**Warnings:**
```
warning @ducanh2912/next-pwa > workbox-build > glob@7.2.3: Glob versions prior to v9 are no longer supported
warning @ducanh2912/next-pwa > workbox-build > source-map@0.8.0-beta.0: beta branch won't be included in future versions
warning @ducanh2912/next-pwa > workbox-build > @rollup/plugin-replace > magic-string > sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead
```

**Why This Happens:**
- These are transitive dependencies of `@ducanh2912/next-pwa`
- `workbox-build` (Google's PWA toolkit) uses older versions
- Not directly under our control

**Impact:** None - these are build-time only dependencies
- They don't affect runtime performance
- They don't introduce security vulnerabilities (as of 2025-10-30)

**Should We Fix?**
Wait for upstream updates from `@ducanh2912/next-pwa` or Google Workbox team.

---

## Dependency Audit Schedule

### Monthly (1st of month)
- [ ] Run `yarn audit` for security vulnerabilities
- [ ] Review and update outdated packages: `yarn outdated`
- [ ] Check for new PWA library updates

### Quarterly
- [ ] Major dependency updates (React, Next.js, Supabase)
- [ ] Review and prune unused dependencies: `npm run dead:deps`
- [ ] Evaluate new tooling/libraries

### Annual
- [ ] Consider package manager migration (Yarn 3/4, pnpm)
- [ ] Evaluate PWA library alternatives
- [ ] Full dependency security audit with third-party tools

---

## Troubleshooting

### "package-lock.json found" Warning
**Cause:** Someone used npm instead of yarn

**Fix:**
```bash
rm package-lock.json
yarn install
```

### Dependency Version Conflicts
**Cause:** Package manager cache inconsistency

**Fix:**
```bash
rm -rf node_modules yarn.lock
yarn install
```

### PWA Not Working in Production
**Checklist:**
1. Verify build succeeded: `yarn build`
2. Check service worker generated: `ls -la public/sw.js`
3. Verify workbox files: `ls -la public/workbox-*.js`
4. Check browser DevTools > Application > Service Workers
5. Ensure HTTPS (PWA requires secure context)

---

## Resources

- [Yarn Classic Docs](https://classic.yarnpkg.com/en/docs)
- [@ducanh2912/next-pwa Documentation](https://github.com/DuCanhGH/next-pwa)
- [Next.js PWA Configuration](https://nextjs.org/docs/pages/building-your-application/configuring/progressive-web-app)
- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview)

---

## Decision Log

### 2025-10-30: Migrated to @ducanh2912/next-pwa
**Reason:** Original `next-pwa@5.6.0` unmaintained since 2021, lacking Next.js 14+ support

**Benefits:**
- Modern Next.js App Router compatibility
- Cleaner peer dependency warnings
- Active maintenance and security updates
- Better webpack 5 support

**Risks Mitigated:**
- Thorough testing of PWA functionality post-migration
- E2E tests verified service worker registration
- Build process confirmed PWA artifacts generated

---

### 2025-10-30: Standardized on Yarn Classic
**Reason:** Eliminate mixed package manager conflicts (npm + yarn)

**Benefits:**
- Consistent dependency resolution across team
- Single source of truth (yarn.lock)
- Better CI/CD reliability

**Enforcement:**
- Added .npmrc with engine-strict
- Added engines field to package.json
- Documented team guidelines
