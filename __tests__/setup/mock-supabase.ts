/**
 * Comprehensive Supabase mock for component tests
 * This replaces all Supabase imports to avoid ES module issues in Jest
 */

import type { Database } from "@/types/database.generated";
import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

// Type-safe query chain interface
interface MockQueryChain {
  select: jest.Mock<MockQueryChain>;
  eq: jest.Mock<MockQueryChain>;
  neq: jest.Mock<MockQueryChain>;
  gt: jest.Mock<MockQueryChain>;
  gte: jest.Mock<MockQueryChain>;
  lt: jest.Mock<MockQueryChain>;
  lte: jest.Mock<MockQueryChain>;
  ilike: jest.Mock<MockQueryChain>;
  like: jest.Mock<MockQueryChain>;
  in: jest.Mock<MockQueryChain>;
  is: jest.Mock<MockQueryChain>;
  limit: jest.Mock<MockQueryChain>;
  range: jest.Mock<MockQueryChain>;
  order: jest.Mock<MockQueryChain>;
  textSearch: jest.Mock<MockQueryChain>;
  maybeSingle: jest.Mock<Promise<{ data: unknown; error: null }>>;
  single: jest.Mock<Promise<{ data: unknown; error: null }>>;
  insert: jest.Mock<MockQueryChain>;
  update: jest.Mock<MockQueryChain>;
  delete: jest.Mock<MockQueryChain>;
  upsert: jest.Mock<MockQueryChain>;
  then: jest.Mock;
}

// Auth types
interface MockAuthResponse<T> {
  data: T;
  error: null;
}

interface MockSessionResponse {
  data: { session: Session | null };
  error: null;
}

interface MockUserResponse {
  data: { user: User | null };
  error: null;
}

// Table mock type
type TableMockFn = (table: string) => MockQueryChain;
type TableMock = MockQueryChain | TableMockFn;

// Storage types
interface MockStorageResponse<T = null> {
  data: T;
  error: null;
}

interface MockStorageBucket {
  upload: jest.Mock<Promise<MockStorageResponse>>;
  download: jest.Mock<Promise<MockStorageResponse>>;
  remove: jest.Mock<Promise<MockStorageResponse>>;
  list: jest.Mock<Promise<MockStorageResponse<unknown[]>>>;
  getPublicUrl: jest.Mock<{ data: { publicUrl: string } }>;
}

// Mock Supabase client interface
interface MockSupabaseClientType {
  auth: {
    getSession: jest.Mock<Promise<MockSessionResponse>>;
    getUser: jest.Mock<Promise<MockUserResponse>>;
    signInWithPassword: jest.Mock;
    signInWithOAuth: jest.Mock;
    signUp: jest.Mock;
    signOut: jest.Mock;
    onAuthStateChange: jest.Mock;
    refreshSession: jest.Mock;
  };
  rpc: jest.Mock<Promise<MockAuthResponse<string>>>;
  __tableMocks: Record<string, TableMock>;
  setTableMock: (table: string, mockImpl: TableMock) => MockSupabaseClientType;
  from: jest.Mock<MockQueryChain, [string]>;
  storage: {
    from: jest.Mock<MockStorageBucket>;
  };
  realtime: {
    channel: jest.Mock;
  };
  channel: jest.Mock;
  removeChannel: jest.Mock;
  functions: {
    invoke: jest.Mock<Promise<MockStorageResponse>>;
  };
  createClient?: typeof createClient;
  createClientComponentClient?: typeof createClientComponentClient;
  createServerComponentClient?: typeof createServerComponentClient;
  createSupabaseServerClient?: typeof createSupabaseServerClient;
  createBrowserClient?: typeof createBrowserClient;
  createSupabaseServiceRoleClient?: typeof createSupabaseServiceRoleClient;
  createServerClient?: typeof createServerClient;
  createMiddlewareClient?: typeof createMiddlewareClient;
  RealtimeClient?: typeof RealtimeClient;
}

/**
 * Creates a mock query chain with proper method chaining
 */
function createMockQueryChain(): MockQueryChain {
  const chain: MockQueryChain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    like: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    range: jest.fn(() => chain),
    order: jest.fn(() => chain),
    textSearch: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    single: jest.fn(async () => ({ data: null, error: null })),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    then: jest.fn((callback: (result: { data: unknown[]; error: null }) => void) =>
      callback({ data: [], error: null })
    ),
  };
  return chain;
}

// Create a comprehensive mock Supabase client
const mockSupabaseClient: MockSupabaseClientType = {
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
  __tableMocks: {} as Record<string, TableMock>,
  setTableMock(table: string, mockImpl: TableMock) {
    mockSupabaseClient.__tableMocks = mockSupabaseClient.__tableMocks || {};
    mockSupabaseClient.__tableMocks[table] = mockImpl;
    return mockSupabaseClient;
  },
  from: jest.fn((table: string) => {
    const tableMock = mockSupabaseClient.__tableMocks[table];
    if (tableMock) {
      return typeof tableMock === "function" ? tableMock(table) : tableMock;
    }
    return createMockQueryChain();
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

function createClient(): SupabaseClient<Database> {
  return mockSupabaseClient as unknown as SupabaseClient<Database>;
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
    unsubscribe: jest.fn(),
  })),
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
  createMockQueryChain,
};

export type { MockSupabaseClientType, MockQueryChain };

if (typeof module !== "undefined") {
  module.exports = exportsForModule;
}
