# N+1 Query Fix - Validation Checklist

## Pre-Deployment Validation

Use this checklist to verify the N+1 query fix is working correctly before deploying to production.

---

## 1. Code Quality Checks

### TypeScript Validation

```bash
yarn typecheck
```

- [ ] No TypeScript errors
- [ ] No new warnings introduced

### Build Validation

```bash
yarn build
```

- [ ] Build completes successfully
- [ ] No build errors or warnings
- [ ] Output size is reasonable

### Linting

```bash
yarn lint
```

- [ ] No ESLint errors
- [ ] No new ESLint warnings
- [ ] Code follows project style guide

---

## 2. Functional Testing

### API Contract Validation

Test the API endpoint maintains the same contract:

```bash
# Start dev server
yarn dev

# Test with curl
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611" | jq '.'
```

**Expected Response Structure:**

```json
{
  "data": {
    "recommendations": [
      {
        "spotId": "...",
        "name": "...",
        "distance_km": 0.5,
        "score": 85,
        "reasons": ["Good swell direction", "Light wind"],
        "wave": {
          "ht_ft": 4.5,
          "period_s": 12
        },
        "wind": {
          "dir_deg": 270,
          "kts": 8
        },
        "tide": {
          "height_ft": 3.2,
          "status": null
        },
        "best_time_window": null
      }
    ],
    "top_picks": [...],
    "metadata": {
      "query_time": "...",
      "location": { "lat": 32.7157, "lon": -117.1611 },
      "total_spots_analyzed": 25,
      "user_skill": null
    }
  }
}
```

#### Validation Steps:

- [ ] `recommendations` array is present
- [ ] `top_picks` array is present (max 3 items)
- [ ] `metadata` object is present
- [ ] Each recommendation has all required fields
- [ ] `spotId` is present and valid
- [ ] `name` is present and valid
- [ ] `score` is a number between 0-100
- [ ] `reasons` is an array of strings
- [ ] `wave` object has `ht_ft` and `period_s`
- [ ] `wind` object has `dir_deg` and `kts`
- [ ] `tide` object has `height_ft` and `status`

### Query Parameters

Test all supported query parameters:

```bash
# Test with time parameter
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611&time=2025-11-14T12:00:00Z"

# Test with skill parameter
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611&skill=intermediate"

# Test with all parameters
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611&time=2025-11-14T12:00:00Z&skill=advanced"
```

- [ ] `lat` parameter works
- [ ] `lon` parameter works
- [ ] `time` parameter works (optional)
- [ ] `skill` parameter works (optional)

### Edge Cases

```bash
# Test with no beaches nearby (middle of ocean)
curl "http://localhost:3000/api/v1/recommendations?lat=0&lon=0"

# Test with invalid coordinates
curl "http://localhost:3000/api/v1/recommendations?lat=invalid&lon=invalid"

# Test with missing coordinates
curl "http://localhost:3000/api/v1/recommendations"
```

- [ ] Empty location returns `{ recommendations: [] }`
- [ ] Invalid coordinates return `{ recommendations: [] }`
- [ ] Missing coordinates return `{ recommendations: [] }`
- [ ] No errors thrown for edge cases

---

## 3. Performance Validation

### Check Performance Logs

Start the dev server and make a request:

```bash
yarn dev
# In another terminal:
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611"
```

**Look for log output in the dev server console:**

```
[PERF] Fetched forecasts for 25 beaches in 127ms (was 50 queries, now 2)
```

- [ ] Performance log is present
- [ ] Query time is <500ms
- [ ] Log shows "now 2" queries
- [ ] Beach count matches expected value

### Performance Test Script

Run the automated performance test:

```bash
npx tsx scripts/test-recommendations-perf.ts
```

**Expected Output:**

```
🏄 Recommendations API Performance Test

Testing N+1 query fix...

📍 Testing: San Diego (25 beaches)
   Coordinates: 32.7157, -117.1611
   ✅ Response time: 127ms
   📊 Beaches analyzed: 25
   ⭐ Top picks: 3
   🎉 EXCELLENT - Well under 500ms target!
   ✅ Response structure valid
```

- [ ] Response time <500ms for all test cases
- [ ] All beaches are analyzed
- [ ] Top picks are generated (max 3)
- [ ] Response structure is valid

### Database Query Monitoring

If you have access to Supabase dashboard:

1. **Navigate to:** Project → Database → Query Performance
2. **Make a request** to the recommendations endpoint
3. **Verify:**
   - [ ] Only 2 queries appear (1 marine + 1 tide)
   - [ ] No individual `.eq("beach_id", ...)` queries
   - [ ] Both queries use `.in("beach_id", [...])`
   - [ ] Query execution time <100ms each

---

## 4. Integration Testing

### Home Screen Integration

> ⚠️ **FEATURE REMOVED (Nov 2025)** - This section describes testing for the removed "Best Conditions" feature.

~~The recommendations API is used by the home screen "Best Conditions" cards.~~

```bash
yarn dev
# Open browser to http://localhost:3000
```

**Manual Test Steps (OBSOLETE):**

1. **Load home page** (must be logged in)
2. ~~**Grant location permission** when prompted~~
3. ~~**Wait for cards to load**~~

**Verify (OBSOLETE):**

