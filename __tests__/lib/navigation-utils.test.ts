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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("beachNavigation", () => {
    describe("URL generation", () => {
      it("should generate beach detail URL", () => {
        const url = beachNavigation.toBeachDetail("test-beach-123");
        expect(url).toBe("/beach/test-beach-123");
      });

      it("should generate beach detail URL with tab", () => {
        const url = beachNavigation.toBeachDetailWithTab(
          "test-beach-123",
          "info"
        );
        expect(url).toBe("/beach/test-beach-123?tab=info");
      });

      it("should generate beach reviews URL", () => {
        const url = beachNavigation.toBeachReviews("test-beach-123");
        expect(url).toBe("/beach/test-beach-123?tab=reviews");
      });

      it("should generate beach info URL", () => {
        const url = beachNavigation.toBeachInfo("test-beach-123");
        expect(url).toBe("/beach/test-beach-123?tab=info");
      });

      it("should generate beach gallery URL", () => {
        const url = beachNavigation.toBeachGallery("test-beach-123");
        expect(url).toBe("/beach/test-beach-123?tab=gallery");
      });
    });

    describe("Navigation functions", () => {
      it("should navigate to beach detail", () => {
        beachNavigation.navigateToBeach(mockRouter, "test-beach-123");
        expect(mockRouter.push).toHaveBeenCalledWith("/beach/test-beach-123");
      });

      it("should navigate to beach with tab", () => {
        beachNavigation.navigateToBeachWithTab(
          mockRouter,
          "test-beach-123",
          "gallery"
        );
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/beach/test-beach-123?tab=gallery"
        );
      });

      it("should navigate to beach reviews", () => {
        beachNavigation.navigateToBeachReviews(mockRouter, "test-beach-123");
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/beach/test-beach-123?tab=reviews"
        );
      });

      it("should navigate to beach info", () => {
        beachNavigation.navigateToBeachInfo(mockRouter, "test-beach-123");
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/beach/test-beach-123?tab=info"
        );
      });

      it("should navigate to beach gallery", () => {
        beachNavigation.navigateToBeachGallery(mockRouter, "test-beach-123");
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/beach/test-beach-123?tab=gallery"
        );
      });
    });

    describe("Edge cases", () => {
      it("should handle special characters in beach ID", () => {
        const url = beachNavigation.toBeachDetail("test-beach_123-abc");
        expect(url).toBe("/beach/test-beach_123-abc");
      });

      it("should handle special characters in tab names", () => {
        const url = beachNavigation.toBeachDetailWithTab(
          "test-beach-123",
          "custom-tab"
        );
        expect(url).toBe("/beach/test-beach-123?tab=custom-tab");
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
        expect(appNavigation.toLogSession()).toBe("/log-session");
        expect(appNavigation.toPlanSession()).toBe("/plan-session");
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
        expect(mockRouter.push).toHaveBeenCalledWith("/log-session");
      });

      it("should navigate to plan session", () => {
        appNavigation.navigateToPlanSession(mockRouter);
        expect(mockRouter.push).toHaveBeenCalledWith("/plan-session");
      });
    });
  });

  describe("Type safety", () => {
    it("should work with typed router instance", () => {
      // This test ensures our typing is correct
      const typedRouter: AppRouterInstance = mockRouter;
      beachNavigation.navigateToBeach(typedRouter, "test-id");
      appNavigation.navigateToMap(typedRouter);

      expect(mockRouter.push).toHaveBeenCalledTimes(2);
    });
  });
});
