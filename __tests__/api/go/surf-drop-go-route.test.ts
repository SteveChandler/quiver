/**
 * @jest-environment node
 */

import {
  createMockRequest,
  createMockSupabaseClient,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";
import type { SurfDropRecord, SurfDropsRepository } from "@/lib/surf-drops/types";

let mockAuthClient: MockSupabaseClient;
let mockRepository: SurfDropsRepository;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockAuthClient,
  createSupabaseServiceRoleClient: () => ({}),
}));

jest.mock("@/lib/surf-drops/repository", () => ({
  createSurfDropsRepository: () => mockRepository,
}));

const { GET } = require("@/app/api/go/[shareSlug]/route");
const { POST } = require("@/app/api/go/[shareSlug]/claim/route");

function customDrop(overrides: Partial<SurfDropRecord> = {}): SurfDropRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    user_id: "550e8400-e29b-41d4-a716-446655440002",
    share_slug: "ABC23456DE",
    location_type: "custom_pin",
    beach_id: null,
    custom_lat: 32.749,
    custom_lon: -117.253,
    general_area: "North County SD",
    exact_label: "Stairwell by the blue house",
    starts_at: "2026-07-02T14:00:00.000Z",
    ends_at: "2099-07-02T15:00:00.000Z",
    audience: "mutuals",
    note: null,
    forecast_snapshot: null,
    created_at: "2026-07-02T12:00:00.000Z",
    updated_at: "2026-07-02T12:00:00.000Z",
    cancelled_at: null,
    deleted_at: null,
    beach: null,
    creator: { display_name: "Maya", full_name: null, avatar_url: null },
    participants_count: 0,
    ...overrides,
  };
}

describe("/api/go/[shareSlug]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthClient = createMockSupabaseClient();
    mockRepository = {
      findDropById: jest.fn(async () => customDrop()),
      findDropByShareSlug: jest.fn(async () => customDrop()),
      upsertLinkGrant: jest.fn(async () => undefined),
      upsertParticipant: jest.fn(async () => undefined),
      countActiveParticipants: jest.fn(async () => 0),
      viewerHasLinkGrant: jest.fn(async () => false),
      viewerIsParticipant: jest.fn(async () => false),
      viewerIsMutual: jest.fn(async () => false),
      hasBlockBetween: jest.fn(async () => false),
    };
  });

  it("returns an anonymous custom-pin teaser without coordinates or exact_label", async () => {
    mockUnauthenticatedUser(mockAuthClient);

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/go/ABC23456DE", {
        headers: {
          "user-agent": "Mozilla/5.0 Safari/605.1.15 SurfDropTest",
          "accept-language": "en-US,en;q=0.9",
        },
      }) as any,
      { params: { shareSlug: "ABC23456DE" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      slug: "ABC23456DE",
      status: "active",
      general_area: "North County SD",
      requires_signin: true,
      requires_claim: true,
      is_known_spot: false,
    });
    expect(JSON.stringify(body.data)).not.toContain("32.749");
    expect(JSON.stringify(body.data)).not.toContain("-117.253");
    expect(JSON.stringify(body.data)).not.toContain("Stairwell");
  });

  it("returns 410 and does not grant expired Surf Drop links", async () => {
    const user = createMockUser({ id: "550e8400-e29b-41d4-a716-446655440099" });
    mockAuthenticatedUser(mockAuthClient, user);
    mockRepository.findDropByShareSlug = jest.fn(async () =>
      customDrop({ ends_at: "2026-07-02T11:00:00.000Z" }),
    );

    const response = await POST(
      createMockRequest("POST", "http://localhost:3000/api/go/ABC23456DE/claim") as any,
      { params: { shareSlug: "ABC23456DE" } },
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("expired");
    expect(mockRepository.upsertLinkGrant).not.toHaveBeenCalled();
  });
});
