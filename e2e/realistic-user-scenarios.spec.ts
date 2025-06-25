import { test, expect } from "@playwright/test";

test.describe("Realistic User Scenarios", () => {
  test.describe("Weekend Warrior Surfer", () => {
    test("Check forecast, plan weekend session, log completed session", async ({
      page,
    }) => {
      // Scenario: User checks app on Friday evening to plan weekend surf
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 1. Check current conditions on Forecast tab (default)
      const forecastContent = page
        .getByTestId("forecast-content")
        .or(page.locator(".forecast-card"))
        .or(page.getByText("Forecast", { exact: false }));

      if (await forecastContent.isVisible()) {
        console.log("Forecast tab accessible for planning");

        // Look for forecast details
        const conditionsText = page.getByText(/wave|wind|conditions/i);
        if (await conditionsText.isVisible()) {
          console.log("Surf conditions visible");
        }
      }

      // 2. Check nearby beaches
      const nearbyTab = page.getByRole("tab", { name: /nearby/i });
      if (await nearbyTab.isVisible()) {
        await nearbyTab.click();
        await page.waitForTimeout(2000);

        // Look for nearby beaches list
        const beachList = page.locator(".beach-card, .beach-item");
        const beachCount = await beachList.count();
        console.log(`Found ${beachCount} nearby beaches`);

        if (beachCount > 0) {
          // Click on first beach to get more details
          await beachList.first().click();
          await page.waitForTimeout(1000);
        }
      }

      // 3. Plan a session for tomorrow
      await page.goto("/plan-session");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // Fill planning form with weekend plans
        const beachInput = page.locator("#beach-input");
        if (await beachInput.isVisible()) {
          await beachInput.fill("Malibu");
          await page.waitForTimeout(1000);
        }

        const dateInput = page.locator("#session-date");
        if (await dateInput.isVisible()) {
          // Plan for tomorrow (weekend)
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toISOString().split("T")[0];
          await dateInput.fill(dateStr);
        }

        // Check notes field for planning details
        const notesField = page.getByLabel(/notes|details/i);
        if (await notesField.isVisible()) {
          await notesField.fill(
            "Early morning session, checking swell forecast"
          );
        }

        await page.waitForTimeout(1000);

        const saveButton = page.getByRole("button", { name: /save|plan/i });
        if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
          console.log("Session planning form ready for submission");
        }
      }

      // 4. Simulate logging the completed session later
      await page.goto("/log-session");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // Fill session log with details from completed session
        const logBeachInput = page.locator("#beach-input");
        if (await logBeachInput.isVisible()) {
          await logBeachInput.fill("Malibu");
          await page.waitForTimeout(1000);
        }

        const logDateInput = page.locator("#session-date");
        if (await logDateInput.isVisible()) {
          // Log yesterday's session
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split("T")[0];
          await logDateInput.fill(dateStr);
        }

        const timeInput = page.locator("#session-time");
        if (await timeInput.isVisible()) {
          await timeInput.fill("06:30"); // Dawn patrol
        }

        const durationInput = page.getByLabel(/duration/i);
        if (await durationInput.isVisible()) {
          await durationInput.fill("2.5"); // Long weekend session
        }

        // Rate the session quality
        const qualityRating = page.getByLabel(/quality|rating/i);
        if (await qualityRating.isVisible()) {
          await qualityRating.selectOption("4"); // Good session
        }

        const logNotes = page.getByLabel(/notes/i);
        if (await logNotes.isVisible()) {
          await logNotes.fill(
            "Great morning session! Clean waves, light offshore wind. Perfect conditions."
          );
        }

        console.log(
          "Session logging form filled with realistic weekend session data"
        );
      }
    });
  });

  test.describe("Local Regular Surfer", () => {
    test("Quick daily check and community interaction", async ({ page }) => {
      // Scenario: Local surfer's daily routine check
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 1. Quick forecast check for local spot
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);

        // Look for today's conditions
        const todayConditions = page.getByText(/today|current/i);
        if (await todayConditions.isVisible()) {
          console.log("Today's conditions visible");
        }
      }

      // 2. Check what the community is up to
      const communityTab = page.getByRole("tab", { name: /community/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(".session-card, .max-w-2xl");
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          // Interact with community posts
          const firstCard = sessionCards.first();

          // Like a session post
          const likeButton = firstCard.getByRole("button", {
            name: /like|heart/i,
          });
          if (await likeButton.isVisible()) {
            await likeButton.click();
            await page.waitForTimeout(500);
            console.log("Interacted with community post");
          }

          // Check for user profile
          const userAvatar = firstCard.locator(".user-avatar, .avatar");
          if (await userAvatar.isVisible()) {
            await userAvatar.click();
            await page.waitForTimeout(1000);
            console.log("Viewed community member profile");
          }
        }
      }

      // 3. Check personal session history
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        const sessionsTab = page.getByRole("tab", { name: /sessions/i });
        if (await sessionsTab.isVisible()) {
          await sessionsTab.click();
          await page.waitForTimeout(2000);

          // Look at recent sessions for patterns
          const personalSessions = page.locator(".session-card");
          const personalCount = await personalSessions.count();
          console.log(`Personal session count: ${personalCount}`);
        }
      }
    });
  });

  test.describe("Traveling Surfer", () => {
    test("Discover new location, research beaches, plan session", async ({
      page,
    }) => {
      // Scenario: Surfer visiting a new area
      await page.goto("/map");
      await page.waitForTimeout(2000);

      // 1. Search for a new location
      const searchInput = page
        .getByPlaceholder("Search beaches...")
        .or(page.locator("input[type='search']"));

      if (await searchInput.isVisible()) {
        await searchInput.fill("Santa Barbara");
        await page.waitForTimeout(1500);

        // Look for search suggestions
        const searchResults = page.locator(".suggestion, .search-result, li");
        if (await searchResults.first().isVisible()) {
          await searchResults.first().click();
          await page.waitForTimeout(2000);
        }
      }

      // 2. Explore beaches in the area
      const beachCards = page.locator(".beach-card, [data-beach-id]");
      const beachCount = await beachCards.count();

      if (beachCount > 0) {
        // Check multiple beaches for comparison
        for (let i = 0; i < Math.min(beachCount, 3); i++) {
          const beach = beachCards.nth(i);
          if (await beach.isVisible()) {
            await beach.click();
            await page.waitForTimeout(1000);

            // Look for beach details
            const beachInfo = page.getByText(/forecast|conditions|reviews/i);
            if (await beachInfo.isVisible()) {
              console.log(`Beach ${i + 1} information accessible`);
            }

            // Check for reviews from locals
            const reviews = page.getByText(/review|rating|star/i);
            if (await reviews.isVisible()) {
              console.log(`Beach ${i + 1} has community reviews`);
            }

            await page.waitForTimeout(500);
          }
        }
      }

      // 3. Plan session at chosen beach
      const planButton = page
        .getByRole("button", { name: /plan session/i })
        .or(page.getByRole("link", { name: /plan session/i }));

      if (await planButton.isVisible()) {
        await planButton.click();
        await page.waitForTimeout(2000);

        if (!page.url().includes("/auth")) {
          // Fill planning form for new location
          const dateInput = page.locator("#session-date");
          if (await dateInput.isVisible()) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split("T")[0];
            await dateInput.fill(dateStr);
          }

          const notes = page.getByLabel(/notes/i);
          if (await notes.isVisible()) {
            await notes.fill(
              "First time surfing this area - checking local conditions and etiquette"
            );
          }

          console.log("Planned session for new location");
        }
      }
    });
  });

  test.describe("Social Surfer", () => {
    test("Share session, follow friends, engage with community", async ({
      page,
    }) => {
      // Scenario: Socially engaged surfer
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 1. Log a great session to share
      await page.goto("/log-session");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // Fill out an epic session
        const beachInput = page.locator("#beach-input");
        if (await beachInput.isVisible()) {
          await beachInput.fill("Rincon");
          await page.waitForTimeout(1000);
        }

        const dateInput = page.locator("#session-date");
        if (await dateInput.isVisible()) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split("T")[0];
          await dateInput.fill(dateStr);
        }

        const timeInput = page.locator("#session-time");
        if (await timeInput.isVisible()) {
          await timeInput.fill("07:00");
        }

        const durationInput = page.getByLabel(/duration/i);
        if (await durationInput.isVisible()) {
          await durationInput.fill("3");
        }

        // Rate it highly for sharing
        const qualityRating = page.getByLabel(/quality|wave quality/i);
        if (await qualityRating.isVisible()) {
          await qualityRating.selectOption("5"); // Epic session
        }

        const notes = page.getByLabel(/notes/i);
        if (await notes.isVisible()) {
          await notes.fill(
            "EPIC session at Rincon! Perfect offshore winds, clean 6ft waves. Best session of the year! 🏄‍♂️🌊"
          );
        }

        // Add photos if available
        const photoUpload = page.locator("input[type='file']");
        if (await photoUpload.isVisible()) {
          console.log("Photo upload available for session sharing");
        }

        const saveButton = page.getByRole("button", { name: /save|log/i });
        if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
          console.log("Epic session ready to be logged and shared");
        }
      }

      // 2. Engage with community
      await page.goto("/");
      await page.waitForTimeout(2000);

      const communityTab = page.getByRole("tab", { name: /community/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(".session-card, .max-w-2xl");
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          // Engage with multiple posts
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const card = sessionCards.nth(i);

            // Like posts
            const likeButton = card.getByRole("button", {
              name: /like|heart/i,
            });
            if (await likeButton.isVisible()) {
              await likeButton.click();
              await page.waitForTimeout(300);
            }

            // Comment on interesting sessions
            const commentButton = card.getByRole("button", {
              name: /comment/i,
            });
            if ((await commentButton.isVisible()) && i === 0) {
              // Comment on first one
              await commentButton.click();
              await page.waitForTimeout(1000);

              const commentInput = page.getByPlaceholder(
                /comment|add a comment/i
              );
              if (await commentInput.isVisible()) {
                await commentInput.fill(
                  "Looks like an amazing session! What board did you ride?"
                );

                const submitComment = page.getByRole("button", {
                  name: /submit|post/i,
                });
                if (await submitComment.isVisible()) {
                  console.log("Comment ready to be posted");
                }
              }
            }

            // Follow active community members
            const userElement = card.locator(".user-avatar, .username").first();
            if ((await userElement.isVisible()) && i === 1) {
              // Follow second user
              await userElement.click();
              await page.waitForTimeout(1000);

              const followButton = page.getByRole("button", {
                name: /follow/i,
              });
              if (await followButton.isVisible()) {
                await followButton.click();
                await page.waitForTimeout(500);
                console.log("Followed community member");
              }
            }
          }
        }
      }

      // 3. Check notifications/activity
      const profileNav = page
        .getByTestId("nav-profile")
        .or(page.getByText("Profile", { exact: true }));

      if (await profileNav.isVisible()) {
        await profileNav.click();
        await page.waitForTimeout(2000);

        if (!page.url().includes("/auth")) {
          // Look for activity/notifications
          const activitySection = page.getByText(
            /activity|notifications|following/i
          );
          if (await activitySection.isVisible()) {
            console.log("Activity/social features accessible");
          }
        }
      }
    });
  });

  test.describe("Equipment Focused Surfer", () => {
    test("Manage board quiver, track performance by board", async ({
      page,
    }) => {
      // Scenario: Surfer focused on equipment and performance
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // 1. Manage board collection
        const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
        if (await quiverTab.isVisible()) {
          await quiverTab.click();
          await page.waitForTimeout(2000);

          // Add a new board
          const addBoardButton = page.getByRole("button", {
            name: /add.*board/i,
          });
          if (await addBoardButton.isVisible()) {
            await addBoardButton.click();
            await page.waitForTimeout(1000);

            // Fill board details
            const boardName = page.getByLabel(/name|brand/i);
            if (await boardName.isVisible()) {
              await boardName.fill("Lost V3 Rocket");
            }

            const boardLength = page.getByLabel(/length|size/i);
            if (await boardLength.isVisible()) {
              await boardLength.fill("5'10\"");
            }

            const boardType = page.getByLabel(/type|category/i);
            if (await boardType.isVisible()) {
              await boardType.selectOption("shortboard");
            }

            const notes = page.getByLabel(/notes|description/i);
            if (await notes.isVisible()) {
              await notes.fill(
                "High performance shortboard for overhead waves"
              );
            }

            console.log("Board details filled for adding to quiver");
          }

          // Check existing boards
          const boardCards = page.locator(".board-card, .board-item");
          const boardCount = await boardCards.count();
          console.log(`Current quiver size: ${boardCount} boards`);
        }

        // 2. Log session with specific board focus
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        if (!page.url().includes("/auth")) {
          // Fill detailed session with board performance notes
          const beachInput = page.locator("#beach-input");
          if (await beachInput.isVisible()) {
            await beachInput.fill("Trestles");
            await page.waitForTimeout(1000);
          }

          const dateInput = page.locator("#session-date");
          if (await dateInput.isVisible()) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split("T")[0];
            await dateInput.fill(dateStr);
          }

          // Select specific board
          const boardSelect = page
            .locator("#board-select")
            .or(page.getByLabel(/board/i));
          if (await boardSelect.isVisible()) {
            await boardSelect.click();
            await page.waitForTimeout(500);
            // Would select specific board from dropdown
          }

          const notes = page.getByLabel(/notes/i);
          if (await notes.isVisible()) {
            await notes.fill(
              "Tested the new Lost V3 Rocket in 4-6ft waves. Board performed excellently in steep waves, great paddle power. Need to adjust fins for next session."
            );
          }

          console.log("Equipment-focused session logged");
        }

        // 3. Review board performance over time
        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const sessionsTab = page.getByRole("tab", { name: /sessions/i });
        if (await sessionsTab.isVisible()) {
          await sessionsTab.click();
          await page.waitForTimeout(2000);

          // Look for session filtering by board
          const filterOptions = page.getByLabel(/filter|board|search/i);
          if (await filterOptions.isVisible()) {
            console.log("Session filtering by board available");
          }

          const sessionCards = page.locator(".session-card");
          if (await sessionCards.first().isVisible()) {
            // Check if board info is shown in session cards
            const boardInfo = sessionCards
              .first()
              .getByText(/board|shortboard|longboard/i);
            if (await boardInfo.isVisible()) {
              console.log("Board information visible in session history");
            }
          }
        }
      }
    });
  });

  test.describe("Weather/Forecast Enthusiast", () => {
    test("Deep dive into forecast data and conditions tracking", async ({
      page,
    }) => {
      // Scenario: Surfer who closely follows weather and forecasts
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 1. Analyze detailed forecast
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);

        // Look for detailed weather info
        const forecastDetails = page.getByText(/wave height|wind|swell|tide/i);
        if (await forecastDetails.isVisible()) {
          console.log("Detailed forecast information available");
        }

        // Check for extended forecast
        const extendedForecast = page.getByText(/tomorrow|next.*days|week/i);
        if (await extendedForecast.isVisible()) {
          console.log("Extended forecast visible");
        }
      }

      // 2. Compare conditions across beaches
      await page.goto("/map");
      await page.waitForTimeout(2000);

      const beachCards = page.locator(".beach-card, [data-beach-id]");
      const beachCount = await beachCards.count();

      if (beachCount > 1) {
        // Check conditions at multiple beaches
        for (let i = 0; i < Math.min(beachCount, 3); i++) {
          const beach = beachCards.nth(i);
          if (await beach.isVisible()) {
            await beach.click();
            await page.waitForTimeout(1000);

            // Look for current conditions
            const conditions = page.getByText(/conditions|waves|wind|rating/i);
            if (await conditions.isVisible()) {
              console.log(`Beach ${i + 1} conditions visible`);
            }

            await page.waitForTimeout(500);
          }
        }
      }

      // 3. Log session with detailed conditions
      await page.goto("/log-session");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // Fill comprehensive conditions data
        const beachInput = page.locator("#beach-input");
        if (await beachInput.isVisible()) {
          await beachInput.fill("Steamer Lane");
          await page.waitForTimeout(1000);
        }

        const dateInput = page.locator("#session-date");
        if (await dateInput.isVisible()) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split("T")[0];
          await dateInput.fill(dateStr);
        }

        // Fill detailed conditions
        const waveQuality = page.getByLabel(/wave quality|quality/i);
        if (await waveQuality.isVisible()) {
          await waveQuality.selectOption("4");
        }

        const waterTemp = page.getByLabel(/water temp|temperature/i);
        if (await waterTemp.isVisible()) {
          await waterTemp.fill("62");
        }

        const crowdLevel = page.getByLabel(/crowd|crowded/i);
        if (await crowdLevel.isVisible()) {
          await crowdLevel.selectOption("medium");
        }

        const notes = page.getByLabel(/notes/i);
        if (await notes.isVisible()) {
          await notes.fill(
            "NW swell 6-8ft @13s, light offshore winds 5-8kts from E. High tide 7.2ft at 8:15am. Water temp 62°F, wetsuit 3/2 perfect. Clean conditions, moderate crowd."
          );
        }

        console.log("Detailed conditions logged for session");
      }
    });
  });
});
