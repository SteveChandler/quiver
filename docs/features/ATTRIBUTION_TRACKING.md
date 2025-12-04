# Attribution Tracking System

> UTM parameter capture, referral tracking, and analytics attribution for Quiver.

## Overview

Quiver implements a comprehensive attribution system that tracks:

- **UTM Parameters** - Marketing campaign tracking via URL parameters
- **Referral Codes** - User-to-user referral program
- **First-Touch Attribution** - Original source that brought a user
- **Landing Page Tracking** - Initial entry point tracking

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Journey                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. User clicks link with UTM params                            │
│      instagram.com → quiversurf.app?utm_source=instagram         │
│                         │                                        │
│   2. Middleware captures │ UTM params                            │
│      Sets cookies (first-touch model)                            │
│                         │                                        │
│   3. User signs up      │                                        │
│      Referral code entered (optional)                            │
│                         │                                        │
│   4. Analytics events   │                                        │
│      Attribution data attached to all events                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## UTM Parameter Tracking

### Supported Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `utm_source` | Traffic source | `instagram`, `google`, `newsletter` |
| `utm_medium` | Marketing medium | `social`, `cpc`, `email`, `referral` |
| `utm_campaign` | Campaign name | `summer-2025`, `launch-promo` |
| `utm_content` | Ad content identifier | `hero-banner`, `sidebar-cta` |
| `utm_term` | Search keywords | `surf-forecast-app` |

### Cookie Storage

**Cookie Naming Convention:** `qvr_` prefix

| Cookie | Purpose | TTL |
|--------|---------|-----|
| `qvr_utm_source` | Traffic source | 90 days |
| `qvr_utm_medium` | Marketing medium | 90 days |
| `qvr_utm_campaign` | Campaign name | 90 days |
| `qvr_utm_content` | Ad content | 90 days |
| `qvr_utm_term` | Keywords | 90 days |
| `qvr_referrer` | Original referrer URL | 90 days |
| `qvr_first_touch_ts` | First visit timestamp | 90 days |
| `qvr_landing_page` | Initial landing URL | 90 days |

### Attribution Model

Quiver uses **first-touch attribution** by default:

- UTM parameters are only saved if not already present
- Once set, attribution cookies persist for 90 days
- Subsequent visits don't override existing attribution

```typescript
// First-touch: only set if not already present
if (overwrite || !existing) {
  setCookie(key, value, days);
}
```

## Implementation

### Client-Side Functions

**Location:** `lib/attribution.ts`

```typescript
import {
  parseUTMParams,
  hasUTMParams,
  getAttributionFromCookies,
  saveAttributionToCookies,
  getAttributionForAnalytics
} from '@/lib/attribution';

// Parse UTM params from URL
const params = parseUTMParams(window.location.search);
// { utm_source: "instagram", utm_medium: "social", ... }

// Check if URL has UTM params
if (hasUTMParams(window.location.href)) {
  saveAttributionToCookies(params);
}

// Get all attribution for analytics event
const attribution = getAttributionForAnalytics({ prefix: 'attr_' });
// { attr_utm_source: "instagram", attr_utm_medium: "social", ... }
```

### Server-Side Functions (Middleware)

```typescript
import {
  parseAttributionFromRequestCookies,
  generateAttributionCookieHeaders
} from '@/lib/attribution';

// In middleware.ts
const existingAttribution = parseAttributionFromRequestCookies(
  request.headers.get('cookie')
);

// Generate Set-Cookie headers for new attribution
const cookieHeaders = generateAttributionCookieHeaders(
  newUTMParams,
  existingAttribution
);
```

### Analytics Integration

Attribution data is automatically attached to analytics events:

```typescript
// In analytics.ts
trackEvent('session_logged', {
  session_id: sessionId,
  beach_id: beachId,
  // Attribution automatically included
  ...getAttributionForAnalytics()
});
```

## Referral System

### Database Schema

**Table:** `public.referrals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `referrer_id` | UUID | User who shared the code |
| `referee_id` | UUID | User who signed up |
| `referral_code` | TEXT | The code entered |
| `status` | TEXT | `pending` / `completed` / `expired` |
| `completed_at` | TIMESTAMPTZ | When referral was completed |
| `created_at` | TIMESTAMPTZ | Record creation time |

**Profile Column:** `profiles.referral_code`

- 6-character alphanumeric code (uppercase)
- Case-insensitive uniqueness
- Generated on first access

### Referral Code Generation

```sql
-- Function: public.generate_referral_code()
-- Returns: 6-character alphanumeric code (e.g., "A3B7X9")

