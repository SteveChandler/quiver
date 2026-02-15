# Production Mock Users Seeding Script

This script creates realistic mock users for Quiver's production environment to support community features, testing, and demos.

## Features

- **Safe Production Usage**: Creates auth users with unconfirmed emails using `@example.invalid` domain
- **Idempotent**: Safe to run multiple times without duplicating data
- **Comprehensive**: Creates auth users, profiles, and boards with realistic data
- **Trackable**: All mock users are flagged with `is_mock=true` for easy identification
- **Self-Cleaning**: Automatically cleans up orphaned auth users

## Requirements

### 1. Environment Variables

Set these environment variables before running:

```bash
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2. Database Migration

Run the migration to add the `is_mock` column:

```bash
# Apply the migration (using Supabase CLI or your preferred method)
supabase db push
# OR manually run: supabase/migrations/20250827000001_add_is_mock_to_profiles.sql
```

### 3. Dependencies

Ensure `ts-node` is installed:

```bash
yarn install --frozen-lockfile  # ts-node is included in devDependencies
```

## Usage

### Run the Seeding Script

```bash
yarn seed:prod-mock-users
```

### Expected Output

```
🏄‍♂️ Quiver Mock Users Seeding Script
=====================================

🔍 Validating database schema...
✅ Schema validation passed

🧹 Checking for orphaned mock auth users...
✅ No orphaned auth users found

🌱 Seeding mock users...

🔄 Processing user: Solid Snake
   ✅ Created auth user: solid.snake@example.invalid
   ✅ Created profile: Solid Snake
   ✅ Created board: High Performance

... (continues for all users)

📊 Seeding Summary
==================
✅ Successfully processed: 15 users
❌ Errors: 0 users
📁 Total mock users attempted: 15

🎉 All mock users seeded successfully!

💡 Next steps:
   - Mock users are marked with is_mock=true in profiles
   - Auth users have email_confirmed=false for safety
   - All emails use @example.invalid domain (non-deliverable)
   - You can query mock users with: SELECT * FROM profiles WHERE is_mock = true
```

## Mock Users Created

The script creates 15 diverse mock users representing different experience levels and surf personas:

### Beginner (0.5-1 years)
- **Riley R.** - Learning the basics
- **Emma F.** - Forecast validation enthusiast

### Intermediate (1.5-5 years)
- **Solid Snake** & **Liquid Snake** - Performance-focused surfers
- **Local Larry** - Longtime local knowledge
- **Tina C.** - Travel surf adventures
- **M. Johnson** - East Coast conditions
- **Ryan K.** - Data-driven approach
- **Mia R.** - Safety-first surfing

### Advanced (6-7 years)
- **Big Boss** - Experienced with guns for bigger waves
- **Dawn Patrol** - Early morning sessions
- **SoCal Sofia** - SoCal longboard culture
- **NorCal Jake** - Northern California conditions

### Expert (10+ years)
- **P. Martinez** - Surf photography
- **Kai N.** - Hawaiian big wave expertise

## Board Assignments

Each user gets a board matching their persona and experience level:

- **Beginners**: 9'0"+ longboards for stability
- **Intermediates**: 6'2"-6'4" all-around boards
- **Advanced**: Performance shortboards and specialized boards
- **Experts**: Guns, custom boards, and specialized equipment

## Safety Features

### Database Safety
- **No Real User Deletion**: Script never deletes existing users
- **Mock-Only Operations**: All operations target mock users with `@example.invalid` emails
- **Transactional Safety**: Each user creation is wrapped in error handling
- **Schema Validation**: Validates required database schema before proceeding

### Auth Safety
- **Unconfirmed Emails**: All auth users created with `email_confirmed=false`
- **Invalid Domains**: Uses `@example.invalid` (guaranteed non-deliverable per RFC 2606)
- **Mock Metadata**: Auth users tagged with `is_mock_user=true` metadata
- **Orphan Cleanup**: Automatically removes orphaned auth users without profiles

### Production Safety
- **Reversible**: Mock users can be safely removed by querying `is_mock=true`
- **Identifiable**: Clear naming patterns and metadata for identification
- **Isolated**: Mock users don't interfere with real user operations

## Querying Mock Users

### View All Mock Users
```sql
SELECT full_name, email, created_at, experience_level
FROM profiles
WHERE is_mock = true
ORDER BY created_at;
```

### View Mock Users with Boards
```sql
SELECT 
  p.full_name,
  p.experience_level,
  b.name as board_name,
  b.board_type,
  b.dimensions
FROM profiles p
JOIN boards b ON p.id = b.user_id
WHERE p.is_mock = true
ORDER BY p.full_name;
```

### Count Mock vs Real Users
```sql
SELECT 
  is_mock,
  COUNT(*) as user_count
FROM profiles 
GROUP BY is_mock;
```

## Cleanup

### Remove All Mock Users
```sql
-- Remove in correct order to respect foreign key constraints
DELETE FROM boards WHERE user_id IN (SELECT id FROM profiles WHERE is_mock = true);
DELETE FROM profiles WHERE is_mock = true;
-- Note: Auth users should be cleaned up via Supabase Admin API
```

### Remove Specific Mock User
```sql
-- Replace 'user-uuid-here' with actual user ID
DELETE FROM boards WHERE user_id = 'user-uuid-here';
DELETE FROM profiles WHERE id = 'user-uuid-here' AND is_mock = true;
```

## Troubleshooting

### Schema Validation Failed
If you see "is_mock column missing":
1. Run the migration: `supabase db push`
2. Or manually apply: `supabase/migrations/20250827000001_add_is_mock_to_profiles.sql`

### Environment Variables Missing
Ensure both environment variables are set:
```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### Permission Errors
Ensure your service role key has the required permissions:
- `auth.admin.createUser` - Create auth users
- `INSERT` on `profiles` and `boards` tables
- `SELECT` for validation queries

### Orphaned Auth Users
The script automatically cleans up orphaned auth users (auth users without profiles), but you can also clean them manually via the Supabase dashboard.

## Integration with Tests

Mock users can be used in E2E tests:

```typescript
// Example: Get a mock user for testing
const mockUser = await supabase
  .from('profiles')
  .select('*')
  .eq('is_mock', true)
  .eq('full_name', 'Solid Snake')
  .single();
```

## Contributing

When adding new mock users:
1. Add to the `mockUsers` array in `scripts/seed-prod-mock-users.ts`
2. Follow the naming convention: `Name "Nickname" Surname`
3. Use `@example.invalid` email domain
4. Include realistic experience levels and board data
5. Test the script locally before deploying

## Security Notes

- **Never use real email domains** for mock users
- **Service role keys** should be kept secure and not committed to version control
- **Mock users** should not be used for actual authentication testing in production
- **Regular cleanup** of unused mock users is recommended

This script is designed to be safe for production use while providing realistic test data for community features and development.