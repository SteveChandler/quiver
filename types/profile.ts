export type ProfileDTO = {
  id: string;
  full_name: string | null;
  home_beach_id: string | null;
  homeBeachName: string | null;
  home_beach?: { id: string; name: string } | null;
};


