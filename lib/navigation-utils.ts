import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { buildBeachUrl, buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";
import type { BeachLocation } from "@/types/beach-core";

/**
 * Beach navigation & routing utilities.
 *
 * Generates URLs and provides router helpers for beach pages (tabs, city/state slugs, etc.).
 * For query parameter preservation during navigation, see `lib/utils/navigation-utils.ts`.
 */
export const beachNavigation = {
  /**
   * Generate URL for beach detail page
   * @param beach - Beach object with slug, city, and state
   */
  toBeachDetail: (beach: BeachLocation): string => buildBeachUrl(beach),

  /**
   * Generate URL for beach detail page with specific tab
   * @param beach - Beach object with slug, city, and state
   * @param tab - Tab name (e.g., "reviews", "info", "gallery")
   */
  toBeachDetailWithTab: (beach: BeachLocation, tab: string): string =>
    buildBeachUrlWithTab(beach, tab),

  /**
   * Generate URL for beach reviews tab
   * @param beach - Beach object with slug, city, and state
   */
  toBeachReviews: (beach: BeachLocation): string =>
    buildBeachUrlWithTab(beach, "reviews"),

  /**
   * Generate URL for beach info tab
   * @param beach - Beach object with slug, city, and state
   */
  toBeachInfo: (beach: BeachLocation): string =>
    buildBeachUrlWithTab(beach, "info"),

  /**
   * Generate URL for beach gallery tab
   * @param beach - Beach object with slug, city, and state
   */
  toBeachGallery: (beach: BeachLocation): string =>
    buildBeachUrlWithTab(beach, "gallery"),

  /**
   * Navigate to beach detail page
   * @param router - Next.js router instance
   * @param beach - Beach object with slug, city, and state
   */
  navigateToBeach: (router: AppRouterInstance, beach: BeachLocation): void => {
    router.push(beachNavigation.toBeachDetail(beach));
  },

  /**
   * Navigate to beach detail page with specific tab
   * @param router - Next.js router instance
   * @param beach - Beach object with slug, city, and state
   * @param tab - Tab name
   */
  navigateToBeachWithTab: (
    router: AppRouterInstance,
    beach: BeachLocation,
    tab: string
  ): void => {
    router.push(beachNavigation.toBeachDetailWithTab(beach, tab));
  },

  /**
   * Navigate to beach reviews tab
   * @param router - Next.js router instance
   * @param beach - Beach object with slug, city, and state
   */
  navigateToBeachReviews: (
    router: AppRouterInstance,
    beach: BeachLocation
  ): void => {
    router.push(beachNavigation.toBeachReviews(beach));
  },

  /**
   * Navigate to beach info tab
   * @param router - Next.js router instance
   * @param beach - Beach object with slug, city, and state
   */
  navigateToBeachInfo: (
    router: AppRouterInstance,
    beach: BeachLocation
  ): void => {
    router.push(beachNavigation.toBeachInfo(beach));
  },

  /**
   * Navigate to beach gallery tab
   * @param router - Next.js router instance
   * @param beach - Beach object with slug, city, and state
   */
  navigateToBeachGallery: (
    router: AppRouterInstance,
    beach: BeachLocation
  ): void => {
    router.push(beachNavigation.toBeachGallery(beach));
  },
} as const;

/**
 * General app navigation utilities
 */
export const appNavigation = {
  /**
   * Navigate to map page
   */
  toMap: (): string => "/map",

  /**
   * Navigate to home page
   */
  toHome: (): string => "/",

  /**
   * Navigate to profile page
   */
  toProfile: (): string => "/profile",

  /**
   * Navigate to sessions page
   */
  toSessions: (): string => "/sessions",

  /**
   * Navigate to log session page
   */
  toLogSession: (): string => "/sessions/new?mode=log",

  /**
   * Navigate to plan session page
   */
  toPlanSession: (): string => "/sessions/new?mode=plan",

  /**
   * Navigate to map page
   */
  navigateToMap: (router: AppRouterInstance): void => {
    router.push(appNavigation.toMap());
  },

  /**
   * Navigate to home page
   */
  navigateToHome: (router: AppRouterInstance): void => {
    router.push(appNavigation.toHome());
  },

  /**
   * Navigate to profile page
   */
  navigateToProfile: (router: AppRouterInstance): void => {
    router.push(appNavigation.toProfile());
  },

  /**
   * Navigate to sessions page
   */
  navigateToSessions: (router: AppRouterInstance): void => {
    router.push(appNavigation.toSessions());
  },

  /**
   * Navigate to log session page
   */
  navigateToLogSession: (router: AppRouterInstance): void => {
    router.push(appNavigation.toLogSession());
  },

  /**
   * Navigate to plan session page
   */
  navigateToPlanSession: (router: AppRouterInstance): void => {
    router.push(appNavigation.toPlanSession());
  },
} as const;
