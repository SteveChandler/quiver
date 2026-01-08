# Lighthouse CI Setup Guide

## Quick Start

This guide will help you set up the Lighthouse CI workflow for your repository.

## Prerequisites

- GitHub repository with admin access
- Supabase project (for build)
- Mapbox account (for maps)
- Firebase project (for push notifications)

## Step 1: Configure GitHub Secrets

Navigate to your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

### Required Secrets (Minimum Set)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token

# Firebase (for build compatibility)
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Web Config
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BCd...your-vapid-key
```

### Optional Secret (PR Comments)

```bash
# Enable automatic PR comments with Lighthouse scores
LHCI_GITHUB_APP_TOKEN=your-lhci-github-app-token
```

## Step 2: Get Your Secret Values

### Supabase Secrets

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### Mapbox Token

1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Navigate to **Access Tokens**
3. Create a new token or copy existing one
4. Token should start with `pk.` → `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

### Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** (gear icon)

**For Service Account (Server-side):**
1. Go to **Service Accounts** tab
2. Click **Generate New Private Key**
3. Download the JSON file
4. Extract values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters!)

**For Web Config (Client-side):**
1. Go to **General** tab
2. Scroll to **Your apps** → Web app
3. Copy the config object values:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

**For VAPID Key:**
1. Go to **Cloud Messaging** tab
2. Scroll to **Web Push certificates**
3. Copy the **Key pair** value → `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

## Step 3: (Optional) Enable PR Comments

To get automated Lighthouse CI comments on pull requests:

### Option 1: GitHub App (Recommended)

1. Install the [Lighthouse CI GitHub App](https://github.com/apps/lighthouse-ci)
2. Grant access to your repository
3. Copy the token from the app settings
4. Add as secret: `LHCI_GITHUB_APP_TOKEN`

### Option 2: Personal Access Token

1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens**
2. Create a new token with `repo` scope
3. Add as secret: `LHCI_GITHUB_APP_TOKEN`

## Step 4: Verify Configuration

After adding all secrets:

1. **Trigger a test run:**
   - Push a commit to `develop` or `main`
   - Or create a pull request to `main`

2. **Monitor the workflow:**
   - Go to **Actions** tab
   - Click on **Lighthouse CI** workflow
   - Watch the live logs

3. **Check for errors:**
   - If build fails, check the build logs
   - If server fails to start, verify all secrets are set correctly
   - If audits fail, download the Lighthouse reports

## Step 5: Review Results

After the workflow completes successfully:

1. **View the summary:**
   - Click on the workflow run
   - Review the performance summary

2. **Download artifacts:**
   - Scroll to the bottom of the workflow page
   - Download `lighthouse-results-{run_number}`
   - Extract and open HTML reports

3. **Review scores:**
   - Check that all scores meet thresholds
   - Review any failing audits
   - Implement improvements as needed

## Troubleshooting

### "Missing environment variable" error

**Problem:** Build fails with missing environment variable

**Solution:**
1. Verify the secret name matches exactly (case-sensitive)
2. Check that the secret value is not empty
3. Ensure there are no extra spaces in the secret value

### Build succeeds but server fails to start

**Problem:** Server health check fails after build

**Solution:**
1. Check the `server-log` artifact for errors
2. Verify all Firebase secrets are set correctly
3. Ensure Supabase credentials are valid

### Lighthouse audits score too low

**Problem:** Performance/accessibility scores below thresholds

**Solution:**
1. Download the detailed Lighthouse reports
2. Review specific failing audits
3. Implement recommended fixes
4. Common fixes:
   - Optimize images (use next/image)
   - Add missing alt text
   - Reduce JavaScript bundle size
   - Improve loading performance

### Workflow times out

**Problem:** Workflow exceeds 20-minute timeout

**Solution:**
1. Check if build is taking too long
2. Verify server starts within 60 seconds
3. Review Lighthouse audit duration
4. Consider reducing number of audited pages in `.lighthouserc.json`

### Firebase private key format error

**Problem:** Firebase private key not recognized

**Solution:**
The private key must include `\n` characters and be wrapped in quotes:

```bash
# Correct format:
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"

# Incorrect format (won't work):
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBA...
-----END PRIVATE KEY-----
```

## Testing Locally

Before relying on GitHub Actions, test Lighthouse CI locally:

```bash
# 1. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 2. Build the application
yarn build

# 3. Start the production server (in one terminal)
yarn start

# 4. Run Lighthouse CI (in another terminal)
yarn lighthouse:ci
```

## Next Steps

Once Lighthouse CI is running successfully:

1. **Monitor trends**: Regularly review Lighthouse scores
2. **Set up notifications**: Configure GitHub to notify you of workflow failures
3. **Customize thresholds**: Adjust scores in `.lighthouserc.json` as needed
4. **Add more pages**: Include additional critical pages in audits
5. **Integrate with CI/CD**: Make Lighthouse a required check for PRs

## Resources

- [Lighthouse CI Documentation](LIGHTHOUSE_CI.md)
- [Lighthouse CI GitHub Repository](https://github.com/GoogleChrome/lighthouse-ci)
- [Web.dev - Lighthouse](https://web.dev/lighthouse/)
- [Core Web Vitals](https://web.dev/vitals/)

## Support

If you need help:

1. Review the [detailed documentation](LIGHTHOUSE_CI.md)
2. Check workflow logs and artifacts
3. Consult [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci/tree/main/docs)
4. Open a GitHub issue with error details
