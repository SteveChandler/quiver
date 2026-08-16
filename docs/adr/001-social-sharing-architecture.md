# ADR 001: Social Sharing Architecture (Native-First)

**Date**: December 22, 2025
**Status**: Historical (superseded for the current web app)
**Deciders**: Engineering Team
**Context**: Migration from Server-Side Rendering (SSR) to a Native-First sharing approach for Capacitor compatibility and reduced maintenance.

> **Retirement note (August 7, 2026):** Capacitor is not a dependency of the current web app. The Capacitor-specific decision and implementation references below are retained only as historical context; current web sharing uses the Web Share API and existing web share routes.

---

## Context and Problem Statement

QuiverSurf requires a robust social sharing system for sessions and forecasts. The previous architecture utilized a Server-Side Rendering (SSR) approach with Satori and Resvg. While performant, this system introduced:
1.  **Maintenance Overhead**: Required managing font files, complex JSX-to-SVG layouts, and specialized API routes.
2.  **Infrastructure Complexity**: Dependency on serverless functions and Redis for rate limiting.
3.  **Capacitor Friction**: Mobile users benefit more from native OS sharing capabilities than static server-generated links.

We need a simpler, more "mobile-first" approach that leverages the user's device and OS.

---

## Decision: Native-First Sharing via Capacitor ✅ **SELECTED**

**Approach**: Use the platform's native share sheet (via `@capacitor/share`) and transition image generation to the client-side.

**Rationale**:
- **Multi-Platform Reach**: Automatically supports any app installed on the user's device (Instagram, X, WhatsApp, Messages, etc.).
- **Reduced Maintenance**: Removed ~1,000 lines of SSR code, font management, and Satori-specific layouts.
- **User Familiarity**: Users are accustomed to their OS-native share dialogs.
- **Privacy**: The app doesn't need to ask for specific social media permissions; the OS handles the handoff.
- **Performance**: Zero server round-trip for image generation once client-side rendering is fully implemented.

**Implementation**:
- **Mobile**: `@capacitor/share` for the system share sheet.
- **Web**: Web Share API (`navigator.share`) for supported browsers.
- **Gallery**: `cordova-plugin-x-socialsharing` for saving to the native photo library.

---

## Deprecated Architecture: Satori + Resvg SSR ❌ **REMOVED**

**Decision**: The previous Satori/Resvg server-rendered share card system was removed in December 2025.

**Reasons for Removal**:
- **CSS Constraints**: Satori's limited CSS support (no Grid) made complex designs difficult to maintain.
- **Redundancy**: Native share sheets provide better value for mobile users with significantly less code.
- **Scalability**: While SSR scaled, client-side generation scales "to infinity" at zero cost per share.

**Clarification (Current Hybrid Web Support)**:
- Lightweight OG image routes still exist for **web share image downloads** and internal previews (e.g. `/api/og/session`, `/api/og/wave`).
- These routes are not intended to restore crawler-driven “dynamic OG previews” for SEO. They exist to support the current `ShareSheet` web flow while client-side generation is implemented for mobile.

---

## Decision: Dual Analytics Tracking

**Approach**: Track shares in both the local database and Google Analytics.

- **Database Tracking** (`session_shares` table): For operational queries and user attribution.
- **Google Analytics**: For aggregate behavioral analysis and funnel tracking.

---

## Consequences

### Positive
- ✅ **Simplified Codebase**: Removed complex SSR dependencies and API routes.
- ✅ **Native Experience**: Better integration with mobile OS features.
- ✅ **Zero Infrastructure Cost**: No server-side rendering or font caching required.
- ✅ **Higher Conversion**: Native share sheets are faster and more reliable than server-redirects.

### Negative
- ⚠️ **No SEO Previews for Images**: Without SSR, we lose the ability to provide dynamic OG images for crawlers (unless we use a hybrid approach or pre-generate).
- ⚠️ **Client-Side Complexity**: Generating high-quality images on-device requires robust canvas/HTML-to-image logic.

---

## Compliance

- **Accessibility**: Native share sheets are highly accessible by default.
- **Privacy**: No social API tokens are stored on the server.
- **Performance**: Instant trigger for sharing; no waiting for server generation.

---

## References

- [Capacitor Share Plugin Documentation](https://capacitorjs.com/docs/apis/share)
- [Quiver Social Sharing Feature Doc](../features/SOCIAL_SHARING.md)
- [Attribution Tracking System](../features/ATTRIBUTION_TRACKING.md)
