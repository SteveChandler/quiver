export type ProfileDTO = {
  id: string;
  full_name: string | null;
  home_beach_id: string | null;
  homeBeachName: string | null;
  home_beach?: { id: string; name: string } | null;
  /**
   * DB field: profiles.experience_level
   * NOTE: Some API contracts expose this as `skill_level` for backward compatibility.
   */
  experience_level?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};


