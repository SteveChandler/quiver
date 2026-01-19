#!/usr/bin/env npx tsx
/**
 * Persona Authentication Setup Script
 *
 * Runs once before persona tests to authenticate all 6 NPC personas
 * and save their individual auth states for parallel test execution.
 *
 * Usage:
 *   npx tsx e2e/persona-setup.ts
 *   yarn test:e2e:persona-setup
 *
 * Environment Variables:
 *   - BASE_URL: Target application URL (default: http://localhost:3000)
 *   - PERSONA_PASSWORD: Password for all persona accounts (default: testpassword123)
 *   - VERCEL_BYPASS_TOKEN: Token for Vercel protection bypass (optional)
 *   - VERBOSE: Set to 'true' for detailed logging
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 * @see e2e/utils/persona-auth.ts - Authentication utilities
 */

import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { authenticateAllPersonas } from './utils/persona-auth';
import { ALL_PERSONA_TYPES, PERSONAS } from './fixtures/personas';

// Load environment variables with same precedence as playwright.config.ts
dotenv.config();
dotenv.config({ path: '.env.playwright', override: true });
if (existsSync('.env.playwright.local')) {
  dotenv.config({ path: '.env.playwright.local', override: true });
}

async function main() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const verbose = process.env.VERBOSE === 'true';
  const vercelBypassToken =
    process.env.VERCEL_BYPASS_TOKEN ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.VERCEL_BYPASS;

  console.log('');
  console.log('='.repeat(60));
  console.log('  Quiver Persona Authentication Setup');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Target URL: ${baseURL}`);
  console.log(`Personas to authenticate: ${ALL_PERSONA_TYPES.length}`);
  console.log('');

  // List personas being authenticated
  console.log('Persona Accounts:');
  for (const type of ALL_PERSONA_TYPES) {
    const persona = PERSONAS[type];
    console.log(`  - ${persona.displayName}: ${persona.email}`);
  }
  console.log('');

  const startTime = Date.now();

  try {
    const results = await authenticateAllPersonas(baseURL, {
      maxAttempts: 3,
      verbose,
      vercelBypassToken,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('='.repeat(60));
    console.log('  Results');
    console.log('='.repeat(60));
    console.log('');

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      console.log('Authenticated:');
      for (const result of successful) {
        const persona = PERSONAS[result.personaType];
        console.log(`  [OK] ${persona.displayName}`);
        console.log(`       State: ${result.authStatePath}`);
      }
      console.log('');
    }

    if (failed.length > 0) {
      console.log('Failed:');
      for (const result of failed) {
        const persona = PERSONAS[result.personaType];
        console.log(`  [FAIL] ${persona.displayName}`);
        console.log(`         Error: ${result.error}`);
      }
      console.log('');
    }

    console.log(`Total time: ${elapsed}s`);
    console.log(`Success: ${successful.length}/${results.length}`);
    console.log('');

    if (failed.length > 0) {
      console.log('Some personas failed to authenticate.');
      console.log('Common issues:');
      console.log('  1. Mock users not seeded: Run "yarn seed:prod-mock-users"');
      console.log('  2. Incorrect password: Set PERSONA_PASSWORD env var');
      console.log('  3. Users need passwords: Check user auth in Supabase dashboard');
      console.log('');
      process.exit(1);
    }

    console.log('All personas authenticated successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run persona tests: yarn test:e2e:personas');
    console.log('  2. Run specific persona: yarn test:e2e e2e/personas/rookie.spec.ts');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('Setup failed with unexpected error:');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// Execute if called directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
