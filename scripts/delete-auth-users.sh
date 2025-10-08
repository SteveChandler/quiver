#!/bin/bash
# ============================================================================
# DELETE AUTH USERS - Bash Script using Admin REST API
# ============================================================================
# PURPOSE: Delete auth users via Supabase Admin REST API
# USAGE:
#   1. Run cleanup-auth-users.sql in Supabase SQL Editor first
#   2. Review the list of user IDs to delete
#   3. Set environment variables:
#      export SERVICE_ROLE_KEY="your-service-role-key"
#      export PROJECT_REF="vawdnbbgawichorsjiwe"
#   4. Run with user IDs:
#      ./delete-auth-users.sh id1 id2 id3
#   OR with dry-run mode:
#      DRY_RUN=1 ./delete-auth-users.sh id1 id2 id3
# WARNING: This permanently deletes users. Cannot be undone.
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}ERROR: SERVICE_ROLE_KEY environment variable not set${NC}"
  echo "Usage: export SERVICE_ROLE_KEY=\"your-service-role-key\""
  exit 1
fi

if [ -z "$PROJECT_REF" ]; then
  echo -e "${RED}ERROR: PROJECT_REF environment variable not set${NC}"
  echo "Usage: export PROJECT_REF=\"vawdnbbgawichorsjiwe\""
  exit 1
fi

# Check if user IDs were provided
if [ $# -eq 0 ]; then
  echo -e "${RED}ERROR: No user IDs provided${NC}"
  echo "Usage: $0 user_id1 user_id2 user_id3 ..."
  echo "Example: $0 550e8400-e29b-41d4-a716-446655440000"
  exit 1
fi

# Dry run mode
DRY_RUN=${DRY_RUN:-0}

if [ "$DRY_RUN" = "1" ]; then
  echo -e "${YELLOW}DRY RUN MODE - No deletions will be performed${NC}"
fi

# Summary
echo "================================================"
echo "Auth User Deletion Script"
echo "================================================"
echo "Project: $PROJECT_REF"
echo "User IDs to delete: $#"
echo "Dry run: $DRY_RUN"
echo "================================================"
echo ""

# Confirmation prompt (skip in dry run)
if [ "$DRY_RUN" != "1" ]; then
  echo -e "${YELLOW}WARNING: This will permanently delete $# user(s)${NC}"
  read -p "Are you sure you want to continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# Track results
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Delete each user
for USER_ID in "$@"; do
  echo -e "Processing user: ${YELLOW}$USER_ID${NC}"
  
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY RUN] Would delete user $USER_ID"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    # Make DELETE request
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/delete-response.txt -X DELETE \
      "https://${PROJECT_REF}.supabase.co/auth/v1/admin/users/${USER_ID}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")
    
    # Check response
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
      echo -e "  ${GREEN}✓ Deleted successfully (HTTP $HTTP_CODE)${NC}"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo -e "  ${RED}✗ Failed (HTTP $HTTP_CODE)${NC}"
      RESPONSE=$(cat /tmp/delete-response.txt)
      if [ -n "$RESPONSE" ]; then
        echo -e "  ${RED}Response: $RESPONSE${NC}"
      fi
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
  fi
  
  echo ""
done

# Clean up temp file
rm -f /tmp/delete-response.txt

# Summary
echo "================================================"
echo "Deletion Summary"
echo "================================================"
echo -e "Successful: ${GREEN}$SUCCESS_COUNT${NC}"
echo -e "Failed: ${RED}$FAILURE_COUNT${NC}"
echo "Total: $(($SUCCESS_COUNT + $FAILURE_COUNT))"
echo "================================================"

if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo -e "${YELLOW}This was a dry run. To execute deletions, run without DRY_RUN=1${NC}"
fi

