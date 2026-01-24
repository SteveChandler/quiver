export interface IntelPostPayload {
  id: string;
  beach_id: string | null;
  user_id: string;
  description: string;
  emoji_rating: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  surf_conditions: Record<string, unknown> | null;
  confirmations_count: number;
  created_at: string;
}

export interface SessionPayload {
  id: string;
  beach_id: string;
  beach_name: string | null;
  status: string | null;
  arrival_time: string;
}
