# Android App Release Guide

**Status:** Ready to Release
**Completion:** 70% automated, 30% manual steps required
**Estimated Time:** 4-8 hours active work + 24-72 hours Google Play review

---

## What's Already Done

The hard technical work is complete:

- [x] Capacitor configured with production URL
- [x] Android project generated with Gradle build
- [x] Firebase push notifications configured
- [x] PWA foundation with offline caching
- [x] Native bridge adapters (share, push, platform detection)
- [x] Deep link routes ready
- [x] google-services.json configured for `app.quiversurf.mobile`
- [x] Java 21 environment setup documented

**Related Documentation:**

- `IOS_RELEASE_GUIDE.md` - iOS App Store submission guide
- `../setup/PUSH_NOTIFICATIONS_SETUP.md` - Firebase push setup

---

## Prerequisites

Before starting, ensure you have:

- [ ] Android Studio installed (https://developer.android.com/studio)
- [ ] Java JDK 21+ installed
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Google Play Developer account ($25 one-time fee)

---

## STEP 1: Environment Setup (15 minutes)

### 1.1 Install Java 21

```bash
# macOS with Homebrew
brew install openjdk@21

# Add to PATH (add to ~/.zshrc for persistence)
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
```

### 1.2 Verify Installation

```bash
java -version
# Should output: openjdk version "21.x.x"
```

### 1.3 Verify Android Studio

1. Open Android Studio
2. Go to **Preferences → Build, Execution, Deployment → Build Tools → Gradle**
3. Ensure **Gradle JDK** is set to Java 21

---

## STEP 2: Build the APK (10-15 minutes)

### 2.1 Build Next.js App

```bash
cd /Users/stevenchandler/Desktop/quiver
yarn build
```

### 2.2 Sync with Capacitor (Production)

```bash
yarn mobile:sync:prod
```

This uses `capacitor.config.prod.ts` which points to `https://www.quiversurf.app`

### 2.3 Build Debug APK

```bash
cd android
./gradlew assembleDebug
```

**Output location:** `android/app/build/outputs/apk/debug/app-debug.apk`

### 2.4 Build Release APK (Signed)

For production release, you need a signed APK:

```bash
./gradlew assembleRelease
```

**Note:** Release builds require signing configuration (see Step 5).

---

## STEP 3: Firebase App Distribution (Beta Testing)

Firebase App Distribution is the recommended way to distribute beta builds to testers before publishing to Google Play.

### 3.1 Setup Firebase App Distribution (One-time)

1. Go to https://console.firebase.google.com/project/quiver-1f787/appdistribution
2. Click **Get started** if first time
3. Select the Android app: `app.quiversurf.mobile`

### 3.2 Add Testers

In Firebase Console → App Distribution → **Testers & Groups**:

1. Click **Add testers**
2. Enter email addresses of testers
3. Create groups (recommended):
   - `internal-team` - Core development team
   - `beta-testers` - External beta users

### 3.3 Upload APK via Firebase Console (Easiest)

1. Go to https://console.firebase.google.com/project/quiver-1f787/appdistribution
2. Click **+ New release** or drag and drop the APK
3. Select APK: `/Users/stevenchandler/Desktop/quiver/android/app/build/outputs/apk/debug/app-debug.apk`
4. Add release notes describing changes
5. Select tester groups
6. Click **Distribute**

### 3.4 Upload APK via CLI (For Automation)

```bash
# Login to Firebase (one-time, opens browser)
firebase login

# Upload and distribute
firebase appdistribution:distribute android/app/build/outputs/apk/debug/app-debug.apk \
  --app 1:230741354184:android:51b22556e66b39db3c67fd \
  --groups "internal-team,beta-testers" \
  --release-notes "Beta release - [describe changes]"
```

### 3.5 How Testers Install the App

1. Testers receive an email invitation from Firebase
2. Click the link and sign in with Google
3. First time: Install the **Firebase App Tester** app (or use direct download)
4. Download and install the APK
5. On Android: Enable **Install from unknown sources** if prompted
6. Testers receive email notifications when new builds are available

### 3.6 Quick Reference Commands

```bash
# Automated release script (builds + syncs + creates AAB)
yarn mobile:release:android

# Build and distribute via Firebase in one flow
yarn build && \
npx cap sync android && \
cd android && \
./gradlew assembleDebug && \
cd .. && \
firebase appdistribution:distribute android/app/build/outputs/apk/debug/app-debug.apk \
  --app 1:230741354184:android:51b22556e66b39db3c67fd \
  --groups "android" \
  --release-notes "$(git log -1 --pretty=%B)"
```

**Note:** Firebase App Distribution requires APKs, not AABs. Use `assembleDebug` for Firebase distribution and `bundleRelease` for Google Play.

---

## STEP 4: Test on Physical Device (1-2 hours)

### 4.1 Enable Developer Mode on Android Device

1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times
3. Go to **Settings → System → Developer options**
4. Enable **USB debugging**

### 4.2 Connect Device

1. Connect Android phone via USB
2. Accept USB debugging prompt on phone
3. In terminal, verify connection:
   ```bash
   adb devices
   # Should show your device
   ```

### 4.3 Install APK

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or use Android Studio:
1. Open Android Studio
2. Click **Run** (green play button)
3. Select your connected device

### 4.4 Test Core Features

**Authentication:**
- [ ] Login with existing account works
- [ ] Logout and re-login works

**Push Notifications:**
- [ ] App requests notification permission on first login
- [ ] Grant permission
- [ ] Check logcat for: "Token registered with backend"

**Core Features:**
- [ ] Home page loads
- [ ] Forecast data displays
- [ ] Can create/log session
- [ ] Social feed loads
- [ ] Can like/comment on sessions
- [ ] Can view beach details

**Native Features:**
- [ ] Share button works (test session sharing)
- [ ] Deep links work from browser

**Offline:**
- [ ] Enable Airplane Mode
- [ ] Check if forecasts are cached
- [ ] Check if previously loaded content is accessible

---

## STEP 5: App Signing (Required for Release)

### 5.1 Create Keystore (One-time)

```bash
keytool -genkey -v -keystore quiver-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias quiver
```

**Prompts to fill:**
- Keystore password (save this!)
- Key password (can be same as keystore)
- First and last name
- Organizational unit
- Organization
- City
- State
- Country code (US)

**CRITICAL:** Store this keystore file and passwords securely. You cannot update your app without them!

### 5.2 Configure Gradle for Signing

Create `android/keystore.properties` (DO NOT commit to git):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=quiver
storeFile=/path/to/quiver-release-key.jks
```

Update `android/app/build.gradle`:

```gradle
// Add at the top, after apply plugin lines
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config ...

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 5.3 Build Signed Release APK

```bash
cd android
./gradlew assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

### 5.4 Build Android App Bundle (AAB) for Play Store

Google Play prefers AAB format:

```bash
./gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## STEP 6: Google Play Console Setup (2-4 hours)

### 6.1 Create Developer Account

1. Go to https://play.google.com/console
2. Pay $25 one-time registration fee
3. Complete account setup

### 6.2 Create App

1. Click **Create app**
2. Fill in:
   - **App name:** Quiver
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
3. Accept declarations
4. Click **Create app**

### 6.3 Store Listing

**Main store listing:**

**App name:** Quiver

**Short description:** (80 chars max)
```
Connect with surfers, track sessions, and get accurate surf forecasts.
```

**Full description:** (4000 chars max)
```
Connect with surfers. Track epic sessions. Discover the best waves.

Quiver is the surf community platform that brings surfers together. Whether you're looking for surf buddies, tracking your progression, or discovering new breaks, Quiver connects you with a thriving community of surfers who share your passion for the ocean.

FIND YOUR SURF CREW
Never surf alone again. Connect with local surfers, join group sessions, and build lasting friendships in the lineup.

TRACK YOUR SESSIONS
Log every surf session with photos, ratings, and notes. Build your surf journal and share your progression with the community.

ACCURATE SURF FORECASTS
Get 10-day surf forecasts trusted by your local community. Know exactly when to paddle out with detailed wave height, wind, tide, and swell data.

DISCOVER NEW BREAKS
Explore surf spots with community reviews, local insights, and real-time conditions. Find your next favorite break.

COMMUNITY FEATURES
Like and comment on sessions, follow surfers, and stay connected through an engaging social feed.

FREE TO USE
All core features are completely free. Join thousands of surfers building connections and sharing the stoke.

Download Quiver today and join the surf community!
```

### 6.4 Graphics Assets

**Required:**
- **App icon:** 512 x 512 PNG (32-bit, no alpha)
- **Feature graphic:** 1024 x 500 PNG or JPG
- **Phone screenshots:** Min 2, max 8 (16:9 or 9:16)

**Screenshot dimensions:**
- Minimum: 320px
- Maximum: 3840px
- Recommended: 1080 x 1920 (portrait)

### 6.5 Content Rating

1. Go to **Policy → App content → Content rating**
2. Complete the IARC questionnaire
3. Should result in **Everyone** rating for Quiver

### 6.6 App Category

- **Category:** Sports
- **Tags:** Surfing, Fitness, Social

---

## STEP 7: Release to Google Play (1 hour)

### 7.1 Internal Testing (Recommended First)

1. Go to **Testing → Internal testing**
2. Click **Create new release**
3. Upload AAB file: `android/app/build/outputs/bundle/release/app-release.aab`
4. Add release notes
5. Click **Review release** → **Start rollout to Internal testing**
6. Add internal testers (up to 100)

### 7.2 Closed Testing (Beta)

1. Go to **Testing → Closed testing**
2. Create track or use existing
3. Upload AAB
4. Add testers via email or Google Group

### 7.3 Production Release

1. Go to **Production**
2. Click **Create new release**
3. Upload AAB
4. Add release notes:
   ```
   Welcome to Quiver!

   - Connect with local surfers and build your crew
   - Track surf sessions with photos and detailed conditions
   - Get accurate 10-day forecasts for every spot
   - Discover new breaks with community reviews
   - Share the stoke through our social feed

   This is just the beginning. We're excited to have you!
   ```
5. Click **Review release**
6. Fix any warnings/errors
7. Click **Start rollout to Production**

### 7.4 Review Timeline

- **Internal/Closed testing:** Usually instant
- **Production:** 1-3 days for first submission, can be faster for updates
- Check status in Google Play Console dashboard

---

## STEP 8: Version Management

### 8.1 Update Version Numbers

Before each release, update `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "app.quiversurf.mobile"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 2          // Increment for each release
    versionName "1.1"      // User-visible version string
}
```

**Rules:**
- `versionCode` must increase with each upload to Play Store
- `versionName` is displayed to users (use semantic versioning)

### 8.2 Release Checklist

Before each release:
- [ ] Update versionCode and versionName
- [ ] Test on physical device
- [ ] Build release AAB
- [ ] Upload to Play Console
- [ ] Write release notes
- [ ] Monitor rollout

---

## Troubleshooting

### Java Not Found

```bash
# Check if Java is installed
java -version

# If not found, install Java 21
brew install openjdk@21

# Add to PATH
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
```

### google-services.json Package Mismatch

Error: `No matching client found for package name 'app.quiversurf.mobile'`

**Fix:**
1. Go to Firebase Console → Project Settings
2. Add Android app with package name `app.quiversurf.mobile`
3. Download new `google-services.json`
4. Replace `android/app/google-services.json`

### Signing Configuration Errors

```
Error: Keystore was tampered with, or password was incorrect
```

**Fix:**
- Verify passwords in `keystore.properties`
- Ensure keystore file path is correct
- Check file permissions

### Gradle Build Failures

```bash
# Clean build
cd android
./gradlew clean
./gradlew assembleDebug
```

### Device Not Recognized

```bash
# Check ADB connection
adb devices

# If empty, try:
adb kill-server
adb start-server
```

---

## Quick Reference

### Build Commands

```bash
# Automated release (build + sync + AAB)
yarn mobile:release:android

# Development
yarn dev                           # Start Next.js dev server

# Build APK (Debug) - for Firebase distribution
yarn build && npx cap sync android && cd android && ./gradlew assembleDebug

# Build APK (Release)
yarn build && npx cap sync android && cd android && ./gradlew assembleRelease

# Build AAB for Play Store
yarn build && npx cap sync android && cd android && ./gradlew bundleRelease

# Build with production Capacitor config (points to www.quiversurf.app)
yarn build && yarn mobile:sync:prod && cd android && ./gradlew bundleRelease

# Open in Android Studio
npx cap open android
```

### Firebase App Distribution

```bash
# Login
firebase login

# Upload debug APK to "android" tester group
firebase appdistribution:distribute android/app/build/outputs/apk/debug/app-debug.apk \
  --app 1:230741354184:android:51b22556e66b39db3c67fd \
  --groups "android" \
  --release-notes "Description of changes"
```

### Output Locations

| Build Type | Location |
|------------|----------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

---

## Success Checklist

Before releasing:

- [ ] Java 21 installed and configured
- [ ] google-services.json has correct package name
- [ ] App builds successfully
- [ ] Tested on physical Android device
- [ ] All core features work (login, forecasts, sessions, social)
- [ ] Push notifications work
- [ ] Signing configured for release builds
- [ ] Version numbers updated
- [ ] Store listing complete (name, description, screenshots)
- [ ] Content rating questionnaire completed
- [ ] AAB uploaded to Play Console
- [ ] Release notes written

---

## Next Steps After Approval

1. **Monitor downloads** - Track installs in Play Console
2. **Check reviews** - Respond to user feedback
3. **Watch crashes** - Firebase Crashlytics / Play Console vitals
4. **Plan updates** - Address feedback and add features
5. **Promote** - Share with surf community

---

## Need Help?

**Google Play Console Help:**
- https://support.google.com/googleplay/android-developer

**Firebase App Distribution:**
- https://firebase.google.com/docs/app-distribution

**Capacitor Documentation:**
- https://capacitorjs.com/docs/android

---

**Last Updated:** February 2026
**Created by:** Quiver Development Team
