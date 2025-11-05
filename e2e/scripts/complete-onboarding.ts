/**
 * Complete Onboarding Script
 *
 * Completes the onboarding flow for the test user.
 * This is required before the user can create sessions.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx tsx e2e/scripts/complete-onboarding.ts
 *   BASE_URL=http://localhost:3000 npx tsx e2e/scripts/complete-onboarding.ts --referral-code ABC123
 */

import { chromium } from '@playwright/test';
import * as path from 'path';

async function completeOnboarding() {
  console.log('🎯 Completing onboarding for test user...\n');

  // Parse command line arguments
  const referralCodeArg = process.argv.find(arg => arg.startsWith('--referral-code='));
  const referralCode = referralCodeArg ? referralCodeArg.split('=')[1] : null;

  if (referralCode) {
    console.log(`🎁 Using referral code: ${referralCode}\n`);
  }

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
    console.log('📝 Looking for onboarding steps...');

    // Step 1: Wave size preference
    const waveSizeButtons = page.locator('button').filter({ hasText: /small|medium|large|any size/i });
    const hasWaveSize = await waveSizeButtons.count() > 0;

    if (hasWaveSize) {
      console.log('   Step 1: Selecting wave size preference (Medium)...');
      const mediumButton = page.locator('button').filter({ hasText: /medium/i }).first();
      if (await mediumButton.isVisible().catch(() => false)) {
        await mediumButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 2: Break type preference
    const breakTypeButtons = page.locator('button').filter({ hasText: /beach|point|reef|any type/i });
    const hasBreakType = await breakTypeButtons.count() > 0;

    if (hasBreakType) {
      console.log('   Step 2: Selecting break type preference (Beach Break)...');
      const beachButton = page.locator('button').filter({ hasText: /beach/i }).first();
      if (await beachButton.isVisible().catch(() => false)) {
        await beachButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 3: Crowd preference
    const crowdButtons = page.locator('button').filter({ hasText: /social|moderate|solitude/i });
    const hasCrowd = await crowdButtons.count() > 0;

    if (hasCrowd) {
      console.log('   Step 3: Selecting crowd preference (Moderate)...');
      const moderateButton = page.locator('button').filter({ hasText: /moderate/i }).first();
      if (await moderateButton.isVisible().catch(() => false)) {
        await moderateButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Referral code (if provided)
    if (referralCode) {
      console.log(`\n🎁 Looking for referral step...`);
      const referralInput = page.getByLabel(/referral.*code/i);
      const hasReferralInput = await referralInput.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasReferralInput) {
        console.log(`   Entering referral code: ${referralCode}`);
        await referralInput.fill(referralCode);

        // Wait for validation (500ms debounce + request)
        await page.waitForTimeout(1000);

        // Check validation status
        const successIcon = page.locator('[class*="text-green"]');
        const hasSuccess = await successIcon.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasSuccess) {
          console.log('   ✓ Referral code validated successfully');
        } else {
          console.warn('   ⚠️  Referral code may not be valid');
        }
      } else {
        console.log('   ℹ️  Referral step not found (may be skipped)');
      }
    }

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
