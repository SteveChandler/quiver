# iOS App Release Guide 🚀

**Status:** Ready to Release
**Completion:** 80% automated, 20% manual steps required
**Estimated Time:** 6-12 hours active work + 24-72 hours Apple review

---

## ✅ What's Already Done

The hard technical work is complete:

- [x] Capacitor configured with production URL
- [x] iOS project generated with Xcode workspace
- [x] Firebase push notifications configured
- [x] PWA foundation with offline caching
- [x] Native bridge adapters (share, push, platform detection)
- [x] Deep link routes ready (`.well-known` infrastructure)
- [x] Privacy policy updated with mobile data collection disclosure
- [x] App Store content written (descriptions, keywords ready to copy-paste)

**Related Documentation:**
- `APP_STORE_CONTENT.md` - Copy & paste content for App Store Connect
- `VERCEL_ENV_SETUP.md` - Environment variables configuration guide

---

## 📋 Manual Steps You Need to Complete

### STEP 1: Apple Developer Console Setup (1-2 hours)

**Location:** https://developer.apple.com/account

#### 1.1 Create App ID (Identifier)

1. Go to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** → **+** (Add button)
3. Select **App IDs** → Continue
4. Select **App** → Continue
5. Fill in:
   - **Description:** Quiver Surf App
   - **Bundle ID:** `app.quiversurf.mobile` ⚠️ MUST MATCH EXACTLY
   - **Explicit** (not wildcard)
6. Enable Capabilities:
   - ✅ **Push Notifications**
   - ✅ **Associated Domains**
   - ✅ **Sign in with Apple** (if using Supabase Apple auth)
7. Click **Continue** → **Register**

#### 1.2 Get Your Team ID

1. In Apple Developer Console, go to **Membership**
2. Find **Team ID** (looks like: `A1B2C3D4E5`)
3. **Copy this** - you'll need it for environment variables

#### 1.3 Configure Apple Push Notifications (APNs)

