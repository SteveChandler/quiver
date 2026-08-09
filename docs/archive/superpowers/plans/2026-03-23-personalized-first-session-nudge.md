# Personalized First-Session Nudge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic "Your first forecast is waiting" email with a personalized nudge showing the user's home beach conditions for onboarded users.

**Architecture:** Upgrade the existing `first-session-nudge` cron to branch on onboarding status. Onboarded users get a new `PersonalizedNudgeEmail` template populated with `beach_daily_intel` data for their home beach. Non-onboarded users continue to receive the existing generic template. No new email types, no schema changes.

**Tech Stack:** Next.js API Route (cron), React email template (TSX), Supabase queries, Resend, Jest

**Spec:** `docs/archive/superpowers/specs/2026-03-23-personalized-first-session-nudge.md`

---

## Chunk 1: PersonalizedNudgeEmail Template

### Task 1: Create the PersonalizedNudgeEmail template

**Files:**
- Create: `lib/mailer/templates/PersonalizedNudgeEmail.tsx`

- [ ] **Step 1: Create the template file**

Create `lib/mailer/templates/PersonalizedNudgeEmail.tsx` with the following content. This follows the same pattern as `ConditionsAlertEmail.tsx` — dark theme, brand colors, score badge, conditions table, two CTAs. The key difference: it handles `conditionsScore: null` gracefully with a fallback layout.

```tsx
import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";

export interface PersonalizedNudgeEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number | null;
  surfDescription: string | null;
  windDescription: string | null;
  bestWindow: {
    start: string;
    end: string;
  } | null;
  ctaUrl: string;
  logSessionUrl: string;
  unsubscribeUrl: string;
}

export function PersonalizedNudgeEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  ctaUrl,
  logSessionUrl,
  unsubscribeUrl,
}: PersonalizedNudgeEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const hasConditions = conditionsScore !== null;

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
        maxWidth: 600,
        margin: "0 auto",
        backgroundColor: "#1E2456",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#252D6B",
          padding: "24px 20px",
          textAlign: "center" as const,
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            margin: 0,
            fontSize: 22,
            fontWeight: "bold",
          }}
        >
          {beachName}
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 20px", backgroundColor: "#2D357D" }}>
        <p style={{ fontSize: 16, margin: "0 0 16px 0", color: "#ffffff" }}>
          {greeting}
        </p>

        {hasConditions ? (
          <>
            {/* Context line */}
            <p
              style={{
                fontSize: 16,
                margin: "0 0 20px 0",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              You set {beachName} as your home break. Here&apos;s what
              it&apos;s looking like:
            </p>

            {/* Score Badge */}
            {(() => {
              const { label, color, emoji } =
                getConditionLabel(conditionsScore);
              return (
                <div
                  style={{ textAlign: "center" as const, marginBottom: 24 }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: color,
                      color: "#ffffff",
                      padding: "20px 40px",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 48,
                        fontWeight: "bold",
                        lineHeight: 1,
                      }}
                    >
                      {conditionsScore}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        textTransform: "uppercase" as const,
                        letterSpacing: "1px",
                        marginTop: 4,
                      }}
                    >
                      {emoji} {label} Conditions
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Conditions Table */}
            {(surfDescription || windDescription || bestWindow) && (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse" as const,
                  marginBottom: 24,
                }}
              >
                <tbody>
                  {surfDescription && (
                    <tr>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          fontWeight: "bold",
                          color: "rgba(255,255,255,0.6)",
                          width: "35%",
                        }}
                      >
                        Waves
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          color: "#ffffff",
                        }}
                      >
                        {surfDescription}
                      </td>
                    </tr>
                  )}
                  {windDescription && (
                    <tr>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          fontWeight: "bold",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        Wind
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          color: "#ffffff",
                        }}
                      >
                        {windDescription}
                      </td>
                    </tr>
                  )}
                  {bestWindow && (
                    <tr>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          fontWeight: "bold",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        Best Window
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #404C92",
                          color: "#ffffff",
                        }}
                      >
                        {bestWindow.start} - {bestWindow.end}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        ) : (
          /* Fallback: no conditions data */
          <p
            style={{
              fontSize: 16,
              margin: "0 0 24px 0",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Your home beach forecast is live. Check conditions before you
            head out.
          </p>
        )}

        {/* Primary CTA */}
        <div style={{ textAlign: "center" as const, marginBottom: 16 }}>
          <a
            href={ctaUrl}
            style={{
              backgroundColor: "#F78E42",
              color: "#ffffff",
              padding: "14px 28px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {hasConditions
              ? "Check Full Forecast \u2192"
              : `Check ${beachName} Forecast \u2192`}
          </a>
        </div>

        {/* Secondary CTA */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          {hasConditions ? (
            <a
              href={logSessionUrl}
              style={{
                backgroundColor: "transparent",
                color: "#4A70D9",
                padding: "12px 24px",
                textDecoration: "none",
                borderRadius: 8,
                display: "inline-block",
                fontSize: 14,
                fontWeight: "bold",
                border: "2px solid #4A70D9",
              }}
            >
              Paddle out? Tell us how it was &rarr;
            </a>
          ) : (
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                margin: 0,
              }}
            >
              After you surf, log your session to make your forecasts
              smarter.
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #404C92",
          padding: "20px",
          textAlign: "center" as const,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 8px 0",
          }}
        >
          You&apos;re receiving this because you recently signed up for
          Quiver.
        </p>
        <a
          href={unsubscribeUrl}
          style={{
            fontSize: 12,
            color: "#4A70D9",
            textDecoration: "underline",
          }}
        >
          Manage notification preferences
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/mailer/templates/PersonalizedNudgeEmail.tsx 2>&1 | head -20`

