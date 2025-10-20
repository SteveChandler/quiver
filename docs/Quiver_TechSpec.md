# Quiver Technical Requirements Specification & Information Architecture

## Overview
Quiver is a growth-focused, community surf app inspired by the architecture of AllTrails. It helps users explore surf, paddleboard, and other water-based spots; plan sessions; navigate off-grid; log activities; and share experiences.  
The design must feel oceanic, clean, and trustworthy and use Quiver’s colour system:  

- **Primary:** `#0077B6`  
- **Accent:** `#FF7F11`  
- **Background:** `#F5F5DC`  
- **Text:** `#333333`

The product does not include monetisation features; instead it emphasises scalable community infrastructure and a robust offline experience.

This document contains:
- **Research synthesis:** How AllTrails ingests data, handles user-generated content, search, caching/offline, and social features.  
- **Technical Requirements Specification (TRS):** Infrastructure layers for Quiver (frontend, backend, APIs, data model, caching, security, monitoring, CI/CD).  
- **Information Architecture (IA):** Hierarchical sitemap, screen relationships, and user flows for Quiver’s user interface.  

---

## 1. Research Synthesis: How AllTrails Works

### 1.1 Data Ingestion and Base Maps
- **OpenStreetMap (OSM) Derivatives:** AllTrails builds its base map using OSM way data via the Overpass API, converting to GeoJSON, splitting ways into segments, computing distances, and storing the results in a derived database that satisfies the ODBL licence.  
- **Verified Routes vs OSM Segments:** Hand-curated verified routes form the core trail database, while OSM segments remain unverified. Submissions are moderated and validated using park data and automation tools.  
- **Map Sources and Overlays:** Integrates Mapbox, OpenStreetMap, and custom styles. Overlays include heatmaps, weather layers, geotagged photos, and distance markers.

### 1.2 User-Generated Content and Social Features
- **Large Curated Database:** Over 400k curated trails, ~55M users.  
- **Navigation and Recording:** GPS-based navigation with elevation, weather, and driving directions; recordings earn “Verified Completed” badges.  
- **Profiles and Social Graph:** Users can like, comment, message, and maintain public or private journals.

### 1.3 Search, Tagging, and Geolocation
- **Filters:** Search by city, park, or trail with filters for difficulty, length, elevation gain, and attractions.  
- **Location Awareness:** Defaults to current location; supports synced custom lists and favourites.

### 1.4 Offline, Caching, and API Orchestration
- **Offline Downloads:** Paid users can download map areas or trails (up to 500 per area). Stored locally, available offline.  
- **Mapbox Mechanisms:** Predictive caching and offline regions enable limited or full offline routing.

### 1.5 Social & Gamification Layers
- **Achievements and Badges:** Earned for activity completions.  
- **Community Heatmaps:** Visualise popular routes.

---

## 2. Technical Requirements Specification (Quiver)

### 2.1 System Overview
Cross-platform web/mobile app built on **Next.js 14** (web) and **React Native/Expo** (mobile).  
**Supabase** powers authentication, database, and edge functions.  
Integrates **NOAA**, **CDIP**, and **Open-Meteo** APIs for tide, swell, and weather data.  
Offline-first design ensures usability without connectivity.

### 2.2 Architecture Diagram (Textual)
```
┌──────────────────────────┐
│        Client Apps       │
│ ┌──────────────┐        │   • Next.js web (PWA)
│ │ Browser (PWA)│        │   • React Native / Expo mobile app
│ └──────────────┘        │
│ ┌──────────────┐        │   Offline: IndexedDB/localStorage
│ │ Mobile (iOS, │        │   Caches map tiles & API responses
│ │ Android)     │        │
└────────┬───────────────┘
          │ HTTPS / JWT / RLS
┌─────────▼──────────────────────────────────────────────────────┐
│                 Supabase Backend (PostgreSQL)                 │
│  • Auth: email/password, OAuth (Google/Apple)                │
│  • Tables: users, spots, sessions, reviews, media, etc.      │
│  • Row Level Security (RLS)                                  │
│  • Realtime subscriptions (Postgres CDC)                     │
│  • Edge Functions (Deno): API proxies to NOAA/CDIP/Open-Meteo│
│    + Reverse geocoding + Upload tokens                       │
│  • Storage: photos, videos, session data                     │
└─────────▲──────────────────────────────────────────────────────┘
          │                                    │
          │                                    └───────────────┐
          │                                                    │
          │                               External APIs        │
          │                               • NOAA CO-OPS: tides │
          │                               • CDIP THREDDS: waves│
          │                               • Open-Meteo Marine  │
          │                               • Mapbox/Leaflet     │
          │                               • Reverse geocoding  │
          └────────────────────────────────────────────────────
```

### 2.3 Data Flow and API Interactions
- **User Session:** Auth via Supabase (JWT + RLS).  
- **Spot Discovery:** Map fetches surf spots within bounding box; edge functions retrieve real-time swell/tide/wind data and cache for 10–15 min.  
- **Map Rendering:** Mapbox GL/Leaflet render; offline caching via Mapbox APIs.  
- **Logging Sessions:** GPS path recorded locally, synced when online. Photos/videos uploaded via signed URLs.  
- **Social:** Feeds via Realtime subscriptions; achievements issued via triggers.  
- **Admin:** Moderators manage flagged content via edge functions.

