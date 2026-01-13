---
description: Sync web code to Capacitor (iOS/Android)
---

# Mobile Sync

Use this to update the native iOS/Android projects with the latest web build.

## Steps

1. Build the web app
2. Sync to Capacitor

```bash
# Build web assets
yarn build

# Sync to iOS and Android
npx cap sync
```

## Opening Native IDEs

To open the native projects:

```bash
npx cap open ios
npx cap open android
```
