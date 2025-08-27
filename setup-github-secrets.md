# Setting Up GitHub Secrets for Database Backups

To enable automated database backups, you need to add these secrets to your GitHub repository:

## Required Secrets

1. **SUPABASE_ACCESS_TOKEN**
   - Get from: https://supabase.com/dashboard/account/tokens
   - Create a new access token with database permissions
   - Add to GitHub: Settings → Secrets and variables → Actions → New repository secret

2. **SUPABASE_DB_PASSWORD**
   - Get from: Supabase Dashboard → Settings → Database → Database password
   - This is your database password (not your Supabase account password)
   - Add to GitHub: Settings → Secrets and variables → Actions → New repository secret

## Steps to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. Navigate to **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret:
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: Your token from Supabase dashboard
   
   - Name: `SUPABASE_DB_PASSWORD`  
   - Value: Your database password

## Testing the Backup

After adding the secrets, you can manually trigger the backup:

1. Go to **Actions** tab in your repository
2. Select **Database Backup** workflow
3. Click **Run workflow** → **Run workflow**
4. Check the workflow run for any errors

The backup will then run automatically every day at 2 AM UTC.

## Accessing Backups

Backups are stored as GitHub Artifacts for 30 days. To download:

1. Go to **Actions** tab
2. Click on a completed backup workflow run
3. Scroll to **Artifacts** section
4. Download the backup files

## Important Notes

- Keep your secrets secure and never commit them to the repository
- Rotate tokens periodically for security
- Monitor the Actions tab for failed backup runs
- Consider upgrading to Supabase paid plan for automatic PITR backups