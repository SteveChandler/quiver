/**
 * Integration test for the claim_notification_events Postgres function.
 *
 * Validates the SQL-level atomic-claim guarantee that the worker's mocked
 * unit tests can't exercise (FOR UPDATE SKIP LOCKED requires real Postgres).
 *
 * Run with:
 *   RUN_INTEGRATION_TESTS=true \
 *     NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=<...> \
 *     SUPABASE_SERVICE_ROLE_KEY=<...> \
 *     npx jest __tests__/database/notifications-claim-function.test.ts
 *
 * @jest-environment node
 */

import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const shouldRun =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!supabaseUrl &&
  !!supabaseServiceRoleKey;

// Restore real fetch (jest.setup.js mocks it for UI tests).

const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;


const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

(shouldRun ? describe : describe.skip)(
  "claim_notification_events RPC",
  () => {
    let admin: ReturnType<typeof createClient<Database>>;
    let testRecipientId: string;

    const createdEventIds: string[] = [];
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      admin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Create a real recipient user (FK constraint on notification_events).
      const { data: userResp, error: userErr } = await admin.auth.admin.createUser({
        email: `claim-test-${Date.now()}@example.test`,
        password: "test-password-12345",
        email_confirm: true,
      });
      if (userErr) throw userErr;
      testRecipientId = userResp.user!.id;
      createdUserIds.push(testRecipientId);
    });

    afterAll(async () => {
      if (createdEventIds.length > 0) {
        await admin
          .from("notification_events")
          .delete()
          .in("id", createdEventIds);
      }
      for (const uid of createdUserIds) {
        await admin.auth.admin.deleteUser(uid);
      }
    });

    afterEach(async () => {
      // Reset any rows we created in this test back to pending so tests are independent.
      if (createdEventIds.length > 0) {
        await admin
          .from("notification_events")
          .delete()
          .in("id", createdEventIds);
        createdEventIds.length = 0;
      }
    });

    async function insertPendingEvent(overrides: Record<string, unknown> = {}) {
      const { data, error } = await admin
        .from("notification_events")
        .insert({
          recipient_user_id: testRecipientId,
          type: "test_claim",
          payload: {},
          ...overrides,
        })
        .select("*")
        .single();
      if (error) throw error;
      createdEventIds.push(data.id);
      return data;
    }

    async function callClaim(batchSize: number, leaseSeconds: number, claimToken: string) {
      // RPC type-cast: claim_notification_events isn't in generated types yet.

      const { data, error } = await (admin.rpc as any)("claim_notification_events", {
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
        p_claim_token: claimToken,
      });
      if (error) throw error;
      return data as Array<{ id: string; status: string; claim_token: string; attempt_count: number }>;
    }

    function uuid() {
      return crypto.randomUUID();
    }

    it("two parallel claims of size 50 against a 100-row pool produce disjoint sets", async () => {
      // Insert 100 pending events.
      const insertPromises = Array.from({ length: 100 }, () => insertPendingEvent());
      await Promise.all(insertPromises);

      const tokenA = uuid();
      const tokenB = uuid();

      // Fire two RPC calls in parallel.
      const [batchA, batchB] = await Promise.all([
        callClaim(50, 300, tokenA),
        callClaim(50, 300, tokenB),
      ]);

      const idsA = new Set(batchA.map((r) => r.id));
      const idsB = new Set(batchB.map((r) => r.id));
      const overlap = [...idsA].filter((id) => idsB.has(id));

      expect(overlap).toEqual([]);
      expect(idsA.size + idsB.size).toBeLessThanOrEqual(100);
      expect(batchA.every((r) => r.claim_token === tokenA)).toBe(true);
      expect(batchB.every((r) => r.claim_token === tokenB)).toBe(true);
    }, 30000);

    it("a row in 'processing' with claimed_at older than the lease becomes claimable", async () => {
      // Stale processing row from a "crashed" prior worker.
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const oldToken = uuid();
      const event = await insertPendingEvent({
        status: "processing",
        claimed_at: tenMinutesAgo,
        claim_token: oldToken,
      });

      const newToken = uuid();
      const claimed = await callClaim(10, 300, newToken);

      const reclaimed = claimed.find((r) => r.id === event.id);
      expect(reclaimed).toBeDefined();
      expect(reclaimed!.claim_token).toBe(newToken);
      expect(reclaimed!.attempt_count).toBe(1); // bumped from 0 → 1
    });

    it("a row in 'processing' with a fresh lease is NOT reclaimed", async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const oldToken = uuid();
      const event = await insertPendingEvent({
        status: "processing",
        claimed_at: oneMinuteAgo,
        claim_token: oldToken,
      });

      const newToken = uuid();
      const claimed = await callClaim(10, 300, newToken);

      const reclaimed = claimed.find((r) => r.id === event.id);
      expect(reclaimed).toBeUndefined();
    });

    it("a row with next_attempt_at in the future is NOT claimable", async () => {
      const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const event = await insertPendingEvent({
        next_attempt_at: oneHourAhead,
      });

      const claimed = await callClaim(10, 300, uuid());

      const found = claimed.find((r) => r.id === event.id);
      expect(found).toBeUndefined();
    });

    it("a row with next_attempt_at in the past IS claimable", async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const event = await insertPendingEvent({
        next_attempt_at: oneMinuteAgo,
      });

      const claimed = await callClaim(10, 300, uuid());

      const found = claimed.find((r) => r.id === event.id);
      expect(found).toBeDefined();
    });

    it("attempt_count increments by 1 per claim", async () => {
      const event = await insertPendingEvent();
      expect(event.attempt_count).toBe(0);

      const tokenA = uuid();
      const claimed1 = await callClaim(10, 300, tokenA);
      const c1 = claimed1.find((r) => r.id === event.id)!;
      expect(c1.attempt_count).toBe(1);

      // Force the row back to claimable by setting status='pending' directly.
      await admin
        .from("notification_events")
        .update({ status: "pending", claim_token: null })
        .eq("id", event.id);

      const tokenB = uuid();
      const claimed2 = await callClaim(10, 300, tokenB);
      const c2 = claimed2.find((r) => r.id === event.id)!;
      expect(c2.attempt_count).toBe(2);
    });

    it("status flips to 'processing' on claim", async () => {
      const event = await insertPendingEvent();
      expect(event.status).toBe("pending");

      const claimed = await callClaim(10, 300, uuid());
      const c = claimed.find((r) => r.id === event.id)!;

      expect(c.status).toBe("processing");
    });
  }
);
