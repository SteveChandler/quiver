# Deployment Architecture

**Purpose**: Production infrastructure, deployment process, CI/CD pipeline, and operational architecture.

**Audience**: DevOps engineers, platform engineers, SREs, architects

**Created**: October 28, 2025
**Last Updated**: October 28, 2025

---

## Overview

Quiver's deployment architecture leverages modern serverless platforms for automatic scaling, global distribution, and minimal operational overhead:

- **Frontend/API Hosting**: Vercel (serverless functions + CDN)
- **Database & Backend**: Supabase (managed PostgreSQL + services)
- **Mobile Apps**: App Store (iOS) + Google Play (Android)
- **Push Notifications**: Firebase Cloud Messaging
- **CI/CD**: GitHub Actions
- **Monitoring**: Vercel Analytics + Supabase Dashboard

---

## Production Infrastructure Diagram

```mermaid
graph TB
    subgraph "Users & Devices"
        WebUsers[Web Users<br/>Desktop & Mobile Browsers]
        iOSUsers[iOS Users<br/>iPhone & iPad]
        AndroidUsers[Android Users<br/>Phones & Tablets]
    end

    subgraph "CDN & Edge Network"
        VercelEdge[Vercel Edge Network<br/>Global CDN<br/>270+ Locations]
    end

    subgraph "Vercel Platform - US West"
        direction TB
        WebApp[Next.js Application<br/>SSR + Static Pages]
        ServerlessFunctions[Serverless Functions<br/>API Routes + Server Actions<br/>Node.js 20 Runtime]
        CronJobs[Vercel Cron Jobs<br/>Scheduled Tasks]
    end

    subgraph "Supabase Platform - US West"
        direction TB
        subgraph "Database Layer"
            PGPrimary[(PostgreSQL 15<br/>Primary Instance<br/>10GB Storage)]
            PGReplica[(Read Replica<br/>Future)]
        end

        subgraph "Services"
            SupaAuth[Supabase Auth<br/>JWT Provider]
            SupaStorage[Supabase Storage<br/>S3-compatible<br/>CDN-backed]
            SupaRealtime[Supabase Realtime<br/>WebSocket Server]
        end

        ConnectionPool[Connection Pool<br/>PgBouncer<br/>Max 100 connections]
    end

    subgraph "Firebase - Global"
        FCM[Firebase Cloud Messaging<br/>APNs + FCM Gateway]
    end

    subgraph "External APIs"
        NOAA[NOAA APIs<br/>Multiple Endpoints]
        Maps[Google Maps<br/>Mapbox]
    end

    subgraph "App Stores"
        AppStore[Apple App Store<br/>iOS Distribution]
        PlayStore[Google Play Store<br/>Android Distribution]
    end

    subgraph "CI/CD Pipeline"
        GitHub[GitHub Repository<br/>Main Branch]
        GitHubActions[GitHub Actions<br/>Build & Test]
    end

    %% User Connections
    WebUsers -->|HTTPS<br/>TLS 1.3| VercelEdge
    iOSUsers -->|HTTPS| VercelEdge
    AndroidUsers -->|HTTPS| VercelEdge

    %% Edge to Application
    VercelEdge -->|Static Assets| WebApp
    VercelEdge -->|Dynamic Requests| WebApp
    WebApp -->|Function Calls| ServerlessFunctions

    %% Scheduled Jobs
    CronJobs -->|Trigger| ServerlessFunctions

    %% Application to Database
    ServerlessFunctions -->|PostgreSQL Wire Protocol| ConnectionPool
    ConnectionPool -->|Pooled Connections| PGPrimary
    PGPrimary -.->|Replication| PGReplica

    %% Application to Supabase Services
    ServerlessFunctions -->|API Calls| SupaAuth
    ServerlessFunctions -->|File Upload/Download| SupaStorage
    ServerlessFunctions -->|Query/Mutation| PGPrimary

    %% Client to Realtime
    WebUsers -.->|WebSocket| SupaRealtime
    iOSUsers -.->|WebSocket| SupaRealtime
    AndroidUsers -.->|WebSocket| SupaRealtime
    SupaRealtime -.->|DB Changes| PGPrimary

    %% Push Notifications
    ServerlessFunctions -->|Send Notification| FCM
    FCM -.->|Deliver| iOSUsers
    FCM -.->|Deliver| AndroidUsers

    %% External APIs
    ServerlessFunctions -->|Fetch Data| NOAA
    ServerlessFunctions -->|Geocoding| Maps
    WebApp -->|Map Rendering| Maps

    %% App Distribution
    AppStore -->|Download| iOSUsers
    PlayStore -->|Download| AndroidUsers

    %% CI/CD Flow
    GitHub -->|Push Event| GitHubActions
    GitHubActions -->|Deploy| WebApp
    GitHubActions -->|Deploy| ServerlessFunctions

    classDef userClass fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef cdnClass fill:#FFB84D,stroke:#CC8800,stroke-width:2px,color:#000
    classDef vercelClass fill:#50C878,stroke:#2E8B57,stroke-width:2px,color:#fff
    classDef supabaseClass fill:#9B59B6,stroke:#6C3483,stroke-width:2px,color:#fff
    classDef externalClass fill:#FFA07A,stroke:#CD5C5C,stroke-width:2px,color:#000

    class WebUsers,iOSUsers,AndroidUsers userClass
    class VercelEdge cdnClass
    class WebApp,ServerlessFunctions,CronJobs vercelClass
    class PGPrimary,PGReplica,SupaAuth,SupaStorage,SupaRealtime,ConnectionPool supabaseClass
    class FCM,NOAA,Maps,AppStore,PlayStore,GitHub,GitHubActions externalClass
```