### 2.6 Caching and Offline Strategy
- **Client-Side:** Service workers use IndexedDB/SQLite/MMKV; Mapbox offline regions downloaded for favourites.  
- **Edge Caching:** Supabase edge cache stores API responses.  
- **Offline Sessions:** Locally stored and upserted once online.

### 2.7 Security and Privacy
- RLS restricts data access.  
- JWT stored in secure storage.  
- Media uploads use time-limited signed URLs.  
- Personal data anonymised; profiles optional.

### 2.8 Monitoring and CI/CD
- **Analytics:** PostHog tracks sessions and powers heatmaps.  
- **Errors:** Sentry monitors exceptions.  
- **CI/CD:** GitHub → Vercel → Supabase migrations via CLI.  
- **Cron Jobs:** Supabase Edge Functions update condition data daily.

---

## 3. Information Architecture (Quiver)

### 3.1 Primary Navigation
- **Home / Feed:** Personalised activity feed, forecasts.  
- **Map / Explore:** Search/filter surf spots, offline area support.  
- **Spot Detail:** Forecasts, reviews, media, “Start Session.”  
- **Log Session:** Record track, stats, uploads.  
- **Community:** Trending sessions, leaderboards, heatmap.  
- **Profile:** Sessions, stats, badges, settings.

### 3.2 Sub-Flows
- **Onboarding:** Interests, location, optional Google/Facebook link.  
- **Notifications:** Comments, followers, surf condition alerts.  
- **Settings:** Units, privacy, theme, connected devices, offline management.  
- **Help & Feedback:** Report issues, suggest spots.  
- **Admin Dashboard:** Manage submissions, flags, and bans.

### 3.3 Hierarchical Sitemap
```
Home / Feed
  ├─ Session Card → Session Detail
  ├─ Review Card → Spot Detail
  └─ Forecast Widget → Spot Detail

Map / Explore
  ├─ Search Bar → Search Results
  ├─ Filter Panel
  ├─ Spot Pin → Spot Detail
  └─ Download Area (offline)

Spot Detail
  ├─ Forecast Tab
  ├─ Reviews Tab → Session Detail
  ├─ Media Tab → Media Viewer
  ├─ Start Session
  └─ Favourite Toggle

Log Session
  ├─ Live Map & Stats
  ├─ Pause / Resume
  ├─ Finish → Session Summary
    ├─ Add Review
    ├─ Upload Media
    └─ Share to Feed

Community
  ├─ Trending Sessions → Session Detail
  ├─ Leaderboards
  ├─ Heatmap Overlay
  └─ Find Friends

Profile
  ├─ Sessions → Session Detail
  ├─ Media → Media Viewer
  ├─ Achievements
  ├─ Followers / Following
  ├─ Lists → Spot Collection
  └─ Settings / Edit Profile
```

---

## 4. Conclusion
Quiver adapts AllTrails’ architecture—custom OSM maps, verified routes, advanced search, offline support, and social discovery—to surfing and water sports.  
Built with Supabase + Next.js + Mapbox + NOAA/CDIP/Open-Meteo APIs, it delivers a responsive, reliable, and offline-capable experience with community heatmaps and secure, scalable data handling.

---

### References
1. [OSM Derivative Database – AllTrails Help](https://support.alltrails.com/hc/en-us/articles/360019246411-OSM-derivative-database-derivation-methodology)  
2. [Verified Routes vs OSM Segments – AllTrails Help](https://support.alltrails.com/hc/en-us/articles/4410231246100-Verified-routes-vs-OSM-OpenStreetMap-segments)  
3. [How Does a Trail End Up on AllTrails? – AllTrails Help](https://support.alltrails.com/hc/en-us/articles/30315531476628-How-does-a-trail-end-up-on-AllTrails)  
4. [AllTrails Map Legend](https://support.alltrails.com/hc/en-us/articles/11555324555924-AllTrails-map-legend)  
5. [AllTrails Map Types, Overlays, and Extras](https://support.alltrails.com/hc/en-us/articles/37228180990228-AllTrails-map-types-overlays-and-extras)  
6. [AllTrails App Review – Road Trips & Coffee](https://www.roadtripsandcoffee.com/alltrails-app-review/)  
7. [Download Custom Areas for Offline Use – AllTrails Help](https://support.alltrails.com/hc/en-us/articles/37758009767444-Download-custom-areas-for-offline-use)  
8. [Mapbox Offline Navigation SDK Docs](https://docs.mapbox.com/android/navigation/v2/guides/advanced/offline/)  
9. [NOAA CO-OPS Data Retrieval API](https://api.tidesandcurrents.noaa.gov/api/prod/)  
10. [CDIP Data Access Docs](https://cdip.ucsd.edu/m/documents/data_access.html)  
11. [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api)