- [ ] ~~"Best Conditions Near You" section appears~~
- [ ] ~~Cards load within 2-3 seconds~~
- [ ] ~~At least 1 beach card is displayed (up to 3)~~
- [ ] ~~Cards show beach name, score, wave/wind/tide data~~
- [ ] ~~No console errors~~
- [ ] ~~No visual regressions~~

### Recommendation Data Accuracy

Compare a specific beach's data:

1. **Note marine forecast data** from recommendations response
2. **Check beach detail page** for the same beach
3. **Verify:**
   - [ ] Wave height matches
   - [ ] Wave period matches
   - [ ] Wind speed matches
   - [ ] Wind direction matches
   - [ ] Tide height matches

---

## 5. Regression Testing

### Existing E2E Tests

Once the dev server is running with authentication, run the relevant E2E test suites to verify functionality:

```bash
# Run E2E tests
yarn test:e2e
```

- [ ] All tests pass
- [ ] No new failures introduced
- [ ] Response times are faster

### Unit Tests

If unit tests exist for recommendations:

```bash
yarn test:unit
```

- [ ] All tests pass
- [ ] No new failures
- [ ] Test coverage maintained

---

## 6. Error Handling

### Database Errors

Simulate database errors by temporarily breaking the connection:

**Verify:**

- [ ] API returns proper error response
- [ ] Error is logged correctly
- [ ] No unhandled exceptions
- [ ] User sees graceful error message

### Timeout Scenarios

Test with very large beach counts (if possible):

```bash
# Request many beaches (if your database has them)
curl "http://localhost:3000/api/v1/recommendations?lat=34.0522&lon=-118.2437"
```

- [ ] Request completes successfully
- [ ] No timeout errors
- [ ] Response time still <500ms
- [ ] Query count still only 2

---

## 7. Documentation Review

### Code Documentation

Review the modified file:

- [ ] Code is well-commented
- [ ] Complex logic is explained
- [ ] Performance optimization is noted
- [ ] Variable names are descriptive

### External Documentation

Review documentation files:

- [ ] `docs/performance/N+1_QUERY_FIX.md` is accurate
- [ ] `docs/archive/performance/N+1_QUERY_FIX_SUMMARY.md` is accurate
- [ ] `docs/performance/QUERY_COMPARISON.md` is accurate
- [ ] All code examples are correct
- [ ] All metrics are accurate

---

## 8. Monitoring Setup

### Production Monitoring

Before deploying to production, ensure:

- [ ] Performance logging is enabled
- [ ] Log aggregation is configured (e.g., Sentry, Datadog)
- [ ] Alerts are set up for:
  - Response time >1000ms
  - Query count >10
  - Error rate >1%

### Dashboard Metrics

Configure dashboard to track:

- [ ] P50 response time
- [ ] P95 response time
- [ ] P99 response time
- [ ] Error rate
- [ ] Query count per request
- [ ] Database query time

---

## 9. Deployment Checklist

### Pre-Deployment

- [ ] All above checks passed
- [ ] Code reviewed by team
- [ ] Documentation updated
- [ ] Change log updated
- [ ] Stakeholders notified

### Staging Deployment

- [ ] Deploy to staging environment
- [ ] Run all validation tests on staging
- [ ] Monitor staging for 24 hours
- [ ] Verify performance improvements
- [ ] Check for any unexpected issues

### Production Deployment

- [ ] Deploy during low-traffic period
- [ ] Monitor error rates closely
- [ ] Monitor response times
- [ ] Monitor database query patterns
- [ ] Have rollback plan ready
- [ ] Notify team of deployment

### Post-Deployment

- [ ] Verify performance improvements in production
- [ ] Check error rates (should be <0.1%)
- [ ] Review performance logs
- [ ] Monitor for 48 hours
- [ ] Document any issues found
- [ ] Celebrate success! 🎉

---

## 10. Success Metrics

### Target Metrics

After deployment, verify these metrics in production:

| Metric               | Before | Target | Measured |
| -------------------- | ------ | ------ | -------- |
| Response Time (P95)  | 5-10s  | <500ms | **\_\_** |
| Database Queries     | 50     | 2      | **\_\_** |
| Error Rate           | N/A    | <0.1%  | **\_\_** |
| Query Execution Time | ~300ms | <100ms | **\_\_** |
| User Satisfaction    | Low    | High   | **\_\_** |

### KPIs to Track

- [ ] Page load time improved
- [ ] Bounce rate decreased
- [ ] User engagement increased
- [ ] Database costs decreased
- [ ] Server response time improved

---

## Quick Validation Command

Run this single command to do a quick validation:

```bash
# All-in-one validation
yarn typecheck && \
yarn build && \
echo "✅ Build successful!" && \
npx tsx scripts/test-recommendations-perf.ts
```

---

## Sign-off

Once all checks are complete:

- **Developer:** ****\*\*****\_\_****\*\***** Date: **\_\_**
- **Reviewer:** ****\*\*****\_\_****\*\***** Date: **\_\_**
- **QA:** ****\*\*****\_\_****\*\***** Date: **\_\_**
- **Deployment Lead:** ****\*\*****\_\_****\*\***** Date: **\_\_**

---

## Notes

Add any additional notes or observations:

```
[Your notes here]
```
