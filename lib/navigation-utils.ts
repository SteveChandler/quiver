import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Beach navigation utilities to centralize routing logic
 */
export const beachNavigation = {
  /**
   * Generate URL for beach detail page
   */
  toBeachDetail: (beachId: string): string => `/beach/${beachId}`,

  /**
   * Generate URL for beach detail page with specific tab
   */
  toBeachDetailWithTab: (beachId: string, tab: string): string =>
    `/beach/${beachId}?tab=${tab}`,

  /**
   * Generate URL for beach reviews tab
   */
  toBeachReviews: (beachId: string): string => `/beach/${beachId}?tab=reviews`,

  /**
   * Generate URL for beach info tab
   */
  toBeachInfo: (beachId: string): string => `/beach/${beachId}?tab=info`,

  /**
   * Generate URL for beach gallery tab
   */
  toBeachGallery: (beachId: string): string => `/beach/${beachId}?tab=gallery`,

  /**
   * Navigate to beach detail page
   */
  navigateToBeach: (router: AppRouterInstance, beachId: string): void => {
    router.push(beachNavigation.toBeachDetail(beachId));
  },

  /**
   * Navigate to beach detail page with specific tab
   */
  navigateToBeachWithTab: (
    router: AppRouterInstance,
    beachId: string,
    tab: string
  ): void => {
    router.push(beachNavigation.toBeachDetailWithTab(beachId, tab));
  },

  /**
   * Navigate to beach reviews tab
   */
  navigateToBeachReviews: (
    router: AppRouterInstance,
    beachId: string
  ): void => {
    router.push(beachNavigation.toBeachReviews(beachId));
  },

  /**
   * Navigate to beach info tab
   */
  navigateToBeachInfo: (router: AppRouterInstance, beachId: string): void => {
    router.push(beachNavigation.toBeachInfo(beachId));
  },

  /**
   * Navigate to beach gallery tab
   */
  navigateToBeachGallery: (
    router: AppRouterInstance,
    beachId: string
  ): void => {
    router.push(beachNavigation.toBeachGallery(beachId));
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
