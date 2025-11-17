# Production Data Pull Safety Plan
**Date**: 2025-11-15
**Purpose**: Pull production data to local development for testing beach detail null reference fix
**Production Project**: vawdnbbgawichorsjiwe

## 1. Risk Analysis & Safety Considerations

### Data Sensitivity Assessment

**Beaches Table Data**:
- ✅ **LOW RISK**: Beach metadata (name, location, descriptions, tips)
- ✅ **LOW RISK**: Physical characteristics (break type, hazards, features)
- ✅ **LOW RISK**: Preference models and swell windows
- ⚠️ **MEDIUM RISK**: Private beaches with owner_id (links to user data)
- ✅ **SAFE FOR LOCAL**: No direct PII, credit cards, or authentication data

**Related Tables to Consider**:
- `beach_reviews`: May contain user-generated content
- `beach_photos`: URLs and metadata only (no actual files)
- `favorite_beaches`: User preferences (user_id linkage)
- `beach_daily_intel`: Public surf condition data

### Identified Risks

1. **Private Beach Data**: Some beaches have `is_private=true` and `owner_id`
   - Mitigation: These are UUID references, not direct PII
   - Safe for local testing as long as not committed to git

2. **User-Generated Content**: Reviews and intel posts contain user contributions
   - Mitigation: Focus on beaches table only for this specific fix
   - Don't pull auth.users or sensitive profile data

3. **Data Volume**: Production may have thousands of records
   - Mitigation: Pull full beaches table (needed to find null values)
   - Optionally filter for specific test cases after initial pull

4. **Schema Drift**: Production schema may differ from local
   - Mitigation: Use `supabase db pull` to sync schema first
   - Review migration diff before applying

### Data Anonymization Needed?

**Decision: NO** - For this specific task:
- Beaches table contains public surf spot information
- No direct PII (names, emails, passwords)
- Private beach owner_ids are just UUIDs (not identifiable without auth data)
- **DO NOT PULL**: auth.users, sensitive profile fields, payment data

## 2. Backup Strategy

### Current State
- Local Supabase running on `127.0.0.1:54322`
- Database: `postgres`
- Existing backups in `supabase/backups/` (last: 2025-09-16)

### Backup Procedure

#### Full Database Dump (Recommended)
```bash
# Create timestamped backup directory
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p supabase/backups/pre_production_pull_${BACKUP_DATE}

# Dump entire local database
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --file="supabase/backups/pre_production_pull_${BACKUP_DATE}/full_backup.sql" \
  --clean --if-exists --verbose

# Backup beaches table specifically
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --table=beaches \
  --file="supabase/backups/pre_production_pull_${BACKUP_DATE}/beaches_only.sql" \
  --clean --if-exists --verbose

# Export beaches data as JSON for easy inspection
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "COPY (SELECT * FROM beaches) TO STDOUT WITH CSV HEADER" \
  > "supabase/backups/pre_production_pull_${BACKUP_DATE}/beaches_data.csv"
```

#### Schema-Only Backup
```bash
# Backup current schema structure
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --schema-only \
  --file="supabase/backups/pre_production_pull_${BACKUP_DATE}/schema_only.sql"
```

### Backup Verification
```bash
# Verify backup file exists and has content
ls -lh supabase/backups/pre_production_pull_${BACKUP_DATE}/
wc -l supabase/backups/pre_production_pull_${BACKUP_DATE}/full_backup.sql
```

## 3. Production Data Pull Procedure

### Method 1: Using Supabase CLI (Recommended)

#### Step 1: Link to Production Project
```bash
# Link to production (requires auth)
supabase link --project-ref vawdnbbgawichorsjiwe

# Verify link
supabase projects list
```

#### Step 2: Pull Schema from Production
```bash
# Pull remote schema to understand differences
supabase db pull --schema public

# Review the generated migration file
ls -lrt supabase/migrations/ | tail -1
```

#### Step 3: Dump Production Data
```bash
# Option A: Dump entire production database (CAREFUL - large file)
supabase db dump --data-only > supabase/production_data_$(date +%Y%m%d).sql

# Option B: Dump specific tables only
supabase db dump --data-only --table=beaches > supabase/production_beaches_$(date +%Y%m%d).sql
supabase db dump --data-only --table=beach_reviews > supabase/production_reviews_$(date +%Y%m%d).sql
```

#### Step 4: Load Data into Local Database
```bash
# Load production data into local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  < supabase/production_beaches_$(date +%Y%m%d).sql
```

### Method 2: Using pg_dump/pg_restore with Remote Connection

```bash
# Connect to production and dump specific table
# NOTE: Requires production database credentials
pg_dump "postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/postgres" \
  --table=beaches \
  --data-only \
  --file="supabase/production_beaches_direct.sql"

# Load into local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  < supabase/production_beaches_direct.sql
```

### Method 3: Using Supabase API/SDK (Alternative)

