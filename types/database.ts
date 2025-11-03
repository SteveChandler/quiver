// This file imports from the auto-generated database.generated.ts
// and exports convenience type aliases for common usage patterns

import type { Database } from './database.generated'

// Re-export the full Database type and JSON type
export type { Database }
export type Json = Database['public']['Tables']['beaches']['Row']['features']

// ===================================================
// TABLE ROW TYPES - Direct database table types
// ===================================================

export type Beach = Database['public']['Tables']['beaches']['Row']
export type BeachInsert = Database['public']['Tables']['beaches']['Insert']
export type BeachUpdate = Database['public']['Tables']['beaches']['Update']

export type BeachReview = Database['public']['Tables']['beach_reviews']['Row']
export type BeachReviewInsert = Database['public']['Tables']['beach_reviews']['Insert']
export type BeachReviewUpdate = Database['public']['Tables']['beach_reviews']['Update']

export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionInsert = Database['public']['Tables']['sessions']['Insert']
export type SessionUpdate = Database['public']['Tables']['sessions']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type IntelPost = Database['public']['Tables']['intel_posts']['Row']
export type IntelPostInsert = Database['public']['Tables']['intel_posts']['Insert']
export type IntelPostUpdate = Database['public']['Tables']['intel_posts']['Update']
export type IntelPostTag = Database['public']['Enums']['intel_post_tag']

// Note: follows table not yet in schema - uncomment when migration is applied
// export type Follow = Database['public']['Tables']['follows']['Row']
// export type FollowInsert = Database['public']['Tables']['follows']['Insert']

export type SessionShare = Database['public']['Tables']['session_shares']['Row']
export type SessionShareInsert = Database['public']['Tables']['session_shares']['Insert']

export type Board = Database['public']['Tables']['boards']['Row']
export type BoardInsert = Database['public']['Tables']['boards']['Insert']
export type BoardUpdate = Database['public']['Tables']['boards']['Update']

// ===================================================
// EXTENDED TYPES - Types with relationships/joins
// ===================================================

export interface BeachReviewWithUser extends BeachReview {
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface SessionWithDetails extends Session {
  beaches: Beach | null
  boards: Board | null
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface BeachWithReviews extends Beach {
  reviews: BeachReview[]
  review_count?: number
  average_rating?: number | null
}

export interface ProfileWithStats extends Profile {
  session_count?: number | null
  follower_count?: number | null
  following_count?: number | null
}

export interface IntelPostWithUser extends IntelPost {
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// ===================================================
// RE-EXPORT EVERYTHING FROM GENERATED FILE
// ===================================================

export * from './database.generated'
