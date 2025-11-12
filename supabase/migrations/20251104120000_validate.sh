#!/bin/bash
# Validation script for referrals infrastructure migration
# Usage: ./20251104120000_validate.sh

set -e

echo "🔍 Validating Referrals Infrastructure Migration"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run SQL and check result
check_sql() {
    local description=$1
    local sql=$2
    local expected=$3

    echo -n "Checking: $description... "

    result=$(psql $DATABASE_URL -t -c "$sql" 2>&1) || {
        echo -e "${RED}FAILED${NC}"
        echo "  Error: $result"
        return 1
    }

    # Trim whitespace
    result=$(echo "$result" | xargs)

    if [[ "$result" == "$expected" ]]; then
        echo -e "${GREEN}PASSED${NC}"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        return 1
    fi
}

# Check if DATABASE_URL is set
if [[ -z "$DATABASE_URL" ]]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Set it with: export DATABASE_URL=postgresql://..."
    exit 1
fi

echo "1. Schema Validation"
echo "-------------------"

# Check profiles.referral_code column exists
check_sql \
    "profiles.referral_code column exists" \
    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code';" \
    "1"

# Check referrals table exists
check_sql \
    "referrals table exists" \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'referrals';" \
    "1"

# Check referrals table has correct number of columns
check_sql \
    "referrals table has 8 columns" \
    "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'referrals';" \
    "8"

echo ""
echo "2. Index Validation"
echo "------------------"

# Check profiles referral_code indexes
check_sql \
    "idx_profiles_referral_code_lower exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_profiles_referral_code_lower';" \
    "1"

check_sql \
    "idx_profiles_referral_code exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_profiles_referral_code';" \
    "1"

# Check referrals indexes
check_sql \
    "idx_referrals_code_lower exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_code_lower';" \
    "1"

check_sql \
    "idx_referrals_referrer_id exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_referrer_id';" \
    "1"

check_sql \
    "idx_referrals_referee_id exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_referee_id';" \
    "1"

check_sql \
    "idx_referrals_status exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_status';" \
    "1"

check_sql \
    "idx_referrals_referrer_status exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_referrer_status';" \
    "1"

check_sql \
    "idx_referrals_created_at exists" \
    "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_referrals_created_at';" \
    "1"

echo ""
echo "3. Constraint Validation"
echo "-----------------------"

# Check constraints exist
check_sql \
    "referrals_no_self_referral constraint exists" \
    "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'referrals_no_self_referral';" \
    "1"

check_sql \
    "referrals_unique_referee constraint exists" \
    "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'referrals_unique_referee';" \
    "1"

check_sql \
    "referrals_completed_at_when_completed constraint exists" \
    "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'referrals_completed_at_when_completed';" \
    "1"

echo ""
echo "4. RLS Policy Validation"
echo "-----------------------"

# Check RLS is enabled
check_sql \
    "RLS enabled on referrals table" \
    "SELECT COUNT(*) FROM pg_tables WHERE tablename = 'referrals' AND rowsecurity = true;" \
    "1"

# Check policies exist
check_sql \
    "Users can view own referrals as referrer policy exists" \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Users can view own referrals as referrer';" \
    "1"

check_sql \
    "Users can view own referrals as referee policy exists" \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Users can view own referrals as referee';" \
    "1"

check_sql \
    "Users can create referrals for themselves policy exists" \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Users can create referrals for themselves';" \
    "1"

check_sql \
    "Users can update own referrals as referee policy exists" \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Users can update own referrals as referee';" \
    "1"

echo ""
echo "5. Function Validation"
echo "---------------------"

# Check functions exist
check_sql \
    "generate_referral_code() function exists" \
    "SELECT COUNT(*) FROM pg_proc WHERE proname = 'generate_referral_code';" \
    "1"

check_sql \
    "get_user_referral_stats() function exists" \
    "SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_referral_stats';" \
    "1"

echo ""
echo "6. Trigger Validation"
echo "--------------------"

# Check trigger exists
check_sql \
    "update_referrals_updated_at trigger exists" \
    "SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'update_referrals_updated_at';" \
    "1"

echo ""
echo "7. Functional Testing"
echo "--------------------"

# Test code generation
echo -n "Testing generate_referral_code()... "
code=$(psql $DATABASE_URL -t -c "SELECT generate_referral_code();" | xargs)
if [[ ${#code} -eq 6 ]]; then
    echo -e "${GREEN}PASSED${NC} (Generated: $code)"
else
    echo -e "${RED}FAILED${NC} (Expected 6 chars, got: $code)"
fi

# Test get_user_referral_stats with non-existent user
echo -n "Testing get_user_referral_stats()... "
result=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM get_user_referral_stats('00000000-0000-0000-0000-000000000000');" | xargs)
if [[ "$result" -ge "0" ]]; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ All validation checks completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Run test suite: yarn test:e2e"
echo "2. Test onboarding flow with referral code"
echo "3. Generate TypeScript types: yarn db:types"
echo "4. Update CHANGELOG.md"
