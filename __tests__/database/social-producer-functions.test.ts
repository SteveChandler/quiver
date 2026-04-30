/**
 * Integration tests for the like_session_with_notification and
 * follow_user_with_notification Postgres functions (Phase 5f).
 *
 * Validates SQL-level atomicity that mocked unit tests can't exercise:
 * either both the social row AND the notification_events row commit, or
 * neither does. Caught duplicate-dedup on the notification keeps the
 * social mutation (idempotent re-engagement is fine) but reports the
 * collision back to the caller.
 *
 * Run with:
 *   RUN_INTEGRATION_TESTS=true \
 *     NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=<...> \
 *     SUPABASE_SERVICE_ROLE_KEY=<...> \
 *     npx jest __tests__/database/social-producer-functions.test.ts
 *
 * @jest-environment node
 */

import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const shouldRun =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!supabaseUrl &&
  !!supabaseServiceRoleKey &&
  !!supabaseAnonKey;

// Restore real fetch (jest.setup.js mocks it for UI tests).
const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;

const { createClient } =
  require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

(shouldRun ? describe : describe.skip)(
  "social producer functions (Phase 5f atomicity)",
  () => {
    let admin: ReturnType<typeof createClient<Database>>;

    let actorUserId: string;
    let actorAccessToken: string;
    let recipientUserId: string;
    let testSessionId: string;

    const createdEventIds: string[] = [];
    const createdLikeIds: string[] = [];
    const createdFollowIds: string[] = [];
    const createdSessionIds: string[] = [];
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      admin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Create the actor (the one performing the like/follow). Sign in to
      // capture a JWT — the RPC's auth.uid() check requires an authenticated
      // call, not a service-role bypass.
      const actorEmail = `producer-actor-${Date.now()}@example.test`;
      const actorPassword = "test-password-12345";
      const { data: actorResp, error: actorErr } =
        await admin.auth.admin.createUser({
          email: actorEmail,
          password: actorPassword,
          email_confirm: true,
        });
      if (actorErr) throw actorErr;
      actorUserId = actorResp.user!.id;
      createdUserIds.push(actorUserId);

      // The supabase-js client triggers realtime.setAuth on signIn which is
      // mocked-out in jest.setup.js, so call the auth REST endpoint directly
      // to get a JWT.
      const tokenResp = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            email: actorEmail,
            password: actorPassword,
          }),
        }
      );
      if (!tokenResp.ok) {
        throw new Error(
          `signin failed: ${tokenResp.status} ${await tokenResp.text()}`
        );
      }
      const tokenJson = (await tokenResp.json()) as { access_token: string };
      actorAccessToken = tokenJson.access_token;

      // Recipient (separate user — the actor likes the recipient's session,
      // or the actor follows the recipient).
      const { data: recipResp, error: recipErr } =
        await admin.auth.admin.createUser({
          email: `producer-recipient-${Date.now()}@example.test`,
          password: "test-password-12345",
          email_confirm: true,
        });
      if (recipErr) throw recipErr;
      recipientUserId = recipResp.user!.id;
      createdUserIds.push(recipientUserId);

      // Create a session owned by the recipient (so the actor's like fires a
      // notification to the recipient).
      const sessionInsertClient = admin as unknown as {
        from(t: "sessions"): {
          insert(row: Record<string, unknown>): {
            select(): {
              single(): Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      // Pick any existing beach for the FK; the function never reads beach_id.
      const { data: beachRow } = await admin
        .from("beaches")
        .select("id")
        .limit(1)
        .single();
      const beachId = beachRow!.id;

      const { data: sessionRow, error: sessionErr } = await sessionInsertClient
        .from("sessions")
        .insert({
          user_id: recipientUserId,
          beach_id: beachId,
          beach_name: "Test Beach Phase5f",
          arrival_time: new Date().toISOString(),
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;
      testSessionId = sessionRow!.id;
      createdSessionIds.push(testSessionId);
      // Stash the beach id for the self-like test to reuse.
      (globalThis as { __test_beach_id?: string }).__test_beach_id = beachId;
    });

    afterAll(async () => {
      if (createdLikeIds.length > 0) {
        await admin.from("session_likes").delete().in("id", createdLikeIds);
      }
      if (createdFollowIds.length > 0) {
        await admin.from("user_follows").delete().in("id", createdFollowIds);
      }
      if (createdEventIds.length > 0) {
        await admin
          .from("notification_events")
          .delete()
          .in("id", createdEventIds);
      }
      if (createdSessionIds.length > 0) {
        await admin
          .from("sessions" as never)
          .delete()
          .in("id", createdSessionIds);
      }
      for (const uid of createdUserIds) {
        await admin.auth.admin.deleteUser(uid);
      }
    });

    afterEach(async () => {
      // Clean up any rows the previous test created so each test starts fresh.
      await admin
        .from("session_likes")
        .delete()
        .eq("user_id", actorUserId);
      await admin
        .from("user_follows")
        .delete()
        .eq("follower_id", actorUserId);
      await admin
        .from("notification_events")
        .delete()
        .eq("actor_user_id", actorUserId);
    });

    function authedClient() {
      const c = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${actorAccessToken}` } },
      });
      return c;
    }

    it("creates session_like AND notification_event in one transaction (happy path)", async () => {
      const client = authedClient();
      const dedupeKey = `like:${testSessionId}:${actorUserId}`;

      const { data, error } = await client.rpc(
        "like_session_with_notification" as never,
        {
          p_session_id: testSessionId,
          p_actor_id: actorUserId,
          p_dedupe_key: dedupeKey,
        } as never
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        liked: true,
        was_existing: false,
        notification_dedup_collision: false,
      });
      expect((data as unknown as { event_id: string }).event_id).toBeTruthy();

      const { data: likeRow } = await admin
        .from("session_likes")
        .select("id, session_id, user_id")
        .eq("session_id", testSessionId)
        .eq("user_id", actorUserId)
        .maybeSingle();
      expect(likeRow).toBeTruthy();

      const { data: eventRow } = await admin
        .from("notification_events")
        .select("id, type, recipient_user_id, actor_user_id, dedupe_key, payload")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      expect(eventRow).toBeTruthy();
      expect(eventRow!.type).toBe("like");
      expect(eventRow!.recipient_user_id).toBe(recipientUserId);
      expect(eventRow!.actor_user_id).toBe(actorUserId);
    });

    it("idempotent re-like returns was_existing=true and does not create a second event", async () => {
      const client = authedClient();
      const dedupeKey = `like:${testSessionId}:${actorUserId}`;

      // First call creates the like + event.
      await client.rpc("like_session_with_notification" as never, {
        p_session_id: testSessionId,
        p_actor_id: actorUserId,
        p_dedupe_key: dedupeKey,
      } as never);

      // Second call: should report was_existing=true, not insert another event.
      const { data, error } = await client.rpc(
        "like_session_with_notification" as never,
        {
          p_session_id: testSessionId,
          p_actor_id: actorUserId,
          p_dedupe_key: dedupeKey,
        } as never
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        liked: true,
        was_existing: true,
        event_id: null,
      });

      const { data: events } = await admin
        .from("notification_events")
        .select("id")
        .eq("dedupe_key", dedupeKey);
      expect(events).toHaveLength(1);
    });

    it("self-like creates the row but does NOT enqueue a notification", async () => {
      // Create a session owned by the actor themselves.
      const sessionInsertClient = admin as unknown as {
        from(t: "sessions"): {
          insert(row: Record<string, unknown>): {
            select(): {
              single(): Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      const beachId = (globalThis as { __test_beach_id?: string })
        .__test_beach_id!;
      const { data: ownSession } = await sessionInsertClient
        .from("sessions")
        .insert({
          user_id: actorUserId,
          beach_id: beachId,
          beach_name: "Own Beach",
          arrival_time: new Date().toISOString(),
        })
        .select()
        .single();
      createdSessionIds.push(ownSession!.id);

      const client = authedClient();
      const dedupeKey = `like:${ownSession!.id}:${actorUserId}`;

      const { data, error } = await client.rpc(
        "like_session_with_notification" as never,
        {
          p_session_id: ownSession!.id,
          p_actor_id: actorUserId,
          p_dedupe_key: dedupeKey,
        } as never
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        liked: true,
        was_existing: false,
        event_id: null,
        notification_dedup_collision: false,
      });

      const { data: events } = await admin
        .from("notification_events")
        .select("id")
        .eq("dedupe_key", dedupeKey);
      expect(events).toHaveLength(0);
    });

    it("rejects RPC when p_actor_id does not match auth.uid() (impersonation guard)", async () => {
      const client = authedClient();
      // Pass a different actor id than the JWT's auth.uid() — function should raise.
      const { data, error } = await client.rpc(
        "like_session_with_notification" as never,
        {
          p_session_id: testSessionId,
          p_actor_id: recipientUserId, // <-- wrong actor
          p_dedupe_key: `like:${testSessionId}:${recipientUserId}`,
        } as never
      );

      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/actor_id mismatch/);
    });

    it("dedup collision on the notification still keeps the like (caught unique_violation)", async () => {
      // Pre-insert a notification_events row with the same dedupe_key so the
      // function's INSERT into notification_events hits unique_violation.
      const dedupeKey = `like:${testSessionId}:${actorUserId}`;
      const { data: preEvent } = await admin
        .from("notification_events")
        .insert({
          recipient_user_id: recipientUserId,
          actor_user_id: actorUserId,
          type: "like",
          entity_type: "session",
          entity_id: testSessionId,
          payload: {},
          dedupe_key: dedupeKey,
        })
        .select("id")
        .single();
      createdEventIds.push(preEvent!.id);

      const client = authedClient();
      const { data, error } = await client.rpc(
        "like_session_with_notification" as never,
        {
          p_session_id: testSessionId,
          p_actor_id: actorUserId,
          p_dedupe_key: dedupeKey,
        } as never
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        liked: true,
        was_existing: false,
        event_id: null,
        notification_dedup_collision: true,
      });

      // Like row IS persisted (function caught the unique_violation).
      const { data: likeRow } = await admin
        .from("session_likes")
        .select("id")
        .eq("session_id", testSessionId)
        .eq("user_id", actorUserId)
        .maybeSingle();
      expect(likeRow).toBeTruthy();
    });

    it("creates user_follows AND notification_event in one transaction (follow happy path)", async () => {
      const client = authedClient();
      const dedupeKey = `follow:${actorUserId}:${recipientUserId}:2026-W18`;

      const { data, error } = await client.rpc(
        "follow_user_with_notification" as never,
        {
          p_target_user_id: recipientUserId,
          p_actor_id: actorUserId,
          p_dedupe_key: dedupeKey,
        } as never
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        followed: true,
        was_existing: false,
        notification_dedup_collision: false,
      });

      const { data: followRow } = await admin
        .from("user_follows")
        .select("id")
        .eq("follower_id", actorUserId)
        .eq("following_id", recipientUserId)
        .maybeSingle();
      expect(followRow).toBeTruthy();

      const { data: eventRow } = await admin
        .from("notification_events")
        .select("id, type")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      expect(eventRow).toBeTruthy();
      expect(eventRow!.type).toBe("follow");
    });

    it("rejects self-follow", async () => {
      const client = authedClient();
      const { data, error } = await client.rpc(
        "follow_user_with_notification" as never,
        {
          p_target_user_id: actorUserId, // following yourself
          p_actor_id: actorUserId,
          p_dedupe_key: `follow:${actorUserId}:${actorUserId}:2026-W18`,
        } as never
      );

      expect(data).toBeNull();
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/cannot follow yourself/i);
    });
  }
);
