/**
 * Landing page: Surf highlights carousel (guest)
 *
 * Ensures the featured beaches section renders and the carousel can advance
 * via its explicit navigation control. Uses route stubbing to avoid reliance
 * on database seeding or timing-based autoplay assertions.
 *
 * @project guest
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad } from "./utils/test-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

function featuredBeachesFixture() {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Blacks",
        city: "La Jolla",
        state: "CA",
        slug: "blacks",
        photo_url: "https://example.com/blacks.jpg",
        average_rating: 3.6,
        review_count: 19,
        skill_level: "advanced",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Tourmaline",
        city: "San Diego",
        state: "CA",
        slug: "tourmaline",
        photo_url: "https://example.com/tourmaline.jpg",
        average_rating: 4.1,
        review_count: 51,
        skill_level: "beginner_intermediate",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Big Jetty",
        city: "San Diego",
        state: "CA",
        slug: "big-jetty",
        photo_url: "https://example.com/big-jetty.jpg",
        average_rating: 3.3,
        review_count: 3,
        skill_level: "intermediate_advanced",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Cardiff Reef",
        city: "Encinitas",
        state: "CA",
        slug: "cardiff-reef",
        photo_url: "https://example.com/cardiff.jpg",
        average_rating: 3.6,
        review_count: 10,
        skill_level: "intermediate",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        name: "Scripps",
        city: "San Diego",
        state: "CA",
        slug: "scripps",
        photo_url: "https://example.com/scripps.jpg",
        average_rating: 4.0,
        review_count: 8,
        skill_level: "beginner_intermediate",
      },
    ],
  };
}

test.describe("Guest landing surf highlights carousel", () => {
  test("renders and advances via next button", async ({ page }) => {
    await page.route("**/api/beaches/featured**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(featuredBeachesFixture()),
      });
    });

    await page.goto("/");
    await waitForPageLoad(page);

    const section = page.getByTestId("surf-highlights-section");
    await expect(section).toBeVisible();

    const carousel = page.getByTestId("surf-highlights-carousel");
    await expect(carousel).toBeVisible();

    // Ensure it rendered at least one card title.
    await expect(carousel).toContainText("Blacks");

    const before = await carousel.getAttribute("data-active-index");
    expect(before).toBeTruthy();

    const nextButton = page.getByTestId("surf-highlights-next");
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    await expect
      .poll(async () => carousel.getAttribute("data-active-index"), {
        timeout: 5000,
      })
      .not.toBe(before);
  });
});






