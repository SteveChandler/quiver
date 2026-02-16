# Supabase Connection Pooling Research for Next.js on Vercel
**Research Date:** February 14, 2026
**Context:** Quiver app scaling from ~7 users to 1,000+ users

## Executive Summary

This document provides comprehensive research on Supabase/PostgreSQL connection pool configuration and monitoring for a Next.js application deployed on Vercel. Key findings include:

- **Free tier supports 200 pooled connections** (60 direct), sufficient for current scale
- **Pro plan ($25/mo) increases to 200-400 pooled connections** depending on compute tier
- **Transaction mode (port 6543) is critical for serverless** environments like Vercel
- **Monitor connections via pg_stat_activity and Grafana dashboard**
- **Keep pooler usage under 40-80%** of max connections depending on API usage patterns
- **Vercel Fluid Compute solves connection leaks** with `attachDatabasePool` helper

---

## 1. Supabase Connection Pool Limits by Plan

### Complete Connection Limits Table

Source: [Supabase Compute and Disk Documentation](https://supabase.com/docs/guides/platform/compute-and-disk)

| Compute Instance | Database Max Connections | Connection Pooler Max Clients | Monthly Cost |
|------------------|-------------------------|------------------------------|--------------|
| **Nano (Free)** | 60 | **200** | $0 |
| **Micro** | 60 | **200** | Pro plan $25 base |
| **Small** | 90 | **400** | Pro + compute upgrade |
| **Medium** | 120 | **600** | Pro + compute upgrade |
| **Large** | 160 | **800** | Pro + compute upgrade |
| **XL** | 240 | 1,000 | Pro + compute upgrade |
| **2XL** | 380 | 1,500 | Pro + compute upgrade |
| **4XL** | 480 | 3,000 | Enterprise |
| **8XL** | 490 | 6,000 | Enterprise |
| **12XL** | 500 | 9,000 | Enterprise |
| **16XL** | 500 | 12,000 | Enterprise |

### Key Distinctions

**Direct Connections vs. Pooler Connections:**
- **Direct Connections:** No pooler overhead, but require IPv6 unless you purchase the IPv4 add-on. Limited to 60-500 depending on tier.
- **Pooler Connections:** Use Supavisor (connection pooler) to multiplex many client connections onto fewer database connections. Supports 200-12,000 clients depending on tier.

**Connection Modes:**
- **Port 5432:** Session mode (one client = one database connection until client disconnects)
- **Port 6543:** Transaction mode (multiple clients share database connections between transactions)

### Pricing Context

Source: [Supabase Pricing 2026](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)

- **Free Tier:** 2 projects, Nano compute (60 direct / 200 pooled connections)
- **Pro Plan:** $25/month base, includes Micro compute (60 direct / 200 pooled), upgradable to larger compute tiers
- **Pro includes:** $10 compute credit, spend caps enabled by default for predictable billing
- **Compute Upgrades:** Charged hourly based on instance size selection

**Important:** Connection limits are **hard-coded** per compute tier and cannot be changed without upgrading the compute instance size. Source: [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)

---

## 2. Best Practices for Next.js + Supabase Pooling

### Connection Mode Selection for Serverless

**CRITICAL: Use Transaction Mode (Port 6543) for Vercel Serverless Functions**

Source: [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management)

Transaction mode is **essential** for serverless environments because:
- Serverless functions create many short-lived connections
- Transaction mode allows multiple clients to share database connections
- Prevents connection exhaustion during traffic spikes
- Handles 3-10x more concurrent clients than direct connections

**Configuration:**
```typescript
// Use transaction mode pooler connection string
const SUPABASE_DATABASE_URL = 'postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres'
```

**Port Reference:**
- **Port 6543:** Transaction mode (recommended for serverless)
- **Port 5432:** Session mode (use for long-lived connections, background jobs)

**Important Update (February 2025):** Supavisor deprecated session mode on port 6543. As of February 28, 2025, port 6543 **only supports transaction mode**. Port 5432 continues to support session mode. Source: [Supavisor Port 6543 Deprecation](https://github.com/orgs/supabase/discussions/32755)

### Next.js Client Instantiation Patterns

Source: [Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

**Server Components:**
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - cookies can't be set
          }
        },
      },
    }
  )
}
```

**IMPORTANT:** On the server, creating a Supabase client configures a `fetch` call. You must reconfigure for every request to access fresh cookies. **Do NOT use singleton pattern for server clients.** Source: [Server Client Singleton Discussion](https://github.com/orgs/supabase/discussions/26936)

**Client Components:**
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Client-side automatically uses singleton pattern** - only one instance is created regardless of how many times you call `createClient()`.

### Connection Pool Configuration

**Pool Size Guidelines:**

Source: [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management)

1. **Heavy PostgREST API Usage:** Keep pool size under **40% of max database connections**
2. **Standard Usage:** Can allocate up to **80% of max database connections** to pool
3. **Reserve Capacity:** Always preserve connections for Auth server and other Supabase utilities

**Example for Nano/Micro (60 max direct connections):**
- Heavy API usage: Pool size ≤ 24 connections (40%)
- Standard usage: Pool size ≤ 48 connections (80%)

**Rationale:** Quiver uses PostgREST heavily through `supabase.from()` queries, so **40% guideline applies**. This means:
- **Free tier (60 direct):** Pool size ≤ 24 direct connections
- **Small tier (90 direct):** Pool size ≤ 36 direct connections

**However,** when using **transaction mode pooler (port 6543)**, you access the "Connection Pooler Max Clients" limit (200 for Nano, 400 for Small), not the direct connection limit. This provides much more headroom.

### Vercel Fluid Compute Integration

Source: [Vercel: The Real Serverless Compute to Database Connection Problem, Solved](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)

**The Connection Leak Problem:**

Traditional serverless platforms suspend functions when idle. During suspension:
- Idle timeout timers don't fire
- Database connections remain open
- Connection pool slots are "leaked"
- Pool exhaustion occurs even with proper timeout configuration

**Vercel Fluid Compute Solution:**

Vercel's `waitUntil` API keeps functions alive just long enough to close idle connections:

```typescript
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 5000, // Close idle connections after 5 seconds
})

