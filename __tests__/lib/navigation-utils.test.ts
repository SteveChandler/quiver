import { beachNavigation, appNavigation } from "@/lib/navigation-utils";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Mock router
const mockRouter: AppRouterInstance = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
} as any;

describe("Navigation Utils", () => {
  // Mock beach data for testing
  const mockBeach = {
    slug: "ocean-beach",
    city: "San Diego",
    state: "CA",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("beachNavigation", () => {
    describe("URL generation", () => {
      it("should generate hierarchical beach detail URL", () => {
        const url = beachNavigation.toBeachDetail(mockBeach);
        expect(url).toBe("/ca/san-diego/ocean-beach");
      });

      it("should generate hierarchical beach detail URL with tab", () => {
        const url = beachNavigation.toBeachDetailWithTab(mockBeach, "info");
        expect(url).toBe("/ca/san-diego/ocean-beach?tab=info");
      });

      it("should generate hierarchical beach reviews URL", () => {
        const url = beachNavigation.toBeachReviews(mockBeach);
        expect(url).toBe("/ca/san-diego/ocean-beach?tab=reviews");
      });

      it("should generate hierarchical beach info URL", () => {
        const url = beachNavigation.toBeachInfo(mockBeach);
        expect(url).toBe("/ca/san-diego/ocean-beach?tab=info");
      });

      it("should generate hierarchical beach gallery URL", () => {
        const url = beachNavigation.toBeachGallery(mockBeach);
        expect(url).toBe("/ca/san-diego/ocean-beach?tab=gallery");
      });
    });

    describe("Navigation functions", () => {
      it("should navigate to beach detail with hierarchical URL", () => {
        beachNavigation.navigateToBeach(mockRouter, mockBeach);
        expect(mockRouter.push).toHaveBeenCalledWith("/ca/san-diego/ocean-beach");
      });

      it("should navigate to beach with tab using hierarchical URL", () => {
        beachNavigation.navigateToBeachWithTab(mockRouter, mockBeach, "gallery");
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/ca/san-diego/ocean-beach?tab=gallery"
        );
      });

      it("should navigate to beach reviews using hierarchical URL", () => {
        beachNavigation.navigateToBeachReviews(mockRouter, mockBeach);
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/ca/san-diego/ocean-beach?tab=reviews"
        );
      });

      it("should navigate to beach info using hierarchical URL", () => {
        beachNavigation.navigateToBeachInfo(mockRouter, mockBeach);
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/ca/san-diego/ocean-beach?tab=info"
        );
      });

      it("should navigate to beach gallery using hierarchical URL", () => {
        beachNavigation.navigateToBeachGallery(mockRouter, mockBeach);
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/ca/san-diego/ocean-beach?tab=gallery"
        );
      });
    });

    describe("Edge cases", () => {
      it("should handle cities with spaces", () => {
        const beach = { slug: "pier", city: "Huntington Beach", state: "CA" };
        const url = beachNavigation.toBeachDetail(beach);
        expect(url).toBe("/ca/huntington-beach/pier");
      });

      it("should handle special characters in tab names", () => {
        const url = beachNavigation.toBeachDetailWithTab(mockBeach, "custom-tab");
        expect(url).toBe("/ca/san-diego/ocean-beach?tab=custom-tab");
      });

      it("should fallback to /beach/{slug} when city or state missing", () => {
        const incompleteBeach = { slug: "test-beach", city: null, state: null };
        const url = beachNavigation.toBeachDetail(incompleteBeach);
        expect(url).toBe("/beach/test-beach");
      });

      it("should handle Baja California beaches", () => {
        const bajaBeach = {
          slug: "k38",
          city: "Ensenada",
          state: "Baja California",
        };
        const url = beachNavigation.toBeachDetail(bajaBeach);
        expect(url).toBe("/mexico/baja-california/ensenada/k38");
      });
    });
  });

  describe("appNavigation", () => {
    describe("URL generation", () => {
      it("should generate correct app URLs", () => {
        expect(appNavigation.toMap()).toBe("/map");
        expect(appNavigation.toHome()).toBe("/");
        expect(appNavigation.toProfile()).toBe("/profile");
        expect(appNavigation.toSessions()).toBe("/sessions");
        expect(appNavigation.toLogSession()).toBe("/sessions/new?mode=log");
        expect(appNavigation.toPlanSession()).toBe("/sessions/new?mode=plan");
      });
    });

    describe("Navigation functions", () => {
      it("should navigate to map", () => {
        appNavigation.navigateToMap(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/map");
      });

      it("should navigate to home", () => {
        appNavigation.navigateToHome(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/");
      });

      it("should navigate to profile", () => {
        appNavigation.navigateToProfile(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/profile");
      });

      it("should navigate to sessions", () => {
        appNavigation.navigateToSessions(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/sessions");
      });

      it("should navigate to log session", () => {
        appNavigation.navigateToLogSession(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/sessions/new?mode=log");
      });

      it("should navigate to plan session", () => {
        appNavigation.navigateToPlanSession(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/sessions/new?mode=plan");
      });
    });
  });

  describe("Type safety", () => {
    it("should work with typed router instance", () => {
      // This test ensures our typing is correct
      const typedRouter: AppRouterInstance = mockRouter;
      beachNavigation.navigateToBeach(typedRouter, mockBeach);
      appNavigation.navigateToMap(typedRouter);

      expect(mockRouter.push).toHaveBeenCalledTimes(2);
    });
  });
});
