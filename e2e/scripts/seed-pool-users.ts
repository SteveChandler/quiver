import { createHash } from "crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  loadPlaywrightEnv,
  requireEnv,
  requireLocalSupabaseEnv,
} from "./lib/playwright-env";
import { POOL_SIZE, poolEmail } from "./lib/worker-pool";

interface SeedBeach {
  id: string;
  name: string;
  slug: string | null;
}

interface SessionSeed {
  beach: SeedBeach;
  dayOffset: number;
  index: number;
}

function stableUuid(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < perPage) break;
  }

  return users;
}

async function ensureUser(
  admin: SupabaseClient,
  usersByEmail: Map<string, User>,
  index: number,
  password: string
): Promise<string> {
  const email = poolEmail(index);
  const existing = usersByEmail.get(email);
  if (existing) {
    const nextAppMetadata: Record<string, unknown> = {
      ...(existing.app_metadata ?? {}),
      is_e2e_worker_pool: true,
    };
    delete nextAppMetadata.is_ephemeral_smoke_test;

    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: nextAppMetadata,
    });
    if (error) throw error;

    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { is_e2e_worker_pool: true },
    email,
    email_confirm: true,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error(`Failed to create ${email}`);

  usersByEmail.set(email, data.user);
  return data.user.id;
}

async function getSeedBeaches(admin: SupabaseClient): Promise<SeedBeach[]> {
  const { data, error } = await admin
    .from("beaches")
    .select("id,name,slug")
    .limit(2000);

  if (error) throw error;

  const beaches = (data ?? []) as SeedBeach[];
  const targets = [
    { names: ["Blacks", "Blacks Beach"], slug: "blacks" },
    { names: ["Beacons"], slug: "beacons" },
    { names: ["Bird Rock"], slug: "bird-rock" },
  ];

  return targets
    .map((target) =>
      beaches.find(
        (beach) =>
          beach.slug === target.slug || target.names.includes(beach.name)
      )
    )
    .filter((beach): beach is SeedBeach => Boolean(beach));
}

function makeSessionSeedRows(
  userId: string,
  beaches: SeedBeach[],
  workerIndex: number
): Record<string, unknown>[] {
  const now = Date.now();
  const primary = beaches[0];
  const secondary = beaches.slice(1);
  const seeds: SessionSeed[] = [
    ...Array.from({ length: 6 }, (_, index) => ({
      beach: primary,
      dayOffset: index + 1,
      index,
    })),
    ...secondary.flatMap((beach, beachIndex) =>
      Array.from({ length: 2 }, (_, index) => ({
        beach,
        dayOffset: 8 + beachIndex * 2 + index,
        index: 6 + beachIndex * 2 + index,
      }))
    ),
  ];

  return seeds.map((seed) => {
    const arrival = new Date(now - seed.dayOffset * 24 * 3600 * 1000);
    return {
      arrival_time: arrival.toISOString(),
      beach_id: seed.beach.id,
      beach_name: seed.beach.name,
      crowd_level: 2 + (seed.index % 3),
      duration_minutes: 90,
      forecast_accuracy: "accurate",
      goals: [],
      id: stableUuid(`e2e-pool-session:${workerIndex}:${seed.index}`),
      invitee_ids: [],
      is_public: true,
      notes: "Seeded E2E worker baseline session",
      rating: 4,
      source: "manual",
      status: "completed",
      tide_status: seed.index % 2 === 0 ? "rising" : "falling",
      user_id: userId,
      wave_height_ft: 3 + (seed.index % 4),
      wave_quality: 4,
      wind_speed_mph: 6 + seed.index,
    };
  });
}

async function seedProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
  beaches: SeedBeach[],
  index: number
): Promise<void> {
  const now = new Date().toISOString();
  const primary = beaches[0];

  const { error } = await admin.from("profiles").upsert(
    {
      allow_implicit_tracking: true,
      display_name: `E2E Worker ${index}`,
      email,
      experience_level: "intermediate",
      full_name: `E2E Worker ${index}`,
      home_beach_id: primary.id,
      home_region: "San Diego",
      id: userId,
      is_mock: true,
      location: "San Diego, CA",
      onboarding_completed_at: now,
      preferred_session_time: "dawn_patrol",
      surf_styles: ["shortboard", "longboard"],
      timezone: "America/Los_Angeles",
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

async function seedFavorites(
  admin: SupabaseClient,
  userId: string,
  beaches: SeedBeach[]
): Promise<void> {
  const rows = beaches.map((beach, index) => ({
    beach_id: beach.id,
    rank: index,
    user_id: userId,
  }));

  const { error } = await admin
    .from("favorite_beaches")
    .upsert(rows, { onConflict: "user_id,beach_id" });

  if (error) throw error;
}

async function seedSessionsAndAffinity(
  admin: SupabaseClient,
  userId: string,
  beaches: SeedBeach[],
  index: number
): Promise<void> {
  const sessionRows = makeSessionSeedRows(userId, beaches, index);
  const { error: sessionsError } = await admin
    .from("sessions")
    .upsert(sessionRows, { onConflict: "id" });

  if (sessionsError) throw sessionsError;

  const now = new Date().toISOString();
  const affinityRows = beaches.map((beach, beachIndex) => ({
    affinity_score: beachIndex === 0 ? 90 : 70,
    beach_id: beach.id,
    computed_at: now,
    last_surfed_at: now,
    session_count: beachIndex === 0 ? 6 : 2,
    user_id: userId,
  }));

  const { error: affinityError } = await admin
    .from("user_beach_affinity")
    .upsert(affinityRows, { onConflict: "user_id,beach_id" });

  if (affinityError) throw affinityError;
}

async function seedWorker(
  admin: SupabaseClient,
  usersByEmail: Map<string, User>,
  beaches: SeedBeach[],
  index: number,
  password: string
): Promise<string> {
  const email = poolEmail(index);
  const userId = await ensureUser(admin, usersByEmail, index, password);
  await seedProfile(admin, userId, email, beaches, index);
  await seedFavorites(admin, userId, beaches);
  await seedSessionsAndAffinity(admin, userId, beaches, index);
  return userId;
}

export async function seedPoolUsers(): Promise<void> {
  loadPlaywrightEnv();

  const localEnv = requireLocalSupabaseEnv();
  const password = requireEnv("E2E_POOL_PASSWORD");
  const admin = createClient(localEnv.url, localEnv.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const beaches = await getSeedBeaches(admin);

  if (beaches.length === 0) {
    throw new Error("No seed beaches found; run the reference snapshot first");
  }

  const usersByEmail = new Map(
    (await listAllUsers(admin)).map((user) => [user.email ?? "", user])
  );

  for (let index = 0; index < POOL_SIZE; index += 1) {
    const userId = await seedWorker(admin, usersByEmail, beaches, index, password);
    console.log(`[seed-pool] ${poolEmail(index)} -> ${userId}`);
  }

  console.log("[seed-pool] done");
}

if (require.main === module) {
  seedPoolUsers().catch((error) => {
    console.error("[seed-pool] FAILED", error);
    process.exit(1);
  });
}
