#!/bin/bash
# Automated database backup script for Quiver
# Run this daily to backup your database to prevent future data loss

set -e

echo "🔄 Starting Quiver Database Backup..."
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
PROJECT_REF="vawdnbbgawichorsjiwe"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📁 Created backup directory: $BACKUP_DIR"

# Backup all data using supabase CLI
echo "💾 Backing up database schema and data..."
supabase db dump --linked --file "$BACKUP_DIR/quiver_full_backup_$DATE.sql"

# Compress the backup
echo "🗜️ Compressing backup..."
gzip "$BACKUP_DIR/quiver_full_backup_$DATE.sql"

# Create a user recovery export
echo "👥 Creating user recovery data..."
supabase db dump --linked --data-only -t auth.users -t public.profiles > "$BACKUP_DIR/user_recovery_$DATE.sql"

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +7 -delete

echo "✅ Backup completed successfully!"
echo "📍 Files created:"
echo "   - $BACKUP_DIR/quiver_full_backup_$DATE.sql.gz (main backup)"
echo "   - $BACKUP_DIR/user_recovery_$DATE.sql (user data only)"

# Show backup size
echo "📊 Backup size:"
ls -lh "$BACKUP_DIR"/*"$DATE"*

echo ""
echo "🚀 To restore from this backup:"
echo "   1. Extract: gunzip $BACKUP_DIR/quiver_full_backup_$DATE.sql.gz"
echo "   2. Restore: supabase db reset --linked && psql -f $BACKUP_DIR/quiver_full_backup_$DATE.sql"
echo ""
echo "💡 Consider setting up a daily cron job:"
echo "   0 2 * * * cd /path/to/quiver && ./backup_script.sh"
