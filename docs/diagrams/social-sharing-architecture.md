# Social Sharing Architecture Diagrams

**Date**: December 22, 2025
**Feature**: QuiverSurf Session Sharing (Native-First)
**Status**: In-Development / Redesign

---

## System Overview

The sharing system leverages the device's native capabilities to provide a seamless multi-platform experience.

```mermaid
graph TD
    User([User]) -->|Taps Share| UI[Presentation Layer]
    
    subgraph App [Quiver App]
        UI -->|Triggers| Controller[Sharing Controller]
        Controller -->|Option A: Text/Link| NativeShare[Capacitor Share Plugin]
        Controller -->|Option B: Image| ClientGen[Client-Side Card Generation]
        ClientGen -->|Saves Temp File| FS[Local Filesystem]
        FS -->|Provides URI| NativeShare

        Controller -->|Web: Share Image URL| OGRoute[OGImageRoute]
        OGRoute -->|Returns PNG| Download[DownloadOrWebShare]
    end
    
    NativeShare -->|Invoke| OS[iOS / Android Share Sheet]
    OS -->|Handoff| Social[Instagram / X / Messages / etc.]
    
    Controller -->|Log Event| Analytics[Google Analytics + DB]
```

---

## User Flow Sequence

The following diagram shows the sequence of events from user trigger to social platform handoff.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component (SessionCard)
    participant P as Capacitor Share Plugin
    participant OS as Native OS (iOS/Android)
    participant DB as Supabase / GA

    U->>C: Tap Share Button
    C->>DB: Log share_initiated
    alt Simple Share (Link/Text)
        C->>P: Share.share({ title, text, url })
    else Image Share (Planned)
        C->>C: Generate Image (Canvas/HTML)
        C->>P: Share.share({ files: [imageUri] })
    end
    P->>OS: Open Share Sheet
    OS->>U: Show App Chooser
    U->>OS: Select App (e.g., Instagram)
    OS->>DB: Log share_completed (if callback supported)
```

---

## Data Schema (Tracking)

Shares are tracked for growth analytics and user attribution.

```mermaid
erDiagram
    SESSIONS ||--o{ SESSION_SHARES : "has"
    PROFILES ||--o{ SESSION_SHARES : "performs"
    
    SESSION_SHARES {
        uuid id PK
        uuid session_id FK
        uuid user_id FK
        string platform "instagram | x | whatsapp | etc"
        string variant "card | text | map"
        timestamp created_at
    }
```

---

## Technology Stack

### Mobile
- **Capacitor Core**: Native bridge.
- **@capacitor/share**: Official plugin for system share sheet.
- **cordova-plugin-x-socialsharing**: Advanced sharing & gallery saving (iOS).
- **Capacitor Filesystem**: Temporary image storage (Android).

### Web
- **Web Share API**: Native sharing in supported browsers.
- **OG image routes**: `/api/og/session`, `/api/og/wave` for downloadable share images (current implementation).
- **Download fallback**: Desktop browsers download the generated image when Web Share is unavailable.

### Backend
- **Supabase**: Real-time share count tracking and persistence.
- **Google Analytics 4**: Behavioral funnel tracking.

---

**Last Updated**: December 22, 2025
**Status**: Redesign complete; implementing native-first logic.
