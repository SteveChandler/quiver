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

interface EnsureLocalBeachForecastFixtureOptions {
  dataSource?: string;
  forceUncalibrated?: boolean;
  minRows?: number;
  slug: string;
  waveHeight?: string;
}

type LocalFixtureCleanup = () => Promise<void>;

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

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

function formatForecastTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

export async function ensureLocalBeachForecastFixture({
  dataSource = "e2e_forecast_fixture",
  forceUncalibrated = false,
  minRows = 8,
  slug,
  waveHeight = "3-4 ft",
}: EnsureLocalBeachForecastFixtureOptions): Promise<LocalFixtureCleanup> {
  if (!isLocalE2ETarget()) return async () => undefined;

  const admin = createLocalAdminClient();
  const beach = await getLocalBeachBySlug(slug);
  const { data: beachSnapshot, error: beachSnapshotError } = await admin
    .from("beaches")
    .select("shoaling_factors")
    .eq("id", beach.id)
    .maybeSingle();

  if (beachSnapshotError) throw beachSnapshotError;

  if (forceUncalibrated) {
    const { error: beachError } = await admin
      .from("beaches")
      .update({ shoaling_factors: null })
      .eq("id", beach.id);

    if (beachError) throw beachError;
  }

  const anchor = new Date();
  const minuteOffset = Array.from(dataSource).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  ) % 45;
  anchor.setUTCMinutes(Math.max(0, anchor.getUTCMinutes() - minuteOffset), 0, 0);
  const rows = Array.from({ length: minRows }, (_, index) => {
    const forecastDate = new Date(
      anchor.getTime() - (minRows - 1 - index) * THREE_HOURS_MS
    );

    return {
      air_temperature: "68F",
      beach_id: beach.id,
      confidence_score: 82,
      data_source: dataSource,
      forecast_at: forecastDate.toISOString(),
      forecast_date: forecastDate.toISOString().slice(0, 10),
      forecast_time: formatForecastTime(forecastDate),
      swell_1_direction: "W",
      swell_1_height: "3 ft",
      swell_1_period: "12s",
      tide_height: "2.1 ft",
      tide_status: "Rising",
      water_temp: "64F",
      wave_direction: "W",
      wave_height: waveHeight,
      wave_period: "12s",
      weather_condition: "Clear",
      wind_direction: "Offshore",
      wind_direction_deg: 80,
      wind_speed: "4 mph",
      wind_wave_height: "1 ft",
    };
  });
  const earliestForecastAt = rows[0]?.forecast_at;
  const latestForecastAt = rows[rows.length - 1]?.forecast_at;

  const { error: upsertError } = await admin
    .from("enhanced_forecasts")
    .upsert(rows, { onConflict: "beach_id,forecast_date,forecast_time" });

  if (upsertError) throw upsertError;

  return async () => {
    if (earliestForecastAt && latestForecastAt) {
      const { error: cleanupError } = await admin
        .from("enhanced_forecasts")
        .delete()
        .eq("beach_id", beach.id)
        .eq("data_source", dataSource)
        .gte("forecast_at", earliestForecastAt)
        .lte("forecast_at", latestForecastAt);

      if (cleanupError) throw cleanupError;
    }

    if (forceUncalibrated && beachSnapshot) {
      const { error: restoreError } = await admin
        .from("beaches")
        .update({
          shoaling_factors:
            (beachSnapshot as { shoaling_factors?: unknown }).shoaling_factors ??
            null,
        })
        .eq("id", beach.id);

      if (restoreError) throw restoreError;
    }
  };
}