```sql
-- Run in production SQL editor, export results
SELECT * FROM beaches
WHERE features IS NULL OR warnings IS NULL
ORDER BY created_at DESC;

-- Export as CSV/JSON and import to local
```

## 4. Data Verification Plan

### Schema Consistency Check
```sql
-- Compare column definitions
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'beaches'
ORDER BY ordinal_position;
```

### Data Integrity Validation
```sql
-- Count total beaches
SELECT COUNT(*) as total_beaches FROM beaches;

-- Check for null features and warnings
SELECT
  COUNT(*) FILTER (WHERE features IS NULL) as null_features,
  COUNT(*) FILTER (WHERE warnings IS NULL) as null_warnings,
  COUNT(*) FILTER (WHERE features IS NULL AND warnings IS NULL) as both_null
FROM beaches;

-- Find specific examples with null values
SELECT
  id,
  name,
  city,
  state,
  features,
  warnings,
  created_at
FROM beaches
WHERE features IS NULL OR warnings IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Identify Test Cases
```sql
-- Find beaches with null features for testing
SELECT
  id,
  name,
  slug,
  city,
  state,
  'NULL features' as test_case
FROM beaches
WHERE features IS NULL
LIMIT 5;

-- Find beaches with null warnings for testing
SELECT
  id,
  name,
  slug,
  city,
  state,
  'NULL warnings' as test_case
FROM beaches
WHERE warnings IS NULL
LIMIT 5;

-- Find beaches with both null for edge case testing
SELECT
  id,
  name,
  slug,
  city,
  state,
  'BOTH NULL' as test_case
FROM beaches
WHERE features IS NULL AND warnings IS NULL
LIMIT 5;
```

## 5. Rollback Procedure

### Full Database Restore
```bash
# If something goes wrong, restore from backup
BACKUP_DATE=20251115_XXXXXX  # Use actual timestamp from backup

# Stop Supabase local
supabase stop

# Reset database
supabase db reset

# Restore from backup
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  < supabase/backups/pre_production_pull_${BACKUP_DATE}/full_backup.sql

# Restart Supabase
supabase start
```

### Beaches Table Only Restore
```bash
# Restore just the beaches table
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<EOF
TRUNCATE beaches CASCADE;
\i supabase/backups/pre_production_pull_${BACKUP_DATE}/beaches_only.sql
EOF
```

### Revert to Migration State
```bash
# Alternative: Reset to known migration state
supabase db reset

# Then re-apply migrations up to specific point
supabase migration up --version 20251113000000
```

## 6. Safety Checklist

Before proceeding:
- [ ] Local Supabase is running (`supabase status`)
- [ ] Current database is backed up (full dump + beaches table)
- [ ] Backup files verified (non-zero size, readable)
- [ ] Rollback procedure documented and tested
- [ ] NOT connected to production in application code
- [ ] `.env.local` points to local Supabase
- [ ] Git status clean (or changes committed)

During pull:
- [ ] Pull schema first, review migrations
- [ ] Pull data in stages (beaches first)
- [ ] Verify data after each stage
- [ ] Monitor disk space
- [ ] Check for errors in output

After pull:
- [ ] Verify null values exist for testing
- [ ] Test beach detail page with null data
- [ ] Confirm fix works as expected
- [ ] Document test beach IDs/slugs
- [ ] Add to `.gitignore` any production data files

## 7. Post-Pull Actions

### Update .gitignore
```bash
# Ensure production data is not committed
echo "supabase/production_*.sql" >> .gitignore
echo "supabase/backups/pre_production_pull_*" >> .gitignore
```

### Document Test Cases
Create `docs/testing/beach-null-test-cases.md` with:
- Specific beach IDs with null features
- Specific beach IDs with null warnings
- Expected behavior after fix
- Screenshots/traces of before/after

### Clean Up After Testing
```bash
# Once fix is verified, optionally restore clean state
# (if you don't want production data lingering)
supabase db reset
```

## 8. Estimated Timeline

- Backup current local DB: **5 minutes**
- Link to production & pull schema: **5 minutes**
- Pull production beaches data: **5-10 minutes**
- Verify data & identify test cases: **10 minutes**
- Test fix with real data: **15-20 minutes**
- **Total: 40-50 minutes**

## 9. Success Criteria

✅ Local database backed up successfully
✅ Production data pulled without errors
✅ Null values confirmed in beaches.features and beaches.warnings
✅ At least 3 test beaches identified for each null case
✅ Beach detail pages load without crashing
✅ Rollback procedure verified (dry run)
✅ No production data committed to git

## 10. Emergency Contacts

- Production Database: vawdnbbgawichorsjiwe
- Local Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- Backup Location: `/Users/stevenchandler/Desktop/quiver/quiver/supabase/backups/`
- Issue: Beach detail page null reference (features/warnings fields)

---

**Next Steps**: Execute backup, then pull production data following procedures above.