---

## CI/CD Pipeline

```mermaid
graph LR
    subgraph "Development"
        Dev[Developer<br/>Local Machine]
    end

    subgraph "Source Control"
        PR[Pull Request<br/>Feature Branch]
        Main[Main Branch]
    end

    subgraph "GitHub Actions"
        Checks[PR Checks]
        Build[Build & Test]
        Deploy[Production Deploy]
    end

    subgraph "Testing"
        Lint[Linting<br/>ESLint]
        TypeCheck[Type Check<br/>TypeScript]
        UnitTests[Unit Tests<br/>Jest]
        E2ETests[E2E Tests<br/>Playwright]
    end

    subgraph "Deployment Targets"
        VercelProd[Vercel Production<br/>quiversurf.app]
        VercelPreview[Vercel Preview<br/>PR Deployments]
    end

    subgraph "Mobile Build"
        CapBuild[Capacitor Build]
        iOSBuild[Xcode Build<br/>iOS App]
        AndroidBuild[Gradle Build<br/>Android App]
        TestFlight[TestFlight<br/>Beta Testing]
        PlayBeta[Google Play<br/>Beta Track]
    end

    %% Development Flow
    Dev -->|git push| PR
    PR -->|Trigger| Checks

    %% PR Checks
    Checks --> Lint
    Checks --> TypeCheck
    Checks --> UnitTests

    Lint --> Build
    TypeCheck --> Build
    UnitTests --> Build

    Build -->|Success| VercelPreview
    Build -->|Tests Pass| MergeReady[Ready to Merge]

    %% Production Flow
    MergeReady -->|Merge PR| Main
    Main -->|Trigger| Deploy

    Deploy --> E2ETests
    E2ETests -->|Pass| VercelProd

    %% Mobile Build Flow
    Main -.->|Manual Trigger| CapBuild
    CapBuild --> iOSBuild
    CapBuild --> AndroidBuild

    iOSBuild --> TestFlight
    AndroidBuild --> PlayBeta

    TestFlight -.->|Approved| AppStore[App Store Release]
    PlayBeta -.->|Approved| PlayStore[Play Store Release]

    classDef devClass fill:#FFE5E5,stroke:#FF0000,stroke-width:2px
    classDef testClass fill:#FFF4E5,stroke:#FFA500,stroke-width:2px
    classDef prodClass fill:#E5FFE5,stroke:#00AA00,stroke-width:2px

    class Dev,PR devClass
    class Checks,Lint,TypeCheck,UnitTests,E2ETests,Build testClass
    class VercelProd,VercelPreview,AppStore,PlayStore prodClass
```

