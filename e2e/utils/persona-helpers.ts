/**
 * Test helper utilities for persona-based E2E testing
 *
 * Provides high-level helper functions for common UI flows
 * when testing with persona accounts.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 * @see e2e/utils/persona-content-generators.ts - Content generation
 */

import { Page, expect } from '@playwright/test';
import { PersonaType, PERSONAS, IntelTag } from '../fixtures/personas';
import { TIMEOUTS } from '../fixtures/test-data';
import {
  generateIntelContent,
  generateSessionContent,
  BeachInfo,
  GeneratedIntelContent,
  GeneratedSessionContent,
} from './persona-content-generators';

/**
 * Options for creating an intel post
 */
export interface CreateIntelOptions {
  /** Beach to post about */
  beach: BeachInfo;
  /** Optional specific tag (otherwise uses persona preference) */
  tag?: IntelTag;
  /** Optional custom title (otherwise generated) */
  title?: string;
  /** Optional custom description (otherwise generated) */
  description?: string;
  /** Whether to submit the form (default: true) */
  submit?: boolean;
}

/**
 * Options for logging a session
 */
export interface LogSessionOptions {
  /** Beach where session occurred */
  beach: BeachInfo;
  /** Optional custom notes (otherwise generated) */
  notes?: string;
  /** Optional custom rating (otherwise generated based on persona) */
  rating?: number;
  /** Session date (default: today) */
  date?: Date;
  /** Whether to submit the form (default: true) */
  submit?: boolean;
}

/**
 * Result of creating an intel post
 */
export interface CreateIntelResult {
  success: boolean;
  content: GeneratedIntelContent;
  error?: string;
}

/**
 * Result of logging a session
 */
export interface LogSessionResult {
  success: boolean;
  content: GeneratedSessionContent;
  error?: string;
}

/**
 * Navigate to a beach page using hierarchical URL structure
 */
