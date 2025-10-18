# Quiver Session Notifications — Implementation Guide

**Goal**: When a user plans a session, notify selected friends immediately via push and email, and record an in-app notification.

---

## 0) High-Level Flow

1. User creates a session and selects invitees
2. API creates the session + invite rows (transaction)
3. Backend fans out notifications:
   - **Push**: FCM or OneSignal
   - **Email**: SendGrid (or SES)
   - **(Optional)** Insert an in-app notification record for badge/feed

---

## 1) Data Model (Postgres/Supabase)

### Migration

```sql
-- device tokens for push
create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  device_token text not null,
  created_at timestamptz not null default now(),
  unique(user_id, device_token)
);

-- sessions (simplified)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null,
  start_time timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

-- invitations (fan-out driver)
create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'notified', -- future: pending/accepted/declined
  created_at timestamptz not null default now(),
  unique(session_id, invited_user_id)
);

-- optional in-app notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- e.g., 'session_invite'
  data jsonb not null, -- { session_id, invited_by, spot, time }
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

### RLS (sketch)

- **user_devices**: Owner can insert/delete their tokens; service role can read (to send)
- **sessions**: Creator can insert/select; invited users can select via join
- **session_invites**: `invited_user` and `inviter` can select; service role can read
- **notifications**: `user_id = auth.uid()` can select/update

---

## 2) Environment & Keys

Set in Vercel/Supabase Edge:

### Firebase (FCM)

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (escape `\n`)

**OR OneSignal:**

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`

### Email

- `SENDGRID_API_KEY`

**OR AWS SES:**

- `AWS_REGION`
- `SES_ACCESS_KEY_ID`
- `SES_SECRET_ACCESS_KEY`

### App URLs

- `APP_BASE_URL` (deep links)
- `WEB_BASE_URL`

---

## 3) Client: Capture Device Tokens

### Web (FCM)

1. Add Firebase web SDK + service worker (`/firebase-messaging-sw.js`)
2. On login/app mount:
   - Request notification permission
   - Get FCM token
   - `POST { platform:'web', device_token }` to `/api/devices/upsert`

### iOS/Android (FCM)

1. Add Firebase SDK
2. On app launch or token refresh:
   - Send `{ platform:'ios'|'android', device_token }` to `/api/devices/upsert`

### OneSignal Alternative

Initialize SDK, set external user ID to Quiver `user_id`. Skip token plumbing; OneSignal manages it.

---

## 4) API Routes (Next.js / Edge Functions)

### 4.1 Upsert Device

**POST** `/api/devices/upsert`

```typescript
// pseudo
const { platform, device_token } = req.body;
await supabase.from("user_devices").upsert({
  user_id: authUser.id,
  platform,
  device_token,
});
return 204;
```

### 4.2 Create Session + Invites + Notify

**POST** `/api/sessions/create`

```typescript
// input: { spotId, startTime, note, inviteeIds: string[] }
begin transaction
  const { data: session } = insert into sessions (...)
  bulk insert into session_invites (session_id, invited_user_id, invited_by)
commit

// gather targets
const tokens = await getDeviceTokens(inviteeIds);
const emails = await getEmails(inviteeIds);

// parallel fan-out
await Promise.allSettled([
  sendPush({session, tokens}),     // FCM or OneSignal
  sendEmails({session, emails}),   // SendGrid or SES
  insertInAppNotifs({session, inviteeIds})
]);

return session;
```

---

## 5) Push: Option A — Firebase Cloud Messaging

### 5.1 Admin SDK Setup

```typescript
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}
```

### 5.2 Send Helper

```typescript
type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendPushFCM(tokens: string[], payload: PushPayload) {
  if (!tokens.length) return;

  const message = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    tokens,
  };

  const res = await admin.messaging().sendEachForMulticast(message);

  // prune invalid tokens
  // res.responses[i].error?.code === 'messaging/registration-token-not-registered'
}
```

### Payload Example

```typescript
sendPushFCM(tokens, {
  title: "New Surf Session Invite",
  body: `${creatorName} invited you: ${spotName} • ${localTime}`,
  data: { session_id: session.id },
});
```

---

## 6) Push: Option B — OneSignal

### 6.1 SDK/Identity

**Client**: Initialize OneSignal, set External User ID = Quiver `user_id`

### 6.2 Send API