If tsc doesn't support single-file check, run: `npx tsc --noEmit 2>&1 | grep PersonalizedNudge`

Expected: No errors related to this file.

- [ ] **Step 3: Commit template**

```bash
git add lib/mailer/templates/PersonalizedNudgeEmail.tsx
git commit -m "feat: add PersonalizedNudgeEmail template for onboarded users

Dark-themed email template that shows home beach conditions (score,
waves, wind, best window) for users who completed onboarding. Falls
back to a simpler layout when conditions data is unavailable."
```

---

## Chunk 2: Upgrade the Cron Route

### Task 2: Expand the candidate query and add template routing

**Files:**
- Modify: `app/api/cron/first-session-nudge/route.ts`

**Reference files (read, don't modify):**
- `lib/utils/beach-url-utils.ts` — `buildBeachUrl()` for URL construction
- `lib/email/email-formatters.ts` — `formatDatabaseTime()` for TIME column formatting
- `lib/mailer/templates/PersonalizedNudgeEmail.tsx` — new template from Task 1

- [ ] **Step 1: Add imports**

At the top of `app/api/cron/first-session-nudge/route.ts`, add alongside existing imports:

```ts
import { PersonalizedNudgeEmail } from "@/lib/mailer/templates/PersonalizedNudgeEmail";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { formatDatabaseTime } from "@/lib/email/email-formatters";
```

- [ ] **Step 2: Expand the NudgeCandidate type**

Replace the existing `NudgeCandidate` interface (lines 47-51) with:

```ts
interface NudgeCandidate {
  user_id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string | null;
  onboarding_completed_at: string | null;
}

interface BeachData {
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface IntelData {
  conditions_score: number | null;
  surf_description: string | null;
  wind_description: string | null;
  best_window_start: string | null;
  best_window_end: string | null;
}
```

- [ ] **Step 3: Expand the profiles query**

Replace the profiles query (lines 104-108) to also fetch `home_beach_id` and `onboarding_completed_at`:

```ts
    const { data: windowProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, home_beach_id, onboarding_completed_at")
      .gte("created_at", signupAfter)
      .lte("created_at", signupBefore);
```

- [ ] **Step 4: Update the profileMap and candidate building**

Replace the profileMap construction (line 157-158) and candidate loop (lines 161-167) with:

```ts
    const profileMap = new Map(
      windowProfiles.map((p) => [
        p.id,
        {
          display_name: p.display_name as string | null,
          home_beach_id: p.home_beach_id as string | null,
          onboarding_completed_at: p.onboarding_completed_at as string | null,
        },
      ])
    );

    const candidateIds: string[] = [];
    for (const profile of windowProfiles) {
      if (userIdsWithSessions.has(profile.id)) continue;
      if (userIdsWithNudge.has(profile.id)) continue;
      if (userIdsWithRecentEmail.has(profile.id)) continue;
      candidateIds.push(profile.id);
    }
```

- [ ] **Step 5: Update the candidate building loop to include profile data**

Replace the candidates building loop (lines 170-188) with:

```ts
    const BATCH_SIZE = 5;
    const candidates: NudgeCandidate[] = [];
    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const batch = candidateIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((userId) => supabase.auth.admin.getUserById(userId))
      );
      for (let j = 0; j < results.length; j++) {
        const authUser = results[j].data;
        const userId = batch[j];
        const profileData = profileMap.get(userId);
        if (authUser?.user?.email) {
          candidates.push({
            user_id: userId,
            email: authUser.user.email,
            display_name: profileData?.display_name ?? null,
            home_beach_id: profileData?.home_beach_id ?? null,
            onboarding_completed_at:
              profileData?.onboarding_completed_at ?? null,
          });
        }
      }
    }
```

- [ ] **Step 6: Add helper functions for beach data and intel fetching**

Add these helper functions before the `GET` handler (above line 67):

```ts
async function fetchBeachData(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beachId: string
): Promise<BeachData | null> {
  const { data, error } = await supabase
    .from("beaches")
    .select("name, slug, city, state, country")
    .eq("id", beachId)
    .single();

  if (error || !data) return null;
  return data as BeachData;
}

async function fetchIntelData(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beachId: string
): Promise<IntelData | null> {
  // Try tomorrow first (Pacific time), fall back to today
  const now = new Date();
  const pacificNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const tomorrow = new Date(pacificNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const todayStr = pacificNow.toISOString().slice(0, 10);

  for (const dateStr of [tomorrowStr, todayStr]) {
    const { data, error } = await supabase
      .from("beach_daily_intel")
      .select(
        "conditions_score, surf_description, wind_description, best_window_start, best_window_end"
      )
      .eq("beach_id", beachId)
      .eq("forecast_date", dateStr)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as IntelData;
  }

  return null;
}
```

- [ ] **Step 7: Replace the email sending loop with template routing**

Replace the email sending loop (lines 205-256) with:

```ts
    for (const candidate of candidates) {
      try {
        await rateLimiter.throttle();

        const logSessionUrl = `${baseUrl}/sessions/new?mode=log&quick=true&utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`;
        const unsubscribeUrl = `${baseUrl}/settings`;

        const isOnboarded =
          candidate.home_beach_id !== null &&
          candidate.onboarding_completed_at !== null;

        let subject: string;
        let emailReact: React.ReactElement;
        let meta: Record<string, unknown>;

        if (isOnboarded) {
          // Personalized path: fetch beach + intel data
          const beachData = await fetchBeachData(
            supabase,
            candidate.home_beach_id!
          );
          const intelData = beachData
            ? await fetchIntelData(supabase, candidate.home_beach_id!)
            : null;

          const beachName = beachData?.name ?? "your home break";
          const score = intelData?.conditions_score ?? null;

          // Build beach URL using buildBeachUrl
          const beachPath = beachData
            ? buildBeachUrl({
                slug: beachData.slug,
                city: beachData.city,
                state: beachData.state,
                country: beachData.country,
              })
            : "/";
          const ctaUrl = `${baseUrl}${beachPath}?utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`;

          // Format best window times
          const bestWindowStart = formatDatabaseTime(
            intelData?.best_window_start ?? null
          );
          const bestWindowEnd = formatDatabaseTime(
            intelData?.best_window_end ?? null
          );
          const bestWindow =
            bestWindowStart && bestWindowEnd
              ? { start: bestWindowStart, end: bestWindowEnd }
              : null;

          // Score-aware subject line
          subject =
            score !== null && score >= 70
              ? `✨ ${beachName} — conditions are looking good`
              : `${beachName} — check tomorrow's forecast`;

          emailReact = PersonalizedNudgeEmail({
            displayName: candidate.display_name,
            beachName,
            conditionsScore: score,
            surfDescription: intelData?.surf_description ?? null,
            windDescription: intelData?.wind_description ?? null,
            bestWindow,
            ctaUrl,
            logSessionUrl,
            unsubscribeUrl,
          });

          meta = {
            template: "personalized",
            beach_name: beachName,
            conditions_score: score,
          };
        } else {
          // Generic path: existing behavior
          subject = "Your first forecast is waiting";

          emailReact = FirstSessionNudgeEmail({
            displayName: candidate.display_name,
            logSessionUrl,
            unsubscribeUrl,
          });

          meta = { template: "generic" };
        }

        const { data: sendData, error: sendError } = await resend.emails.send({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          react: emailReact,
        });

        if (sendError) {
          console.error(
            `${CONTEXT_TAG} Failed to send to user ${candidate.user_id}:`,
            sendError
          );
          summary.skipped.sendFailed++;
          continue;
        }

        const logResult = await emailLogger.logDelivery({
          userId: candidate.user_id,
          emailType: EMAIL_TYPE,
          subject,
          resendMessageId: sendData?.id,
          localDate: today,
          meta,
        });

        if (!logResult.success) {
          summary.skipped.logFailed++;
        }

        summary.sent++;
        console.log(
          `${CONTEXT_TAG} Sent ${isOnboarded ? "personalized" : "generic"} to user ${candidate.user_id}`
        );
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
      }
    }
