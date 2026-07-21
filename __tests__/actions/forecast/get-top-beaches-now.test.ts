/**
 * @jest-environment node
 */

jest.mock("@/lib/utils/forecast-hub-utils", () => ({
  getTopBeachesRightNow: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: jest.fn(),
}));
jest.mock("@/lib/monitoring/fallback-tracker", () => ({
  trackFallback: jest.fn(),
}));

import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTopBeachesRightNow } from "@/lib/utils/forecast-hub-utils";

describe("getTopBeachesNow major-event hold cohort", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTopBeachesRightNow as jest.Mock).mockResolvedValue([]);
  });

  it("passes only a server-verified profile experience to regional policy", async () => {
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "verified-user" } },
          error: null,
        }),
      },
    };
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(supabase);
    (getProfileExperienceLevel as jest.Mock).mockResolvedValue("intermediate");

    await getTopBeachesNow(4, 32.8, -117.2);

    expect(getProfileExperienceLevel).toHaveBeenCalledWith(
      supabase,
      "verified-user",
    );
    expect(getTopBeachesRightNow).toHaveBeenCalledWith(
      4,
      { lat: 32.8, lon: -117.2 },
      "intermediate",
    );
  });

  it("uses the unknown cohort when there is no verified user", async () => {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    await getTopBeachesNow();

    expect(getProfileExperienceLevel).not.toHaveBeenCalled();
    expect(getTopBeachesRightNow).toHaveBeenCalledWith(5, null, null);
  });
});
