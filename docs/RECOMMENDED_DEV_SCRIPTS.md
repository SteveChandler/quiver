# Recommended Development Scripts

**Date**: November 15, 2025
**Purpose**: Prevent stale webpack bundle issues and improve development workflow

## Overview

After resolving the stale webpack bundle issue (see `STALE_WEBPACK_BUNDLE_FIX.md`), these scripts are recommended to prevent future occurrences and improve developer experience.

## Recommended package.json Additions

Add these scripts to the `"scripts"` section of `package.json`:

```json
{
  "scripts": {
    // ... existing scripts ...

    // Development Server Management
    "dev:clean": "rm -rf .next && yarn dev",
    "dev:safe": "yarn dev:check && yarn dev",
    "dev:check": "lsof -ti:3000 && echo '⚠️  Port 3000 already in use! Kill with: kill -9 $(lsof -ti:3000)' && exit 1 || echo '✓ Port 3000 is available'",
    "dev:kill": "lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null; echo '✓ Dev servers killed'",
    "dev:restart": "yarn dev:kill && yarn dev:clean",

    // Cache Management
    "cache:clear": "rm -rf .next && find node_modules/.cache -type f -delete 2>/dev/null; echo '✓ Caches cleared'",
    "cache:check": "du -sh .next 2>/dev/null || echo 'No .next directory'",
    "cache:webpack": "du -sh .next/cache/webpack 2>/dev/null || echo 'No webpack cache'",

    // Diagnostic Scripts
    "dev:status": "lsof -ti:3000,3001,3002 && echo 'Dev servers running on ports above' || echo '✓ No dev servers running'",
    "dev:ports": "lsof -i:3000,3001,3002 | grep LISTEN || echo '✓ No ports in use'",

    // All-in-One Fixes
    "dev:fix": "yarn dev:kill && yarn cache:clear && yarn dev",
    "dev:diagnose": "echo '=== Dev Server Status ===' && yarn dev:status && echo '\n=== Port Status ===' && yarn dev:ports && echo '\n=== Cache Status ===' && yarn cache:check && yarn cache:webpack"
  }
}
```

## Script Descriptions

### Development Server Management

#### `dev:clean`
Clears the `.next` build directory and starts a fresh dev server.
```bash
yarn dev:clean
```
**Use when**: Switching branches, resolving HMR issues, or after pulling updates.

#### `dev:safe`
Checks if port 3000 is available before starting the dev server.
```bash
yarn dev:safe
```
**Use when**: You want to prevent accidentally starting multiple dev servers.

#### `dev:check`
Verifies port 3000 availability without starting the server.
```bash
yarn dev:check
```
**Use when**: Diagnosing port conflicts before starting development.

#### `dev:kill`
Kills all dev servers running on ports 3000, 3001, or 3002.
```bash
yarn dev:kill
```
**Use when**: You need to clean up multiple dev server processes.

#### `dev:restart`
Kills all dev servers, clears cache, and starts fresh.
```bash
yarn dev:restart
```
**Use when**: Complete reset is needed (most common fix for issues).

### Cache Management

#### `cache:clear`
Removes `.next` directory and `node_modules/.cache`.
```bash
yarn cache:clear
```
**Use when**: Experiencing stale cache issues or after dependency updates.

#### `cache:check`
Shows the size of the `.next` build directory.
```bash
yarn cache:check
```
**Use when**: Monitoring cache growth or diagnosing build issues.

#### `cache:webpack`
Shows the size of webpack cache specifically.
```bash
yarn cache:webpack
```
**Use when**: Investigating webpack-specific cache problems.

### Diagnostic Scripts

#### `dev:status`
Shows all running dev server processes.
```bash
yarn dev:status
```
**Use when**: Checking if any dev servers are running.

#### `dev:ports`
Shows detailed information about processes using dev server ports.
```bash
yarn dev:ports
```
**Use when**: Investigating port conflicts or process details.

#### `dev:diagnose`
Comprehensive diagnostic report of dev server and cache status.
```bash
yarn dev:diagnose
```
**Use when**: Troubleshooting any development environment issues.

### All-in-One Fixes

#### `dev:fix`
The nuclear option - kills servers, clears all caches, starts fresh.
```bash
yarn dev:fix
```
**Use when**: Experiencing any unexplained development issues.

## Development Workflow Best Practices

### Starting Development
```bash
# Recommended: Check status first
yarn dev:diagnose

# If ports are in use
yarn dev:kill

# Start development
yarn dev
# OR for a clean start
yarn dev:clean
```

### After Pulling Updates
```bash
# Clean start recommended
yarn dev:restart
```

