When tile loading temporarily makes the map style unavailable, enabling the swell overlay can miss its mount and remain blank. Retry mounting when map data becomes ready, and remove the retry listener after recovery.

Validation: 62 map component unit tests passed, including deferred mounting without another style.load event. Production build/TypeScript and scoped ESLint passed. The mobile Chromium native-embed E2E passed, verifying overlay removal and recovery across inactive/active transitions before selecting a beach. Screenshot reviewed. No fresh iOS simulator run.

Merge into main to include this fix in production promotion PR #701.