1. Go to **Keys** section
2. Click **+** to create a new key
3. Enter key name: "Quiver APNs Key"
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** → **Register**
6. **Download the .p8 file** (you can only download once!)
7. Note the **Key ID** (you'll need this for Firebase)

#### 1.4 Upload APNs Key to Firebase

1. Go to **Firebase Console**: https://console.firebase.google.com
2. Select your project: **quiver-1f787**
3. Go to **Project Settings** (gear icon) → **Cloud Messaging** tab
4. Under **Apple app configuration**:
   - Upload the **.p8 file** from step 1.3
   - Enter **Key ID** from step 1.3
   - Enter **Team ID** from step 1.2
5. Click **Upload**

---

### STEP 2: Set Environment Variables (5 minutes)

**Location:** Vercel Dashboard or `.env.production`

Add these environment variables:

```bash
# Required for iOS universal links
APPLE_TEAM_ID=YOUR_TEAM_ID_FROM_STEP_1.2
APPLE_APP_BUNDLE_ID=app.quiversurf.mobile

# Optional (defaults are fine for now)
# APPLE_APP_SITE_ASSOCIATION_PATHS=/auth/*,/sessions/*,/beach/*,/profile/*,/map*
```

**If using Vercel:**

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add both variables
3. Redeploy: `vercel --prod` or trigger from Vercel dashboard

**If using `.env.production` file:**

1. Create `.env.production` in project root
2. Add the variables above
3. Deploy to production

---

### STEP 3: Verify Universal Links (5 minutes)

1. **Test the endpoint** - Open in browser:

   ```
   https://quiversurf.app/.well-known/apple-app-site-association
   ```

2. **Should return JSON like this:**

   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "YOUR_TEAM_ID.app.quiversurf.mobile",
           "paths": [
             "/auth/*",
             "/sessions/*",
             "/beach/*",
             "/profile/*",
             "/map*"
           ]
         }
       ]
     }
   }
   ```

3. **If you see `"details": []`**, the environment variables aren't set correctly. Redeploy after adding them.

---

### STEP 4: Configure Xcode Project (30-60 minutes)

#### 4.1 Open Project in Xcode

```bash
cd /Users/stevenchandler/Desktop/quiver/quiver
npm run mobile:build:ios
```

This will:

- Sync Capacitor
- Open Xcode workspace automatically

**Or manually:**

```bash
open ios/App/App.xcworkspace
```

⚠️ **Always open `.xcworkspace`, NOT `.xcodeproj`**

#### 4.2 Configure Signing & Capabilities

1. In Xcode, select **App** target in left sidebar
2. Go to **Signing & Capabilities** tab

**Signing Section:**

- ✅ Enable **Automatically manage signing**
- Select your **Team** from dropdown (should auto-populate with your Apple Developer account)
- Verify **Bundle Identifier**: `app.quiversurf.mobile`
- **Status** should show green checkmark ✅

**If signing fails:**

- Ensure you're logged into Xcode with Apple ID (Xcode → Settings → Accounts)
- May need to register device: https://developer.apple.com/account/resources/devices/list

#### 4.3 Add Capabilities

Still in **Signing & Capabilities** tab:

1. Click **+ Capability** button

2. **Add Push Notifications:**

   - Search "Push"
   - Click **Push Notifications**
   - Should appear in capabilities list

3. **Add Associated Domains:**

   - Click **+ Capability** again
   - Search "Associated"
   - Click **Associated Domains**
   - Click **+** under Associated Domains
   - Add: `applinks:quiversurf.app`
   - ⚠️ Must start with `applinks:` prefix

4. **(Optional) Add Background Modes** if you want background push:
   - Click **+ Capability**
   - Search "Background"
   - Click **Background Modes**
   - Check **Remote notifications**

#### 4.4 Verify Build Settings

1. Go to **General** tab
2. Verify:
   - **Display Name:** Quiver
   - **Version:** 1.0
   - **Build:** 1
   - **Deployment Target:** iOS 14.0 (already set)

---

### STEP 5: Test on Physical Device (1-2 hours)

#### 5.1 Connect iPhone

1. Connect iPhone via USB cable
2. Unlock iPhone
3. Trust computer if prompted on iPhone
4. In Xcode, select your iPhone from device dropdown (top toolbar)

#### 5.2 Build and Run

1. Click **Run** button (▶️) or press `Cmd+R`
2. First build takes 2-5 minutes
3. App installs and launches on iPhone

#### 5.3 Test Core Features

**Authentication:**

- [ ] Login with existing account works
- [ ] Logout and re-login works

**Push Notifications:**

- [ ] App requests notification permission on first login
- [ ] Grant permission
- [ ] Check Xcode console for: "Token registered with backend"

**Core Features:**

- [ ] Home page loads
- [ ] Forecast data displays
- [ ] Can create/log session
- [ ] Social feed loads
- [ ] Can like/comment on sessions
- [ ] Can view beach details

**Native Features:**

- [ ] Share button works (test session sharing)
- [ ] Deep link: Open Safari, go to a session URL, tap "Open in App"

**Offline:**

- [ ] Enable Airplane Mode
- [ ] Check if forecasts are cached
- [ ] Check if previously loaded content is accessible

#### 5.4 Test Push Notifications End-to-End

**From another device or web:**

1. Login as different user
2. Create new session
3. Invite your test device's user
4. Send invitation

**On iPhone:**

1. Should receive push notification within seconds
2. Tap notification
3. App should open to session detail

---

### STEP 6: Take App Store Screenshots (1-2 hours)

#### 6.1 Use Simulator for Screenshots

```bash
# Open iPhone 15 Pro Max simulator
open -a Simulator
# Select: iPhone 15 Pro Max
```

Or in Xcode:

1. Select **iPhone 15 Pro Max** from device dropdown
2. Click **Run** (▶️)

#### 6.2 Capture Screenshots

**Required Size:** 1290 x 2796 pixels (6.7" display)  
**Minimum:** 3 screenshots  
**Recommended:** 5-8 screenshots

**Capture method:**

- Simulator → **Features → Screenshot** (or `Cmd+S`)
- Screenshots save to Desktop

**Recommended screenshots:**

1. **Home/Forecast View**

   - Shows surf forecast, conditions
   - Highlights "Know when to paddle out"

2. **Session Logging Form**

   - User creating/logging a session
   - Shows date, beach, photos, conditions
   - Highlights "Track your surf journey"

3. **Beach Detail Page**

   - Beach with forecast, reviews, conditions
   - Shows community ratings
   - Highlights "Discover epic spots"

4. **Social Feed**

   - Feed of recent sessions from community
   - Shows likes, comments, interactions
   - Highlights "Join the community"

5. **Session Detail/Journal**
   - Detailed view of a logged session
   - Photos, stats, conditions, comments
   - Highlights "Share your stoke"

#### 6.3 Polish Screenshots (Optional)

Use tools like:

- **Screenshot.rocks** - Add device frames and backgrounds
- **Canva** - Add text overlays with key features
- **Figma** - Professional layouts

**Pro tips:**

- Use consistent styling across all screenshots
- Add 1-2 word captions highlighting key features
- Show real data (not empty states)
- Make it visually appealing

---

### STEP 7: Create Archive & Upload to App Store (1-2 hours)

#### 7.1 Create Archive

1. In Xcode, select **Any iOS Device (arm64)** from device dropdown
   - ⚠️ Cannot archive when simulator is selected
2. Go to **Product → Archive**

   - Takes 5-10 minutes
   - Status shows in toolbar

3. When complete, **Organizer** window opens automatically
   - Shows your archive

#### 7.2 Validate Archive

1. In Organizer, select your archive
2. Click **Validate App** button
3. Select:
   - ✅ Automatically manage signing
   - Your team/profile
4. Click **Validate**
5. Wait 1-2 minutes
6. **Fix any errors** before proceeding

Common validation errors:

- Missing icons → Check `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Signing issues → Review Step 4.2
- Missing capabilities → Review Step 4.3

