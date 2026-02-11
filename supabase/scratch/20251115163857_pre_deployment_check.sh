#!/bin/bash

# Pre-Deployment Checklist for Beach Photos Cleanup Migration
# Migration: 20251115163857_cleanup_orphaned_beach_photos
# Created: 2025-11-15

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check marks
CHECK_MARK="${GREEN}✓${NC}"
CROSS_MARK="${RED}✗${NC}"
WARNING_MARK="${YELLOW}⚠${NC}"

echo -e "${BLUE}===============================================================================${NC}"
echo -e "${BLUE}Beach Photos Cleanup Migration - Pre-Deployment Check${NC}"
echo -e "${BLUE}Migration: 20251115163857_cleanup_orphaned_beach_photos${NC}"
echo -e "${BLUE}===============================================================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${CROSS_MARK} DATABASE_URL environment variable is not set"
    echo -e "${YELLOW}Please set DATABASE_URL to your Supabase database connection string${NC}"
    echo -e "Example: export DATABASE_URL='postgresql://...'${NC}"
    exit 1
fi
echo -e "${CHECK_MARK} DATABASE_URL is set"

# Check if required migration files exist
MIGRATION_DIR="supabase/migrations"
MAIN_MIGRATION="${MIGRATION_DIR}/20251115163857_cleanup_orphaned_beach_photos.sql"
ROLLBACK_MIGRATION="${MIGRATION_DIR}/20251115163857_cleanup_orphaned_beach_photos_rollback.sql"
VERIFY_QUERIES="${MIGRATION_DIR}/20251115163857_cleanup_orphaned_beach_photos_verify.sql"

if [ ! -f "$MAIN_MIGRATION" ]; then
    echo -e "${CROSS_MARK} Main migration file not found: $MAIN_MIGRATION"
    exit 1
fi
echo -e "${CHECK_MARK} Main migration file exists"

if [ ! -f "$ROLLBACK_MIGRATION" ]; then
    echo -e "${WARNING_MARK} Rollback migration file not found: $ROLLBACK_MIGRATION"
else
    echo -e "${CHECK_MARK} Rollback migration file exists"
fi

if [ ! -f "$VERIFY_QUERIES" ]; then
    echo -e "${WARNING_MARK} Verification queries file not found: $VERIFY_QUERIES"
else
    echo -e "${CHECK_MARK} Verification queries file exists"
fi

echo ""
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"
echo -e "${BLUE}Current Database State${NC}"
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"

# Count total beach_photos
TOTAL_PHOTOS=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM public.beach_photos;" 2>/dev/null || echo "ERROR")
if [ "$TOTAL_PHOTOS" = "ERROR" ]; then
    echo -e "${CROSS_MARK} Failed to query beach_photos table"
    echo -e "${YELLOW}Make sure you have access to the database${NC}"
    exit 1
fi
echo -e "Total beach_photos: ${YELLOW}$TOTAL_PHOTOS${NC}"

# Count orphaned beach_photos
ORPHANED_PHOTOS=$(psql "$DATABASE_URL" -t -A -c "
    SELECT COUNT(*)
    FROM public.beach_photos bp
    WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);
" 2>/dev/null || echo "ERROR")

if [ "$ORPHANED_PHOTOS" = "ERROR" ]; then
    echo -e "${CROSS_MARK} Failed to count orphaned photos"
    exit 1
fi

if [ "$ORPHANED_PHOTOS" -gt 0 ]; then
    echo -e "Orphaned beach_photos: ${RED}$ORPHANED_PHOTOS${NC} ${WARNING_MARK}"
else
    echo -e "Orphaned beach_photos: ${GREEN}$ORPHANED_PHOTOS${NC} ${CHECK_MARK}"
fi

# Count valid beach_photos
VALID_PHOTOS=$(psql "$DATABASE_URL" -t -A -c "
    SELECT COUNT(*)
    FROM public.beach_photos bp
    WHERE EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);
" 2>/dev/null || echo "ERROR")

if [ "$VALID_PHOTOS" = "ERROR" ]; then
    echo -e "${CROSS_MARK} Failed to count valid photos"
    exit 1
fi
echo -e "Valid beach_photos: ${GREEN}$VALID_PHOTOS${NC}"

# Count unique orphaned beach IDs
ORPHANED_BEACH_IDS=$(psql "$DATABASE_URL" -t -A -c "
    SELECT COUNT(DISTINCT bp.beach_id)
    FROM public.beach_photos bp
    WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);
" 2>/dev/null || echo "ERROR")

if [ "$ORPHANED_BEACH_IDS" = "ERROR" ]; then
    echo -e "${CROSS_MARK} Failed to count orphaned beach IDs"
    exit 1
fi

if [ "$ORPHANED_BEACH_IDS" -gt 0 ]; then
    echo -e "Orphaned beach IDs: ${RED}$ORPHANED_BEACH_IDS${NC} ${WARNING_MARK}"
else
    echo -e "Orphaned beach IDs: ${GREEN}$ORPHANED_BEACH_IDS${NC} ${CHECK_MARK}"