### When Experiencing Issues
```bash
# Quick fix
yarn dev:restart

# If issues persist
yarn cache:clear
yarn install
yarn dev
```

### Before Committing
```bash
# Ensure clean state
yarn dev:kill
yarn cache:clear
yarn build
```

## Common Scenarios

### Scenario 1: "My changes aren't showing up"
**Solution**:
```bash
yarn dev:restart
```
**Explanation**: Clears webpack cache and restarts with fresh build.

### Scenario 2: "Port 3000 already in use"
**Solution**:
```bash
yarn dev:kill
yarn dev
```
**Explanation**: Kills zombie processes and starts fresh server.

### Scenario 3: "Error at line X but file only has Y lines"
**Solution**:
```bash
yarn dev:fix
```
**Explanation**: Classic stale webpack bundle - this is the complete fix.

### Scenario 4: "Slow HMR or build times"
**Check**:
```bash
yarn cache:check
yarn cache:webpack
```
**If large caches (>500MB)**:
```bash
yarn cache:clear
yarn dev
```

### Scenario 5: "Just pulled main and everything's broken"
**Solution**:
```bash
yarn install
yarn dev:restart
```
**Explanation**: Updates dependencies and clears stale cache.

## Integration with CI/CD

### Pre-Commit Hook (Optional)
Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Kill dev servers before commit
yarn dev:kill

# Optionally clear cache
# yarn cache:clear
```

### CI Pipeline
Add cache clearing to CI:
```yaml
# .github/workflows/ci.yml
- name: Clear Next.js cache
  run: rm -rf .next

- name: Build
  run: yarn build
```

## Monitoring and Alerting

### Development Dashboard (Optional)
Create a simple dashboard script:
```bash
#!/bin/bash
# scripts/dev-dashboard.sh

while true; do
  clear
  echo "=== Quiver Development Dashboard ==="
  echo ""
  echo "Dev Servers:"
  lsof -ti:3000,3001,3002 | wc -l | xargs echo "  Running: "
  echo ""
  echo "Cache Status:"
  du -sh .next 2>/dev/null || echo "  No .next cache"
  echo ""
  echo "Last Updated: $(date)"
  sleep 5
done
```

Make executable:
```bash
chmod +x scripts/dev-dashboard.sh
```

Add to package.json:
```json
{
  "scripts": {
    "dev:dashboard": "bash scripts/dev-dashboard.sh"
  }
}
```

## Performance Metrics

### Expected Build Times
- **Cold Build**: 15-30s (no cache)
- **Warm Build**: 3-5s (with cache)
- **HMR Update**: <1s (single file change)

### Expected Cache Sizes
- **Healthy**: <200MB
- **Warning**: 200-500MB (consider clearing)
- **Critical**: >500MB (definitely clear)

### Port Usage
- **Expected**: 1 process on port 3000
- **Warning**: 2+ processes on any port
- **Critical**: Processes on multiple ports (3000, 3001, 3002)

## Troubleshooting Guide

### Issue: Script fails with "command not found"
**Cause**: Missing system utilities (`lsof`, `xargs`)
**Solution**:
- macOS: Already included
- Linux: `sudo apt-get install lsof psmisc`
- Windows: Use WSL or adjust scripts for PowerShell

### Issue: Permission denied
**Cause**: Insufficient permissions to kill processes
**Solution**:
```bash
sudo yarn dev:kill
```
Or kill manually:
```bash
sudo kill -9 $(lsof -ti:3000)
```

### Issue: Scripts slow down over time
**Cause**: Large webpack cache
**Solution**:
```bash
yarn cache:clear
# Restart dev server
yarn dev
```

## Future Improvements

### Potential Enhancements
1. **Auto-detection**: Automatically detect and kill zombie processes on `yarn dev`
2. **Cache rotation**: Automatically clear cache when it exceeds threshold
3. **Port selection**: Automatically use next available port if 3000 is taken
4. **Health checks**: Periodic health checks with auto-recovery
5. **Metrics collection**: Track build times and cache growth over time

### Next.js Config Improvements
Consider adding to `next.config.mjs`:
```javascript
{
  // Limit cache size
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // More aggressive cache invalidation
  experimental: {
    // Consider webpack memory cache instead of filesystem
    webpackBuildWorker: true,
  }
}
```

## References

- Original Issue: `docs/STALE_WEBPACK_BUNDLE_FIX.md`
- Next.js Caching: https://nextjs.org/docs/app/building-your-application/caching
- Webpack Caching: https://webpack.js.org/configuration/cache/

---

**Last Updated**: November 15, 2025
**Maintained by**: Development Team
**Status**: Recommended for implementation
