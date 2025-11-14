# Performance Testing Guide - Quiver

This guide covers how to run performance tests against different environments.

## Quick Start

### Test dev.quiversurf.app (Production Dev Environment)

```bash
# Run performance tests against dev environment
node scripts/perf-test-dev.mjs

# Or with custom URL
TEST_URL=https://staging.quiversurf.app node scripts/perf-test-dev.mjs
```

This will:
- ✅ Test multiple pages (home, discover, map, beach detail)
- ✅ Generate Lighthouse reports for each page
- ✅ Calculate average scores across all pages
- ✅ Create HTML reports you can open in a browser
- ✅ Check Core Web Vitals (LCP, FCP, CLS, TBT)

**Output files** (in `scripts/` directory):
- `dev-performance-results.json` - Summary JSON
- `dev-home.report.html` - Home page report
- `dev-discover.report.html` - Discover page report
- `dev-map.report.html` - Map page report
- `dev-beaches-usa-california-san-diego.report.html` - Beach detail report

### Test Local Development Server

```bash
# Start your dev server first
npm run dev

# In another terminal, run performance tests
npm run perf:test

# Or manually
node scripts/performance-test.mjs
```

## Available Performance Scripts

### 1. `perf:test` - Local Performance Test
Tests your local development server (localhost:3000)

```bash
npm run perf:test
```

**Features:**
- Runs Lighthouse audit on localhost:3000
- Generates performance recommendations
- Saves results to `scripts/performance-results.json`
- Creates HTML report `scripts/lighthouseRun.report.html`

### 2. `perf:audit` - Build + Audit
Builds production version and runs Lighthouse

```bash
npm run perf:audit
```

**Use when:** You want to test production build performance locally

### 3. `perf:monitor` - Full Production Simulation
Builds, starts production server, runs audit, then cleanup

```bash
npm run perf:monitor
```

**Use when:** You want to simulate exact production performance

### 4. `lighthouse` - Raw Lighthouse Command
Runs Lighthouse directly

```bash
npm run lighthouse
```

### 5. `lighthouse:ci` - CI/CD Pipeline Test
Runs Lighthouse CI with assertions (configured in `.lighthouserc.json`)

```bash
npm run lighthouse:ci
```

**Use when:** Running in CI/CD pipeline (GitHub Actions, etc.)

## Performance Thresholds

Current thresholds enforced:

| Metric | Target | Description |
|--------|--------|-------------|
| **Performance Score** | ≥ 80 | Overall Lighthouse performance score |
| **Accessibility** | ≥ 90 | Accessibility compliance |
| **Best Practices** | ≥ 90 | Web best practices |
| **SEO** | ≥ 90 | Search engine optimization |
| **LCP** | ≤ 2.5s | Largest Contentful Paint |
| **FCP** | ≤ 1.5s | First Contentful Paint |
| **CLS** | ≤ 0.1 | Cumulative Layout Shift |
| **TBT** | ≤ 300ms | Total Blocking Time |

## Core Web Vitals Explained

### LCP (Largest Contentful Paint)
**What it measures:** Time until largest content element is rendered
**Why it matters:** User perceived loading performance
**Target:** < 2.5s

**How to improve:**
- Optimize images (use Next.js Image component)
- Preload critical resources
- Implement proper caching
- Use a CDN

### FCP (First Contentful Paint)
**What it measures:** Time until first content appears
**Why it matters:** Initial loading feedback to user
**Target:** < 1.5s

**How to improve:**
- Reduce render-blocking resources
- Optimize font loading
- Minimize CSS
- Enable compression

### CLS (Cumulative Layout Shift)
**What it measures:** Visual stability during page load
**Why it matters:** Prevents frustrating content jumps
**Target:** < 0.1

**How to improve:**
- Add explicit width/height to images
- Reserve space for dynamic content
- Avoid inserting content above existing content
- Use CSS aspect-ratio

### TBT (Total Blocking Time)
**What it measures:** Time main thread is blocked
**Why it matters:** Page responsiveness
**Target:** < 300ms

**How to improve:**
- Code splitting
- Lazy loading
- Optimize JavaScript execution
- Remove unused code

## Interpreting Results