```typescript
await fetch("https://api.onesignal.com/notifications", {
  method: "POST",
  headers: {
    Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    app_id: process.env.ONESIGNAL_APP_ID,
    include_external_user_ids: inviteeIds,
    headings: { en: "New Surf Session Invite" },
    contents: {
      en: `${creatorName} invited you: ${spotName} • ${localTime}`,
    },
    data: { session_id: session.id },
  }),
});
```

---

## 7) Email: SendGrid

### 7.1 Minimal Sender

```typescript
import sg from "@sendgrid/mail";
sg.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendSessionEmails(
  to: string[],
  { creatorName, spotName, localTime, sessionId }: any
) {
  if (!to.length) return;

  const link = `${process.env.WEB_BASE_URL}/sessions/${sessionId}`;

  const msg = {
    from: { email: "no-reply@quiver.app", name: "Quiver" },
    personalizations: to.map((email) => ({ to: [{ email }] })),
    subject: `You're invited to a surf session by ${creatorName}`,
    content: [
      {
        type: "text/html",
        value: `
        <p>${creatorName} invited you to surf.</p>
        <p><b>Spot:</b> ${spotName}<br/><b>Time:</b> ${localTime}</p>
        <p><a href="${link}">View session in Quiver</a></p>
      `,
      },
    ],
  };

  await sg.send(msg as any);
}
```

**SES Alternative**: Use `@aws-sdk/client-sesv2` with similar template.

---

## 8) Optional: In-App Notifications

```sql
insert into notifications (user_id, type, data)
select invited_user_id, 'session_invite',
       jsonb_build_object(
         'session_id', session_id,
         'invited_by', invited_by
       )
from session_invites
where session_id = :sessionId;
```

Client can subscribe to `notifications` (Supabase Realtime) to update a badge or list.

---

## 9) Alternative Triggered Architecture (Edge Function)

### Why

Decouple fan-out from API latency.

### Implementation

1. API only inserts `session_invites` rows
2. `AFTER INSERT ON session_invites` → HTTP webhook to Supabase Edge Function
3. Edge Function:
   - Resolves emails + tokens
   - Sends FCM/OneSignal + SendGrid
   - Inserts notifications
   - Prunes invalid tokens

This allows retries/backoff and keeps the user-facing request snappy.

---

## 10) Permissions & Security

- Use **service role key** only in server context for:
  - Reading `auth.users` emails (or mirror email into `profiles` at signup)
  - Reading all device tokens
- **Validate** that the caller is the session creator
- **Rate-limit** invites per user to prevent spam
- Offer **user preferences** later (mute push/email)

---

## 11) Testing Checklist

### Unit

- Formatters for email/push payloads
- Token pruning

### Integration

- Create session with N invitees → verify rows in `sessions`, `session_invites`, `notifications`
- Mock FCM/SendGrid — assert calls & payloads

### E2E

- **Web push**: Grant permission → token saved → receive push via test script
- **Email**: Use a sandbox/verified domain; confirm template renders & links open correct session

---

## 12) Rollout Plan

1. ✅ Ship schema + RLS
2. ✅ Implement `/api/devices/upsert`
3. ✅ Implement `/api/sessions/create` (inline fan-out)
4. 🔄 Add client UI: invitee picker (followers list), permissions prompt for notifications
5. 🔄 Switch to Edge Function trigger when ready
6. 🔄 Add user notification preferences

---

## 13) Minimal Invitee Picker (UI Sketch)

### Features

- Multi-select of users the planner follows (or followers)
- Fallback: search users by handle

### Submit Payload

```json
{
  "spotId": "…",
  "startTime": "2025-10-20T06:00:00-07:00",
  "note": "Dawn patrol 🤙",
  "inviteeIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

---

## 14) Observability

- **Log** per-batch success/fail counts (push + email)
- Store a lightweight `notification_logs` table or structured logs (platform, status, error_code)
- Create a **cron job** to remove invalid/stale `user_devices`

---

## Next Steps

1. Review this implementation guide
2. Create migration files for database schema
3. Set up environment variables in Vercel/Supabase
4. Implement API routes following established patterns
5. Build client UI for invitee selection
6. Test thoroughly before rollout

---

**Last Updated**: January 2025  
**Status**: Planning & Design Phase  
**Owner**: Engineering Team
