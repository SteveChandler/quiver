/**
 * Global CSS classes for progressive enhancement and authentication state.
 *
 * These classes coordinate SSR/client rendering and are used across
 * components, providers, and global CSS rules.
 */
export const BODY_CLASSES = {
  /**
   * Applied when JavaScript is loaded (hides SSR fallbacks).
   * Used by: AuthAwareLandingWrapper
   * CSS rule: body.js-loaded .ssr-beach-section { display: none; }
   */
  JS_LOADED: "js-loaded",

  /**
   * Applied when user is authenticated.
   * Managed by: AuthBodyClassManager in providers.tsx
   * CSS rule: body.authenticated .ssr-beach-section { display: none; }
   */
  AUTHENTICATED: "authenticated",
} as const;