attachDatabasePool(pool)

export async function GET(request: Request) {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT NOW()')
    return Response.json(result.rows)
  } finally {
    client.release()
  }
}
```

**Key Points:**
- Set `idleTimeoutMillis` to 5-10 seconds for serverless
- Always call `client.release()` in a `finally` block
- `attachDatabasePool` handles cleanup during function suspension

**For Supabase with `@supabase/supabase-js`:** The official Supabase JavaScript client uses `fetch`, not direct PostgreSQL connections, so it **doesn't require** `attachDatabasePool`. Connection pooling is handled server-side by Supavisor when using port 6543.

---

## 3. Monitoring Approaches

### Dashboard Metrics (Teams/Enterprise Plans)

Source: [How to Monitor Postgres and Supavisor Connections](https://supabase.com/docs/guides/troubleshooting/monitor-supavisor-postgres-connections)

**Database Client Connections Chart** displays historical data by type:
- **Postgres:** Direct connections from applications
- **PostgREST:** Connections from PostgREST API layer
- **Reserved:** Administrative connections for Supabase services
- **Auth, Storage, Custom Roles:** Service-specific connections

**Chart Types:**
- Hourly/daily aggregated data in standard Observability Dashboard
- Real-time data in Grafana Dashboard (recommended for active monitoring)

### Grafana Dashboard (Recommended)

Source: [Supabase Metrics API Documentation](https://supabase.com/docs/guides/telemetry/metrics)

**Setup:**
1. Access project metrics endpoint: `https://<project-ref>.supabase.co/customer/v1/metrics`
2. Authenticate with HTTP Basic Auth:
   - Username: `service_role`
   - Password: Service role JWT from Dashboard
3. Visualizes 200+ database metrics including:
   - Active connections by type (Supavisor pooler vs direct)
   - CPU and memory usage
   - Query performance
   - EBS disk I/O

**Connection Visualization:**
- **Yellow line:** Connections to Supavisor Pooler (querying + idle)
- **Green line:** Direct database connections (querying + idle)

**Advantages over standard Dashboard:**
- Real-time updates (not hourly/daily aggregation)
- Correlation with CPU, memory, query performance
- Exportable for external monitoring systems

### pg_stat_activity Queries