---

## Deployment Workflow

### 1. Web Application Deployment

#### Automatic Deployment (Main Branch)

```mermaid
sequenceDiagram
    actor Developer
    participant GitHub
    participant Actions as GitHub Actions
    participant Vercel
    participant Supabase

    Developer->>GitHub: git push origin main
    GitHub->>Actions: Trigger workflow

    Note over Actions: 1. Install Dependencies

    Actions->>Actions: yarn install --frozen-lockfile

    Note over Actions: 2. Run Checks

    Actions->>Actions: yarn lint
    Actions->>Actions: npx tsc --noEmit
    Actions->>Actions: yarn test

    Note over Actions: 3. Build Application

    Actions->>Actions: yarn build
    Actions->>Actions: Generate static pages
    Actions->>Actions: Optimize assets

    Note over Actions: 4. Run E2E Tests

    Actions->>Actions: npx playwright test

    alt Tests Fail
        Actions-->>Developer: ❌ Deployment Failed
    else Tests Pass
        Actions->>Vercel: Deploy to production

        Note over Vercel: 5. Deploy Functions

        Vercel->>Vercel: Deploy serverless functions
        Vercel->>Vercel: Update edge config
        Vercel->>Vercel: Invalidate CDN cache

        Note over Vercel: 6. Health Check

        Vercel->>Vercel: Smoke tests
        Vercel->>Supabase: Test DB connection

        alt Health Check Fails
            Vercel->>Vercel: Rollback to previous version
            Vercel-->>Developer: ⚠️ Deployed with rollback
        else Health Check Passes
            Vercel-->>Developer: ✅ Deployed Successfully
        end
    end
```

#### Preview Deployments (Pull Requests)

```bash
# Triggered automatically on PR creation/update
name: Preview Deployment

on:
  pull_request:
    branches: [main]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: yarn install --frozen-lockfile
      - run: yarn build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
          # Preview deployment (not production)
          # Unique URL: quiver-pr-123.vercel.app
```

### 2. Mobile App Deployment

#### iOS Deployment

```mermaid
graph TD
    Start[Code Ready] --> CapSync[yarn build:ios]
    CapSync --> UpdateCap[Sync Capacitor<br/>npx cap sync ios]
    UpdateCap --> Xcode[Open Xcode]

    Xcode --> UpdateVer[Increment Build Number<br/>Version]
    UpdateVer --> BuildApp[Archive App<br/>Product > Archive]

    BuildApp --> ValidateApp{Validate App}
    ValidateApp -->|Issues| FixIssues[Fix Issues]
    FixIssues --> BuildApp

    ValidateApp -->|Pass| UploadTF[Upload to TestFlight<br/>Distribute App]
    UploadTF --> BetaTest[Beta Testing<br/>Internal + External]

    BetaTest --> Review{Ready for Production?}
    Review -->|No| MoreTesting[Continue Testing]
    MoreTesting --> BetaTest

    Review -->|Yes| SubmitReview[Submit for App Review]
    SubmitReview --> AppleReview[Apple Review Process<br/>1-2 days]

    AppleReview --> Approved{Approved?}
    Approved -->|No| FixReview[Address Review Comments]
    FixReview --> SubmitReview

    Approved -->|Yes| Release[Release to App Store]
    Release --> End[App Live]

    classDef buildClass fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef testClass fill:#FFB84D,stroke:#CC8800,stroke-width:2px
    classDef prodClass fill:#50C878,stroke:#2E8B57,stroke-width:2px,color:#fff

    class CapSync,UpdateCap,BuildApp buildClass
    class ValidateApp,BetaTest,Review,AppleReview testClass
    class Release,End prodClass
```

