# Quick Start: Dev Validation Suite

## TL;DR

```bash
# Run 51 curated tests in ~4 minutes
npm run test:e2e:dev:quick
```

## What is this?

A fast E2E test suite for development validation with:
- ✅ **51 focused tests** covering critical functionality
- ✅ **Runs in <5 minutes** for fast feedback
- ✅ **Production-quality** error detection and reporting
- ✅ **Easy to use** with single command

## First Time Setup

```bash
# 1. Generate auth state (one time)
npm run test:e2e:setup

# 2. Run tests
npm run test:e2e:dev:quick
```

## Daily Usage

### Quick Validation
```bash
# Before committing changes
npm run test:e2e:dev:quick
```

### Interactive Debugging
```bash
# Run with UI mode
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --ui
```

### Localhost Testing
```bash
# Run against local dev server
playwright test --grep @dev
```

## What's Tested?

| Category | Tests | What |
|----------|-------|------|
| 🏠 Critical Pages | 5 | Home, Beach, Map, Sessions, Profile |
| 🧭 Navigation | 8 | Routes, back button, deep links |
| 🔐 Auth | 3 | Login, protected routes |
| 🌐 API | 6 | Endpoints, errors, CORS |
| 📈 SEO | 5 | Meta tags, sitemap, OG images |
| 👆 Interactions | 8 | Search, responsive, clicks |
| 📊 Data | 5 | Integrity, console errors |
| ⚡ Performance | 5 | Load times, memory, lazy load |
| ⚠️  Errors | 6 | 404s, network, fallbacks |
| **Total** | **51** | **~4 minutes** |

## Common Commands

```bash
# Full test suite
npm run test:e2e:dev:quick

# With browser visible
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --headed

# Single test group
playwright test --grep "@dev.*Navigation"

# Specific test
playwright test --grep "@dev.*Home page loads"
```

## Troubleshooting

### Tests fail with auth errors
```bash
npm run test:e2e:auth:reset
npm run test:e2e:setup
npm run test:e2e:dev:quick
```

### Tests timeout
- Check network connection
- Verify dev environment is up
- Try with `--headed` to see what's happening

### Flaky tests
- Run again to confirm
- Check test output for specific failures
- Run in UI mode for interactive debugging

## Learn More

- **Full documentation**: `e2e/DEV_VALIDATION.md`
- **E2E architecture**: `e2e/ARCHITECTURE.md`
- **Test file**: `e2e/dev-validation.spec.ts`

## Quick Examples

### Pre-commit Hook
```bash
#!/bin/bash
npm run test:e2e:dev:quick || exit 1
```

### CI/CD
```yaml
- name: Dev Validation
  run: npm run test:e2e:dev:quick
```

### Local Development
```bash
# Make changes...
npm run test:e2e:dev:quick

# If failures:
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --ui

# Fix and re-run
```

---

**That's it!** Simple, fast, and effective. 🚀
