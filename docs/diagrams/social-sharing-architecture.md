# Social Sharing Architecture Diagrams

**Date**: October 31, 2025
**Feature**: QuiverSurf Session Sharing
**Status**: Production-Ready

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Devices                            │
│                  (iOS, Android, Desktop)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Presentation Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  ShareBar    │  │ SharePreview │  │ Public Share Page  │   │
│  │  Component   │  │  Component   │  │   (/s/[id])        │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ URL Builder  │  │ Text Builder │  │ Analytics        │     │
│  │ (Platform    │  │ (Templates)  │  │ Tracker          │     │
│  │  Adapters)   │  │              │  │ (Dual DB + GA)   │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │   Satori     │  │   Supabase   │  │ Google Analytics │     │
│  │ + Resvg      │  │   (DB+Auth)  │  │    (Events)      │     │
│  │ (Image Gen)  │  │              │  │                  │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ShareBar Component                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  State Management                                       │   │
│  │  - selectedVariant (1-6)                                │   │
│  │  - selectedRatio (1:1, 4:5, 9:16)                      │   │
│  │  - isSharing (loading state)                            │   │
│  │  - copiedLink (success state)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UI Elements                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐                    │   │
│  │  │ Variant      │  │ Aspect Ratio │                    │   │
│  │  │ Selector     │  │ Selector     │                    │   │
│  │  │ (Dropdown)   │  │ (Dropdown)   │                    │   │
│  │  └──────────────┘  └──────────────┘                    │   │
│  │                                                         │   │
│  │  ┌─────────────┬─────────────┬──────────────┬────────┐ │   │
│  │  │ Instagram   │ X/Twitter   │ Facebook     │Download│ │   │
│  │  │ Button      │ Button      │ Button       │ Button │ │   │
│  │  └─────────────┴─────────────┴──────────────┴────────┘ │   │
│  │                                                         │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ Generic Share Button (Web Share API fallback)   │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Share Flow Sequence

```
┌──────┐
│ User │
└───┬──┘
    │ 1. Clicks Share Button
    ▼
┌────────────────┐
│   ShareBar     │
│   Component    │──────────────┐
└───┬────────────┘              │
    │ 2. handleShare(platform)  │
    ▼                           │
┌─────────────────────┐         │
│ trackSharePlatform  │         │ 3. Platform Router
│ Selected() → GA     │         │
└─────────────────────┘         ▼
                        ┌───────────────────┐
    ┌───────────────────┤ Platform Strategy ├────────────────┐
    │                   └───────────────────┘                │
    │                                                         │
    ▼                           ▼                             ▼
┌─────────────┐       ┌──────────────────┐      ┌────────────────────┐
│ Instagram   │       │   X/Twitter      │      │   Facebook         │
│ Strategy    │       │   Strategy       │      │   Strategy         │
│             │       │                  │      │                    │
│ Download    │       │ Open Intent URL  │      │ Open Sharer URL    │
│ Image + Show│       │ (with text)      │      │ (with page URL)    │
│ Tooltip     │       │                  │      │                    │
└──────┬──────┘       └────────┬─────────┘      └─────────┬──────────┘
       │                       │                           │
       │                       │                           │
       ▼                       ▼                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                  buildPlatformShareUrl()                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ buildImage   │  │ buildTwitter │  │ buildFacebook      │      │
│  │ Url()        │  │ ShareUrl()   │  │ ShareUrl()         │      │
│  └──────────────┘  └──────────────┘  └────────────────────┘      │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ GET /api/sessions/    │
                │ [id]/share-image?     │
                │ variant=3&ratio=9:16  │
                └───────────┬───────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │ session-card-renderer  │
                │ .renderVariant()       │
                │                        │
                │ Satori → SVG → Resvg   │
                │ → PNG (Uint8Array)     │
                └───────────┬────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Return PNG with       │
                │ Cache-Control: 7 days │
                └───────────┬───────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    ┌───────────────┐           ┌──────────────────┐
    │ trackShare()  │           │ User downloads/  │
    │ → Database    │           │ shares image     │
    │ → Analytics   │           │                  │
    └───────────────┘           └──────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ increment_session_share_ │
    │ count(uuid) RPC          │
    └──────────────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ trackShareCompleted()    │
    │ → GA success event       │
    └──────────────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ Toast notification       │
    │ "Shared successfully!"   │
    └──────────────────────────┘
```

---

