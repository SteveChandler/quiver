# Quiver MVP Product Requirements Document

> **Personal surf forecaster and session log**

**Last Updated**: December 9, 2025  
**Status**: Production MVP  
**Document Type**: Product Definition

---

## Executive Summary

Quiver is a **personal surf forecaster and session log** designed to help surfers make better decisions about when and where to surf. The platform combines multi-source surf forecasting with session logging, social sharing, and community intelligence to create a comprehensive surf companion.

### Vision

Be the surfer's trusted digital companion - helping them find optimal conditions, track their progression, and connect with the surf community.

### Target Users

Recreational and avid surfers who want data-driven surf decisions without the complexity of professional tools.

### Core Value Proposition

Personalized surf recommendations that match your skill level, preferences, and local spots - combined with a simple way to log sessions, capture memories, and share with friends.

### Key Differentiators

1. **Personalized Forecasting** - Not just raw data, but recommendations tailored to your skill and preferences
2. **Session Memory** - Beautiful photo journals that capture your surf progression
3. **Community Intelligence** - Real-time local intel from surfers on the ground
4. **Shareable Moments** - Turn any session into social-ready content

---

## Core Features List

### 1. Personalized Surf Forecasting

**The foundation of Quiver - intelligent forecasts tailored to each surfer.**

| Feature                         | Description                                              | MVP Scope                                      |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| **Multi-Source Forecasts**      | Aggregates NOAA, CDIP buoys, and NWS weather data        | 12-day forecasts with 3-hour intervals         |
| **Personalized Scoring**        | Matches conditions to user's skill level and preferences | 0-100 scoring with breakdown by wave/wind/tide |
| **Best Window Recommendations** | Identifies optimal surf windows                          | Highlights "Best Time to Surf" on home screen  |
| **Confidence Indicators**       | Shows forecast reliability                               | Confidence badges on each forecast             |
| **Home Beach Forecast**         | Quick access to user's favorite spot                     | Personalized home screen tile                  |

**Key Data Points:**

- Wave height, period, direction (primary + secondary swell)
- Wind speed and direction
- Tide status and predictions
- Water/air temperature
- Weather conditions

**User Story:**

> As a surfer, I want to see a personalized forecast for my home beach that tells me if conditions match my skill level, so I can decide whether to paddle out.

---

### 2. Session Logging (Surf Journal)

**Track every session to understand your progression.**

| Feature                 | Description                                 | MVP Scope                                        |
| ----------------------- | ------------------------------------------- | ------------------------------------------------ |
| **Session Wizard**      | Guided multi-step session entry             | Beach, date/time, duration, conditions, rating   |
| **Photo Upload**        | Capture session memories                    | Up to 5 photos per session, 100MB user quota     |
| **Condition Recording** | Log actual vs forecasted conditions         | Wave size, crowd level, wind, overall rating     |
| **Board Tracking**      | Track which boards work in which conditions | Select from quiver, see session counts per board |
| **Forecast Comparison** | Compare what was predicted vs actual        | Show forecast accuracy for logged sessions       |

**Session Data Captured:**

- Beach location
- Date and time window
- Duration (minutes)
- Wave count (optional)
- Conditions (crowd, wind, waves)
- 1-5 star rating
- Notes/reflections
- Photos

**User Story:**

> As a surfer, I want to log my session with photos and conditions so I can track my progression over time and remember great sessions.

---

### 3. Beach Discovery

**Find and explore surf spots with AllTrails-inspired browsing.**

| Feature                   | Description                         | MVP Scope                                  |
| ------------------------- | ----------------------------------- | ------------------------------------------ |
| **Interactive Map**       | Visual discovery with beach markers | Full-screen map with condition overlays    |
| **Location Pages**        | City/region browse pages            | 13+ viable locations (3+ beaches each)     |
| **Beach Details**         | Comprehensive spot information      | Photos, stats, amenities, hazards, reviews |
| **Search & Autocomplete** | Quick beach lookup                  | Real-time search with suggestions          |
| **Ranking System**        | Composite scoring for beaches       | Rating, reviews, intel, quality weights    |

**Beach Information Includes:**

- Break type (beach, point, reef)
- Skill level recommendation
- Best swell/wind/tide conditions
- Amenities (parking, restrooms, showers)
- Hazards and warnings
- User reviews and ratings
- Recent community intel

