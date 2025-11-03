# E2E Test Data Scripts

This directory contains scripts for creating test data needed by E2E tests.

## Creating Test Sessions with Photos

Some E2E tests (like `feed-photo-thumbnails.spec.ts`) require sessions with photos to exist in the test account. If these tests are skipping, you can create test data using the provided script.

### Prerequisites

1. Ensure you're authenticated: `npx playwright test --grep auth` (this creates `e2e/.auth/state.json`)
2. Ensure local or dev environment is running

### Running the Script

```bash
# Local environment (default)
npx ts-node e2e/scripts/create-photo-test-data.ts

# Dev environment (uses BASE_URL from .env.playwright)
# Make sure BASE_URL=https://dev.quiversurf.app in .env.playwright
npx ts-node e2e/scripts/create-photo-test-data.ts
```

The script automatically uses the `BASE_URL` from your `.env.playwright` file and the authentication state from `e2e/.auth/state.json`.

This will:
- Check your test account for existing sessions
- Create up to 5 sessions with photos if needed
- Create sessions with varying photo counts (1, 2, 3 photos)
- Use different beaches (Blacks, Swamis, Windansea)

### What It Creates

The script creates test sessions through the UI wizard:
- **Session 1**: Blacks Beach, 3 stars, 1 photo
- **Session 2**: Swamis, 4 stars, 2 photos
- **Session 3**: Windansea, 5 stars, 3 photos
- *And so on...*

### Troubleshooting

**Script fails with "locator.click: Test ended"**
- The session wizard UI may have changed
- Check that the beach names exist in your environment
- Try running with `headless: false` to see what's happening

**Photos not uploading**
- Check that test images are being created in `e2e/.test-images/`
- Verify file input elements are accessible
- Check browser console for upload errors

**Sessions created but tests still skip**
- Ensure photos actually uploaded (check session detail pages)
- Verify test selectors match your UI implementation
- Check that sessions appear in the feed (navigate to /sessions manually)

## Test Image Management

Test images are automatically created as minimal valid JPEGs and stored in:
```
e2e/.test-images/
├── test-image-1.jpg
├── test-image-2.jpg
└── test-image-3.jpg
```

These are created on demand and reused across test runs. They're gitignored and can be safely deleted.

## Alternative: Manual Test Data

If the automated script doesn't work in your environment, you can create test data manually:

1. Log in to the test account
2. Navigate to `/new` (session wizard)
3. Create 3-5 sessions at different beaches
4. Upload 1-3 photos to each session
5. Run the E2E tests

## Integration with Tests

Tests use graceful skipping when data doesn't exist:

```typescript
if (count === 0) {
  test.skip(true, "No sessions available - run e2e/scripts/create-photo-test-data.ts");
  return;
}
```

This allows tests to:
- ✅ Pass when data exists
- ⏭️ Skip gracefully when data doesn't exist
- 💡 Provide clear guidance on creating data

## CI/CD Integration

For CI environments, consider:

1. **Seed script in CI pipeline**:
   ```yaml
   - name: Create test data
     run: npx ts-node e2e/scripts/create-photo-test-data.ts
   ```

2. **Use persistent test account** with pre-existing sessions

3. **Mock test data** by creating sessions via API instead of UI
