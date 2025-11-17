# Performance Validation Quick Start Guide

**Quick reference for running performance validation tests**

---

## Prerequisites

1. Start development server:
   ```bash
   yarn dev
   ```

2. Verify server is running:
   ```bash
   curl http://localhost:3000/
   ```

---

## Run All Tests (Recommended)

```bash
# Run complete validation suite
./scripts/run-all-performance-validation.sh
```

This will run:
- API performance tests
- React performance tests
- E2E performance tests
- Generate summary report

**Time**: ~10-15 minutes  
**Requirements**: Dev server running

---

## Individual Test Scripts

### Phase 3: API Performance

```bash
# Comprehensive API validation
npx tsx scripts/validate-performance-improvements.ts

# Legacy test (simpler)
npx tsx scripts/test-recommendations-perf.ts
```

**Tests**:
- Response time (target: <1s)
- Scalability (50 beaches)
- Error handling

**Expected output**:
```
✅ Average response time: 450ms (target: <1000ms)
✅ P95 response time: 520ms (target: <1500ms)
✅ Scalability test: 650ms for 50 beaches
```

### Phase 4: React Performance

```bash
# React rendering validation (requires Playwright)
npx tsx scripts/validate-react-performance.ts
```

**Tests**:
- Home page TTI (target: <3.5s)
- Map page load (target: <5s)
- Component re-renders

**Expected output**:
```
✅ Home Page - Time to Interactive: 2.8s (target: <3.5s)
✅ Map Page - Load Time: 3.2s (target: <5s)
```

### E2E Performance Tests

```bash
# API performance E2E
yarn test:e2e e2e/recommendations-performance.spec.ts

# React rendering E2E
yarn test:e2e e2e/react-rendering-performance.spec.ts

# Page-specific tests
yarn test:e2e e2e/performance/home-page-performance.spec.ts
yarn test:e2e e2e/performance/map-page-performance.spec.ts
yarn test:e2e e2e/performance/beach-detail-performance.spec.ts
```

### Lighthouse Audit

```bash
# Install Lighthouse (if needed)
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3000 --only-categories=performance --view
lighthouse http://localhost:3000/map --only-categories=performance --view
lighthouse http://localhost:3000/beach/blacks-beach --only-categories=performance --view
```

**Target**: Score >90

---

## Quick Smoke Test

**Time**: ~2 minutes

```bash
# 1. Check API performance
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611"
# Look for response time in browser devtools

# 2. Check console logs
# Should see: [PERF] Fetched forecasts for X beaches in ~100-200ms

# 3. Visual test
# Open http://localhost:3000 - should load fast (<3s)
```

---

## Interpreting Results

### Success Criteria

| Test | Target | Status |
|------|--------|--------|
| API Response (Avg) | <1000ms | ✅ / ❌ |
| API Response (P95) | <1500ms | ✅ / ❌ |
| Home Page TTI | <3500ms | ✅ / ❌ |
| Map Page Load | <5000ms | ✅ / ❌ |
| Lighthouse Score | >90 | ✅ / ❌ |

### Common Issues

**API Test Fails**:
- Check Supabase connection
- Verify database has forecast data
- Check rate limiting (wait between requests)

**React Test Fails**:
- Clear browser cache
- Check for console errors
- Verify Playwright installed: `yarn install`

**E2E Test Fails**:
- Ensure dev server running
- Check test authentication
- Review test logs: `--debug` flag

---

## Reports Generated

After running tests, reports are saved to:

```
docs/performance/
  ├── PERFORMANCE_VALIDATION_REPORT.md (baseline)
  ├── BEFORE_AFTER_BENCHMARKS.md (comparisons)
  ├── validation-results-YYYYMMDD-HHMMSS.txt (test run)
  ├── REACT_PERFORMANCE_VALIDATION.md (react tests)
  └── screenshots/ (E2E test traces)
```

---

## Troubleshooting

### Dev server not running
```bash
# Terminal 1
yarn dev

# Terminal 2 (run tests)
npx tsx scripts/validate-performance-improvements.ts
```

### Rate limited
```
Error: 429 Too Many Requests
```

**Solution**: Wait 60 seconds between test runs

### Playwright errors
```bash
# Install/update Playwright
yarn playwright install

# Run with debug
yarn test:e2e --debug e2e/recommendations-performance.spec.ts
```

### Slow performance
- Check network connection
- Verify database has data
- Review Supabase dashboard for slow queries
- Check browser devtools for bottlenecks

---

## Next Steps After Validation

1. ✅ Review generated reports
2. ✅ Document actual vs. expected results
3. ✅ Update `PERFORMANCE_VALIDATION_REPORT.md` with actuals
4. ✅ Deploy to staging if tests pass
5. ✅ Monitor production metrics

---

## Quick Reference Commands

```bash
# Start dev server
yarn dev

# Run all validations
./scripts/run-all-performance-validation.sh

# API tests only
npx tsx scripts/validate-performance-improvements.ts

# React tests only
npx tsx scripts/validate-react-performance.ts

# E2E tests
yarn test:e2e e2e/recommendations-performance.spec.ts
yarn test:e2e e2e/react-rendering-performance.spec.ts

# Lighthouse
lighthouse http://localhost:3000 --only-categories=performance --view
```

---

**Questions?** See `/docs/performance/PERFORMANCE_VALIDATION_REPORT.md` for full details.