#### Android Deployment

```bash
# Build for Android
yarn build:android
npx cap sync android

# Open Android Studio and build AAB
# Build > Generate Signed Bundle / APK
# Upload to Google Play Console (Internal Testing → Beta → Production)
```

---

## Infrastructure Configuration

### Vercel Configuration

**File**: `vercel.json`

```json
{
  "version": 2,
  "regions": ["sfo1"],
  "buildCommand": "yarn build",
  "devCommand": "yarn dev",
  "installCommand": "yarn install --frozen-lockfile",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  },
  "crons": [
    {
      "path": "/api/cron/refresh-forecasts",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-buoys",
      "schedule": "0 */1 * * *"
    },
    {
      "path": "/api/cron/cleanup-old-data",
      "schedule": "0 2 * * *"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### Supabase Configuration

**Project Settings**:
- **Region**: US West (Oregon)
- **Instance Size**: Free Tier (upgradable to Pro)
- **Storage**: 10GB database + 1GB file storage
- **Bandwidth**: Unlimited (fair use)
- **Connection Pooling**: Enabled (PgBouncer)
- **SSL**: Enforced
- **Backups**: Daily (7-day retention on Pro)

**Database Configuration**:

```sql
-- Connection pool settings
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '10MB';

-- Performance settings
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD optimized
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
```

---

## Environment Variables

### Production Environment

Stored securely in Vercel and accessed at runtime:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Firebase
FIREBASE_PROJECT_ID=[project-id]
FIREBASE_CLIENT_EMAIL=[service-account-email]
FIREBASE_PRIVATE_KEY=[private-key]

# External APIs
NOAA_API_KEY=[optional]
GOOGLE_MAPS_API_KEY=[api-key]
MAPBOX_ACCESS_TOKEN=[token]

# App Config
NEXT_PUBLIC_APP_URL=https://quiversurf.app
NODE_ENV=production
```

### Development Environment

**File**: `.env.local` (gitignored)

```bash
# Same variables as production, but pointing to dev instances
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[local-anon-key]
```

---

## Scaling & Performance

### Current Capacity

| Component | Current Limit | Notes |
|-----------|--------------|-------|
| **Vercel Functions** | Unlimited invocations | Auto-scales per request |
| **Database Connections** | 100 (pooled) | PgBouncer connection pooling |
| **Database Storage** | 10GB | Upgradable to 100GB+ |
| **File Storage** | 1GB | Upgradable to unlimited |
| **CDN Bandwidth** | Unlimited | Fair use policy |
| **WebSocket Connections** | 10,000+ | Supabase Realtime auto-scales |

### Auto-Scaling Behavior

```mermaid
graph TD
    Request[Incoming Request] --> CheckCache{CDN Cache Hit?}

    CheckCache -->|Yes| ServeCDN[Serve from Edge<br/>< 50ms]
    CheckCache -->|No| RouteRequest[Route to Function]

    RouteRequest --> CheckCold{Cold Start?}

    CheckCold -->|Yes| ColdStart[Cold Start<br/>~200-500ms]
    CheckCold -->|No| WarmFunction[Warm Function<br/>~50ms]

    ColdStart --> ExecuteFunction
    WarmFunction --> ExecuteFunction[Execute Function]

    ExecuteFunction --> CheckLoad{High Load?}

    CheckLoad -->|Yes| ScaleUp[Vercel Auto-scales<br/>Spin up more instances]
    CheckLoad -->|No| ProcessRequest[Process Request]

    ScaleUp --> ProcessRequest

    ProcessRequest --> DBQuery[Database Query]
    DBQuery --> CheckPool{Connection Available?}

    CheckPool -->|Yes| UseConnection[Use Pooled Connection]
    CheckPool -->|No| WaitPool[Wait for Connection<br/>Queue Request]

    WaitPool --> UseConnection
    UseConnection --> QueryDB[(PostgreSQL)]

    QueryDB --> ReturnResponse[Return Response]
    ReturnResponse --> CacheResponse{Cacheable?}

    CacheResponse -->|Yes| UpdateCDN[Update CDN Cache<br/>TTL: 60s - 1h]
    CacheResponse -->|No| DirectResponse

    UpdateCDN --> DirectResponse[Return to Client]
    ServeCDN --> DirectResponse

    classDef fastPath fill:#50C878,stroke:#2E8B57,stroke-width:2px,color:#fff
    classDef slowPath fill:#FFB84D,stroke:#CC8800,stroke-width:2px
    classDef dbClass fill:#9B59B6,stroke:#6C3483,stroke-width:2px,color:#fff

    class ServeCDN,WarmFunction,UseConnection,DirectResponse fastPath
    class ColdStart,WaitPool slowPath
    class DBQuery,QueryDB dbClass
```

