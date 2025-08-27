#!/bin/bash

# Quiver Database Backup and User Recovery Script
# This script helps you export data and analyze user traces

# Configuration
PROJECT_ID="vawdnbbgawichorsjiwe"
ACCESS_TOKEN="sbp_d8dea6677d504e58464899cc472b1ca8fc076494"
BACKUP_DIR="./supabase/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Quiver Database Backup and Recovery Tool${NC}"
echo -e "${YELLOW}Project ID: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}Backup Directory: ${BACKUP_DIR}${NC}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Function to run SQL queries via Supabase API
run_sql_query() {
    local query="$1"
    local output_file="$2"
    local description="$3"
    
    echo -e "${YELLOW}Running: ${description}${NC}"
    
    curl -X POST \
        "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"${query}\"}" \
        > "${output_file}" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Saved to: ${output_file}${NC}"
    else
        echo -e "${RED}✗ Failed to execute query${NC}"
    fi
}

# Function to export table data
export_table_data() {
    local table_name="$1"
    local output_file="${BACKUP_DIR}/${table_name}_${DATE}.json"
    
    local query="SELECT json_agg(row_to_json(${table_name})) FROM ${table_name};"
    run_sql_query "${query}" "${output_file}" "Exporting ${table_name} table"
}

echo -e "${GREEN}📊 Step 1: Investigating database structure${NC}"

# Get table list
run_sql_query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" \
    "${BACKUP_DIR}/tables_list_${DATE}.json" \
    "Getting list of all tables"

echo ""
echo -e "${GREEN}📋 Step 2: Analyzing user data traces${NC}"

# Run user investigation queries
run_sql_query "
WITH user_activity AS (
    SELECT DISTINCT user_id as id, 'sessions' as source FROM sessions WHERE user_id IS NOT NULL
    UNION
    SELECT DISTINCT id, 'profiles' as source FROM profiles WHERE id IS NOT NULL
    UNION  
    SELECT DISTINCT owner_id as id, 'boards' as source FROM boards WHERE owner_id IS NOT NULL
)
SELECT 
    ua.id as user_id,
    STRING_AGG(DISTINCT ua.source, ', ') as found_in_tables,
    COUNT(DISTINCT ua.source) as table_count
FROM user_activity ua
GROUP BY ua.id
ORDER BY table_count DESC, ua.id;
" "${BACKUP_DIR}/user_traces_${DATE}.json" "Finding user traces across tables"

# Get user contact information
run_sql_query "
SELECT 
    p.id as user_id,
    p.email,
    p.display_name,
    p.created_at,
    p.updated_at,
    COALESCE(s.session_count, 0) as sessions,
    COALESCE(b.board_count, 0) as boards
FROM profiles p
LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count 
    FROM sessions GROUP BY user_id
) s ON p.id = s.user_id
LEFT JOIN (
    SELECT owner_id, COUNT(*) as board_count 
    FROM boards GROUP BY owner_id
) b ON p.id = b.owner_id
WHERE p.email IS NOT NULL
ORDER BY sessions DESC, boards DESC;
" "${BACKUP_DIR}/user_contacts_${DATE}.json" "Extracting user contact information"

echo ""
echo -e "${GREEN}💾 Step 3: Creating full data backup${NC}"

# Export all main tables
export_table_data "sessions"
export_table_data "profiles" 
export_table_data "boards"

# Check for and export other tables
additional_tables=("sessions_boards" "board_members" "user_settings" "notifications" "invites")

for table in "${additional_tables[@]}"; do
    # Check if table exists
    table_exists=$(curl -s -X POST \
        "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"SELECT 1 FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public';\"}" \
        | grep -o '"rows":\[.*\]' | grep -v ':\[\]')
    
    if [ ! -z "$table_exists" ]; then
        export_table_data "$table"
    else
        echo -e "${YELLOW}⚠ Table ${table} does not exist, skipping${NC}"
    fi
done

echo ""
echo -e "${GREEN}🔍 Step 4: Generating recovery statistics${NC}"

# Generate summary statistics
run_sql_query "
SELECT 
    'Database Summary' as report_type,
    COUNT(*) FILTER (WHERE table_name = 'sessions') as sessions_table_exists,
    COUNT(*) FILTER (WHERE table_name = 'profiles') as profiles_table_exists,
    COUNT(*) FILTER (WHERE table_name = 'boards') as boards_table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
" "${BACKUP_DIR}/database_summary_${DATE}.json" "Generating database summary"

# Get row counts for all tables
run_sql_query "
SELECT 
    schemaname,
    relname as table_name,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
" "${BACKUP_DIR}/table_statistics_${DATE}.json" "Getting table row counts and statistics"

echo ""
echo -e "${GREEN}📄 Step 5: Exporting schema information${NC}"

# Export schema definition
run_sql_query "
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
" "${BACKUP_DIR}/schema_definition_${DATE}.json" "Exporting complete schema structure"

# Export constraints and indexes
run_sql_query "
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ') as columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name;
" "${BACKUP_DIR}/constraints_${DATE}.json" "Exporting constraints and relationships"

echo ""
echo -e "${GREEN}✅ Backup Complete!${NC}"
echo -e "${YELLOW}📁 All files saved to: ${BACKUP_DIR}${NC}"
echo ""
echo -e "${GREEN}📧 Next Steps for User Recovery:${NC}"
echo -e "1. Review ${BACKUP_DIR}/user_contacts_${DATE}.json for users with email addresses"
echo -e "2. Check ${BACKUP_DIR}/user_traces_${DATE}.json to understand user engagement levels"
echo -e "3. Use the contact information to reach out to users about the migration"
echo -e "4. Consider segmenting users by engagement level for targeted messaging"
echo ""
echo -e "${YELLOW}💡 Recommended Re-engagement Strategy:${NC}"
echo -e "• Power users (>15 sessions): Personal outreach with migration assistance"
echo -e "• Active users (5-15 sessions): Email campaign with data export offer"
echo -e "• Casual users (<5 sessions): General announcement about new authentication"
echo ""
echo -e "${GREEN}🔒 Security Note:${NC}"
echo -e "These backup files contain user data. Store them securely and delete when no longer needed."

# Create a summary report
cat > "${BACKUP_DIR}/backup_report_${DATE}.txt" << EOF
Quiver Database Backup Report
Generated: $(date)
Project ID: ${PROJECT_ID}

Files Created:
- tables_list_${DATE}.json: List of all database tables
- user_traces_${DATE}.json: User activity across different tables
- user_contacts_${DATE}.json: User contact information for re-engagement
- sessions_${DATE}.json: All session data
- profiles_${DATE}.json: All profile data  
- boards_${DATE}.json: All board data
- database_summary_${DATE}.json: High-level database statistics
- table_statistics_${DATE}.json: Detailed table row counts
- schema_definition_${DATE}.json: Complete database schema
- constraints_${DATE}.json: Table relationships and constraints

Next Steps:
1. Review user contact data for re-engagement opportunities
2. Analyze user engagement patterns for segmentation
3. Plan migration communication strategy
4. Store backup files securely
5. Consider implementing data retention policies

Contact the development team if you need help interpreting any of this data.
EOF

echo -e "${GREEN}📋 Summary report created: ${BACKUP_DIR}/backup_report_${DATE}.txt${NC}"