## Database Schema Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         sessions                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  id                uuid PRIMARY KEY                      │ │
│  │  user_id           uuid → profiles(id)                   │ │
│  │  beach_id          uuid → beaches(id)                    │ │
│  │  session_date      timestamp                             │ │
│  │  rating            integer (1-5)                         │ │
│  │  notes             text                                  │ │
│  │  is_public         boolean DEFAULT false ◄────┐          │ │
│  │  share_count       integer DEFAULT 0          │          │ │
│  │  created_at        timestamp                  │          │ │
│  │  updated_at        timestamp                  │          │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬───────────────────────────┘
                                     │
                                     │ FK: session_id
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────┐
│                     session_shares                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  id              uuid PRIMARY KEY                        │ │
│  │  session_id      uuid → sessions(id)                     │ │
│  │  user_id         uuid → profiles(id)                     │ │
│  │  platform        text CHECK (instagram|x|facebook|...)   │ │
│  │  variant         text CHECK ('1'|'2'|...|'6')            │ │
│  │  aspect_ratio    text CHECK ('1:1'|'4:5'|'9:16')         │ │
│  │  share_url       text                                    │ │
│  │  created_at      timestamp DEFAULT now()                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Indexes:                                                      │
│  - idx_session_shares_variant (variant)                       │
│  - idx_session_shares_aspect_ratio (aspect_ratio)             │
│  - idx_session_shares_analytics (platform, variant,           │
│                                   aspect_ratio, created_at)   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  RPC Functions                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  increment_session_share_count(session_id uuid)          │ │
│  │    → UPDATE sessions                                     │ │
│  │       SET share_count = share_count + 1                  │ │
│  │       WHERE id = session_id                              │ │
│  │                                                          │ │
│  │  Security: DEFINER (elevated privileges)                │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Image Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│              Image Generation Pipeline                          │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ API Request  │
  │ GET /api/    │
  │ sessions/    │
  │ [id]/share-  │
  │ image?       │
  │ variant=3    │
  │ &ratio=9:16  │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────┐
  │ Parse & Validate     │
  │ - variant (1-6)      │
  │ - ratio (1:1/4:5/9:16│
  │ - sessionId (uuid)   │
  └──────┬───────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ Fetch Session Data   │
  │ from Supabase        │
  │ - beach name         │
  │ - date, rating       │
  │ - conditions         │
  │ - is_public flag ◄───┼── 403 if private
  └──────┬───────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Extract Session Data         │
  │ - beachName                  │
  │ - dateDisplay                │
  │ - ratingStars (⭐⭐⭐⭐)       │
  │ - waveHeight, wind, forecast │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Load Fonts (cached)          │
  │ - Try: Noto Sans → Roboto    │
  │        → Open Sans → etc.    │
  │ - Return first available     │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Select Variant Renderer      │
  │ Factory Pattern              │
  │                              │
  │ variant === 1 → renderVariant1() │
  │ variant === 2 → renderVariant2() │
  │ ...                          │
  │ default → renderVariant1()   │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Build React Element Tree     │
  │ (using React.createElement)  │
  │                              │
  │ Example: Variant 3           │
  │ ┌─────────────────────────┐  │
  │ │ Container (flex column) │  │
  │ │ ├─ Header (beach + date)│  │
  │ │ ├─ Content (flex row)   │  │
  │ │ │  ├─ Left (rating)     │  │
  │ │ │  └─ Right (conditions)│  │
  │ │ └─ Footer (branding)    │  │
  │ └─────────────────────────┘  │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Satori: JSX → SVG            │
  │ - Render React to SVG string │
  │ - Apply fonts                │
  │ - Calculate layout (Flexbox) │
  │ - Output: SVG text           │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Resvg: SVG → PNG             │
  │ - Parse SVG                  │
  │ - Rasterize to bitmap        │
  │ - Encode as PNG              │
  │ - Output: Uint8Array         │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ Return PNG Response          │
  │ Content-Type: image/png      │
  │ Cache-Control: public,       │
  │   max-age=604800, immutable  │
  │ Content-Length: <bytes>      │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ CDN/Edge Caching             │
  │ (Vercel Edge Network)        │
  │ - 7 day cache                │
  │ - Immutable (no revalidation)│
  └──────────────────────────────┘

⏱️ Total Time: 900ms - 2.5s
📦 File Size: 150-377KB (target: <350KB/500KB)
```

---

## Caching Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Caching Layers                           │
└─────────────────────────────────────────────────────────────┘

 ┌──────────┐
 │  User    │
 └────┬─────┘
      │ Request: /api/sessions/abc123/share-image?variant=3&ratio=9:16
      │
      ▼
 ┌────────────────────────────────────┐
 │  Layer 1: Browser Cache            │
 │  - Duration: 7 days                │
 │  - Type: Disk cache                │
 │  - Hit: Instant (0ms)              │
 │  - Miss: Request to CDN            │
 └────┬───────────────────────────────┘
      │ MISS
      │
      ▼
 ┌────────────────────────────────────┐
 │  Layer 2: CDN/Edge Cache           │
 │  (Vercel Edge Network)             │
 │  - Duration: 7 days                │
 │  - Type: Distributed cache         │
 │  - Hit: ~10-50ms (geo-distributed) │
 │  - Miss: Request to Origin         │
 │  - Header: max-age=604800          │
 └────┬───────────────────────────────┘
      │ MISS
      │
      ▼
 ┌────────────────────────────────────┐
 │  Layer 3: Origin (API Route)       │
 │  - Generate image (Satori + Resvg) │
 │  - Duration: 900ms - 2.5s          │
 │  - Return with immutable header    │
 │  - CDN caches response             │
 └────────────────────────────────────┘

 Cache Key Structure:
 ┌──────────────────────────────────────────────────┐
 │ /api/sessions/[sessionId]/share-image            │
 │   ?variant=[1-6]                                 │
 │   &ratio=[1:1|4:5|9:16]                          │
 │                                                  │
 │ Example: /api/sessions/abc123/share-image?      │
 │          variant=3&ratio=9:16                    │
 │                                                  │
 │ Total combinations per session:                  │
 │ 6 variants × 3 ratios = 18 possible URLs         │
 └──────────────────────────────────────────────────┘

 Cache Behavior:
 ┌──────────────────────────────────────────────────┐
 │ Request #1: MISS → Generate → Cache → Return    │
 │   Time: 1,500ms                                  │
 │                                                  │
 │ Request #2: HIT (CDN) → Return                   │
 │   Time: 30ms                                     │
 │                                                  │
 │ Request #3+: HIT (Browser) → Return              │
 │   Time: 0ms (instant)                            │
 └──────────────────────────────────────────────────┘

 Future Optimization (Recommended):
 ┌──────────────────────────────────────────────────┐
 │  Layer 0: Pre-Generated Images (S3/R2)           │
 │  - Pre-generate popular variants                 │
 │  - Trigger: On session creation                  │
 │  - Storage: Object storage (cheap)               │
 │  - Access: Signed URLs (security)                │
 │  - Hit: ~5-10ms (edge storage)                   │
 └──────────────────────────────────────────────────┘
```

---

## Analytics Integration

```
┌─────────────────────────────────────────────────────────────┐
│              Analytics Dual Tracking System                 │
└─────────────────────────────────────────────────────────────┘

  User Action (Share Click)
         │
         ▼
  ┌──────────────────────────┐
  │ trackShare() function    │
  └──────────┬───────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌───────────┐  ┌────────────────┐
│ Database  │  │ Google         │
│ Tracking  │  │ Analytics      │
└───────────┘  └────────────────┘
      │             │
      ▼             ▼
┌───────────────────────────────────────────────┐
│ session_shares table                          │
│ - Persistent storage                          │
│ - User attribution                            │
│ - Platform, variant, ratio                    │
│ - Queryable (SQL)                             │
│                                               │
│ Use Cases:                                    │
│ - User share history                          │
│ - Most popular variants                       │
│ - Share count per session                     │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Google Analytics Events                       │
│ - 14-month retention                          │
│ - Behavioral analysis                         │
│ - Funnel tracking                             │
│ - Real-time dashboard                         │
│                                               │
│ Events:                                       │
│ 1. share_platform_selected                    │
│ 2. share                                      │
│ 3. share_{platform}                           │
│ 4. share_completed                            │
│ 5. share_failed (with error)                  │
│ 6. share_variant_changed                      │
│ 7. share_aspect_ratio_changed                 │
│ 8. share_download_started                     │
│ 9. share_download_completed                   │
│                                               │
│ Parameters:                                   │
│ - method (platform)                           │
│ - content_type ("session")                    │
│ - content_id (sessionId)                      │
│ - variant (1-6)                               │
│ - aspect_ratio (1:1/4:5/9:16)                 │
│ - surface (session_detail/preview/share)      │
└───────────────────────────────────────────────┘

Event Flow Timeline:
┌──────────────────────────────────────────────┐
│ 1. Button Click                              │
│    → trackSharePlatformSelected()            │
│    → GA: share_platform_selected             │
│                                              │
│ 2. Share Initiated                           │
│    → trackShare()                            │
│    → DB: Insert to session_shares            │
│    → GA: share, share_{platform}             │
│                                              │
│ 3. Download/Navigate (platform specific)     │
│    → Download: trackDownloadStarted()        │
│    → GA: share_download_started              │
│                                              │
│ 4. Success                                   │
│    → trackShareCompleted()                   │
│    → GA: share_completed                     │
│    → RPC: increment_session_share_count()    │
│                                              │
│ 5. (If Error)                                │
│    → trackShareFailed(error)                 │
│    → GA: share_failed                        │
│    → No DB update                            │
└──────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Security Layers                            │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Layer 1: Input Validation                                 │
│                                                           │
│ Type Guards (Runtime):                                    │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ isShareVariant(value): value is ShareVariant        │   │
│ │ isAspectRatio(value): value is AspectRatio          │   │
│ │ isSharePlatform(value): value is SharePlatform      │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ Database Constraints:                                     │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ CHECK (variant IN ('1', '2', ..., '6'))            │   │
│ │ CHECK (aspect_ratio IN ('1:1', '4:5', '9:16'))     │   │
│ │ CHECK (platform IN ('instagram', 'x', ...))        │   │
│ └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 2: Authentication & Authorization                   │
│                                                           │
│ ShareBar Component (Client-Side):                        │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ if (!user) {                                        │   │
│ │   toast("Sign in required")                         │   │
│ │   return                                            │   │
│ │ }                                                   │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ API Route (Server-Side):                                 │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ if (!session.is_public) {                           │   │
│ │   return 403 Forbidden                              │   │
│ │ }                                                   │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ Database RLS:                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ session_shares: authenticated users only            │   │
│ │ sessions: is_public = true OR user_id = auth.uid()  │   │
│ └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 3: SQL Injection Prevention                         │
│                                                           │
│ Supabase Query Builder (Parameterized):                  │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ await supabase                                      │   │
│ │   .from("sessions")                                 │   │
│ │   .select("*")                                      │   │
│ │   .eq("id", sessionId)  // Parameterized           │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ RPC Calls (Type-Safe):                                   │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ await supabase.rpc("increment_session_share_count", │   │
│ │   { session_id: sessionId } // UUID validated      │   │
│ │ )                                                   │   │
│ └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 4: Rate Limiting (RECOMMENDED - NOT YET IMPLEMENTED)│
│                                                           │
│ Proposed Implementation:                                  │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ import { Ratelimit } from "@upstash/ratelimit"     │   │
│ │                                                     │   │
│ │ const ratelimit = new Ratelimit({                  │   │
│ │   limiter: Ratelimit.slidingWindow(10, "1 m")      │   │
│ │ })                                                 │   │
│ │                                                     │   │
│ │ const { success } = await ratelimit.limit(ip)      │   │
│ │ if (!success) return 429 Too Many Requests         │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ Limits:                                                   │
│ - Anonymous: 10 req/min (image generation only)           │
│ - Authenticated: 100 shares/day                           │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 5: CORS & Cross-Origin Security                    │
│                                                           │
│ OPTIONS Handler:                                          │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Access-Control-Allow-Origin: *                      │   │
│ │ Access-Control-Allow-Methods: GET, OPTIONS          │   │
│ │ Access-Control-Allow-Headers: Content-Type          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                           │
│ Rationale: Public images (social media crawlers)         │
│ Alternative: Restrict to quiversurf.app domain           │
└───────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Error Handling Architecture                    │
└─────────────────────────────────────────────────────────────┘

User Action → ShareBar.handleShare()
                    │
                    │ try {
                    ▼
            ┌───────────────┐
            │ Validate Auth │────────► if (!user) → Toast + Return
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Build URL     │────────► May throw (invalid params)
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Execute       │────────► Platform-specific action
            │ Platform      │          (download, navigate, etc.)
            │ Action        │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Track Share   │────────► May fail (network, DB)
            │ (DB +analytics)│
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Increment     │────────► RPC call may fail
            │ Share Count   │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Track Success │────────► Fire-and-forget (GA)
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Toast Success │
            └───────────────┘

                } catch (error) {
                    │
                    ▼
            ┌───────────────────┐
            │ trackShareFailed  │────────► Log to analytics
            │ (platform, error) │
            └───────┬───────────┘
                    │
                    ▼
            ┌───────────────────┐
            │ Toast Error       │────────► User-friendly message
            │ (destructive)     │          "Failed to share. Try again."
            └───────┬───────────┘
                    │
                    ▼
            ┌───────────────────┐
            │ console.error()   │────────► Server-side logging
            └───────────────────┘

                } finally {
                    │
                    ▼
            ┌───────────────────┐
            │ setIsSharing(false)│────────► Reset loading state
            └───────────────────┘


API Route Error Handling:
┌────────────────────────────────────────────────────────────┐
│ GET /api/sessions/[id]/share-image                         │
│                                                            │
│ 1. Invalid Parameters                                      │
│    → 400 Bad Request                                       │
│    → { error: "Invalid variant. Must be 1-6." }            │
│                                                            │
│ 2. Session Not Found                                       │
│    → 404 Not Found                                         │
│    → { error: "Session not found" }                        │
│                                                            │
│ 3. Session Not Public                                      │
│    → 403 Forbidden                                         │
│    → { error: "Session is not public" }                    │
│                                                            │
│ 4. Image Generation Failed                                 │
│    → 500 Internal Server Error                             │
│    → { error: "Failed to generate image" }                 │
│    → Log full error to Sentry/console                      │
│                                                            │
│ 5. Font Loading Failed                                     │
│    → Fallback to error SVG (renderErrorSVG)                │
│    → Return SVG as fallback image                          │
│    → Log warning (non-fatal)                               │
└────────────────────────────────────────────────────────────┘

Graceful Degradation:
┌────────────────────────────────────────────────────────────┐
│ Analytics Failure        → Continue (log error)            │
│ Database Insert Failure  → Continue (analytics still fires)│
│ Share Count RPC Failure  → Continue (minor inconsistency OK│
│ Font Loading Failure     → Fallback to next font          │
│ Image Generation Failure → Return error SVG                │
└────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Technology Stack                         │
└─────────────────────────────────────────────────────────────┘

Frontend:
  ├─ Next.js 14+ (App Router)
  ├─ React 18 (Server + Client Components)
  ├─ TypeScript (strict mode)
  ├─ Tailwind CSS (styling)
  └─ Shadcn/ui (component library)

Backend:
  ├─ Next.js API Routes (serverless)
  ├─ Satori (JSX → SVG)
  ├─ @resvg/resvg-js (SVG → PNG)
  └─ Supabase (database + auth)

Database:
  ├─ PostgreSQL (via Supabase)
  ├─ Row Level Security (RLS)
  └─ RPC Functions (increment_session_share_count)

Analytics:
  ├─ Google Analytics 4 (GA4)
  └─ Custom events tracking

Deployment:
  ├─ Vercel (hosting + CDN)
  ├─ Edge Network (caching)
  └─ Serverless Functions (API routes)

Fonts:
  ├─ Noto Sans (primary)
  ├─ Roboto, Open Sans, Montserrat, Inter
  └─ TTF format (7 fonts) + WOFF2 (2 fonts)

Testing:
  ├─ Jest (unit tests)
  ├─ React Testing Library (component tests)
  ├─ Playwright (E2E tests)
  └─ Visual regression (screenshot comparison)
```

---

## Future Architecture Improvements

### Phase 1: Performance Optimization (Month 1)
```
┌──────────────────────────────────────────────────────────┐
│ Async Job Queue                                          │
│ ├─ Move image generation to background (Inngest/BullMQ) │
│ ├─ Pre-generate popular variants on session creation    │
│ ├─ Store in object storage (S3/R2)                      │
│ └─ Return pre-signed URLs immediately                   │
└──────────────────────────────────────────────────────────┘
```

### Phase 2: Advanced Analytics (Month 2)
```
┌──────────────────────────────────────────────────────────┐
│ Variant Performance Dashboard                            │
│ ├─ A/B testing framework                                │
│ ├─ Share rate by variant (which performs best?)         │
│ ├─ Conversion funnel (view → click → share → sign-up)   │
│ └─ User segmentation (variant preferences by user type) │
└──────────────────────────────────────────────────────────┘
```

### Phase 3: Customization (Quarter 1)
```
┌──────────────────────────────────────────────────────────┐
│ Custom Variant Builder                                   │
│ ├─ User-uploaded background images                      │
│ ├─ Color customization (brand colors)                   │
│ ├─ Font selection (from preset list)                    │
│ └─ Save custom variants to user profile                 │
└──────────────────────────────────────────────────────────┘
```

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Maintained By**: Engineering Team