**User Story:**

> As a surfer visiting a new area, I want to browse beaches by location and see which ones match my skill level, so I can find a good spot to surf.

---

### 4. Community Intelligence (Local Intel)

**Crowdsourced real-time information from local surfers.**

| Feature                 | Description                      | MVP Scope                               |
| ----------------------- | -------------------------------- | --------------------------------------- |
| **Intel Posts**         | User-submitted condition reports | Conditions, parking, crowd, access tags |
| **Confirmation System** | Community validation of posts    | Upvote accurate intel                   |
| **Location-Based**      | GPS-tagged reports               | Shows reports near each beach           |
| **Recency Weighting**   | Fresh intel ranks higher         | Last 7 days emphasized                  |

**Intel Categories:**

- **Conditions** - Wave quality, wind, water temp observations
- **Crowd** - How packed is the lineup?
- **Parking** - Lot availability, street parking status
- **Access** - Trail conditions, closures, hazards

**User Story:**

> As a surfer, I want to see recent reports from locals about parking and crowd levels, so I can plan my session timing better.

---

### 5. Social Sharing

**Turn sessions into shareable content for social media.**

| Feature                   | Description                | MVP Scope                                                              |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| **Share Cards**           | Beautiful session graphics | 6 design variants (Photo, Minimal, Stats, Wave, Conditions, Equipment) |
| **Aspect Ratios**         | Platform-optimized sizes   | 1:1 (Instagram), 9:16 (Stories), 16:9 (Twitter)                        |
| **Server-Side Rendering** | Consistent quality         | Satori + Resvg image generation                                        |
| **One-Click Share**       | Native sharing integration | Web Share API                                                          |

**User Story:**

> As a surfer, I want to create a beautiful share card from my session that I can post to Instagram, so my friends can see where I surfed.

---

### 6. Gamification & Progression

**Reward engagement and track surf journey.**

| Feature             | Description              | MVP Scope                                               |
| ------------------- | ------------------------ | ------------------------------------------------------- |
| **XP System**       | Earn points for actions  | 13 XP-earning actions defined                           |
| **Levels**          | Progress through 9 tiers | Kook → Quiver King/Queen                                |
| **Badges**          | Achievement unlocks      | 23 badges across 3 categories (Global, Journal, Quiver) |
| **Profile Display** | Show progression         | XP card, badge gallery on profile                       |

**XP Actions:**

| Action               | XP  |
| -------------------- | --- |
| Log session          | 50  |
| Post beach intel     | 50  |
| Invite friend        | 100 |
| Add board            | 30  |
| Tag board to session | 20  |
| Upload photos        | 15  |
| Write reflection     | 25  |
| Get like/upvote      | 10  |

**User Story:**

> As a surfer, I want to earn XP and unlock badges for my surf activities, so I feel motivated to log sessions and contribute to the community.

---

### 7. User Profile & Preferences

**Personalization that improves recommendations.**

| Feature               | Description                  | MVP Scope                                            |
| --------------------- | ---------------------------- | ---------------------------------------------------- |
| **Surf Preferences**  | Define your ideal conditions | Skill level, wave size, break type, crowd preference |
| **Home Beach**        | Set primary spot             | Quick access on home screen                          |
| **Quiver Management** | Track your boards            | Add boards, assign to sessions                       |
| **Onboarding Flow**   | Guided setup for new users   | 6-step wizard                                        |

**Preference Options:**

- **Experience Level**: Beginner, Intermediate, Advanced, Expert
- **Preferred Wave Size**: Small, Medium, Large, Any
- **Preferred Break Type**: Beach, Point, Reef, Any
- **Crowd Preference**: Social, Moderate, Solitude

**User Story:**

> As a new user, I want to set my skill level and preferences during onboarding, so the app gives me personalized recommendations from the start.

---

### 8. Referral & Attribution

**Growth mechanics for user acquisition.**

| Feature               | Description                 | MVP Scope                                   |
| --------------------- | --------------------------- | ------------------------------------------- |
| **Referral Codes**    | Unique 6-character codes    | Auto-generated per user                     |
| **Referral Tracking** | Track who invited whom      | Stats dashboard (total, pending, completed) |
| **UTM Attribution**   | Marketing campaign tracking | First-touch model, 90-day cookies           |

**Referral Flow:**

