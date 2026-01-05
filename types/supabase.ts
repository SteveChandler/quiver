// Re-export Database type for compatibility
// This file exists to support the conventional import path @/types/supabase
// The actual Database type is defined in database.generated.ts

export type { Database, Json } from './database';