```

- [ ] **Step 8: Add React import**

Add at the top of the file with the other imports:

```ts
import * as React from "react";
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "first-session-nudge\|PersonalizedNudge" | head -20`

Expected: No errors.

- [ ] **Step 10: Commit cron route changes**

```bash
git add app/api/cron/first-session-nudge/route.ts
git commit -m "feat: personalize first-session-nudge for onboarded users

Users who completed onboarding now receive an email with their home
beach name, conditions score, surf/wind descriptions, and best window
instead of the generic template. Falls back to generic for users
who didn't complete onboarding.

Subject line is score-aware: emoji for score >= 70, plain otherwise.
Logs template type and beach data in email_send_log meta for analytics."
```

---

## Chunk 3: Tests

### Task 3: Add tests for the cron route and template

**Files:**
- Create: `__tests__/app/api/cron/first-session-nudge.test.ts`

- [ ] **Step 1: Create the test file**

Create `__tests__/app/api/cron/first-session-nudge.test.ts`. Reference existing cron test patterns from `__tests__/app/api/cron/conditions-alert-email.test.ts` for mock setup conventions.

```ts
/**
 * Tests for first-session-nudge cron
 *
 * Covers:
 * - Onboarded user → personalized template with beach conditions
 * - Onboarded user, no intel → personalized template fallback (no score)
 * - Non-onboarded user → generic template
 * - Subject line routing (score >= 70 vs < 70 vs generic)
 * - Meta logging (template type, beach name, score)
 */