### Scaling Strategy

1. **Horizontal Scaling**: Vercel automatically adds function instances
2. **Connection Pooling**: PgBouncer manages database connections
3. **CDN Caching**: Edge network caches static and dynamic content
4. **Database Read Replicas**: Future addition for read-heavy queries
5. **Redis Cache**: Future addition for hot data (sessions, user profiles)

---

## Monitoring & Observability

### Vercel Analytics

- **Page Views**: Track user navigation
- **Performance Metrics**: Core Web Vitals (LCP, FID, CLS)
- **Function Logs**: Real-time serverless function logs
- **Error Tracking**: Automatic error detection

### Supabase Dashboard

- **Database Performance**: Query stats, slow queries
- **Connection Pool**: Active connections, queue length
- **Storage Usage**: File storage and database size
- **API Requests**: Auth, database, storage request counts

### Monitoring Diagram

```mermaid
graph TD
    subgraph "Application"
        App[Quiver App]
        Functions[Serverless Functions]
        DB[(Database)]
    end

    subgraph "Monitoring Services"
        VercelAnalytics[Vercel Analytics<br/>Performance + Logs]
        SupaDashboard[Supabase Dashboard<br/>DB + API Metrics]
        LogDrain[Log Drain<br/>Future: Datadog/Sentry]
    end

    subgraph "Alerts"
        Email[Email Alerts]
        Slack[Slack Notifications]
    end

    App -->|Web Vitals| VercelAnalytics
    Functions -->|Logs + Errors| VercelAnalytics
    Functions -->|API Metrics| SupaDashboard
    DB -->|Performance Metrics| SupaDashboard

    VercelAnalytics -.->|Future| LogDrain
    SupaDashboard -.->|Future| LogDrain

    VercelAnalytics -->|Threshold Alerts| Email
    SupaDashboard -->|DB Alerts| Email

    Email -.->|Future| Slack

    classDef appClass fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef monitorClass fill:#FFB84D,stroke:#CC8800,stroke-width:2px
    classDef alertClass fill:#FF6B6B,stroke:#C92A2A,stroke-width:2px,color:#fff

    class App,Functions,DB appClass
    class VercelAnalytics,SupaDashboard,LogDrain monitorClass
    class Email,Slack alertClass
```

---

## Disaster Recovery & Backups

### Database Backups

**Supabase Pro Plan**:
- **Frequency**: Daily automatic backups
- **Retention**: 7 days (configurable up to 30 days)
- **Type**: Full database dump + point-in-time recovery
- **Storage**: Separate S3 bucket (encrypted)

**Manual Backup**:

```bash
# Local backup
npx supabase db dump > backup.sql

# Restore from backup
npx supabase db reset
psql -h [host] -U postgres -d postgres < backup.sql
```

### Rollback Strategy

#### Web Application

