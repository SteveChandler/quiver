# Quiver Database Backup and User Recovery Guide

## Overview
This guide helps you create comprehensive backups of your Supabase database and identify user data for potential re-engagement after the authentication reset.

## Quick Start

### Option 1: Using the SQL Scripts (Recommended)
1. Open your Supabase dashboard: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe
2. Go to the SQL Editor
3. Run the queries from the provided SQL files in this order:

```sql
-- 1. First run: user_data_investigation.sql
-- This finds all traces of users in your database

-- 2. Then run: user_recovery_analysis.sql  
-- This creates actionable user contact lists

-- 3. Finally run: backup_database.sql
-- This creates complete backups of all your data
```

### Option 2: Using the Bash Script
```bash
# Navigate to your project directory
cd /Users/stevenchandler/Desktop/quiver/quiver

# Run the automated backup script
./supabase/export_data.sh
```

## What You'll Get

### 1. User Contact Information
- **Email addresses** of users who had accounts
- **Display names** and profile information
- **Engagement levels** (sessions, boards created)
- **Last activity dates** for prioritizing outreach

### 2. Complete Data Backup
- All session data with user associations
- All profile information
- All board data with ownership
- Database schema and structure
- Constraints and relationships

### 3. Recovery Analysis
- **Power users**: >15 sessions (priority contact)
- **Active users**: 5-15 sessions (email campaign)
- **Casual users**: <5 sessions (general announcement)

## Key Files Created

| File | Purpose |
|------|---------|
| `user_data_investigation.sql` | Find user traces across tables |
| `user_recovery_analysis.sql` | Generate contact lists and engagement analysis |
| `backup_database.sql` | Complete database backup |
| `export_data.sh` | Automated backup script |

## User Re-engagement Strategy

### High Priority (Contact Personally)
Users with:
- 15+ sessions
- 5+ boards created
- Recent activity (last 30 days)

**Message**: "Hey [name], we noticed you were a power user of Quiver with [X] sessions and [Y] boards. We had a technical issue that requires users to re-register, but we can help migrate your data..."

### Medium Priority (Email Campaign)
Users with:
- 5-15 sessions
- 1-4 boards created
- Activity in last 90 days

**Message**: "We miss you on Quiver! Due to a technical update, you'll need to create a new account, but your data is safe and we can help restore it..."

### Low Priority (General Announcement)
Users with:
- <5 sessions
- No boards or minimal engagement
- Older activity

**Message**: "Quiver has been updated with improved authentication. Create a new account to continue using our platform..."

## Running the Queries

### In Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe
2. Click "SQL Editor" in the left sidebar
3. Copy and paste the SQL from each file
4. Click "Run" to execute
5. Export results as CSV or JSON

### Sample Key Queries

#### Find All Users with Contact Info
```sql
SELECT 
    p.id as user_id,
    p.email,
    p.display_name,
    COUNT(s.id) as session_count,
    COUNT(b.id) as board_count,
    MAX(GREATEST(p.updated_at, s.created_at, b.created_at)) as last_activity
FROM profiles p
LEFT JOIN sessions s ON p.id = s.user_id
LEFT JOIN boards b ON p.id = b.owner_id
WHERE p.email IS NOT NULL
GROUP BY p.id, p.email, p.display_name, p.updated_at
ORDER BY session_count DESC, board_count DESC;
```

#### Export All User Data as JSON
```sql
SELECT json_agg(
    json_build_object(
        'user_id', id,
        'email', email,
        'display_name', display_name,
        'created_at', created_at,
        'updated_at', updated_at
    )
) as users_backup
FROM profiles
WHERE email IS NOT NULL;
```

## Data Security Notes

⚠️ **Important**: The exported data contains personal information (emails, user IDs, activity data). 

- Store backup files securely
- Use encryption if storing long-term
- Delete backups when no longer needed
- Only share with authorized team members
- Follow your privacy policy for user data handling

## Next Steps After Backup

1. **Immediate**: Run the backup queries to secure your data
2. **Within 24h**: Analyze user engagement levels and create contact segments  
3. **Within 48h**: Begin outreach to power users with personal messages
4. **Within 1 week**: Send email campaigns to medium-engagement users
5. **Ongoing**: Monitor re-registration rates and adjust messaging

## Troubleshooting

### If queries fail:
- Check you're connected to the right project
- Verify tables exist (`sessions`, `profiles`, `boards`)
- Check for typos in table/column names
- Ensure you have proper read permissions

### If no user data found:
- Confirm the tables weren't completely dropped
- Check if data exists in auth schema
- Look for backup tables or logs

### If you need help:
- Review the detailed SQL files in this directory
- Check Supabase logs for any error messages
- Contact the development team with specific error messages

## Recovery Timeline Estimate

- **Backup creation**: 1-2 hours
- **User analysis**: 2-3 hours  
- **Contact segmentation**: 1 hour
- **Outreach preparation**: 2-4 hours
- **User re-engagement**: 1-2 weeks

Total estimated effort: **8-12 hours** over 2 weeks for complete user recovery process.