import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSwellWatchAudience } from "@/lib/alerts/swell-watch/audience";
import type { Database } from "@/types/database.generated";

function clientWithFavorites(includeCustom: boolean): SupabaseClient<Database> {
  const rows: Record<string, Array<Record<string, unknown>>> = {
    profiles: [{ id: "user-1", home_beach_id: null, notif_push_enabled: true, notif_forecast_alerts: true }],
    favorite_beaches: [
      { user_id: "user-1", beach_id: "beach-1", custom_spot_id: null, alerts_enabled: true },
      ...(includeCustom ? [{ user_id: "user-1", beach_id: null, custom_spot_id: "spot-1", alerts_enabled: false }] : []),
    ],
    alert_rules: [],
    user_devices: [{ user_id: "user-1", retired_at: null }],
  };
  return {
    from: jest.fn((table: string) => {
      let filtered = rows[table];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filtered = filtered.filter((row) => row[column] === value);
          return query;
        },
        in: (column: string, values: string[]) => {
          filtered = filtered.filter((row) => values.includes(row[column] as string));
          return query;
        },
        is: (column: string, value: unknown) => {
          filtered = filtered.filter((row) => row[column] === value);
          return query;
        },
        order: () => query,
        range: async (from: number, to: number) => ({
          data: filtered.slice(from, to + 1), count: filtered.length, error: null,
        }),
      };
      return query;
    }),
  } as unknown as SupabaseClient<Database>;
}

it("keeps the Swell Watch audience unchanged when a custom favorite is present", async () => {
  const baseline = await loadSwellWatchAudience(clientWithFavorites(false), ["beach-1"]);
  const withCustom = await loadSwellWatchAudience(clientWithFavorites(true), ["beach-1"]);

  expect(baseline).toEqual([{ recipientUserId: "user-1", beachId: "beach-1", reason: "favorite" }]);
  expect(withCustom).toEqual(baseline);
});