#### 7.3 Distribute to App Store Connect

1. Click **Distribute App** button
2. Select **App Store Connect** → Next
3. Select **Upload** → Next
4. Select:
   - ✅ Automatically manage signing
   - ✅ Include bitcode: No
   - ✅ Upload symbols: Yes
5. Click **Upload**
6. Wait 5-15 minutes (shows progress)
7. Click **Done** when complete

#### 7.4 Wait for Processing

1. Go to App Store Connect: https://appstoreconnect.apple.com
2. Click **Apps** → **Quiver** (or create if doesn't exist)
3. Build will show **"Processing"** for 10-30 minutes
4. Refresh page until status changes to **"Ready to Submit"**

---

### STEP 8: Complete App Store Listing (1 hour)

**Location:** https://appstoreconnect.apple.com

#### 8.1 Create App (if doesn't exist)

1. Click **Apps** → **+** (Add App)
2. Fill in:
   - **Platform:** iOS
   - **Name:** Quiver
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `app.quiversurf.mobile`
   - **SKU:** `app.quiversurf.mobile` (or any unique identifier)
   - **User Access:** Full Access
3. Click **Create**

#### 8.2 Fill in App Information

**In the App Information section:**

**Name:** Quiver

**Subtitle:** (30 chars max)

```
Surf Community & Forecasts
```

**Category:**

- **Primary:** Sports
- **Secondary:** Social Networking

**Content Rights:**

- ☐ Does not contain third-party content

**Age Rating:**
Click **Edit** and fill questionnaire:

- Violence: None
- Profanity: None
- Mature/Suggestive: None
- Horror: None
- Should result in **4+** rating

**Privacy Policy URL:**

```
https://quiversurf.app/privacy
```

**Support URL:**

```
https://quiversurf.app/about
```

**Marketing URL:** (optional)

```
https://quiversurf.app
```

#### 8.3 Upload Screenshots

1. Go to **App Store** tab
2. Select **iOS** → **6.7" Display**
3. Click **+** to add screenshots
4. Upload your 3-5 screenshots from Step 6
5. Drag to reorder (first screenshot is most important)

**Optional:** Add screenshots for other sizes:

- 6.5" Display (iPhone 11 Pro Max)
- 5.5" Display (iPhone 8 Plus)
- If you don't add these, Apple uses the 6.7" ones

#### 8.4 Add App Description

**Promotional Text:** (170 chars max - can update without review)

```
Connect with local surfers, track epic sessions, and get accurate 10-day forecasts. Join the surf community that's growing every day. Free to use.
```

**Description:** (4000 chars max)

```
Connect with surfers. Track epic sessions. Discover the best waves.

Quiver is the surf community platform that brings surfers together. Whether you're looking for surf buddies, tracking your progression, or discovering new breaks, Quiver connects you with a thriving community of surfers who share your passion for the ocean.

FIND YOUR SURF CREW
Never surf alone again. Connect with local surfers, join group sessions, and build lasting friendships in the lineup. Quiver makes it easy to find surf buddies at your skill level and coordinate sessions at your favorite spots.

• Browse local surfer profiles and connect
• Join or create group surf sessions
• Follow your favorite surfers and stay updated
• Build your surf crew one session at a time

TRACK YOUR SESSIONS
Log every surf session with photos, ratings, and notes. Build your surf journal and share your progression with the community. Track conditions, wave quality, and see your improvement over time.

• Log sessions with detailed conditions data
• Add photos to capture the magic
• Rate wave quality, crowd levels, and more
• Review your surf history anytime
• Share sessions with your crew
• See your stats and progression

ACCURATE SURF FORECASTS
Get 10-day surf forecasts trusted by your local community. Know exactly when to paddle out with detailed wave height, wind, tide, and swell data. Our forecasts help you plan the perfect session.

• 10-day surf forecasts for every spot
• Wave height, period, and direction
• Wind speed and direction
• Tide charts and predictions
• Real-time conditions from the community
• Set up spot notifications

DISCOVER NEW BREAKS
Explore surf spots with community reviews, local insights, and real-time conditions. Find your next favorite break with help from surfers who know it best.

• Comprehensive beach directory
• Community reviews and ratings
• Local knowledge and surf tips
• Parking, accessibility, and crowd info
• Best times and conditions to surf
• Hidden gems shared by locals

COMMUNITY FEATURES
Quiver isn't just an app - it's a community. Like and comment on sessions, follow surfers, and stay connected with your surf crew through an engaging social feed.

• Social feed of recent sessions
• Like and comment on posts
• Follow friends and local surfers
• Session invitations and notifications
• Share the stoke with your community

WHY SURFERS LOVE QUIVER
"Finally, an app built by surfers for surfers. The community features are game-changing."

"Best way to find surf buddies and track my sessions. The forecasts are super accurate."

"I've met so many amazing surfers through Quiver. It's changed how I experience the ocean."

FREE TO USE
All core features are completely free. Join thousands of surfers building connections, sharing sessions, and spreading the stoke.

PERFECT FOR
• Surfers looking for session partners
• Anyone wanting to track their surf journey
• Travelers discovering new surf spots
• Beginners learning with the community
• Experienced surfers sharing knowledge
• Surf crews coordinating sessions

Download Quiver today and join the surf community that's growing every day. Find your crew, track epic sessions, and discover amazing spots. Free to join — priceless connections.
```

#### 8.5 Add Keywords

**Keywords:** (100 chars max, comma-separated, no spaces after commas)

```
surf,surfing,forecast,waves,conditions,beach,ocean,session,log,journal,community,surfer,swell,tide
```

#### 8.6 Select Build

1. In **Build** section, click **+** or **Select a build**
2. Choose the build you uploaded in Step 7
3. Click **Done**

#### 8.7 Add What's New (for version 1.0)

**What's New in This Version:**

```
Welcome to Quiver! 🏄‍♀️

• Connect with local surfers and build your crew
• Track surf sessions with photos and detailed conditions
• Get accurate 10-day forecasts for every spot
• Discover new breaks with community reviews
• Share the stoke through our social feed

This is just the beginning. We're excited to have you in our community!
```

#### 8.8 Export Compliance

**Export Compliance Information:**

- Question: "Is your app designed to use cryptography or does it contain or incorporate cryptography?"
- Answer: **No** (unless you're using custom encryption beyond standard HTTPS)
- This should be **No** for most apps using standard HTTPS

#### 8.9 Content Rights & Advertising

**Content Rights:**

- Does your app contain, display, or access third-party content? → **Yes**
- Do you have the necessary rights to that content? → **Yes** (user-generated content, properly licensed)

**Advertising:**

- Does your app serve ads? → **No** (unless you have ads)

---

### STEP 9: Create Test Account & Submit for Review (30 minutes)

#### 9.1 Create Test Account

Create a test account for Apple reviewers:

1. In App Store Connect, go to **Users and Access**
2. Create sandbox tester account OR
3. Use existing test account

**Or create account in your app:**

- Email: `reviewer@quiversurf.app` (or similar)
- Password: Strong, memorable password
- Fill in profile with sample data

**Document credentials:**

```
Test Account:
Email: reviewer@quiversurf.app
Password: [YourTestPassword123!]

Instructions:
1. Open app
2. Tap "Sign In"
3. Enter credentials above
4. Explore features: forecasts, session logging, social feed
5. Test push notifications by creating a session invite
```

#### 9.2 Add Review Information

**App Review Information section:**

**Contact Information:**

- First Name: [Your Name]
- Last Name: [Your Last Name]
- Phone: [Your Phone]
- Email: [Your Email]

**Demo Account:**

- Check **Sign-in required**
- Username: `reviewer@quiversurf.app`
- Password: [YourTestPassword123!]

**Notes:**

```
Thank you for reviewing Quiver!

TEST ACCOUNT:
Email: reviewer@quiversurf.app
Password: [YourTestPassword123!]

KEY FEATURES TO TEST:
1. Surf Forecasts - View 10-day forecasts for any beach
2. Session Logging - Create a new session (logged or planned)
3. Social Feed - Browse community sessions, like and comment
4. Beach Discovery - Search for surf spots, view details
5. Push Notifications - Session invite notifications (pre-configured for test account)

The app is a community platform for surfers. All features are free to use. We use standard iOS push notifications for session invites and community updates.

Please reach out if you have any questions!
```

**Attachment:** (optional)

- Can add demo video or additional screenshots

#### 9.3 Version Release

**Version Release:**

- ⚪ Manually release this version
- 🔘 Automatically release this version (recommended for first release)

#### 9.4 Submit for Review

1. Review all information carefully
2. Click **Add for Review** at top right
3. Review the checklist
4. Click **Submit to App Review**
5. Confirm submission

---

### STEP 10: Monitor Review Status

**Review timeline:**

- Typically: 24-48 hours
- Can take: 1-7 days
- Check status: App Store Connect dashboard

**Statuses:**

1. **Waiting for Review** - In queue
2. **In Review** - Apple is actively reviewing
3. **Pending Developer Release** - Approved! (if set to manual release)
4. **Ready for Sale** - Live in App Store! 🎉
5. **Rejected** - Needs fixes (see rejection reasons)

**If rejected:**

- Read rejection reason carefully
- Fix issues
- Respond to App Review in Resolution Center
- Submit new build if needed

---

## ✅ Success Checklist

Before submitting, verify:

- [ ] Privacy policy updated (✅ Done automatically)
- [ ] Environment variables set in Vercel
- [ ] Universal links verified (JSON endpoint returns correct data)
- [ ] App builds successfully in Xcode
- [ ] Tested on physical iPhone device
- [ ] All core features work (login, forecasts, sessions, social)
- [ ] Push notifications work end-to-end
- [ ] Screenshots captured (3-5 quality screenshots)
- [ ] App Store listing complete (name, description, keywords, URLs)
- [ ] Build uploaded and processing complete
- [ ] Test account created with clear instructions
- [ ] Review notes added with testing guidance
- [ ] Submitted for review

---

## 🚀 Next Steps After Approval

1. **Celebrate!** 🎉 Your app is live!
2. **Monitor feedback** - Check App Store reviews
3. **Track analytics** - Monitor downloads, retention, engagement
4. **Iterate** - Plan updates based on user feedback
5. **Marketing** - Promote app to surf community
6. **Support** - Be ready to help users

---

## 📞 Need Help?

**Apple Developer Support:**

- https://developer.apple.com/support/
- Phone support for urgent issues

**App Store Connect Help:**

- https://help.apple.com/app-store-connect/

**Firebase Console:**

- https://console.firebase.google.com

---

**Last Updated:** October 17, 2025  
**Created by:** Quiver Development Team  
**For questions:** Create issue in repo or contact team