Source: [How to Monitor Postgres and Supavisor Connections](https://supabase.com/docs/guides/troubleshooting/monitor-supavisor-postgres-connections)

**Live Connection Inspection:**
```sql
SELECT
  pg_stat_activity.pid,
  ssl AS ssl_connection,
  datname AS database,
  usename AS connected_role,
  application_name,
  client_addr,
  query,
  query_start,
  state,
  backend_start
FROM pg_stat_ssl
JOIN pg_stat_activity ON pg_stat_ssl.pid = pg_stat_activity.pid;
```

**Key Columns:**
- `usename`: Identifies connection source via role mapping:
  - `supabase_admin`: Monitoring and Realtime services
  - `authenticator`: PostgREST API connections
  - `postgres`: Dashboard, Prisma, SQLAlchemy, direct tools
- `state`: `active` (running query) vs `idle` (holding connection)
- `query_start`: How long query has been running (identify long-running queries)
- `backend_start`: When connection was established (identify stuck connections)

**Identify Idle Connections Holding Slots:**
```sql
SELECT
  usename,
  application_name,
  state,
  COUNT(*) AS connection_count,
  MAX(NOW() - backend_start) AS oldest_connection_age
FROM pg_stat_activity
WHERE state = 'idle'
GROUP BY usename, application_name, state
ORDER BY connection_count DESC;
```

**Check Total Connections vs Limits:**
```sql
SELECT
  COUNT(*) AS current_connections,
  current_setting('max_connections')::int AS max_connections,
  ROUND(100.0 * COUNT(*) / current_setting('max_connections')::int, 2) AS utilization_percent
FROM pg_stat_activity;
```

### Connection Pool Settings in Dashboard

Navigate to: **Dashboard → Project Settings → Database → Connection Pooling Configuration**

**Adjustable Settings:**
- **Pool Size:** Number of backend connections the pooler maintains to Postgres
- **Pool Mode:** Transaction vs Session (transaction recommended for serverless)
- **Default Pool Size:** Typically 15-20 for transaction mode

Source: [How to Update Connection Pool Settings](https://supabase.com/docs/guides/troubleshooting/how-do-i-update-connection-pool-settings-in-my-dashboard-wAxTJ_)

---

## 4. Alerting Thresholds

### Recommended Utilization Thresholds

Source: [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management)

**Connection Pool Utilization:**

| Usage Pattern | Warning Threshold | Critical Threshold | Action Required |
|---------------|------------------|-------------------|-----------------|
| **Heavy PostgREST API usage** | >30% (12/40 rule) | >40% | Upgrade compute or optimize queries |
| **Standard usage** | >60% | >80% | Upgrade compute or optimize queries |

**Reasoning:**
- **40% rule for API-heavy apps:** Reserve 60% for Auth, Storage, Realtime, administrative tasks
- **80% rule for standard apps:** More connections available for application traffic
- Thresholds are **flexible** - monitor actual peak concurrent usage patterns

**Quiver-Specific Recommendation:**
Since Quiver uses PostgREST heavily (`supabase.from()` queries), apply the **40% rule**:
- **Free tier (200 pooled clients):** Warning at 60 clients (30%), critical at 80 clients (40%)
- **Small tier (400 pooled clients):** Warning at 120 clients (30%), critical at 160 clients (40%)

### Signs of Connection Exhaustion

Source: [Supabase Troubleshooting - Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)

**Client-Side Errors:**
- `"Max client connections reached"` - Pooler client limit hit
- `"Sorry, too many clients already"` - Direct connection limit hit
- `"FATAL: remaining connection slots are reserved"` - All connections consumed

**Database-Side Indicators:**
- High idle connection count in `pg_stat_activity`
- Long-running queries blocking connection release
- Connection churn (many connections opening/closing rapidly)

**Application Symptoms:**
- Slow API response times
- Timeout errors on database queries
- Intermittent 500 errors during traffic spikes
- Increased error rate in Sentry

### Monitoring Tools for Alerts

**External Monitoring (Recommended):**

1. **Sentry Performance Monitoring:**
   - Track API route response times
   - Alert on p95 latency > 500ms
   - Monitor database query duration

2. **Prometheus/Grafana Alerts:**
   - Set up alerts on Supabase Metrics API
   - Alert when `pg_stat_activity` connection count exceeds threshold
   - Monitor connection pool utilization percentage

3. **Vercel Analytics:**
   - Function duration tracking
   - Timeout frequency
   - Regional performance variations

**Alert Configuration Example:**
```yaml
# Prometheus alert rule example
- alert: HighDatabaseConnectionUsage
  expr: (count(pg_stat_activity) / max_connections) > 0.8
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Database connection usage above 80%"
    description: "Current connections: {{ $value }}%"

- alert: CriticalDatabaseConnectionUsage
  expr: (count(pg_stat_activity) / max_connections) > 0.9
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Database connection usage above 90%"
```

---

## 5. Connection Management Patterns for Serverless

### Vercel Edge Functions vs API Routes

**Edge Functions (Vercel Edge Runtime):**
- **Location:** Runs at CDN edge, closer to users
- **Max Duration:** 30 seconds (hard limit)
- **Connection Pattern:** Very short-lived, must use transaction mode
- **Use Case:** Real-time data fetching, lightweight API endpoints

**API Routes (Serverless Functions / Node.js Runtime):**
- **Location:** Runs in specific AWS regions
- **Max Duration:** 5 minutes (Pro plan), 10 seconds (Hobby)
- **Connection Pattern:** Short-lived, transaction mode recommended
- **Use Case:** Complex business logic, background jobs, webhooks

Source: [Vercel Function Limits](https://vercel.com/docs/functions/runtimes)

### Connection Timeout Configuration

**Recommended Settings for Serverless:**

```typescript
// For direct PostgreSQL connections (if using pg/Prisma)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum pool size
  idleTimeoutMillis: 5000, // Close idle connections after 5 seconds
  connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10 seconds
  statement_timeout: 30000, // Kill queries taking longer than 30 seconds
})
```

**For Supabase JavaScript Client:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-client-info': 'supabase-js-web' },
    },
    auth: {
      persistSession: false, // Critical for server-side - don't persist sessions
    },
  }
)
```

**Why `persistSession: false`?**
- Server-side clients should not persist auth sessions
- Each request gets fresh auth state from cookies
- Prevents memory leaks and stale session data

### Graceful Degradation Patterns

**Handle Connection Exhaustion Gracefully:**

```typescript
// lib/api-utils.ts
export async function withConnectionRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isConnectionError =
        error.message?.includes('Max client connections') ||
        error.message?.includes('too many clients')

      if (!isConnectionError || attempt === maxRetries - 1) {
        throw error
      }

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, delayMs * Math.pow(2, attempt))
      )
    }
  }
  throw new Error('Max retries exceeded')
}