1. Existing user shares their referral code (e.g., "K9M2QZ")
2. New user enters code during onboarding
3. System validates and creates referral record
4. Both users tracked for reward eligibility

**User Story:**

> As a surfer, I want to share my referral code with friends so I can invite them to Quiver and track how many people I've referred.

---

## Success Metrics

### Primary Metrics (North Stars)

| Metric                    | Definition                                         | Target                  |
| ------------------------- | -------------------------------------------------- | ----------------------- |
| **Weekly Active Surfers** | Users who log in AND check forecast OR log session | 40% of registered users |
| **Session Logging Rate**  | Sessions logged per active user per month          | 3+ sessions/month       |
| **Share Rate**            | % of sessions shared to social media               | 15% of sessions         |

### Engagement Metrics

| Metric                    | Definition                                | Target          |
| ------------------------- | ----------------------------------------- | --------------- |
| **Forecast Checks/User**  | Average forecast views per week           | 5+ checks/week  |
| **Intel Posts/Beach**     | Community posts per active beach per week | 2+ posts/week   |
| **Session Photo Rate**    | % of sessions with photos attached        | 40% of sessions |
| **Onboarding Completion** | Users completing all onboarding steps     | 70% completion  |

### Growth Metrics

| Metric                  | Definition                              | Target             |
| ----------------------- | --------------------------------------- | ------------------ |
| **Referral Conversion** | New users from referral codes           | 20% of new signups |
| **Viral Coefficient**   | New users generated per existing user   | 0.3+               |
| **7-Day Retention**     | Users returning within 7 days of signup | 50%                |
| **30-Day Retention**    | Users active 30 days after signup       | 30%                |

### Quality Metrics

| Metric                    | Definition                                  | Target                 |
| ------------------------- | ------------------------------------------- | ---------------------- |
| **Forecast Accuracy**     | User-reported accuracy vs logged conditions | 75% "accurate" ratings |
| **Beach Rating Coverage** | Beaches with 3+ reviews                     | 80% of active beaches  |
| **Page Load Time**        | LCP for key pages                           | Under 2 seconds        |
| **Share Generation Time** | Time to generate share card                 | Under 3 seconds        |

---

## Out of Scope for MVP

The following are explicitly **not** included in the MVP:

### Monetization

- Premium subscription tiers
- Paid features or content
- Advertising

### Advanced Features

- Video upload to sessions
- Real-time chat/messaging
- AI surf coaching beyond scoring
- Wetsuit/gear recommendations
- Session buddy matching algorithm

### Platform Expansion

- Native iOS/Android apps (web-first, PWA only)
- Surf school/instructor integration
- Competition/contest features
- E-commerce/board marketplace

---

## Geographic Coverage (MVP)

### Primary Markets (Full Feature Support)

- **California** - LA to SF coastline
- **Oregon** - Key breaks
- **Washington** - Coastal spots
- **Hawaii** - Major islands
- **Baja California, Mexico** - Northern region

### Beach Count

- **72+ beaches** with complete location data
- **13 viable city pages** (3+ beaches each)
- Full forecast coverage via NOAA/CDIP data sources

---

## Technical Foundation

> _For reference only - see technical documentation for implementation details_

| Layer                | Technology                                     |
| -------------------- | ---------------------------------------------- |
| **Frontend**         | Next.js 14 App Router, React, TypeScript       |
| **Styling**          | Tailwind CSS, shadcn/ui components             |
| **Backend**          | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **Data Sources**     | NOAA NWS, CDIP buoys, CO-OPS tides             |
| **Maps**             | Interactive beach discovery map                |
| **Image Generation** | Satori + Resvg for share cards                 |
| **Hosting**          | Vercel (Edge + Serverless)                     |

---

## Related Documentation

- **[Architecture Overview](/docs/app/ARCHITECTURE.md)** - Technical architecture
- **[Design Principles](/docs/DESIGN_PRINCIPLES.md)** - UX guidelines
- **[Feature Documentation](/docs/features/)** - Individual feature specs
- **[API Reference](/docs/api/)** - API documentation

---

## Document History

| Date       | Author       | Changes                                    |
| ---------- | ------------ | ------------------------------------------ |
| 2025-12-09 | AI Assistant | Initial PRD generated from codebase review |

---

**Built with ❤️ for the surf community** 🏄‍♂️

