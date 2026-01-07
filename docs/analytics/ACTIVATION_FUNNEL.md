# Activation Funnel Definition

**Last Updated**: 2025-01-07
**Owner**: Growth / Product
**Status**: Active

---

## Table of Contents

1. [What is Activation](#what-is-activation)
2. [Funnel Structure](#funnel-structure)
3. [Event Reference](#event-reference)
4. [GA4 Setup Instructions](#ga4-setup-instructions)
5. [Success Metrics](#success-metrics)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Debugging Guide](#debugging-guide)

---

## What is Activation

### Definition

**Activation** measures whether a new user has experienced the core value of Quiver and demonstrated belief in its usefulness. An activated user has:

1. **Seen the value proposition** - Viewed a personalized surf recommendation (`first_win_impression`)
2. **Demonstrated intent to act** - Clicked "Plan Session" OR enabled reminders

### Why This Matters

Activation is distinct from other metrics:

| Metric | What It Measures | Example Event |
|--------|------------------|---------------|
| **Acquisition** | User signed up | `sign_up_verified` |
| **Activation** | User believes the product will help them | `first_win_plan_clicked` OR `first_win_reminder_enabled` |
| **Retention** | User returns and logs sessions | `session_created`, `return_7d` |
| **Revenue** | User converts to paid | `subscription_started` |

Activation is the critical moment where a user goes from "trying out the app" to "believing this will help me surf better."

### The "First Win" Concept

The activation funnel centers on the user's "first win" - the moment they see Quiver's value:

- **What they see**: A personalized recommendation showing the best surf window for them
- **What they do**: Take action (plan a session or enable reminders)
- **What they believe**: "This app knows when I should surf"

---

## Funnel Structure

### Visual Representation

```
                          +------------------------+
                          |  first_win_impression  |
                          |       (100% base)      |
                          +------------------------+
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
     +-----------------------------+   +-----------------------------+
     |  first_win_plan_clicked     |   | first_win_reminder_enabled  |
     |     (Intent Signal A)       |   |     (Intent Signal B)       |
     +-----------------------------+   +-----------------------------+
                    |                                 |
                    +----------------+----------------+
                                     |
                                     v
                          +------------------------+
                          |     ACTIVATED USER     |
                          +------------------------+
```

### Funnel Steps

| Step | Event | Description | Success Criteria |
|------|-------|-------------|------------------|
| 1 | `first_win_impression` | User sees personalized forecast card | Card renders with recommendation |
| 2a | `first_win_plan_clicked` | User clicks "Plan Session" button | Button click captured |
| 2b | `first_win_reminder_enabled` | User enables forecast reminders | Push permission granted + profile updated |

**Activation Formula:**
```
Activation Rate = (first_win_plan_clicked + first_win_reminder_enabled) / first_win_impression * 100
```

Note: Users who do both actions should be deduplicated when calculating the total activated users.

---

## Event Reference

### Core Activation Events

#### first_win_impression

Fires when the personalized forecast recommendation card renders successfully.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of recommended beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |
| `best_window_start` | string (ISO 8601) | Start of optimal surf window | `"2025-01-07T07:00:00Z"` |
| `best_window_end` | string (ISO 8601) | End of optimal surf window | `"2025-01-07T10:00:00Z"` |
| `has_home_beach` | boolean | User has home beach set | `true` |
| `forecast_alerts_enabled` | boolean | User has alerts enabled | `false` |
| `window_timing` | string | Relative timing of window | `"today"` \| `"tomorrow"` \| `"later"` |

**Source File**: `/components/home-screen/personalized-forecast-card.tsx` (lines 377-403)

---

#### first_win_plan_clicked

Fires when user clicks the "Plan Session" button on the recommendation card.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |

**Source File**: `/components/home-screen/personalized-forecast-card.tsx` (lines 541-549)

---

#### first_win_reminder_enabled

Fires when user successfully enables forecast reminders (push permission granted + profile flags set).

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |
| `platform` | string | User platform | `"web"` \| `"native"` |
| `set_home_beach` | boolean | Home beach was set as part of flow | `true` |

**Source Files**:
- `/components/home-screen/forecast-tab.tsx` (lines 191-195)
- `/components/home-screen/personalized-forecast-card.tsx` (lines 441-446, 481-487)

---

### Supporting Events (Non-Funnel)

#### first_win_reminder_declined

Fires when reminder enablement fails or user declines.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |
| `reason` | string | Why it failed | `"push_denied"` \| `"push_error"` \| `"error"` |
| `platform` | string | User platform | `"web"` \| `"native"` |
| `dismissal_reason` | string | User action context | `"permission_denied"` \| `"enable_failed"` \| `"home_beach_declined"` |

---

#### first_win_reminder_retry

Fires when user retries after an error or denied state.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |
| `previous_state` | string | State before retry | `"error"` \| `"denied"` |

---

#### first_win_tomorrow_shown

Fires when the recommendation shows a "tomorrow" framing (best conditions are not today).

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `beach_id` | string | UUID of beach | `"abc-123-def"` |
| `beach_name` | string | Display name of beach | `"Pacific Beach"` |
| `window_timing` | string | When window occurs | `"tomorrow"` \| `"later"` |
| `best_window_start` | string (ISO 8601) | Start of optimal window | `"2025-01-08T07:00:00Z"` |

---

## GA4 Setup Instructions

### Step 1: Verify Events Are Firing

1. Open GA4 > **Configure** > **DebugView**
2. Load Quiver with `?debug_mode=1` parameter
3. Navigate to home screen (must be logged in)
4. Verify `first_win_impression` appears
5. Click "Plan Session" - verify `first_win_plan_clicked` appears
6. (Optional) Enable reminders - verify `first_win_reminder_enabled` appears

### Step 2: Create Funnel Exploration

1. Go to GA4 > **Explore** > **Create new exploration**
2. Select **Funnel exploration** template
3. Configure as follows:

**Technique Settings:**
- Visualization: Standard funnel
- Make open funnel: OFF (we want closed funnel)
- Show elapsed time: ON

**Steps Configuration:**

| Step | Event Name | Description |
|------|------------|-------------|
| 1 | `first_win_impression` | Saw recommendation |
| 2 | `first_win_plan_clicked` OR `first_win_reminder_enabled` | Took action |

**Note on OR Logic**: GA4 explorations don't support OR between events directly. Create two separate funnels:

**Funnel A - Plan Path:**
1. `first_win_impression`
2. `first_win_plan_clicked`

**Funnel B - Reminder Path:**
1. `first_win_impression`
2. `first_win_reminder_enabled`

### Step 3: Add Useful Dimensions

Add these dimensions to the exploration for segmentation:

| Dimension | Purpose |
|-----------|---------|
| `platform` | Compare web vs native activation |
| `device_category` | Mobile vs desktop |
| `operating_system` | iOS vs Android vs Web |
| `first_user_source` | Attribution source |
| `first_user_medium` | Attribution medium |

### Step 4: Save and Share

1. Name: "Activation Funnel - First Win"
2. Save exploration
3. Share with Growth team

---

## Success Metrics

### Target Benchmarks

| Metric | Target | Stretch Goal | Source |
|--------|--------|--------------|--------|
| **Activation Rate (Overall)** | 25% | 40% | Industry benchmark for consumer apps |
| **Plan Click Rate** | 15% | 25% | Primary action path |
| **Reminder Enable Rate** | 10% | 20% | Secondary action path |

### Industry Context

| App Category | Typical Activation Rate | Notes |
|--------------|------------------------|-------|
| Consumer apps (general) | 20-40% | First meaningful action |
| Fitness/Sports apps | 25-35% | Higher intent users |
| Weather/Forecast apps | 30-45% | High utility, low friction |

Quiver's target of 25-40% is realistic given:
- High-intent user base (surfers seeking forecast info)
- Low friction primary action (view recommendation)
- Push notification barrier for secondary action

### Segmentation Goals

| Segment | Target | Notes |
|---------|--------|-------|
| Returning users (7d) | 30%+ | Should be higher than first-time |
| Native app users | 35%+ | Better push UX |
| Web users | 20%+ | Lower due to push friction |
| Users with home beach | 40%+ | Already invested |

---

## Monitoring and Alerts

### Key Metrics to Track Daily

1. **Daily Activation Rate** - Primary health metric
2. **Impression Volume** - Is traffic reaching the card?
3. **Reminder Decline Rate** - Push permission issues?
4. **Plan Click Rate by Platform** - Platform-specific issues?

### Setting Up Alerts

#### In GA4

1. Go to **Admin** > **Custom Definitions** > **Custom Metrics**
2. Create custom metric for activation rate calculation
3. Use **Insights** > **Create custom insight** for automated alerts

#### Alert Thresholds

| Alert | Condition | Action |
|-------|-----------|--------|
| Activation rate drop | Below 15% for 3 days | Investigate UI changes, data issues |
| Zero impressions | No `first_win_impression` for 24h | Check recommendation API, component errors |
| Reminder decline spike | `first_win_reminder_declined` > 50% | Check push infrastructure |
| Tomorrow framing high | `first_win_tomorrow_shown` > 60% | Review forecast data quality |

### Looker Studio Dashboard (Optional)

Create a dashboard with:

1. **Activation Funnel Chart** - Daily trend
2. **Conversion Rate Card** - Current 7-day rolling
3. **Platform Breakdown** - Web vs Native pie chart
4. **Top Decline Reasons** - Bar chart of `reason` values

---

## Debugging Guide

### Common Issues

#### Issue: first_win_impression not firing

**Check:**
1. User must be logged in with a profile
2. Recommendation API must return data
3. Component must successfully render

**Debug Steps:**
```javascript
// In browser console
localStorage.setItem('quiver_debug', 'true');
// Reload page, check for console logs
```

---

#### Issue: Reminder enable fails on web

**Common Causes:**
1. Browser doesn't support push notifications
2. User blocked notifications previously
3. Service worker not registered

**Check:**
```javascript
// In browser console
Notification.permission // Should be "default" or "granted"
navigator.serviceWorker.ready.then(reg => console.log(reg))
```

---

#### Issue: Low activation rate

**Investigation Checklist:**
1. Is recommendation quality good? (check scores)
2. Is "tomorrow" framing too common? (check `window_timing`)
3. Are there UI issues? (check for JS errors)
4. Is push permission getting blocked? (check decline events)

---

### Event Validation Checklist

Use this before launching changes:

- [ ] `first_win_impression` fires once per page load
- [ ] Event includes all required properties
- [ ] Properties have correct data types
- [ ] `first_win_plan_clicked` fires on button click
- [ ] `first_win_reminder_enabled` fires after successful enable
- [ ] Decline events capture appropriate reasons
- [ ] No duplicate events firing
- [ ] Events appear in GA4 DebugView

---

## Related Documentation

- [GTM + GA4 Implementation Plan](/docs/planning/archive/GTM_GA4_IMPLEMENTATION_PLAN.md)
- [Push Notification Architecture](/docs/features/PUSH_NOTIFICATIONS.md)
- [Personalization System](/lib/services/ARCHITECTURE.md)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-07 | Initial documentation created | Documentation Specialist |
