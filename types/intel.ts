import type { IntelPostTag, IntelPost, IntelPostWithUser } from "./database";

export interface CreateIntelPostData {
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url?: string;
  photo_storage_path?: string;
  // Surf condition fields
  wave_height?: number | null;
  wind_speed?: number | null;
  wind_direction?: string | null;
  water_temp?: number | null;
  crowd_level?: number | null;
  wave_types?: string[];
  forecast_accuracy?: "accurate" | "somewhat" | "inaccurate" | null;
}

export interface GetNearbyIntelPostsParams {
  latitude: number;
  longitude: number;
  radius?: number;
  tag?: IntelPostTag | "all";
  limit?: number;
}

export interface IntelData {
  posts: IntelPostWithUser[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  confirmations: {
    [postId: string]: boolean;
  };
}

export interface UseIntelDataParams {
  latitude?: number;
  longitude?: number;
  radius?: number;
  tag?: IntelPostTag | "all";
  limit?: number;
  enabled?: boolean;
}
