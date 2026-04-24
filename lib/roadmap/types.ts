export type RoadmapStatus =
  | 'under_consideration'
  | 'in_progress'
  | 'shipped'
  | 'declined';

export type RoadmapCategory =
  | 'forecasts'
  | 'logging'
  | 'community'
  | 'notifications'
  | 'subscription'
  | 'other';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  category: RoadmapCategory;
  status: RoadmapStatus;
  eta_label: string | null;
  founder_reply: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  viewer_has_voted: boolean;
}

export interface RoadmapItemsResponse {
  items: RoadmapItem[];
}