// Usage in API route
export const GET = withAuth(async (request, { user, supabase }) => {
  const data = await withConnectionRetry(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .limit(10)

    if (error) throw error
    return data
  })

  return createSuccessResponse(data)
})
```

**Circuit Breaker Pattern:**

```typescript
// lib/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0
  private lastFailureTime: number | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold = 5, // Open after 5 failures
    private timeout = 60000, // Try again after 60 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker()

export async function fetchUserSessions(userId: string) {
  return dbCircuitBreaker.execute(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return data
  })
}
```

### Best Practices Summary

1. **Always use transaction mode (port 6543)** for serverless functions
2. **Never use singleton pattern** for server-side Supabase clients
3. **Set `persistSession: false`** for server-side auth
4. **Use `attachDatabasePool`** if using direct PostgreSQL connections (pg/Prisma)
5. **Set aggressive idle timeouts** (5-10 seconds) for connection pools
6. **Always release connections** in `finally` blocks
7. **Implement retry logic** with exponential backoff for transient errors
8. **Monitor connection usage** via Grafana and `pg_stat_activity`
9. **Set up alerts** at 60-80% connection utilization
10. **Test under load** before deploying to production

---

## 6. Supabase Pro Plan Specifics

### Pro Plan Features

Source: [Supabase Pricing](https://supabase.com/pricing)

**Base Pro Plan ($25/month):**
- **Compute:** Micro instance (60 direct / 200 pooled connections)
- **Database Storage:** 8 GB included
- **Database Egress:** 250 GB/month included
- **Compute Credits:** $10/month included (can upgrade compute tier)
- **Support:** Email support within 24 hours
- **Backups:** Daily automatic backups, 7-day retention
- **IPv4 Add-on:** Available for $4/month (enables direct connections without IPv6)

**Compute Add-ons (Paid Hourly):**
- **Small:** 90 direct / 400 pooled (~$0.01344/hour = ~$10/month)
- **Medium:** 120 direct / 600 pooled (~$0.02688/hour = ~$20/month)
- **Large:** 160 direct / 800 pooled (~$0.05376/hour = ~$40/month)
- **XL and above:** Enterprise-grade pricing

**Included Services:**
- PostgREST API (automatic REST API)
- Realtime subscriptions
- Storage (1 GB included, $0.021/GB additional)
- Edge Functions (2 million invocations/month included)
- Auth (unlimited MAUs on Pro plan)

### Connection Limit Interaction with Vercel Concurrency

**Vercel Function Concurrency:**
- **Hobby Plan:** 1 concurrent execution per function
- **Pro Plan:** 100 concurrent executions per function
- **Enterprise:** 1,000+ concurrent executions

**Connection Math for Quiver:**

**Current Scale (~7 users, Free tier):**
- **Vercel:** Likely Hobby or Pro plan (100 concurrent functions)
- **Supabase:** Free tier (200 pooled connections)
- **Headroom:** 200 connections / 100 functions = 2 connections per function
- **Status:** Comfortable headroom

**Target Scale (1,000 users, Pro tier):**

**Assumptions:**
- 10% of users active simultaneously = 100 active users
- Each user action triggers 1 API call
- Each API call holds 1 pooled connection for ~100ms

**Connection Requirements:**
- **Peak QPS:** ~10 queries/second (assuming typical usage)
- **Concurrent Connections:** 10 QPS × 0.1s hold time = 1 connection on average
- **Burst Capacity:** Need headroom for 10x spikes = 10 connections

**Recommendation:**
- **Start with Free tier** (200 pooled connections) - sufficient for 1,000 users
- **Upgrade to Pro + Small compute** (400 pooled connections) if:
  - Seeing connection warnings in logs
  - P95 latency > 500ms
  - Planning features with high query rates (leaderboards, real-time data)

**Connection Pooling Mode:**
- **Port 6543 (transaction mode):** Essential for Vercel serverless
- **Default Pool Size:** Start with 15-20, increase if seeing queuing

### When to Upgrade Compute Tier

**Upgrade from Nano/Micro to Small when:**
- Connection utilization consistently > 60% (120+ of 200 pooled connections)
- Seeing "Max client connections reached" errors
- P95 API latency > 500ms
- Query performance degrading (visible in Grafana)

**Upgrade from Small to Medium when:**
- Connection utilization > 60% (240+ of 400 pooled connections)
- CPU utilization > 70% sustained
- Database storage > 8 GB (triggers automatic upgrade)
- Complex queries timing out

**Cost Comparison:**
- **Free tier:** $0/month (200 connections)
- **Pro + Micro:** $25/month (200 connections)
- **Pro + Small:** ~$35/month (400 connections)
- **Pro + Medium:** ~$45/month (600 connections)

**Recommendation for Quiver:**
- Stay on **Free tier** until hitting 500+ DAU
- Upgrade to **Pro + Small** when seeing connection pressure
- Monitor with Grafana and set up alerts before hitting limits

---

## 7. Recommendations for Quiver

### Immediate Actions (Current Scale: ~7 Users)

1. **Verify Transaction Mode Usage**
   - Check `DATABASE_URL` environment variable in Vercel
   - Ensure port 6543 is used: `postgresql://...pooler.supabase.com:6543/postgres`
   - Update connection string if using port 5432 or direct connection