```mermaid
graph LR
    Issue[Production Issue Detected] --> Investigate{Severity?}

    Investigate -->|Critical| ImmediateRollback[Immediate Rollback]
    Investigate -->|Non-Critical| QuickFix[Attempt Quick Fix]

    ImmediateRollback --> VercelUI[Vercel Dashboard<br/>Deployments Tab]
    VercelUI --> SelectPrevious[Select Previous Deployment]
    SelectPrevious --> PromoteProd[Promote to Production<br/>~30 seconds]

    QuickFix --> TestFix{Fix Works?}
    TestFix -->|Yes| Deploy[Deploy Fix]
    TestFix -->|No| ImmediateRollback

    PromoteProd --> Verify[Verify Production]
    Deploy --> Verify

    Verify --> PostMortem[Post-Mortem Analysis]

    classDef criticalClass fill:#FF6B6B,stroke:#C92A2A,stroke-width:2px,color:#fff
    classDef actionClass fill:#FFB84D,stroke:#CC8800,stroke-width:2px
    classDef successClass fill:#50C878,stroke:#2E8B57,stroke-width:2px,color:#fff

    class Issue,ImmediateRollback criticalClass
    class VercelUI,SelectPrevious,QuickFix actionClass
    class PromoteProd,Verify,Deploy successClass
```

#### Database

```sql
-- Point-in-time recovery (Supabase Pro)
-- Contact Supabase support with target timestamp

-- Manual restore from backup
-- 1. Download backup from Supabase dashboard
-- 2. Restore to new database
-- 3. Verify data integrity
-- 4. Update connection strings
```

---

## Security

### HTTPS/TLS

- **Certificate**: Automatic via Vercel (Let's Encrypt)
- **TLS Version**: 1.3 (1.2 minimum)
- **HSTS**: Enabled (max-age=31536000)
- **Certificate Renewal**: Automatic

### Database Security

- **Encryption at Rest**: AES-256
- **Encryption in Transit**: TLS 1.2+
- **Network**: VPC-isolated (Supabase infrastructure)
- **Access Control**: Row-Level Security (RLS) enabled on all tables
- **Connection**: SSL required

### Secrets Management

- **Vercel Environment Variables**: Encrypted at rest
- **GitHub Secrets**: Encrypted repository secrets
- **Rotation**: Manual (recommended every 90 days)

---

## Cost Optimization

### Current Costs (Estimated)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| **Vercel** | Pro | $20/month |
| **Supabase** | Pro | $25/month |
| **Firebase** | Spark (Free) | $0 (pay-as-you-go for scale) |
| **Domain** | Namecheap | $12/year |
| **Total** | | ~$46/month |

### Scaling Costs

At 10,000 monthly active users:

| Service | Estimated Cost |
|---------|---------------|
| **Vercel** | $20-40/month (function invocations included) |
| **Supabase** | $25-50/month (database + bandwidth) |
| **Firebase** | $10-20/month (push notifications) |
| **Total** | ~$55-110/month |

### Cost Optimization Strategies

1. **CDN Caching**: Reduce function invocations
2. **Query Optimization**: Reduce database load
3. **Image Optimization**: Use Next.js Image (automatic WebP)
4. **Lazy Loading**: Reduce initial bundle size
5. **Connection Pooling**: Efficient database usage

---

## Related Diagrams

- [System Context](./system-context.md) - High-level infrastructure view
- [Container Architecture](./container-architecture.md) - Application containers
- [CI/CD Pipeline](#cicd-pipeline) - Detailed deployment flow

---

## Related Documentation

- [System Architecture Guide](../architecture/SYSTEM_ARCHITECTURE.md)
- [API Documentation](../architecture/API_DOCUMENTATION.md)
- [Security Guide](../architecture/SECURITY_GUIDE.md)

---

**Deployment Summary**:
- Fully automated CI/CD pipeline
- Preview deployments for every PR
- Production deployments on merge to main
- Automatic rollback capability
- Global CDN distribution
- 99.9%+ uptime SLA
- Zero-downtime deployments
