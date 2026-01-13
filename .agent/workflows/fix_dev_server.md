---
description: Fix development server (restart, clean cache)
---

# Fix Development Server

This workflow implements the "nuclear option" for fixing dev server issues, stale bundles, or HMR problems.

## Steps

1. Kill existing dev servers
   // turbo
2. Clear Next.js cache and node_modules cache
3. Restart development server

```bash
# Step 1: Kill servers
yarn dev:kill

# Step 2: Clear cache
yarn cache:clear

# Step 3: Restart
yarn dev
```