2. **Set Up Basic Monitoring**
   - Add `pg_stat_activity` query to admin dashboard
   - Create Grafana dashboard for connection metrics
   - Set up Sentry alerts for database timeout errors

3. **Audit Server-Side Client Creation**
   - Verify all server components use `createServerClient` (not singleton)
   - Ensure `persistSession: false` for server-side auth
   - Check middleware doesn't leak connections

### Short-Term (Before 100 Users)

1. **Implement Connection Monitoring**
   - Deploy Grafana dashboard with connection metrics
   - Set up alerts for >60% connection utilization
   - Add connection count to status page or admin panel

2. **Load Testing**
   - Simulate 100 concurrent users with tools like k6 or Artillery
   - Monitor connection pool behavior under load
   - Identify bottleneck queries with slow-query logging

3. **Optimize High-Frequency Queries**
   - Review `pg_stat_statements` for most frequent queries
   - Add appropriate indexes (especially for leaderboards, social features)
   - Consider caching for read-heavy endpoints (Vercel KV, Redis)

### Medium-Term (100-500 Users)

1. **Connection Pool Tuning**
   - Review actual peak concurrent connection usage
   - Adjust pool size in Dashboard if seeing queuing
   - Consider dedicated read replicas for analytics queries

2. **Upgrade Path Planning**
   - Monitor connection utilization trends
   - Set budget threshold for upgrading to Pro + Small ($35/month)
   - Plan for ~$50-100/month database costs at 1,000 users

