# 24-Hour Performance Monitoring Guide

**Deployment**: October 14, 2025  
**Commit**: 15a3bec  
**Status**: Live in production

---

## 🎯 What to Monitor

### Hour 1: Critical Validation

**Check Immediately After Deployment:**

1. **Application Health**

   ```
   Visit: https://quiversurf.app
   ✓ App loads correctly
   ✓ No console errors
   ✓ Intel tab works
   ✓ Beach pages load
   ✓ Comments/likes/follows functional
   ```

2. **Supabase Dashboard**

   ```
   Visit: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/reports/database

   Look for:
   ✓ Query volume dropping
   ✓ realtime.list_changes calls decreasing
   ✓ get_nearby_intel_posts execution time < 10ms
   ```

3. **Vercel Deployment**
   ```
   Check: https://vercel.com/[your-project]/deployments
   ✓ Build successful
   ✓ No deployment errors
   ✓ Functions deployed correctly
   ```

---

### Hours 2-6: Performance Validation

**Monitor these metrics every 2 hours:**

#### Supabase Metrics to Track:

1. **Top Queries by Total Time**

   - `realtime.list_changes` should drop from #1 spot
   - Should see dramatic reduction in time percentage

2. **Query Execution Times**

   - `get_nearby_intel_posts`: Should be <10ms (was 51ms avg)
   - Beach SELECT queries: Should be faster
   - Session invitation queries: Should use new indexes

3. **Connection Pool**
   - Check active connections (should be stable or lower)
   - No connection pool exhaustion warnings

#### Application Metrics:

1. **Page Load Times** (use browser DevTools)

   - Intel tab: <500ms
   - Beach detail: <300ms
   - Home forecast: <400ms

2. **Browser Console**
   - No Realtime subscription warnings
   - No duplicate channel messages
   - Clean subscription cleanup logs

---

### Hours 6-24: Trend Analysis

**Look for sustained improvements:**

1. **Database Performance Dashboard**

   - Total query volume trending down
   - No spike in slow queries
   - Cache hit rates improving

2. **User Reports**

   - Zero timeout reports
   - No complaints about slow loading
   - Positive feedback on responsiveness

3. **Error Rates**
   - Supabase error logs stable or improved
   - No new error patterns
   - Realtime subscriptions working reliably

---

## 📊 Quick Health Check Queries

### Run in Supabase SQL Editor:

**1. Verify indexes are being used:**

```sql
-- Check if GIST index is being used for intel posts
EXPLAIN ANALYZE
SELECT * FROM get_nearby_intel_posts(
  center_lat := 32.7157,
  center_lng := -117.1611,
  limit_count := 20,
  radius_miles := 25.0
);
-- Should show "Index Scan using idx_intel_posts_location_active"
```

**2. Check recent query performance:**

```sql
-- Top queries by total time (last hour)
SELECT
  query,
  calls,
  total_time,
  mean_time,
  (total_time / SUM(total_time) OVER () * 100)::numeric(5,2) as pct_total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_time DESC
LIMIT 10;
```

**3. Monitor Realtime subscription activity:**

```sql
-- Check active subscriptions
SELECT * FROM realtime.subscription
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚨 Red Flags to Watch For

### Immediate Action Required If:

❌ **Error rate spike** → Check Supabase logs, may need to rollback  
❌ **Realtime subscriptions not working** → Check browser console errors  
❌ **New timeout reports** → Monitor query performance dashboard  
❌ **Database connection issues** → Check connection pool stats

### Warning Signs (Investigate):

⚠️ **Query times not improving** → Run ANALYZE on tables  
⚠️ **Cache not populating** → Check browser console for cache logs  
⚠️ **Duplicate subscriptions** → Use realtime-monitor utility

---

## 🛠 Debugging Tools

### In Browser Console:

```javascript
// Check active Realtime subscriptions
import {
  logActiveSubscriptions,
  monitorRealtimeHealth,
} from "@/lib/utils/realtime-monitor";
logActiveSubscriptions(supabase);

// Check for duplicates
const health = monitorRealtimeHealth(supabase);
console.log("Health:", health);

// Check cache stats
import { getBeachCacheStats } from "@/lib/utils/beach-cache";
console.log("Cache:", getBeachCacheStats());
```

### In Supabase Dashboard:

1. **Database → Performance**

   - Query performance over time
   - Top queries by time
   - Slow query log

2. **Database → Query Performance**

   - Individual query execution plans
   - Index usage statistics

3. **Logs**
   - Real-time error logs
   - API request logs
   - Database logs

---

## ✅ Success Indicators (After 24h)

You'll know the optimization was successful when you see:

1. ✅ **Realtime polling calls down 90%+**
2. ✅ **No user timeout complaints**
3. ✅ **Intel queries consistently <10ms**
4. ✅ **Beach pages loading smoothly**
5. ✅ **No subscription-related console errors**
6. ✅ **Database time for Realtime < 10%** (was 87.6%)

---

## 📞 If Issues Occur

**Immediate Support:**

- Check `DEPLOYMENT_CHECKLIST.md` for rollback instructions
- Review `docs/database-performance-optimization-summary.md` for technical details
- Use monitoring utilities in `lib/utils/realtime-monitor.ts`

**Rollback if Needed:**

```bash
git revert 15a3bec
git push
```

Then remove indexes if they're causing issues (see DEPLOYMENT_CHECKLIST.md)

---

## 📈 24-Hour Report Template

After 24 hours, document:

**Performance Metrics:**

- Realtime call reduction: \_\_\_\_%
- Query time improvements: \_\_\_\_%
- User timeout reports: **\_**
- Error rate change: \_\_\_\_%

**User Impact:**

- Page load improvements: Yes / No / Partial
- Issues reported: **\_**
- Positive feedback: **\_**

**Next Steps:**

- Continue monitoring
- Fine-tune if needed
- Consider additional optimizations

---

**Last Updated**: October 14, 2025  
**Next Review**: October 15, 2025 (24 hours post-deployment)



