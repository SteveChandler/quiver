# Lighthouse CI Deployment Checklist

Use this checklist to ensure the Lighthouse CI workflow is properly configured and ready to deploy.

## Pre-Deployment Validation

### ✅ Step 1: Validate Workflow Files

Run the validation script:
```bash
bash scripts/validate-lighthouse-workflow.sh
```

Expected output:
- ✅ YAML syntax is valid
- ✅ .lighthouserc.json exists and is valid
- ✅ Required package.json scripts exist
- ✅ Dependencies are configured
- ✅ Environment variables are documented
- ✅ All documentation files exist

### ✅ Step 2: Configure GitHub Secrets

Navigate to: `GitHub Repository → Settings → Secrets and variables → Actions`

**Required Secrets (15 total):**

#### Supabase (3 secrets)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

#### Mapbox (1 secret)
- [ ] `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

#### Firebase Server Config (3 secrets)
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`

#### Firebase Web Config (8 secrets)
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

#### Optional (PR Comments)
- [ ] `LHCI_GITHUB_APP_TOKEN` (optional)

**📚 Detailed setup instructions:** `.github/workflows/LIGHTHOUSE_CI_SETUP.md`

### ✅ Step 3: Test Locally

Before deploying, test the Lighthouse CI workflow locally:

```bash
# Terminal 1: Build and start the server
yarn build
yarn start

# Terminal 2: Run Lighthouse CI
yarn lighthouse:ci
```

**Expected result:**
- Build completes successfully
- Server starts on http://localhost:3000
- All 5 pages are audited
- Reports generated in `.lighthouseci/` directory

### ✅ Step 4: Review Configuration

Verify `.lighthouserc.json` settings:
- [ ] Correct URLs are configured
- [ ] Mobile device settings are appropriate
- [ ] Thresholds match project requirements
- [ ] Number of runs is set to 3

### ✅ Step 5: Commit Workflow Files

Files to commit:
```bash
git add .github/workflows/lighthouse-ci.yml
git add .github/workflows/LIGHTHOUSE_CI.md
git add .github/workflows/LIGHTHOUSE_CI_SETUP.md
git add .github/workflows/LIGHTHOUSE_CI_CHECKLIST.md
git add .github/workflows/README.md
git add LIGHTHOUSE_CI_SUMMARY.md
git add scripts/validate-lighthouse-workflow.sh
```

Commit message:
```
feat: add Lighthouse CI workflow for performance monitoring

- Automated performance, accessibility, SEO, and best practices audits
- Runs on push to main/develop and PRs to main
- Audits 5 critical pages with mobile-first approach
- Enforces minimum scores (Performance: 85%, A11y/SEO/Best Practices: 90%)
- Tracks Core Web Vitals (LCP, CLS, FCP, TBT)
- Uploads detailed reports as artifacts (30-day retention)

Includes comprehensive documentation and setup guide.
```

## Deployment Steps

### 📤 Step 6: Push to GitHub

```bash
# Push to develop first for testing
git checkout develop
git push origin develop

# After validation, merge to main
git checkout main
git merge develop
git push origin main
```

### 🔍 Step 7: Monitor First Run

1. Go to: `GitHub → Actions → Lighthouse CI`
2. Watch the workflow run in real-time
3. Verify each step completes successfully:
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build application
   - ✅ Start production server
   - ✅ Wait for server
   - ✅ Install Lighthouse CI
   - ✅ Run Lighthouse CI
   - ✅ Upload artifacts

### 📊 Step 8: Review Results

After the workflow completes:

1. **View workflow summary:**
   - Click on the workflow run
   - Review the performance summary in the step summary

2. **Download artifacts:**
   - Scroll to the bottom of the workflow page
   - Download `lighthouse-results-{run_number}`
   - Extract and review HTML reports

3. **Check scores:**
   - Verify all scores meet thresholds
   - Note any warnings or recommendations
   - Review Core Web Vitals metrics

## Post-Deployment Configuration

### 🔧 Step 9: Enable Branch Protection (Optional)

Configure branch protection to require Lighthouse CI to pass:

1. Go to: `Settings → Branches → Branch protection rules`
2. Add rule for `main` branch
3. Enable: "Require status checks to pass before merging"
4. Select: "Lighthouse CI"
5. Save changes

### 📬 Step 10: Configure Notifications

Set up failure notifications:

1. Go to: `Settings → Notifications`
2. Enable: "Send notifications for failed workflows"
3. Choose notification method (email, GitHub, mobile)

### 🤖 Step 11: Enable PR Comments (Optional)

If you want automatic PR comments:

1. Install [Lighthouse CI GitHub App](https://github.com/apps/lighthouse-ci)
2. Grant access to your repository
3. Copy the token
4. Add as secret: `LHCI_GITHUB_APP_TOKEN`
5. Create a test PR to verify comments appear

## Maintenance Checklist

### Weekly Tasks
- [ ] Review Lighthouse scores for all runs
- [ ] Check for performance regressions
- [ ] Download and analyze detailed reports
- [ ] Address any failing audits

### Monthly Tasks
- [ ] Update `@lhci/cli` if new version available
- [ ] Review and adjust thresholds if needed
- [ ] Verify all secrets are still valid
- [ ] Check artifact storage usage

### Quarterly Tasks
- [ ] Comprehensive performance audit review
- [ ] Update documentation if workflow changes
- [ ] Review and optimize audited pages
- [ ] Consider adding new pages to audit

## Troubleshooting Quick Reference

### Build Fails
1. Check `build-log` artifact
2. Verify all GitHub secrets are configured
3. Test build locally: `yarn build`

### Server Fails to Start
1. Check `server-log` artifact
2. Verify environment variables
3. Test locally: `yarn start`

### Lighthouse Audits Fail
1. Download `lighthouse-results` artifact
2. Review detailed HTML reports
3. Address specific failing audits
4. Test locally: `yarn lighthouse:ci`

### Workflow Times Out
1. Check build duration
2. Verify server starts quickly
3. Review audit duration
4. Consider reducing number of pages/runs

## Success Criteria

The Lighthouse CI workflow is successfully deployed when:

- ✅ Workflow completes without errors
- ✅ All 5 pages are audited successfully
- ✅ Performance scores meet minimum thresholds
- ✅ Accessibility scores are ≥90%
- ✅ Best practices scores are ≥90%
- ✅ SEO scores are ≥90%
- ✅ Core Web Vitals are within limits
- ✅ Artifacts are uploaded and accessible
- ✅ GitHub step summary shows clear results

## Resources

- **Workflow File**: `.github/workflows/lighthouse-ci.yml`
- **Detailed Documentation**: `.github/workflows/LIGHTHOUSE_CI.md`
- **Setup Guide**: `.github/workflows/LIGHTHOUSE_CI_SETUP.md`
- **Summary**: `LIGHTHOUSE_CI_SUMMARY.md`
- **Validation Script**: `scripts/validate-lighthouse-workflow.sh`

## Support

If you encounter issues:
1. Review workflow logs and artifacts
2. Check troubleshooting section in documentation
3. Run validation script: `bash scripts/validate-lighthouse-workflow.sh`
4. Consult [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci)
5. Open GitHub issue with error details

---

**Last Updated:** 2026-01-06
**Workflow Version:** 1.0
**Status:** Ready for deployment