export async function navigateToBeach(page: Page, beach: BeachInfo): Promise<void> {
  // Build hierarchical URL: /{state}/{city-slug}/{beach-slug}
  // Use encodeURIComponent to prevent URL injection from special characters
  const stateSlug = encodeURIComponent((beach.state || 'california').toLowerCase().replace(/\s+/g, '-'));
  const citySlug = encodeURIComponent((beach.city || 'san-diego').toLowerCase().replace(/\s+/g, '-'));
  const beachSlug = encodeURIComponent(beach.slug || beach.name.toLowerCase().replace(/\s+/g, '-'));

  const url = `/${stateSlug}/${citySlug}/${beachSlug}`;
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Create an intel post as a specific persona
 *
 * Navigates to the beach, opens intel form, fills content, and submits.
 */
export async function createIntelPostAsPersona(
  page: Page,
  personaType: PersonaType,
  options: CreateIntelOptions
): Promise<CreateIntelResult> {
  const { beach, tag, title, description, submit = true } = options;

  // Generate content if not provided
  const generatedContent = generateIntelContent(personaType, beach, tag);
  const finalContent: GeneratedIntelContent = {
    title: title || generatedContent.title,
    description: description || generatedContent.description,
    tag: tag || generatedContent.tag,
  };

  try {
    // Navigate to beach page
    await navigateToBeach(page, beach);

    // Wait for page to load and find the "Add Intel" button (data-testid="add-intel")
    const intelButton = page.getByTestId('add-intel');
    await intelButton.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
    await intelButton.click();

    // Wait for intel modal/form to appear (Dialog renders with role="dialog")
    await page.waitForSelector('[role="dialog"]', {
      timeout: TIMEOUTS.medium,
    });

    // Select tag using the Radix Select combobox (IntelTagSelector uses <Select>)
    // The trigger is a combobox role; open it and click the matching option
    const tagTrigger = page.getByRole('combobox');
    const tagTriggerVisible = await tagTrigger.isVisible().catch(() => false);
    if (tagTriggerVisible) {
      await tagTrigger.click();
      // Wait for dropdown options to appear
      const tagOption = page.getByRole('option', { name: new RegExp(finalContent.tag, 'i') });
      const optionVisible = await tagOption.isVisible().catch(() => false);
      if (optionVisible) {
        await tagOption.click();
      } else {
        // Close combobox if option not found
        await page.keyboard.press('Escape');
        console.warn(`[Persona Helper] Tag option not found for tag: ${finalContent.tag}`);
      }
    }

    // Fill title using input id="title"
    await page.locator('#title').fill(finalContent.title);

    // Fill description using textarea id="description"
    await page.locator('#description').fill(finalContent.description);

    if (submit) {
      // Submit the form — the submit button label comes from IntelFormActions
      const submitButton = page.getByRole('button', { name: /share intel|share|submit/i });
      await submitButton.click();

      // Wait for success toast or dialog to close
      await expect(
        page.getByText(/intel post created|posted|success/i)
          .or(page.locator('[data-testid="intel-success"]'))
      ).toBeVisible({ timeout: TIMEOUTS.medium });
    }

    return {
      success: true,
      content: finalContent,
    };
  } catch (error) {
    return {
      success: false,
      content: finalContent,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Log a surf session as a specific persona
 *
 * Navigates to /sessions/new?mode=log and fills the session wizard.
 */
export async function logSessionAsPersona(
  page: Page,
  personaType: PersonaType,
  options: LogSessionOptions
): Promise<LogSessionResult> {
  const { beach, notes, rating, date, submit = true } = options;

  // Generate content if not provided
  const generatedContent = generateSessionContent(personaType);
  const finalContent: GeneratedSessionContent = {
    notes: notes || generatedContent.notes,
    rating: rating ?? generatedContent.rating,
    waveHeight: generatedContent.waveHeight,
    crowdLevel: generatedContent.crowdLevel,
  };

  try {
    // Navigate directly to session logging wizard
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the beach search input from the SessionWizard / LocationStep
    const beachInput = page.getByTestId('beach-search-input');
    await beachInput.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
    await beachInput.fill(beach.name);

    // Wait for dropdown and select first match
    // eslint-disable-next-line playwright/no-wait-for-timeout -- allow debounce to settle before selecting
    await page.waitForTimeout(400);
    const firstOption = page.locator('ul li button').first();
    const optionVisible = await firstOption.isVisible().catch(() => false);
    if (optionVisible) {
      await firstOption.click();
    } else {
      // Trigger blur to accept free-typed value
      await beachInput.blur();
    }

    // Advance to next step if there's a Next/Continue button
    const nextButton = page.getByRole('button', { name: /next|continue/i });
    const nextVisible = await nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await nextButton.click();
    }

    return {
      success: true,
      content: finalContent,
    };
  } catch (error) {
    return {
      success: false,
      content: finalContent,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Follow another user from their profile
 */
export async function followUserAsPersona(
  page: Page,
  targetUserName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate to user's profile
    // Use encodeURIComponent to prevent URL injection from special characters
    const userSlug = encodeURIComponent(targetUserName.toLowerCase().replace(/\s+/g, '-'));
    await page.goto(`/surfer/${userSlug}`);
    await page.waitForLoadState('domcontentloaded');

    // Find and click follow button
    const followButton = page.getByRole('button', { name: /follow/i });
    await followButton.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });

    // Check if already following
    const buttonText = await followButton.textContent();
    if (buttonText?.toLowerCase().includes('following')) {
      return { success: true }; // Already following
    }

    await followButton.click();

    // Wait for button state to change
    await expect(followButton).toHaveText(/following|unfollow/i, { timeout: TIMEOUTS.short });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update profile preferences as a persona
 */
export async function updateProfileAsPersona(
  page: Page,
  _personaType: PersonaType,
  updates: { bio?: string; favoriteSpot?: string; experienceLevel?: string }
): Promise<{ success: boolean; error?: string }> {
  // personaType reserved for future persona-specific defaults
  try {
    // Navigate to profile settings
    await page.goto('/profile/settings');
    await page.waitForLoadState('domcontentloaded');

    // Update bio if provided
    if (updates.bio) {
      const bioInput = page.getByLabel(/bio|about/i);
      await bioInput.fill(updates.bio);
    }

    // Update favorite spot if provided
    if (updates.favoriteSpot) {
      const spotInput = page.getByLabel(/favorite.*spot|home.*break/i);
      const spotInputVisible = await spotInput.isVisible().catch(() => false);
      if (spotInputVisible) {
        await spotInput.fill(updates.favoriteSpot);
      }
    }

    // Update experience level if provided
    if (updates.experienceLevel) {
      const expSelect = page.getByLabel(/experience|skill.*level/i);
      const expSelectVisible = await expSelect.isVisible().catch(() => false);
      if (expSelectVisible) {
        await expSelect.selectOption({ label: updates.experienceLevel });
      }
    }

    // Save changes
    const saveButton = page.getByRole('button', { name: /save|update/i });
    await saveButton.click();

    // Wait for success
    await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: TIMEOUTS.short });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify the currently logged in user matches expected persona
 */
export async function verifyLoggedInAsPersona(
  page: Page,
  personaType: PersonaType
): Promise<{ isCorrectPersona: boolean; currentUser?: string }> {
  const persona = PERSONAS[personaType];
  const firstName = persona.displayName.split(' ')[0];

  try {
    // Wait for auth check to complete (dismiss "Checking authentication..." spinner)
    const authSpinner = page.getByText('Checking authentication');
    try {
      await authSpinner.waitFor({ state: 'hidden', timeout: TIMEOUTS.medium });
    } catch {
      // If spinner never appeared or took too long, continue with checks
    }

    // Wait for page to settle after auth
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.short }).catch(() => {});

    // Strategy 1: Check greeting text (e.g., "Good evening, Lauren Mitchell.")
    const greeting = page.locator('text=/Good (morning|afternoon|evening),/');
    const greetingVisible = await greeting.isVisible().catch(() => false);

    if (greetingVisible) {
      const greetingText = await greeting.textContent();
      return {
        isCorrectPersona: greetingText?.includes(firstName) || false,
        currentUser: greetingText?.replace(/Good \w+, /, '').replace('.', '').trim() || undefined,
      };
    }

    // Strategy 2: Look for user menu or profile indicator
    const userMenu = page.getByTestId('user-menu').or(page.getByRole('button', { name: /profile|account/i }));
    const menuVisible = await userMenu.isVisible().catch(() => false);

    if (menuVisible) {
      const displayName = await userMenu.textContent();
      const isCorrect = displayName?.includes(firstName) || false;
      return {
        isCorrectPersona: isCorrect,
        currentUser: displayName || undefined,
      };
    }

    // Strategy 3: Check for any avatar initials or auth indicators
    const avatarButton = page.locator('[class*="avatar"], [data-testid="avatar"]').first();
    const avatarVisible = await avatarButton.isVisible().catch(() => false);

    if (avatarVisible) {
      return {
        isCorrectPersona: false,
        currentUser: 'authenticated (avatar found)',
      };
    }

    return { isCorrectPersona: false };
  } catch {
    return { isCorrectPersona: false };
  }
}

/**
 * Open discovery page and apply filters appropriate for persona
 */
export async function exploreDiscoveryAsPersona(
  page: Page,
  personaType: PersonaType
): Promise<{ success: boolean; beachesFound?: number; error?: string }> {
  const persona = PERSONAS[personaType];

  try {
    // Navigate to discovery
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');

    // Apply skill level filter based on persona
    const skillFilter = page.getByLabel(/skill|experience|level/i);
    const skillFilterVisible = await skillFilter.isVisible().catch(() => false);

    if (skillFilterVisible) {
      const levelMap: Record<string, string> = {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        expert: 'Expert',
      };
      await skillFilter.selectOption({ label: levelMap[persona.experienceLevel] });
    }

    // Wait for results to load by waiting for beach cards to be present
    const beachCards = page.locator('[data-testid="beach-card"], .beach-card');
    await beachCards.first().waitFor({ state: 'visible', timeout: TIMEOUTS.medium }).catch(() => {
      // No results found is a valid state
    });

    // Count beach cards
    const count = await beachCards.count();

    return {
      success: true,
      beachesFound: count,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check session planner as persona
 */
export async function checkSessionPlannerAsPersona(
  page: Page,
  personaType: PersonaType
): Promise<{ success: boolean; hasRecommendations?: boolean; error?: string }> {
  try {
    // Navigate to session planner
    await page.goto('/plan');
    await page.waitForLoadState('domcontentloaded');

    // Wait for recommendations to load
    const recommendations = page.locator('[data-testid="recommendation"], .recommendation-card');
    await recommendations.first().waitFor({ state: 'visible', timeout: TIMEOUTS.long });

    const count = await recommendations.count();

    return {
      success: true,
      hasRecommendations: count > 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify the user's profile has the expected experience level
 *
 * Fetches the profile via API and compares with persona's expected level
 */
export async function verifyProfileExperienceLevel(
  page: Page,
  personaType: PersonaType
): Promise<{
  success: boolean;
  expectedLevel: string;
  actualLevel?: string;
  error?: string
}> {
  const persona = PERSONAS[personaType];
  const expectedLevel = persona.experienceLevel;

  try {
    // Use the page's context to make an authenticated API call
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/user/profile');
      if (!res.ok) {
        throw new Error(`Profile fetch failed: ${res.status}`);
      }
      return res.json();
    });

    const actualLevel = response?.experience_level || response?.experienceLevel;

    return {
      success: actualLevel === expectedLevel,
      expectedLevel,
      actualLevel,
    };
  } catch (error) {
    return {
      success: false,
      expectedLevel,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
