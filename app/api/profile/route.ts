import type { NextRequest } from "next/server";
import { getProfileDTOById } from "@/lib/profile/fetchers";
import type { ProfileDTO } from "@/types/profile";
import {
  withAuth,
  createSuccessResponse,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * GET /api/profile - Get current user's profile with home beach name
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    // Get standardized profile DTO via view
    const dto = await getProfileDTOById(user.id, supabase);

    if (!dto) {
      return createNotFoundError("Profile not found");
    }

    const toIsoOrNull = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    // API guideline: DB-mapped fields use snake_case. Keep camelCase for backward compatibility.
    // Keep response fields explicit to avoid unintentionally expanding the API surface.
    const profile: ProfileDTO & {
      home_beach_name: string | null;
      skill_level: string | null;
    } = {
      id: dto.id,
      full_name: dto.full_name ?? null,
      home_beach_id: dto.home_beach_id ?? null,
      homeBeachName: dto.homeBeachName ?? null,
      home_beach: dto.home_beach ?? null,
      experience_level: dto.experience_level ?? null,
      created_at: toIsoOrNull(dto.created_at),
      updated_at: toIsoOrNull(dto.updated_at),
      home_beach_name: dto.homeBeachName ?? null,
      // API contract alias: expose `experience_level` as `skill_level`
      skill_level: dto.experience_level ?? null,
      // Onboarding tracking (now included in view)
      onboarding_completed_at: dto.onboarding_completed_at ?? null,
    };

    return createSuccessResponse(profile);
  },
  { errorMessage: "Failed to load profile" }
);
