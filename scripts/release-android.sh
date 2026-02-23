#!/usr/bin/env bash
set -euo pipefail

# Android Release Build Script
# Usage: yarn mobile:release:android
#
# Builds a signed Android App Bundle (AAB) for distribution.
# Uses the default Capacitor config (dev.quiversurf.app).
# For production builds, set CAPACITOR_CONFIG=capacitor.config.prod.ts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Android Release Build ==="
echo ""

# Step 1: Build Next.js
echo "[1/3] Building Next.js..."
yarn build

# Step 2: Sync Capacitor
echo ""
echo "[2/3] Syncing Capacitor Android..."
npx cap sync android

# Step 3: Build signed AAB
echo ""
echo "[3/3] Building signed release AAB..."
cd android
./gradlew bundleRelease

AAB_PATH="app/build/outputs/bundle/release/app-release.aab"

if [ -f "$AAB_PATH" ]; then
  echo ""
  echo "=== Build Complete ==="
  echo "AAB: $PROJECT_DIR/android/$AAB_PATH"
  echo ""
  echo "Next steps:"
  echo "  1. Upload to Google Play Console"
  echo "  2. Or distribute via Firebase: firebase appdistribution:distribute $AAB_PATH --app 1:230741354184:android:51b22556e66b39db3c67fd"
else
  echo ""
  echo "ERROR: AAB not found at $AAB_PATH"
  exit 1
fi
