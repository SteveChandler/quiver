#!/usr/bin/env bash
set -euo pipefail

# iOS Release Build Script
# Usage: yarn mobile:release:ios
#
# Builds a signed iOS IPA and distributes via Firebase App Distribution.
# Uses the default Capacitor config (dev.quiversurf.app).
# For production builds, set CAPACITOR_CONFIG=capacitor.config.prod.ts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IOS_DIR="$PROJECT_DIR/ios"
ARCHIVE_PATH="$IOS_DIR/build/App.xcarchive"
EXPORT_PATH="$IOS_DIR/build/export"
IPA_PATH="$EXPORT_PATH/App.ipa"
FIREBASE_IOS_APP_ID="1:230741354184:ios:44c5a4342c1fc5d53c67fd"
FIREBASE_GROUP="testers"

cd "$PROJECT_DIR"

echo "=== iOS Release Build ==="
echo ""

# Step 1: Build Next.js
echo "[1/5] Building Next.js..."
yarn build

# Step 2: Sync Capacitor
echo ""
echo "[2/5] Syncing Capacitor iOS..."
npx cap sync ios

# Step 3: Archive
echo ""
echo "[3/5] Archiving iOS app..."
xcodebuild -workspace "$IOS_DIR/App/App.xcworkspace" \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  CODE_SIGN_IDENTITY="Apple Development" \
  | tail -5

# Step 4: Export IPA
echo ""
echo "[4/5] Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$IOS_DIR/ExportOptions.plist" \
  -exportPath "$EXPORT_PATH" \
  | tail -5

# Step 5: Upload to Firebase
if [ -f "$IPA_PATH" ]; then
  echo ""
  echo "[5/5] Uploading to Firebase App Distribution..."
  RELEASE_NOTES="${1:-$(git log -1 --pretty=%B)}"
  firebase appdistribution:distribute "$IPA_PATH" \
    --app "$FIREBASE_IOS_APP_ID" \
    --groups "$FIREBASE_GROUP" \
    --release-notes "$RELEASE_NOTES"

  echo ""
  echo "=== iOS Release Complete ==="
  echo "IPA: $IPA_PATH"
  echo "Distributed to group: $FIREBASE_GROUP"
else
  echo ""
  echo "ERROR: IPA not found at $IPA_PATH"
  exit 1
fi
