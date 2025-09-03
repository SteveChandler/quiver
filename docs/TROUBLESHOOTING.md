# Quiver Development Troubleshooting Guide

## Table of Contents

1. [Development Server Issues](#development-server-issues)
2. [Profile System Debugging](#profile-system-debugging)
3. [Database Schema Issues](#database-schema-issues)
4. [Build and Type Errors](#build-and-type-errors)
5. [Testing Issues](#testing-issues)
6. [Common Gotchas](#common-gotchas)

---

## Development Server Issues

### React Hydration Errors

**Symptoms:**
- `"Cannot read properties of undefined (reading 'call')"` in browser console
- `"Warning: An error occurred during hydration"`
- Dev server showing error overlay with webpack errors

**Root Cause:**
Stale Next.js build cache conflicting with recent code changes, particularly schema changes.

**Resolution:**
1. Stop the development server (`Ctrl+C`)
2. Clear the Next.js cache: `rm -rf .next`
3. Restart the development server: `npm run dev`

**Prevention:**
- Clear cache after major schema changes
- Clear cache after changing TypeScript types
- Clear cache if experiencing unexplained hydration issues

### Port Conflicts

**Symptoms:**
- `Port 3000 is in use, trying 3001 instead`
- Server starts on unexpected port

**Resolution:**
1. Kill processes using the port: `lsof -ti:3000 | xargs kill`
2. Or use a specific port: `PORT=3000 npm run dev`

---

## Profile System Debugging

### Instagram Field Issues

**Symptoms:**
- Instagram updates not saving
- Profile form validation errors
- TypeScript errors related to `instagram_username` vs `instagram`

**Root Cause:**
Field name inconsistency between frontend and database.

**Resolution:**
All profile components should use the `instagram` field name (not `instagram_username`):

```typescript
// ✅ Correct - Use 'instagram'
interface Profile {
  instagram: string | null;
}

// ❌ Incorrect - Don't use 'instagram_username'
interface Profile {
  instagram_username: string | null;
}
```

**Verification:**
1. Check form schema uses `instagram` field
2. Verify Profile type uses `instagram: string | null`
3. Ensure server actions don't perform field mapping

### Profile Form Validation Errors

**Symptoms:**
- Form submission fails with validation errors
- Fields appear invalid when they should be valid

**Debug Steps:**
1. Check Zod schema matches Profile interface
2. Verify form default values use correct field names
3. Check server action validation schema

**Common Fix:**
```typescript
// Ensure schema field names match database schema
const profileSchema = z.object({
  full_name: z.string().min(1),
  instagram: z.string().optional(), // Not instagram_username
  bio: z.string().optional(),
  // ... other fields
});
```

### Home Beach Display Issues

**Symptoms:**
- Home beach not displaying in profile
- "—" shown instead of beach name
- Beach selector not working

**Debug Steps:**
1. Check if `home_beach_id` is set in database
2. Verify beach data is being fetched correctly
3. Check `useDataFetcher` implementation in components

**Common Issues:**
- Missing `home_beach_id` foreign key
- Beach fetch query returns null
- Component not handling loading states

---

## Database Schema Issues

### Profile Field Mismatches

**Symptoms:**
- Profile updates partially saving
- Missing data in profile display
- TypeScript errors about missing properties

**Debug Steps:**
1. Check database schema: `\d profiles` in psql
2. Compare with `types/database.ts` Profile interface
3. Verify migration files are applied

**Resolution:**
Ensure database schema matches TypeScript types:

```sql
-- Database schema should have:
ALTER TABLE profiles ADD COLUMN instagram VARCHAR(30);

-- Not:
ALTER TABLE profiles ADD COLUMN instagram_username VARCHAR(30);
```

### Migration Issues

**Symptoms:**
- Profile updates failing silently
- Missing columns in database
- Foreign key constraint errors

**Debug Steps:**
1. Check migration status: `npx supabase db show`
2. View applied migrations: `SELECT * FROM supabase_migrations.schema_migrations;`
3. Check for failed migrations in logs

**Resolution:**
1. Reset database: `npx supabase db reset`
2. Push migrations: `npx supabase db push`
3. Verify schema: `npx supabase db diff`

---

## Build and Type Errors

### TypeScript Path Mapping Errors

**Symptoms:**
- `Cannot find module '@/components/...'` errors
- Import path resolution failures

**Root Cause:**
Running TypeScript compiler directly instead of through Next.js build system.

**Resolution:**
Use Next.js build commands instead:
```bash
# ✅ Use these
npm run build
npm run dev

# ❌ Don't use these directly
npx tsc --noEmit
npx tsc components/file.tsx
```

### JSX Configuration Errors

**Symptoms:**
- `Cannot use JSX unless the '--jsx' flag is provided`

**Root Cause:**
TypeScript compiler needs JSX configuration that Next.js provides automatically.

**Resolution:**
Always use Next.js build system for TypeScript checking.

---

## Testing Issues

### Jest Mock Issues

**Symptoms:**
- `TypeError: mockFunction.mockResolvedValue is not a function`
- Mock functions not working in tests

**Common Causes:**
1. Incorrect mock setup
2. Missing Jest configuration
3. Import/export mismatch

**Resolution:**
```typescript
// ✅ Correct mock setup
jest.mock('@/actions/profile-actions', () => ({
  updateProfile: jest.fn(),
}));

const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;

// ❌ Incorrect - missing function wrapper
jest.mock('@/actions/profile-actions');
```

### Playwright Test Failures

**Symptoms:**
- Authentication failures in E2E tests
- Tests timing out
- Element not found errors

**Debug Steps:**
1. Check test authentication setup
2. Verify test data seeding
3. Check element selectors and timing

**Common Issues:**
- Stale authentication state
- Race conditions in test setup
- Changed component selectors

---

## Common Gotchas

### 1. Field Name Consistency

Always use `instagram` (not `instagram_username`) throughout the codebase:
- Database schema
- TypeScript interfaces
- Form schemas
- Component props
- Test data

### 2. Cache Issues

When experiencing unexplained errors:
1. Clear Next.js cache: `rm -rf .next`
2. Clear node modules: `rm -rf node_modules && npm install`
3. Clear browser cache and localStorage

### 3. Server Action Patterns

Always use `withAuthenticatedAction` wrapper:

```typescript
// ✅ Correct pattern
export async function updateProfile(data: ProfileData) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Implementation
  });
}

// ❌ Avoid direct supabase calls without auth
export async function updateProfile(data: ProfileData) {
  const supabase = createClient(); // Missing auth context
  return supabase.from('profiles').update(data);
}
```

### 4. Form Validation

Ensure Zod schemas match database constraints:

```typescript
// Match database VARCHAR(30) constraint
instagram: z.string().max(30).optional(),

// Match NOT NULL constraints
full_name: z.string().min(1), // Required field
```

### 5. Data Fetching

Always use `useDataFetcher` for consistent loading states:

```typescript
// ✅ Correct pattern
const fetchProfile = useCallback(async () => {
  return await getProfile();
}, []);

const { data, loading, error } = useDataFetcher(fetchProfile);

// ❌ Avoid manual state management
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
// Manual loading logic...
```

---

## Getting Help

### Debug Information to Collect

When reporting issues, include:

1. **Error Messages**: Full error text and stack traces
2. **Environment**: Node version, npm version, browser
3. **Steps to Reproduce**: Minimal reproduction steps
4. **Expected vs Actual**: What should happen vs what happens
5. **Recent Changes**: Code changes made before issue appeared

### Log Analysis

Check these logs for debugging:
- Browser console (F12)
- Development server terminal
- Network tab for API failures
- React DevTools for component state

### Performance Debugging

Use these tools:
- React DevTools Profiler
- Chrome DevTools Performance tab
- Lighthouse audits
- Bundle analyzer: `npm run analyze`

---

## Emergency Fixes

### Quick Profile System Reset

If profile system is completely broken:

```bash
# 1. Reset database
npx supabase db reset

# 2. Clear cache
rm -rf .next

# 3. Reinstall dependencies
rm -rf node_modules && npm install

# 4. Restart server
npm run dev
```

### Quick Test Environment Reset

If tests are failing unexplainably:

```bash
# 1. Clear Jest cache
npx jest --clearCache

# 2. Reset Playwright browsers
npx playwright install

# 3. Run tests with clean state
npm run test:clean
```

This guide should help diagnose and resolve common development issues in the Quiver codebase.