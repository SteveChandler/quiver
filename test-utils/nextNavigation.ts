// Mock for next/navigation
const createMockRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
});

// Mock AppRouterInstance
const appRouter = {
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

// Mock AppRouterContext
const AppRouterContext = {
  getServerActionDispatcher: jest.fn(() => null),
  getServerInsertedHTML: jest.fn(() => undefined),
  navigateReducer: jest.fn(() => null),
  tree: "",
};

// Mock the useRouter implementation
let mockRouter = createMockRouter();

// Provide a function to reset the mock router
const resetMockRouter = () => {
  mockRouter = createMockRouter();
  return mockRouter;
};

// Track if the router has been mounted
const mountedState = { mounted: true };

// Export mock functions
export {
  appRouter,
  AppRouterContext,
  mockRouter,
  resetMockRouter,
  mountedState,
};

// Mock the entire next/navigation module
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: jest.fn(() => ({
    get: jest.fn((param) => {
      if (param === "mode") return null;
      return null;
    }),
  })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
  useSelectedLayoutSegment: jest.fn(() => null),
  useSelectedLayoutSegments: jest.fn(() => []),
  useAppRouter: jest.fn(() => appRouter),
  useServerInsertedHTML: jest.fn(),
  redirect: jest.fn((url) => {
    throw new Error(`Redirected to ${url}`);
  }),
}));

// Helper to mock search params
export const mockUseSearchParams = (mode: string | null) => {
  jest
    .spyOn(require("next/navigation"), "useSearchParams")
    .mockImplementation(() => ({
      get: jest.fn((param) => {
        if (param === "mode") return mode;
        return null;
      }),
      getAll: jest.fn(() => []),
      has: jest.fn(() => false),
      forEach: jest.fn(),
      entries: jest.fn(() => []),
      keys: jest.fn(() => []),
      values: jest.fn(() => []),
      toString: jest.fn(() => ""),
    }));
};
