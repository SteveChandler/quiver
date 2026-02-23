#!/usr/bin/env bash
set -euo pipefail

# Android Release Build Script
# Usage: yarn mobile:release:android
#
# Builds Android APK and distributes via Firebase App Distribution.
# Uses the default Capacitor config (dev.quiversurf.app).
# For production builds, set CAPACITOR_CONFIG=capacitor.config.prod.ts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FIREBASE_ANDROID_APP_ID="1:230741354184:android:51b22556e66b39db3c67fd"
FIREBASE_GROUP="android"

cd "$PROJECT_DIR"

echo "=== Android Release Build ==="
echo ""

# Step 1: Build Next.js
echo "[1/4] Building Next.js..."
yarn build

# Step 2: Sync Capacitor
echo ""
echo "[2/4] Syncing Capacitor Android..."
npx cap sync android

# Step 3: Build debug APK (Firebase requires APK, not AAB)
echo ""
echo "[3/4] Building debug APK..."
cd android
./gradlew assembleDebug
cd "$PROJECT_DIR"

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

# Step 4: Upload to Firebase
if [ -f "$APK_PATH" ]; then
  echo ""
  echo "[4/4] Uploading to Firebase App Distribution..."
  RELEASE_NOTES="${1:-$(git log -1 --pretty=%B)}"
  firebase appdistribution:distribute "$APK_PATH" \
    --app "$FIREBASE_ANDROID_APP_ID" \
    --groups "$FIREBASE_GROUP" \
    --release-notes "$RELEASE_NOTES"

  echo ""
  echo "=== Android Release Complete ==="
  echo "APK: $PROJECT_DIR/$APK_PATH"
  echo "Distributed to group: $FIREBASE_GROUP"
else
  echo ""
  echo "ERROR: APK not found at $APK_PATH"
  exit 1
fi
