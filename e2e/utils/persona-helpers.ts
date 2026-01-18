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
  const stateSlug = (beach.state || 'california').toLowerCase().replace(/\s+/g, '-');
  const citySlug = (beach.city || 'san-diego').toLowerCase().replace(/\s+/g, '-');
  const beachSlug = beach.slug || beach.name.toLowerCase().replace(/\s+/g, '-');

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

    // Wait for page to load and find intel button
    // Look for "Post Intel" or "Share Intel" button
    const intelButton = page.getByRole('button', { name: /post intel|share intel|add intel/i });
    await intelButton.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
    await intelButton.click();

    // Wait for intel modal/form to appear
    await page.waitForSelector('[role="dialog"], [data-testid="intel-form"]', {
      timeout: TIMEOUTS.medium,
    });

    // Select tag if tag selector is visible
    const tagSelector = page.getByRole('combobox', { name: /tag|type|category/i });
    const tagSelectorVisible = await tagSelector.isVisible().catch(() => false);
    if (tagSelectorVisible) {
      await tagSelector.selectOption({ label: finalContent.tag });
    } else {
      // Try button-based tag selection
      const tagButton = page.getByRole('button', { name: new RegExp(finalContent.tag, 'i') });
      const tagButtonVisible = await tagButton.isVisible().catch(() => false);
      if (tagButtonVisible) {
        await tagButton.click();
      } else {
        console.warn(`[Persona Helper] Tag selector not found for tag: ${finalContent.tag}`);
      }
    }

    // Fill title
    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i));
    await titleInput.fill(finalContent.title);

    // Fill description
    const descInput = page
      .getByPlaceholder(/description|details|what.*(happening|going)/i)
      .or(page.getByLabel(/description/i));
    await descInput.fill(finalContent.description);

    if (submit) {
      // Submit the form
      const submitButton = page.getByRole('button', { name: /submit|post|share/i });
      await submitButton.click();

      // Wait for success indication
      await expect(
        page.getByText(/posted|shared|success/i).or(page.locator('[data-testid="intel-success"]'))
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
 * Navigates to session logging, fills form with persona-appropriate content.
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
    // Navigate to session logging page or beach page
    await navigateToBeach(page, beach);

    // Look for session logging button
    const sessionButton = page.getByRole('button', {
      name: /log session|add session|record session/i,
    });
    await sessionButton.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
    await sessionButton.click();

    // Wait for session form
    await page.waitForSelector('[role="dialog"], [data-testid="session-form"]', {
      timeout: TIMEOUTS.medium,
    });

    // Fill rating if star rating component exists
    const ratingStars = page.locator('[data-testid="rating-star"], [aria-label*="star"]');
    const starsCount = await ratingStars.count();
    if (starsCount >= finalContent.rating) {
      await ratingStars.nth(finalContent.rating - 1).click();
    }

    // Fill notes
    const notesInput = page
      .getByPlaceholder(/notes|comments|how was/i)
      .or(page.getByLabel(/notes|session notes/i));
    await notesInput.fill(finalContent.notes);

    // Fill wave height if field exists
    if (finalContent.waveHeight) {
      const waveInput = page.getByPlaceholder(/wave|height|size/i).or(page.getByLabel(/wave/i));
      const waveInputVisible = await waveInput.isVisible().catch(() => false);
      if (waveInputVisible) {
        await waveInput.fill(finalContent.waveHeight);
      }
    }

    // Fill crowd level if field exists
    if (finalContent.crowdLevel) {
      const crowdInput = page.getByLabel(/crowd/i);
      const crowdInputVisible = await crowdInput.isVisible().catch(() => false);
      if (crowdInputVisible) {
        await crowdInput.fill(String(finalContent.crowdLevel));
      }
    }

    // Fill date if provided
    if (date) {
      const dateInput = page.getByLabel(/date/i);
      const dateInputVisible = await dateInput.isVisible().catch(() => false);
      if (dateInputVisible) {
        const dateStr = date.toISOString().split('T')[0];
        await dateInput.fill(dateStr);
      }
    }

    if (submit) {
      // Submit the form
      const submitButton = page.getByRole('button', { name: /submit|save|log/i });
      await submitButton.click();

      // Wait for success
      await expect(
        page.getByText(/logged|saved|success/i).or(page.locator('[data-testid="session-success"]'))
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
 * Follow another user from their profile
 */
export async function followUserAsPersona(
  page: Page,
  targetUserName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate to user's profile
    await page.goto(`/surfer/${targetUserName.toLowerCase().replace(/\s+/g, '-')}`);
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

  try {
    // Look for user menu or profile indicator
    const userMenu = page.getByTestId('user-menu').or(page.getByRole('button', { name: /profile|account/i }));
    await userMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.short });

    // Get displayed name
    const displayName = await userMenu.textContent();

    // Check if it matches persona
    const isCorrect = displayName?.includes(persona.displayName.split(' ')[0]) || false;

    return {
      isCorrectPersona: isCorrect,
      currentUser: displayName || undefined,
    };
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
