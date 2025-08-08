// Vitest shim for Jest environment
import * as globals from "@jest/globals";

export const {
  describe,
  it,
  test,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} = globals;

export const vi: any = {
  fn: globals.jest.fn,
  spyOn: globals.jest.spyOn,
  mocked: <T>(item: T) => item as any,
  clearAllMocks: globals.jest.clearAllMocks,
  resetAllMocks: globals.jest.resetAllMocks,
  mock: globals.jest.mock,
  doMock: (moduleName: string, factory?: any) =>
    globals.jest.doMock(moduleName, factory),
  unmock: globals.jest.unmock,
  useFakeTimers: globals.jest.useFakeTimers,
  useRealTimers: globals.jest.useRealTimers,
};

export default globals;