fi

echo ""
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"
echo -e "${BLUE}Foreign Key Constraint Check${NC}"
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"

# Check if FK constraint exists
FK_EXISTS=$(psql "$DATABASE_URL" -t -A -c "
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'beach_photos'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%beach_id%'
    );
" 2>/dev/null || echo "f")

if [ "$FK_EXISTS" = "t" ]; then
    echo -e "${CHECK_MARK} Foreign key constraint exists on beach_photos.beach_id"

    # Get constraint details
    FK_DETAILS=$(psql "$DATABASE_URL" -t -A -c "
        SELECT
            tc.constraint_name || ' | ' ||
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_name = 'beach_photos'
        AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
    " 2>/dev/null || echo "ERROR")

    if [ "$FK_DETAILS" != "ERROR" ]; then
        IFS='|' read -ra DETAILS <<< "$FK_DETAILS"
        echo -e "  Constraint name: ${BLUE}${DETAILS[0]}${NC}"
        echo -e "  Delete rule: ${BLUE}${DETAILS[1]}${NC}"
    fi
else
    echo -e "${CROSS_MARK} Foreign key constraint is MISSING"
    echo -e "${YELLOW}This is unexpected - constraint should exist${NC}"
fi

echo ""
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"
echo -e "${BLUE}Expected Migration Impact${NC}"
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"

if [ "$ORPHANED_PHOTOS" -gt 0 ]; then
    echo -e "Records to be deleted: ${RED}$ORPHANED_PHOTOS${NC}"
    echo -e "Records to be backed up: ${YELLOW}$ORPHANED_PHOTOS${NC}"
    echo -e "Remaining valid photos: ${GREEN}$VALID_PHOTOS${NC}"
else
    echo -e "${GREEN}No orphaned records found - migration will have no impact${NC}"
    echo -e "${YELLOW}You may not need to run this migration${NC}"
fi

echo ""
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"
echo -e "${BLUE}Backup Recommendation${NC}"
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"

# Check if backup directory exists
BACKUP_DIR="db_backups"
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${WARNING_MARK} Backup directory does not exist: $BACKUP_DIR"
    echo -e "${YELLOW}Creating backup directory...${NC}"
    mkdir -p "$BACKUP_DIR"
    echo -e "${CHECK_MARK} Created $BACKUP_DIR"
fi

BACKUP_FILE="${BACKUP_DIR}/backup_before_orphan_cleanup_$(date +%Y%m%d_%H%M%S).dump"
echo -e "Recommended backup command:"
echo -e "${BLUE}pg_dump -Fc \"\$DATABASE_URL\" > $BACKUP_FILE${NC}"
echo ""
read -p "Create backup now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Creating database backup...${NC}"
    if pg_dump -Fc "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${CHECK_MARK} Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        echo -e "${CROSS_MARK} Backup failed"
        exit 1
    fi
else
    echo -e "${WARNING_MARK} Skipped backup creation"
    echo -e "${YELLOW}WARNING: Proceeding without backup is not recommended${NC}"
fi

echo ""
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"
echo -e "${BLUE}Deployment Readiness${NC}"
echo -e "${BLUE}-------------------------------------------------------------------------------${NC}"

READY=true

# Check 1: Migration files exist
if [ ! -f "$MAIN_MIGRATION" ]; then
    echo -e "${CROSS_MARK} Main migration missing"
    READY=false
else
    echo -e "${CHECK_MARK} Main migration ready"
fi

# Check 2: Database accessible
if [ "$TOTAL_PHOTOS" = "ERROR" ]; then
    echo -e "${CROSS_MARK} Database not accessible"
    READY=false
else
    echo -e "${CHECK_MARK} Database accessible"
fi

# Check 3: FK constraint exists
if [ "$FK_EXISTS" = "t" ]; then
    echo -e "${CHECK_MARK} FK constraint verified"
else
    echo -e "${CROSS_MARK} FK constraint missing"
    READY=false
fi

# Check 4: Orphaned records exist (optional - migration can run either way)
if [ "$ORPHANED_PHOTOS" -gt 0 ]; then
    echo -e "${CHECK_MARK} Orphaned records detected ($ORPHANED_PHOTOS)"
else
    echo -e "${WARNING_MARK} No orphaned records (migration will have no effect)"
fi

echo ""
echo -e "${BLUE}===============================================================================${NC}"

if [ "$READY" = true ]; then
    echo -e "${GREEN}✓ READY FOR DEPLOYMENT${NC}"
    echo ""
    echo -e "To deploy, run:"
    echo -e "${BLUE}psql \"\$DATABASE_URL\" -f $MAIN_MIGRATION${NC}"
    echo ""
    echo -e "Or using Supabase CLI:"
    echo -e "${BLUE}supabase db push${NC}"
else
    echo -e "${RED}✗ NOT READY FOR DEPLOYMENT${NC}"
    echo -e "${YELLOW}Please resolve the issues above before deploying${NC}"
    exit 1
fi

echo -e "${BLUE}===============================================================================${NC}"
