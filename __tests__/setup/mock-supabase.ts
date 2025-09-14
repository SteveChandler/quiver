/**
 * Comprehensive Supabase mock for component tests
 * This replaces all Supabase imports to avoid ES module issues in Jest
 */

// Mock the client creation functions
const createClient = jest.fn(() => mockSupabaseClient);
// Support both named and default-style access in tests using require()
export { createClient };
export const createClientComponentClient = jest.fn(() => mockSupabaseClient);
export const createServerComponentClient = jest.fn(() => mockSupabaseClient);
export const createSupabaseServerClient = jest.fn(() =>
  Promise.resolve(mockSupabaseClient)
);
export const createBrowserClient = jest.fn(() => mockSupabaseClient);

// Create a comprehensive mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(() =>
      Promise.resolve({ data: { session: null }, error: null })
    ),
    getUser: jest.fn(() =>
      Promise.resolve({ data: { user: null }, error: null })
    ),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
    refreshSession: jest.fn(),
  },
  rpc: jest.fn(() => Promise.resolve({ data: "activity-id", error: null })),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      neq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      range: jest.fn(() => Promise.resolve({ data: [], error: null })),
      // Add these missing methods that can be called directly after select
      then: jest.fn((callback) => callback({ data: [], error: null })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
      download: jest.fn(() => Promise.resolve({ data: null, error: null })),
      remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
      list: jest.fn(() => Promise.resolve({ data: [], error: null })),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: "https://example.com/mock-url" },
      })),
    })),
  },
  realtime: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  },
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  })),
  removeChannel: jest.fn(),
  functions: {
    invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
};

// Default export for ES module compatibility
const defaultExport: any = mockSupabaseClient;
defaultExport.createClient = createClient;
export default defaultExport;

// Named exports that might be imported
export { mockSupabaseClient as supabase };

// Mock any other Supabase utilities
export const createServerClient = jest.fn(() => mockSupabaseClient);
export const createMiddlewareClient = jest.fn(() => mockSupabaseClient);

// Mock RealtimeClient specifically
export const RealtimeClient = jest.fn().mockImplementation(() => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }))
}));

// Export for use in other test files
export { mockSupabaseClient };
