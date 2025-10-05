## [2025.10.05] - Daily Morning Surf Intel Automation

### Added

- **Morning Intel Bot**: Automated daily surf reports for Ocean Beach, San Diego

  - Posts every morning at 6:00 AM America/Los_Angeles timezone
  - Comprehensive surf analysis including:
    - Wave height range with size descriptions (flat to triple overhead+)
    - Tide height, direction (rising/falling), and next high/low predictions
    - Primary and secondary swell components with period, height, and direction
    - Wind speed, direction, and offshore/onshore analysis relative to beach orientation
    - Best surf window recommendations based on tide, wind, and swell quality
    - Confidence scoring based on forecast data completeness
  - **User Setup**: Dedicated bot user (`morning.intel@quiversurf.app`) with `is_mock = true` flag
  - **Idempotent**: Updates existing post if already posted today (no duplicates)
  - **Graceful Degradation**: Handles missing forecast data fields with "N/A" placeholders
  - **GitHub Actions Workflow**: `.github/workflows/morning-intel.yml` with DST-aware scheduling
  - **Manual Trigger**: Supports workflow_dispatch for testing and manual runs
  - **Comprehensive Testing**: 12 unit tests covering all utility functions and edge cases
  - **Documentation**: Complete setup guide in `docs/MORNING_INTEL_SETUP.md`

- **Morning Intel Utilities** (`lib/utils/morning-intel-utils.ts`):

  - `deriveSurfRange()`: Wave height analysis with human-readable descriptions
  - `tideAt()`: Tide height and direction at specific times
  - `primarySecondarySwell()`: Swell component extraction and ranking
  - `windAt()`: Wind condition analysis with offshore/onshore calculations
  - `bestWindowHeuristic()`: Smart surf window recommendations
  - `confidenceHeuristic()`: Data completeness scoring (Low/Medium/High)
  - `renderIntelMarkdown()`: Formatted intel post generation

- **Type Safety**: Complete TypeScript types in `types/morning-intel.ts`

  - `MorningIntelData`: Complete intel post structure
  - `ForecastSlice`: Forecast data windowing
  - `MorningIntelConfig`: Environment configuration
  - Typed metrics for surf, tide, swell, and wind conditions

- **Setup Scripts**:

  - `scripts/create-morning-intel-bot.sql`: Database user creation
  - `scripts/morningIntel.ts`: Core execution logic (280+ lines)
  - npm script: `npm run morning-intel` for local testing

- **Environment Configuration**:
  - `.env.example` with morning intel variables
  - GitHub Secrets documentation for Actions setup
  - Feature flag: `MORNING_INTEL_ENABLED` for easy disable

### Changed

- **package.json**: Added `morning-intel` script for local execution
- **Architecture**: Uses existing `intel_posts` table with `conditions` tag
- **Expiry**: Intel posts expire after 24 hours (end of day)

### Performance

- **Efficient Queries**: Fetches only 04:00-12:00 forecast window for analysis
- **Cached Beach Lookup**: Reuses beach_id when provided via env
- **Idempotent Operations**: Single database write per day (update vs. insert)

---

## [2025.10.05] - Enhanced Mock Data Variety & Beach-Specific Content

### Changed

- **Mock Data Seeding Improvements**: Significantly enhanced variety and beach-specific content generation
  - **Expanded Content Templates**: Increased content variations by 3-5x across all post types (conditions, parking, crowd, hazards, access)
  - **Writing Style Phrases**: Expanded personality-based phrases from 4-5 to 11-12 variations per personality type
  - **Condition Descriptions**:
    - Rookie: 8 variations (up from 3)
    - Local: 9 variations (up from 3)
    - Traveler: 8 variations (up from 3)
    - Photographer: 7 variations (up from 3)
    - Tactical: 6 variations (up from 3)
    - Competitor: 7 variations (up from 3)
  - **Parking Descriptions**: 6-7 variations per personality (up from 3)
  - **Crowd Descriptions**: 6-7 variations per personality (up from 3)
  - **Hazard Descriptions**: 6-7 variations per personality (up from 3)
  - **Beach-Specific References**: All content now includes actual beach names and contextual details
  - **Posts Per Beach**: Increased from 1-3 to 2-5 intel posts per beach for better distribution
  - **Reviews Per Beach**: Increased from 1-3 to 2-4 reviews per beach
  - **Temporal Range**: Extended intel posts from 10 to 14 days, reviews from 21 to 30 days
  - **Dynamic Phrase Selection**: Randomized phrase selection within personality styles prevents repetition
  - **Beach Characteristics Detection**: Added function to detect break types (reef, beach, point, pier, jetty, mixed) for future contextual content

### Fixed

