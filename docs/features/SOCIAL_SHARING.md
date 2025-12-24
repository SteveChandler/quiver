# Session Social Sharing

**Status**: In Development (Hybrid: Web OG download + Native share)
**Last Updated**: December 24, 2025

---

## 📋 Overview

The social sharing feature enables users to share their surf sessions and forecasts with the community and on external social platforms.

We are moving toward a **Native-First Sharing** approach (Capacitor share sheet + on-device card generation), but today the system is **hybrid**:
- **Web (desktop)**: downloads a share image from lightweight OG image routes (no auth required).
- **Mobile (Capacitor)**: uses the native OS share sheet; on-device card generation is still planned.

### Key Features
- **Native Share Sheet** - Leverages the OS-level sharing dialog for maximum compatibility.
- **Client-Side Generation** - (Planned) Generate shareable cards directly on the device using canvas or HTML-to-image.
- **Multi-Platform Support** - Share to Instagram, X (Twitter), WhatsApp, Messages, and more.
- **Direct Save** - Option to save generated cards directly to the device's photo gallery.

---

## 🏗️ Architecture

### UX & Placement

To maximize engagement and reach, sharing actions must be discoverable and contextual.

**1. Make the Share Action Easy to Find**
*   **Forecast View**: Clearly visible share icon on forecast cards or in the navigation bar when viewing beach details.
*   **Post-Session View**: Share button placed in the top bar or alongside primary actions (Edit/Delete) on the session detail page.
*   **Feed View**: Inline share icons beneath activities (Like, Comment, Share) to make sharing a contextual action.

**2. Placement Guidelines**
*   **App Bar**: Dedicated detail pages (sessions/forecasts) should feature a share icon in the upper-right corner, consistent with platform norms (iOS arrow, Android three-dot).
*   **Inline with Content**: Engagement buttons should be grouped together. Strava-style kudos/comment/share groups are highly recognizable.
*   **Prominence**: Sharing is a core growth feature. Avoid tucking it away in submenus. Use contrasting colors or prominent positioning to encourage use.

### User Flow for Sharing

The following flow ensures a smooth experience from discovery to multi-platform sharing:

1.  **Trigger**: User taps the share button on a forecast card or session summary.
2.  **Capture/Generate**: The app gathers content (stats, photos, maps). Future implementation will generate a "Session Recap" image card on the client.
3.  **Native Share Sheet**: The app invokes the platform's native share sheet (iOS `UIActivityViewController` or Android `Intent.ACTION_SEND`).
4.  **Platform Handoff**: The OS handles passing the content to Instagram, X, Messages, etc.
5.  **Download/Save**: Provide a direct "Download" or "Save to Photos" option within the flow or share sheet.
6.  **Confirmation**: Show a subtle confirmation (toast or checkmark) after a successful share.

---

## 💻 Implementation

### Capacitor (Mobile) Implementation

For our Capacitor-powered mobile apps, we leverage native plugins to provide a seamless sharing experience.

**1. Native Share Sheet (`@capacitor/share`)**
The official Capacitor Share plugin is our primary tool for triggering the system share dialog.

```typescript
import { Share } from '@capacitor/share';

const shareSession = async (beachName: string, text?: string) => {
  await Share.share({
    title: `Surf Session at ${beachName}`,
    text: text || `Check out my session at ${beachName} on Quiver!`,
    url: window.location.href, // Link back to the public session page
    dialogTitle: 'Share your session',
  });
};
```

**2. Image Sharing (Planned)**
When sharing generated cards, the flow involves saving the image to a temporary path and sharing the file URI.

```typescript
// Proposed implementation for image sharing
const shareImageCard = async (imageUri: string) => {
  await Share.share({
    files: [imageUri],
  });
};
```

**3. Saving to Gallery**
To allow users to download images directly to their device:
*   **iOS**: Use `cordova-plugin-x-socialsharing` to call `saveToPhotoAlbum()`.
*   **Android**: Save to the `Pictures` directory via Filesystem and trigger a Media Scanner.

---

### Web (Desktop) Implementation (Current)

On the web, the share flow uses `components/share/share-sheet.tsx` + `lib/share/share-image.ts`:
- **Supported browsers**: uses the Web Share API (`navigator.share`) when available (primarily mobile browsers).
- **Desktop fallback**: downloads the share image file.

The image URLs come from the share URL builders in `lib/share/build-share-card-url.ts`:
- **Forecast share image**: `/api/og/wave?...`
- **Session share image**: `/api/og/session?...`

#### `/api/og/session` query parameters

Required:
- `beach`
- `rating`
- `stars`
- `size`
- `board`

Optional (new):
- `date` (e.g., `December 23, 2025`)
- `windLabel` (e.g., `Light Offshore`)
- `windSpeed` (e.g., `7 mph`)
- `tagline` (one-line session summary)
- `footer` (footer line text)
- `bg` (background image URL)

Notes:
- These OG routes are intended for **share image downloads** and internal previews, not for SEO/social crawler richness.
- The session card uses a public logo asset from `public/examples/surfboardLogo-notext.png` for consistent rendering.

---

## 🧪 Testing

### Manual Testing Checklist

#### Basic Share Flow
- [ ] Click "Share" button on session detail page (if implemented)
- [ ] Verify native share sheet opens
- [ ] Verify link/text is correctly populated
- [ ] Verify sharing to at least one external app (Messages, Mail, etc.)

---

## 📚 Related Documentation

- **[Attribution Tracking](./ATTRIBUTION_TRACKING.md)** - Referrals and UTM tracking
- **[Gamification](./GAMIFICATION.md)** - XP and badge system rewards for sharing
- **[Social Sharing Architecture ADR](../adr/001-social-sharing-architecture.md)** - Architectural decisions
- **[Capacitor Share Plugin](https://capacitorjs.com/docs/apis/share)** - Official documentation

---

**Built with ❤️ for the surf community** 🏄‍♂️📸
