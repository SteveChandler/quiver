import { FullConfig } from '@playwright/test';

/**
 * Temporary minimal global setup - skips authentication for guest tests
 */
async function globalSetup(config: FullConfig) {
  console.log('[Global Setup] Skipping authentication setup for guest tests');
  console.log('[Global Setup] Base URL:', config.projects[0].use.baseURL);

  // Create empty auth state file
  const fs = require('fs');
  const authFile = 'e2e/.auth/state.json';
  fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));

  console.log('[Global Setup] Created empty auth state for guest tests');
  console.log('[Global Setup] ✓ Setup completed\n');
}

export default globalSetup;