- **Repetitive Content**: Eliminated duplicate posts appearing across multiple beaches
- **Generic Templates**: Replaced generic post templates with beach-specific, varied content
- **Limited Variety**: Mock data now generates unique combinations preventing same-beach repetition

## [2025.10.05] - Production Service Worker with Workbox

### Added

- **Production-Grade Service Worker**: Implemented `next-pwa` with Workbox for enhanced PWA capabilities
  - Auto-generated service worker with intelligent caching strategies
  - NetworkFirst strategy for forecast/beach/buoy APIs (3s timeout, respects anti-stale-data policy)
  - StaleWhileRevalidate for images (7-day cache)
  - CacheFirst for static assets (1-year cache with immutability)
  - Production-only (disabled in development for fast hot reload)
  - Automated service worker registration and updates
  - Installed packages: `next-pwa@5.6.0`, `workbox-window@7.3.0`

### Changed

- **Service Worker Architecture**: Migrated from manual service worker to Workbox-based auto-generation
  - `public/sw.js` now auto-generated in production builds (removed from git, added to `.gitignore`)
  - Previous manual service worker (87 lines) replaced by Workbox runtime caching configuration
  - Enhanced caching covers more API endpoints (forecasts, beaches, buoys) with appropriate TTLs
  - Forecast API cache: 30-minute TTL (down from 6 hours) for fresher data
  - Service worker registration unchanged in `pwa-and-push-listeners.tsx`

### Performance

- **Offline Functionality**: Enhanced offline experience with multi-tier caching
  - API responses cached with NetworkFirst (fresh data priority, offline fallback)
  - Images served instantly from cache while updating in background
  - Static assets served from cache for instant page loads
  - Intelligent cache expiration prevents stale data while improving performance

## [2025.10.05] - iOS PWA Support

### Added

- **iOS PWA Installation Support**: Full iOS Progressive Web App support for native app-like experience
  - Generated Apple Touch Icons in all required sizes (180x180, 167x167, 152x152, 120x120)
  - Added `apple-touch-icon` link tags in `app/layout.tsx` for iOS home screen installation
  - Added iOS-specific meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`
  - Created `scripts/generate-apple-icons.mjs` for automated icon generation from existing 512x512 source
  - Updated `lib/constants/seo.ts` with iOS PWA meta configuration
  - iOS users can now "Add to Home Screen" with proper app icon and standalone mode

### Changed

- **PWA Meta Tags**: Enhanced iOS PWA configuration in SEO constants
  - Changed status bar style to `black-translucent` for better iOS integration
  - Added explicit `apple-mobile-web-app-capable` meta tag (separate from generic `mobile-web-app-capable`)
  - Set app title to "Quiver" for iOS home screen display

### Performance

- **Icon Generation**: Automated Apple touch icon creation using Sharp for consistent branding
  - All icons generated from single source (512x512) ensuring consistency
  - White background applied for proper iOS home screen appearance

## [2025.10.03] - Auth User Cleanup Tools

### Added

- **Auth User Cleanup Scripts**: Created comprehensive tooling for safely cleaning up unused/unconfirmed auth users
  - `scripts/cleanup-auth-users.sql`: SQL query to review candidate users for deletion (never signed in or unconfirmed)
    - Includes export queries with two formats: space-separated for bash and one-per-line for review
    - Summary stats query to show counts before deletion
  - `scripts/delete-auth-users.sh`: Bash script for bulk deletion via Supabase Admin REST API
  - `scripts/delete-auth-users-from-file.sh`: File-based deletion script (avoids command line length limits)
  - `scripts/delete-auth-users.mjs`: Node.js alternative for deletion with better error handling
  - `scripts/delete-auth-users.sql`: **Direct SQL deletion script** (bypasses app.allow_destructive blocks)
  - All bash scripts include dry-run mode, confirmation prompts, detailed logging, and HTTP status validation
  - Updated `scripts/README.md` with comprehensive usage guide, safety features, and troubleshooting

### Fixed

- **Admin REST API Blocked**: Discovered Supabase database-level safety feature blocks Admin REST API deletions
  - Error: "DELETE blocked on users. Set app.allow_destructive=on inside a transaction"
  - Created SQL-based deletion approach that sets `app.allow_destructive=on` in transaction
  - Documented workaround in troubleshooting section
  - SQL script includes verification query to confirm successful deletions

### Safety Features

- Dry run mode to preview deletions without executing (bash/node scripts)
- Confirmation prompts requiring explicit "yes" to proceed
- Optional age filters (e.g., only delete accounts older than 30 days)
- Detailed success/failure logging for each deletion attempt
- HTTP status code validation (200/204 = success)
- Environment variable requirements (no hardcoded secrets)
- Transaction-based SQL deletion with rollback capability
