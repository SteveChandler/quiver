import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

interface EnsureLocalAuthUserOptions {
  email: string;
  password: string;
  fullName: string;
  displayName: string;
  fixtureName: string;
}

interface LocalBeachFixture {
  id: string;
  name: string;
  slug: string | null;
}

function localProfileDisplayName(base: string, userId: string): string {
  return `${base}-${userId.slice(0, 8)}`;
}

export function isLocalE2ETarget(): boolean {
  const baseUrl = process.env.BASE_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const localBaseUrl =
    !baseUrl || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  return (
    localBaseUrl &&
    (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1"))
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for local E2E fixture setup`);
  }
  return value;
}

export function createLocalAdminClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }
}

export async function ensureLocalAuthUser({
  email,
  password,
  fullName,
  displayName,
  fixtureName,
}: EnsureLocalAuthUserOptions): Promise<User> {
  const admin = createLocalAdminClient();
  let user = await findAuthUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
        app_metadata: {
          e2e_fixture: fixtureName,
          is_ephemeral_smoke_test: true,
        },
        email,
        email_confirm: true,
        password,
        user_metadata: { full_name: fullName },
    });

    user = data.user;

    if (error || !user) {
      user = await findAuthUserByEmail(admin, email);
      if (!user && error) throw error;
    }
  }

  if (!user) {
    throw new Error(`Failed to create local E2E auth user ${email}`);
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      display_name: localProfileDisplayName(displayName, user.id),
      email,
      full_name: fullName,
      id: user.id,
      is_mock: true,
      onboarding_completed_at: now,
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (error) throw error;

  return user;
}

export async function getLocalBeachBySlug(
  slug: string
): Promise<LocalBeachFixture> {
  const admin = createLocalAdminClient();
  const { data, error } = await admin
    .from("beaches")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`Local E2E beach fixture missing: ${slug}`);
  }

  return data as LocalBeachFixture;
}
