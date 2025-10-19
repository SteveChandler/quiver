# Setting Environment Variables in Vercel

**Quick Guide for iOS App Release**

---

## Required Environment Variables

You need to add these to Vercel for iOS universal links to work:

```bash
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE
APPLE_APP_BUNDLE_ID=app.quiversurf.mobile
```

---

## How to Get Your Apple Team ID

1. Go to https://developer.apple.com/account
2. Click **Membership** in left sidebar
3. Find **Team ID** (format: `A1B2C3D4E5`)
4. Copy it

---

## How to Add Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. **Go to your project:**

   ```
   https://vercel.com/[your-username]/quiver/settings/environment-variables
   ```

2. **Add APPLE_TEAM_ID:**

   - **Key:** `APPLE_TEAM_ID`
   - **Value:** Your Team ID from Apple Developer (e.g., `A1B2C3D4E5`)
   - **Environments:** Check `Production`, `Preview`, `Development`
   - Click **Save**

3. **Add APPLE_APP_BUNDLE_ID:**

   - **Key:** `APPLE_APP_BUNDLE_ID`
   - **Value:** `app.quiversurf.mobile`
   - **Environments:** Check `Production`, `Preview`, `Development`
   - Click **Save**

4. **Redeploy:**
   - Go to **Deployments** tab
   - Click **...** menu on latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger deployment

### Method 2: Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add APPLE_TEAM_ID production
# Enter your Team ID when prompted

vercel env add APPLE_APP_BUNDLE_ID production
# Enter: app.quiversurf.mobile

# Also add to preview and development
vercel env add APPLE_TEAM_ID preview
vercel env add APPLE_TEAM_ID development
vercel env add APPLE_APP_BUNDLE_ID preview
vercel env add APPLE_APP_BUNDLE_ID development

# Redeploy
vercel --prod
```

---

## Verify It's Working

After redeploying, test the universal links endpoint:

### 1. Check the Endpoint

Open in browser:

```
https://quiversurf.app/.well-known/apple-app-site-association
```

### 2. Expected Response

Should return JSON like this:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "A1B2C3D4E5.app.quiversurf.mobile",
        "paths": ["/auth/*", "/sessions/*", "/beach/*", "/profile/*", "/map*"]
      }
    ]
  }
}
```

### 3. If You See This Instead

```json
{
  "applinks": {
    "apps": [],
    "details": []
  }
}
```

**Problem:** Environment variables aren't set or deployment didn't pick them up

**Solution:**

1. Double-check variables are saved in Vercel
2. Make sure you redeployed AFTER adding variables
3. Check variable names are exact (case-sensitive)

---

## Optional Environment Variables

These have defaults and are optional:

### Custom App Link Paths

If you want different URL patterns:

```bash
APPLE_APP_SITE_ASSOCIATION_PATHS=/auth/*,/sessions/*,/custom/*
```

Default: `/auth/*,/sessions/*,/beach/*,/profile/*,/map*`

### Web Credentials

For password autofill on web:

```bash
APPLE_WEB_CREDENTIALS_APP_IDS=A1B2C3D4E5.app.quiversurf.mobile
```

Only needed if using Apple's password autofill features.

---

## Troubleshooting

### Variables Not Showing Up

**Check which environments they're in:**

```bash
vercel env ls
```

**Pull variables locally to test:**

```bash
vercel env pull .env.local
```

### Still Not Working?

1. **Clear Vercel cache:**

   - In dashboard, go to Settings → Clear Cache
   - Redeploy

2. **Check deployment logs:**

   - Go to Deployments tab
   - Click on latest deployment
   - Check **Build Logs** for errors

3. **Test locally:**

   ```bash
   # Pull production env vars
   vercel env pull .env.local

   # Run dev server
   npm run dev

   # Test endpoint
   curl http://localhost:3000/.well-known/apple-app-site-association
   ```

### Environment Not Loading in App

If the app is deployed but endpoints don't work:

1. **Verify variables are in Production:**

   - Dashboard → Settings → Environment Variables
   - Filter by "Production"
   - Both variables should be listed

2. **Trigger fresh deployment:**
   - Make a small change (add comment to any file)
   - Commit and push
   - Wait for deployment
   - Test endpoint again

---

## Security Notes

- **Team ID is NOT sensitive** - It's public in your app's App Store listing
- **Bundle ID is NOT sensitive** - It's public information
- These are configuration values, not secrets
- They're required in the response JSON, so they'll be publicly visible

---

## Next Steps After Setup

1. ✅ Add environment variables to Vercel
2. ✅ Redeploy to production
3. ✅ Verify `.well-known` endpoint returns correct JSON
4. → Continue with Xcode configuration (see `IOS_APP_RELEASE_STEPS.md`)

---

**Quick Commands:**

```bash
# Check current variables
vercel env ls

# Add variables interactively
vercel env add APPLE_TEAM_ID
vercel env add APPLE_APP_BUNDLE_ID

# Deploy with new variables
vercel --prod

# Test endpoint
curl https://quiversurf.app/.well-known/apple-app-site-association
```

---

**Last Updated:** October 17, 2025  
**Related Docs:** `IOS_APP_RELEASE_STEPS.md`, `APP_STORE_CONTENT.md`