SELECT public.generate_referral_code();
-- Result: "K9M2QZ"
```

### Referral Stats

```sql
-- Function: public.get_user_referral_stats(user_id UUID)
SELECT * FROM public.get_user_referral_stats('user-uuid');

-- Returns:
-- total_referrals | completed_referrals | pending_referrals | expired_referrals | referral_code
-- 5               | 3                   | 2                 | 0                 | "K9M2QZ"
```

### Referral Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Existing   │     │   New User   │     │   Backend    │
│    User      │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Share code         │                    │
       │ "K9M2QZ"           │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Enter code during  │
       │                    │ onboarding         │
       │                    │───────────────────>│
       │                    │                    │
       │                    │            Validate code
       │                    │            Create referral record
       │                    │            status = 'pending'
       │                    │                    │
       │                    │<───────────────────│
       │                    │ Success            │
       │                    │                    │
       │                    │ Complete onboarding│
       │                    │───────────────────>│
       │                    │                    │
       │                    │            Update referral
       │                    │            status = 'completed'
       │                    │                    │
```

### RLS Policies

```sql
-- Users can view referrals where they are the referrer
CREATE POLICY "Users can view own referrals as referrer"
    ON public.referrals FOR SELECT
    USING (auth.uid() = referrer_id);

-- Users can view referrals where they are the referee
CREATE POLICY "Users can view own referrals as referee"
    ON public.referrals FOR SELECT
    USING (auth.uid() = referee_id);

-- Users can create referrals for themselves
CREATE POLICY "Users can create referrals for themselves"
    ON public.referrals FOR INSERT
    WITH CHECK (auth.uid() = referee_id);
```

## API Endpoints

### Validate Referral Code

**Endpoint:** `POST /api/referrals/validate`

```typescript
// Request
{ "code": "K9M2QZ" }

// Response (success)
{
  "valid": true,
  "referrer_name": "John D."
}

// Response (invalid)
{
  "valid": false,
  "error": "Invalid referral code"
}
```

## Testing Attribution

### Manual Testing

1. **UTM Parameters:**
   ```
   http://localhost:3000?utm_source=test&utm_medium=manual&utm_campaign=debug
   ```

2. **Check Cookies:**
   ```javascript
   // In browser console
   document.cookie.split(';').filter(c => c.includes('qvr_'))
   ```

3. **Referral Flow:**
   - Sign up as User A, get referral code
   - Sign up as User B, enter User A's code
   - Verify referral record created

### E2E Tests

**Location:** `e2e/utils/referral-helpers.ts`

```typescript
import { validateReferralCode } from '@/e2e/utils/referral-helpers';

// Test referral validation
const result = await validateReferralCode(page, 'K9M2QZ');
expect(result.valid).toBe(true);
```

## Analytics Events

| Event | Trigger | Attribution Data |
|-------|---------|------------------|
| `signup_started` | User begins signup | All UTM params |
| `signup_completed` | User completes signup | All UTM + referral code |
| `referral_entered` | User enters referral code | Code, referrer ID |
| `session_logged` | User logs a session | All UTM params |
| `first_session` | User's first session | All UTM + referral |

## Debugging

### Check Attribution State

```typescript
import { getAttributionFromCookies } from '@/lib/attribution';

const attribution = getAttributionFromCookies();
console.log('Current attribution:', attribution);
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| UTM params not saved | Cookies blocked | Check SameSite settings |
| Attribution overwritten | `overwrite: true` passed | Use default first-touch |
| Referral code invalid | Case mismatch | Codes are case-insensitive |
| Missing attribution | 90-day expiry | Cookies expired |

## Related Documentation

- [Analytics Architecture](/docs/architecture/ANALYTICS.md)
- [Onboarding Flow](/docs/features/ONBOARDING.md)
- [RPC Functions](/docs/api/RPC_FUNCTIONS.md) - `get_user_referral_stats()`
- [Referrals Migration](/supabase/migrations/20251104120000_create_referrals_infrastructure.sql)

---

**Last Updated:** December 2025