3. **Advanced Monitoring**
   - Export Supabase metrics to Prometheus
   - Set up comprehensive alerting (PagerDuty, Opsgenie)
   - Create connection usage dashboard for stakeholder visibility

### Long-Term (1,000+ Users)

1. **Scaling Strategy**
   - Evaluate Pro + Medium tier ($45/month for 600 connections)
   - Consider regional read replicas for geographic distribution
   - Investigate Supabase Edge Functions for compute-intensive operations

2. **Connection Pool Optimization**
   - Implement connection pooling at application layer (if needed)
   - Use read replicas for analytics/reporting queries
   - Offload background jobs to dedicated workers (avoid blocking API connections)

3. **Cost Optimization**
   - Review and optimize slow queries regularly
   - Implement aggressive caching for static/semi-static data
   - Use Supabase Storage + CDN for media assets (reduce database egress)

### Monitoring Checklist

- [ ] Transaction mode (port 6543) configured in production
- [ ] Grafana dashboard created for connection metrics
- [ ] Sentry error tracking for "Max client connections" errors
- [ ] `pg_stat_activity` monitoring query added to admin panel
- [ ] Alert configured for >60% connection utilization
- [ ] Weekly review of connection usage trends
- [ ] Load testing completed before major releases
- [ ] Slow query monitoring enabled (identify queries >100ms)

---

## 8. Additional Resources

### Official Documentation
- [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management)
- [Supabase Compute and Disk Limits](https://supabase.com/docs/guides/platform/compute-and-disk)
- [How to Monitor Postgres and Supavisor Connections](https://supabase.com/docs/guides/troubleshooting/monitor-supavisor-postgres-connections)
- [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- [Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Metrics API](https://supabase.com/docs/guides/telemetry/metrics)

### Vercel Integration
- [Connection Pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [The Real Serverless Compute to Database Connection Problem, Solved](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)
- [Vercel Function Timeouts](https://vercel.com/docs/functions/runtimes)

### Community Discussions
- [Supavisor Connection Limits Discussion](https://github.com/orgs/supabase/discussions/18986)
- [How to Change Max Database Connections](https://github.com/orgs/supabase/discussions/27197)
- [Increased Supavisor Client Connection Limits](https://github.com/orgs/supabase/discussions/22457)
- [Preventing "Max Client Connections Reached" Errors](https://github.com/orgs/supabase/discussions/22305)

### Pricing and Cost Optimization
- [Supabase Pricing 2026 Complete Breakdown](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)
- [Supabase Pricing Models and Cost Optimization](https://flexprice.io/blog/supabase-pricing-breakdown)
- [Making the Most of Supabase's Free Tier](https://medium.com/@reliabledataengineering/making-the-most-of-supabases-free-tier-a-practical-guide-ef4817d84a26)

---

## Conclusion

Quiver's current infrastructure (Free tier Supabase + Vercel) is well-suited for the current scale of ~7 users and can comfortably support growth to 1,000+ users with proper monitoring and configuration:

**Key Takeaways:**
1. **Free tier provides 200 pooled connections** - sufficient for 1,000 users with typical usage patterns
2. **Transaction mode (port 6543) is critical** - prevents connection exhaustion in serverless environments
3. **Monitor proactively** - set up Grafana dashboard and alerts before hitting limits
4. **Plan for Pro + Small upgrade** (~$35/month) around 500-1,000 users if seeing connection pressure
5. **Optimize queries and implement caching** to reduce connection hold times and database load

By following the recommendations in this document, Quiver can scale efficiently while maintaining predictable costs and excellent performance.
