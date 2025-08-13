import { fetchBestTimes } from "@/lib/bestTimes";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabaseRpc(returnData: any) {
  return {
    rpc: jest.fn().mockResolvedValue({ data: returnData, error: null }),
  } as unknown as SupabaseClient<any>;
}

describe("fetchBestTimes integration", () => {
  test("returns windows sorted and preserves labels and scores", async () => {
    const sample = [
      {
        start_ts: "2025-08-12T06:00:00.000Z",
        end_ts: "2025-08-12T08:00:00.000Z",
        label: "good (72)",
        score: 72,
      },
      {
        start_ts: "2025-08-12T04:00:00.000Z",
        end_ts: "2025-08-12T06:00:00.000Z",
        label: "fair (60)",
        score: 60,
      },
    ];
    const supabase = mockSupabaseRpc(sample);
    const { data, error } = await fetchBestTimes(supabase, "beach-uuid", 24, 6);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.[0]).toMatchObject(sample[0]);
    expect(data?.[1]).toMatchObject(sample[1]);
  });
});
