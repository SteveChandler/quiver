/**
 * Comprehensive Supabase mock for component tests
 * This replaces all Supabase imports to avoid ES module issues in Jest
 */

// Create a comprehensive mock Supabase client
const mockSupabaseClient: any = {
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
  __tableMocks: {} as Record<string, any>,
  setTableMock(table: string, mockImpl: any) {
    mockSupabaseClient.__tableMocks = mockSupabaseClient.__tableMocks || {};
    mockSupabaseClient.__tableMocks[table] = mockImpl;
    return mockSupabaseClient;
  },
  from: jest.fn((table: string) => {
    const tableMock = mockSupabaseClient.__tableMocks[table];
    if (tableMock) {
      return typeof tableMock === "function" ? tableMock(table) : tableMock;
    }

    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      ilike: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      single: jest.fn(async () => ({ data: null, error: null })),
      order: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      upsert: jest.fn(() => chain),
      range: jest.fn(() => chain),
      then: jest.fn((callback) => callback({ data: [], error: null })),
    } as any;

    return chain;
  }),
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

function createClient() {
  return mockSupabaseClient as any;
}

const createClientComponentClient = jest.fn(() => mockSupabaseClient);
const createServerComponentClient = jest.fn(() => mockSupabaseClient);
const createSupabaseServerClient = jest.fn(() =>
  Promise.resolve(mockSupabaseClient)
);
const createBrowserClient = jest.fn(() => mockSupabaseClient);
const createSupabaseServiceRoleClient = jest.fn(() =>
  Promise.resolve(mockSupabaseClient)
);

const createServerClient = jest.fn(() => mockSupabaseClient);
const createMiddlewareClient = jest.fn(() => mockSupabaseClient);

const RealtimeClient = jest.fn().mockImplementation(() => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }))
}));

mockSupabaseClient.createClient = createClient;
mockSupabaseClient.createClientComponentClient = createClientComponentClient;
mockSupabaseClient.createServerComponentClient = createServerComponentClient;
mockSupabaseClient.createSupabaseServerClient = createSupabaseServerClient;
mockSupabaseClient.createBrowserClient = createBrowserClient;
mockSupabaseClient.createSupabaseServiceRoleClient =
  createSupabaseServiceRoleClient;
mockSupabaseClient.createServerClient = createServerClient;
mockSupabaseClient.createMiddlewareClient = createMiddlewareClient;
mockSupabaseClient.RealtimeClient = RealtimeClient;

const exportsForModule = {
  __esModule: true,
  default: mockSupabaseClient,
  mockSupabaseClient,
  supabase: mockSupabaseClient,
  createClient,
  createClientComponentClient,
  createServerComponentClient,
  createSupabaseServerClient,
  createBrowserClient,
  createSupabaseServiceRoleClient,
  createServerClient,
  createMiddlewareClient,
  RealtimeClient,
};

export default mockSupabaseClient;
export {
  mockSupabaseClient,
  mockSupabaseClient as supabase,
  createClient,
  createClientComponentClient,
  createServerComponentClient,
  createSupabaseServerClient,
  createBrowserClient,
  createSupabaseServiceRoleClient,
  createServerClient,
  createMiddlewareClient,
  RealtimeClient,
};

if (typeof module !== "undefined") {
  module.exports = exportsForModule;
}