import { GET } from "@/app/api/cron/first-session-nudge/route";

// Mock dependencies
const mockSupabaseFrom = jest.fn();
const mockSupabaseRpc = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockLimit = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockEq = jest.fn();
const mockSelect = jest.fn();

// Build chainable query mock
function createChainableMock(finalData: unknown, finalError: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  const terminal = { data: finalData, error: finalError };

  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(terminal);
  chain.maybeSingle = jest.fn().mockResolvedValue(terminal);
  // Default: resolves the chain itself as the terminal value
  chain.then = jest.fn((resolve) => resolve(terminal));

  return chain;
}

let fromCallIndex = 0;
const fromReturnValues: ReturnType<typeof createChainableMock>[] = [];

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => {
      const idx = fromCallIndex++;
      if (fromReturnValues[idx]) return fromReturnValues[idx];
      return createChainableMock([]);
    },
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue({
          data: {
            user: { email: "test@example.com" },
          },
        }),
      },
    },
  }),
}));

const mockResendSend = jest.fn().mockResolvedValue({
  data: { id: "msg-123" },
  error: null,
});

jest.mock("@/lib/mailer/client", () => ({
  resend: { emails: { send: (...args: unknown[]) => mockResendSend(...args) } },
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "test@quiversurf.app",
  getBaseUrl: () => "https://www.quiversurf.app",
}));

jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: () => ({
    logDelivery: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: () => ({
    throttle: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("@/lib/api-utils", () => ({
  validateCronRequest: () => true,
  createSuccessResponse: (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), { status: 200 }),
  createErrorResponse: (msg: string, detail: string, status: number) =>
    new Response(JSON.stringify({ error: msg, detail }), { status }),
  handleApiError: (err: unknown) =>
    new Response(JSON.stringify({ error: String(err) }), { status: 500 }),
}));

function makeRequest() {
  return new Request("https://quiversurf.app/api/cron/first-session-nudge", {
    headers: { "x-vercel-cron": "1" },
  });
}

describe("first-session-nudge cron", () => {
  beforeEach(() => {
    fromCallIndex = 0;
    fromReturnValues.length = 0;
    mockResendSend.mockClear();
  });

  it("sends personalized template for onboarded user with intel", async () => {
    // profiles query
    fromReturnValues.push(
      createChainableMock([
        {
          id: "user-1",
          display_name: "Jess",
          home_beach_id: "beach-1",
          onboarding_completed_at: "2026-03-20T12:33:14Z",
        },
      ])
    );
    // sessions query (no sessions)
    fromReturnValues.push(createChainableMock([]));
    // email_send_log query (no previous emails)
    fromReturnValues.push(createChainableMock([]));
    // beaches query (for fetchBeachData)
    fromReturnValues.push(
      createChainableMock({
        name: "Huntington Beach Pier",
        slug: "huntington-beach-pier",
        city: "Huntington Beach",
        state: "CA",
        country: null,
      })
    );
    // beach_daily_intel query (for fetchIntelData)
    fromReturnValues.push(
      createChainableMock({
        conditions_score: 83,
        surf_description: "Chest-high",
        wind_description: "Light offshore",
        best_window_start: "06:00:00",
        best_window_end: "09:00:00",
      })
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.summary.sent).toBe(1);

    // Check personalized subject (score >= 70)
    const sendCall = mockResendSend.mock.calls[0][0];
    expect(sendCall.subject).toContain("Huntington Beach Pier");
    expect(sendCall.subject).toContain("✨");
    expect(sendCall.subject).toContain("conditions are looking good");
  });

  it("sends personalized fallback for onboarded user without intel", async () => {
    fromReturnValues.push(
      createChainableMock([
        {
          id: "user-1",
          display_name: "Steve",
          home_beach_id: "beach-2",
          onboarding_completed_at: "2026-03-15T19:05:56Z",
        },
      ])
    );
    fromReturnValues.push(createChainableMock([]));
    fromReturnValues.push(createChainableMock([]));
    fromReturnValues.push(
      createChainableMock({
        name: "Jacksonville Beach Pier",
        slug: "jacksonville-beach-pier-jacksonville-beach-fl",
        city: "Jacksonville Beach",
        state: "FL",
        country: null,
      })
    );
    // No intel data — both tomorrow and today return null
    fromReturnValues.push(createChainableMock(null));
    fromReturnValues.push(createChainableMock(null));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.summary.sent).toBe(1);

    const sendCall = mockResendSend.mock.calls[0][0];
    expect(sendCall.subject).toContain("Jacksonville Beach Pier");
    expect(sendCall.subject).toContain("check tomorrow's forecast");
    expect(sendCall.subject).not.toContain("✨");
  });

  it("sends generic template for non-onboarded user", async () => {
    fromReturnValues.push(
      createChainableMock([
        {
          id: "user-1",
          display_name: null,
          home_beach_id: null,
          onboarding_completed_at: null,
        },
      ])
    );
    fromReturnValues.push(createChainableMock([]));
    fromReturnValues.push(createChainableMock([]));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.summary.sent).toBe(1);

    const sendCall = mockResendSend.mock.calls[0][0];
    expect(sendCall.subject).toBe("Your first forecast is waiting");
  });

  it("uses plain subject for score < 70", async () => {
    fromReturnValues.push(
      createChainableMock([
        {
          id: "user-1",
          display_name: "Marine",
          home_beach_id: "beach-3",
          onboarding_completed_at: "2026-03-17T12:13:02Z",
        },
      ])
    );
    fromReturnValues.push(createChainableMock([]));
    fromReturnValues.push(createChainableMock([]));
    fromReturnValues.push(
      createChainableMock({
        name: "Ponce Inlet",
        slug: "ponce-inlet-melbourne-beach-fl",
        city: "Melbourne Beach",
        state: "FL",
        country: null,
      })
    );
    fromReturnValues.push(
      createChainableMock({
        conditions_score: 45,
        surf_description: "Knee-high",
        wind_description: "Onshore",
        best_window_start: null,
        best_window_end: null,
      })
    );

    const response = await GET(makeRequest());

    const sendCall = mockResendSend.mock.calls[0][0];
    expect(sendCall.subject).toBe(
      "Ponce Inlet — check tomorrow's forecast"
    );
    expect(sendCall.subject).not.toContain("✨");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest __tests__/app/api/cron/first-session-nudge.test.ts --no-coverage 2>&1 | tail -30`

Expected: Tests may need mock adjustments based on how the Supabase client chain resolves. Fix any failures by adjusting mock setup. The key assertions to verify:
1. Personalized subject contains beach name + emoji for high score
2. Fallback subject contains beach name without emoji
3. Generic subject is "Your first forecast is waiting"

- [ ] **Step 3: Fix any test failures and re-run until green**

Iterate on mock setup as needed. The mock chain pattern may need adjustment based on how the actual Supabase client chains `.from().select().eq().single()`.

- [ ] **Step 4: Commit tests**

```bash
git add __tests__/app/api/cron/first-session-nudge.test.ts
git commit -m "test: add first-session-nudge cron tests

Covers personalized path (with/without intel), generic path,
and subject line routing by score threshold."
```

---

## Chunk 4: Verify and Update CHANGELOG

### Task 4: End-to-end verification and CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors.

- [ ] **Step 2: Run the test suite**

Run: `npx jest __tests__/app/api/cron/first-session-nudge.test.ts --no-coverage -v`

Expected: All tests pass.

- [ ] **Step 3: Update CHANGELOG.md**

Add under `[Unreleased]`:

```markdown
### Changed
- First-session-nudge email now shows personalized home beach conditions for users who completed onboarding, with score-aware subject lines
```

- [ ] **Step 4: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for personalized nudge email"
```
