/**
 * Complete Onboarding Script
 *
 * Completes the onboarding flow for the test user.
 * This is required before the user can create sessions.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx tsx e2e/scripts/complete-onboarding.ts
 */

import { chromium } from '@playwright/test';
import * as path from 'path';

async function completeOnboarding() {
  console.log('🎯 Completing onboarding for test user...\n');

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const storageStatePath = path.join(process.cwd(), 'e2e', '.auth', 'state.json');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: storageStatePath,
    baseURL,
  });
  const page = await context.newPage();

  try {
    console.log(`📍 Navigating to ${baseURL}...`);
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Check if onboarding modal appears
    console.log('🔍 Checking for onboarding modal...');
    await page.waitForTimeout(2000);

    const onboardingModal = page.locator('[role="dialog"]').filter({ hasText: /welcome|onboarding|get started/i });
    const hasOnboardingModal = await onboardingModal.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasOnboardingModal) {
      console.log('✅ No onboarding modal found - user may have already completed onboarding');

      // Navigate to onboarding directly
      console.log('📍 Navigating to /onboarding...');
      await page.goto(`${baseURL}/onboarding`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Look for onboarding questions or steps
    // Current flow: Welcome → Profile → Experience → Wave Preferences → Home Beach → Completion
    console.log('📝 Completing onboarding steps...');

    // Step 1: Welcome Step - Click "Get Started"
    const welcomeStep = page.getByTestId('welcome-step');
    if (await welcomeStep.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   Step 1: Welcome - Clicking Get Started...');
      const getStartedBtn = page.getByTestId('welcome-get-started');
      if (await getStartedBtn.isVisible().catch(() => false)) {
        await getStartedBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 2: Profile Step - Fill name if fields are visible
    const fullNameInput = page.getByLabel(/full name/i);
    if (await fullNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Step 2: Profile - Filling in name...');
      await fullNameInput.fill('Test User');
      const displayNameInput = page.getByLabel(/display name/i);
      if (await displayNameInput.isVisible().catch(() => false)) {
        await displayNameInput.fill('TestSurfer');
      }
      const continueBtn = page.getByRole('button', { name: /continue/i });
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }

    // Step 3: Experience Step - Select experience level
    const experienceStep = page.getByTestId('experience-step');
    if (await experienceStep.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Step 3: Experience - Selecting Intermediate...');
      const intermediateCard = page.getByTestId('experience-intermediate');
      await intermediateCard.click();
      await page.waitForTimeout(500);
      const continueBtn = page.getByRole('button', { name: /continue/i });
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }

    // Step 4: Wave Preferences Step - Select wave size, break type, and surf style
    const wavePrefsStep = page.getByTestId('wave-preferences-step');
    if (await wavePrefsStep.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Step 4: Wave Preferences - Selecting preferences...');

      // Select medium waves
      const mediumWaveBtn = page.getByTestId('wave-size-medium');
      if (await mediumWaveBtn.isVisible().catch(() => false)) {
        await mediumWaveBtn.click();
      }

      // Select beach break
      const beachBreakBtn = page.getByTestId('break-type-beach');
      if (await beachBreakBtn.isVisible().catch(() => false)) {
        await beachBreakBtn.click();
      }

      // Select shortboard surf style (required)
      const shortboardBtn = page.getByTestId('surf-style-shortboard');
      if (await shortboardBtn.isVisible().catch(() => false)) {
        await shortboardBtn.click();
      }

      await page.waitForTimeout(500);
      const continueBtn = page.getByRole('button', { name: /continue/i });
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }

    // Step 5: Home Beach - Skip or search (handled by generic button click below)

    // Look for "Continue", "Next", or "Finish" buttons
    console.log('\n🔄 Looking for navigation buttons...');

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const nextButton = page.getByRole('button', { name: /continue|next|finish|complete|get started|let's go/i }).first();
      const hasNextButton = await nextButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasNextButton) {
        const buttonText = await nextButton.textContent();
        console.log(`   Clicking "${buttonText}" button...`);
        await nextButton.click();
        await page.waitForTimeout(2000);
        attempts++;

        // Check if we're redirected away from onboarding
        const currentUrl = page.url();
        if (!currentUrl.includes('onboarding') && !currentUrl.includes('welcome')) {
          console.log(`✅ Redirected to: ${currentUrl}`);
          console.log('✅ Onboarding appears to be complete!');
          break;
        }
      } else {
        // No more "next" buttons - might be done
        const currentUrl = page.url();
        console.log(`   No more navigation buttons found at: ${currentUrl}`);
        break;
      }
    }

    // Save the updated auth state
    console.log('\n💾 Saving updated authentication state...');
    await context.storageState({ path: storageStatePath });
    console.log(`✅ Saved to ${storageStatePath}`);

    // Verify onboarding completion
    console.log('\n🔍 Verifying onboarding completion...');
    await page.goto(`${baseURL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if profile loads without redirect
    const finalUrl = page.url();
    if (finalUrl.includes('/profile')) {
      console.log('✅ Profile page accessible - onboarding likely complete!');
    } else if (finalUrl.includes('/onboarding')) {
      console.log('⚠️  Still on onboarding page - may need manual completion');
    } else {
      console.log(`ℹ️  Redirected to: ${finalUrl}`);
    }

    console.log('\n✅ Onboarding completion script finished!');
    console.log('\n📖 Next steps:');
    console.log('   1. Run: BASE_URL=http://localhost:3000 npx tsx e2e/scripts/setup-personalization-db.ts');
    console.log('   2. Then run: npx playwright test personalization.spec.ts');

  } catch (error) {
    console.error('\n❌ Error during onboarding completion:');
    console.error(error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Run the script
completeOnboarding().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