### Score Ranges

| Score | Emoji | Status | Action Required |
|-------|-------|--------|-----------------|
| 90-100 | ✅ | Excellent | Maintain current performance |
| 75-89 | ⚠️ | Good | Minor optimizations recommended |
| 0-74 | ❌ | Needs Work | Performance improvements required |

### Example Output

```
========================================================================
📊 Performance Summary - dev.quiversurf.app
========================================================================

──────────────────────────────────────────────────────────────────────
Page                 Perf     A11y     Best     SEO
──────────────────────────────────────────────────────────────────────
home                 ✅ 92    ✅ 95    ✅ 91    ✅ 100
discover             ✅ 88    ✅ 94    ✅ 90    ✅ 98
map                  ⚠️ 78    ✅ 93    ✅ 89    ✅ 97
beaches              ✅ 85    ✅ 96    ✅ 92    ✅ 100
──────────────────────────────────────────────────────────────────────
AVERAGE              86       95       91       99
```

## Testing in CI/CD

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *' # Daily at midnight

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests on dev
        run: node scripts/perf-test-dev.mjs

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-reports
          path: scripts/dev-*.report.html
```

## Performance Monitoring Best Practices

### 1. Regular Testing
- **Daily:** Run automated tests on dev environment
- **Per PR:** Test critical pages before merge
- **Weekly:** Full audit of all pages
- **Monthly:** Compare trends over time

### 2. Page Priorities
Test pages in order of importance:
1. **Home page** - First impression
2. **Beach detail** - Core feature
3. **Map** - Interactive experience
4. **Discover** - Content discovery
5. **Session logging** - User engagement

### 3. Test Conditions
- **Network:** Test on both fast and slow connections
- **Devices:** Desktop and mobile (use `--form-factor=mobile`)
- **Time of day:** Test during peak and off-peak hours
- **Cache:** Test both cold and warm cache scenarios

### 4. Performance Budget
Set and enforce performance budgets:

```json
{
  "budgets": {
    "javascript": "< 300KB",
    "css": "< 50KB",
    "images": "< 500KB",
    "fonts": "< 100KB",
    "totalSize": "< 1MB"
  }
}
```

## Troubleshooting

### "Site not accessible"
**Problem:** Script can't reach dev.quiversurf.app
**Solution:** Check if site is deployed and DNS is resolving

### "Lighthouse command not found"
**Problem:** Lighthouse CLI not installed
**Solution:** `npm install -g lighthouse`

### "Chrome not found"
**Problem:** Headless Chrome not available
**Solution:** Install Google Chrome or Chromium

### Tests timing out
**Problem:** Slow network or heavy page
**Solution:** Increase timeout in Lighthouse config

### Inconsistent scores
**Problem:** Scores vary between runs
**Solution:**
- Run multiple times (script does 3 runs by default)
- Use `--throttling-method=simulate` for consistent network simulation
- Test at consistent times of day

## Advanced Usage

### Custom URL Testing

```bash
# Test any URL
TEST_URL=https://production.quiversurf.app node scripts/perf-test-dev.mjs
```

### Mobile Testing

Modify the script's `lighthouseCmd`:
```javascript
"--form-factor=mobile",
"--preset=mobile",
```

### Custom Thresholds

Edit `CONFIG.thresholds` in the script:
```javascript
thresholds: {
  performance: 85,  // Stricter
  lcp: 2000,        // Faster
  // ...
}
```

### Additional Pages

Add to `CONFIG.urls` array:
```javascript
urls: [
  "",
  "/discover",
  "/map",
  "/beaches/usa/california/san-diego",
  "/session-log",  // Add more pages
  "/profile",
],
```

## Performance Optimization Workflow

1. **Baseline** - Run tests on current version
2. **Identify** - Find bottlenecks from Lighthouse reports
3. **Fix** - Implement optimizations
4. **Test** - Verify improvements
5. **Monitor** - Track over time

## Resources

- [Web.dev Performance Guide](https://web.dev/performance/)
- [Lighthouse Scoring Guide](https://web.dev/performance-scoring/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)

---

**Questions or issues?** Check the Lighthouse reports in the `scripts/` directory for detailed recommendations.
