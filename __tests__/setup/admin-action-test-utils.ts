/**
 * Shared test utilities for admin action tests
 *
 * NOTE: This file lives under `__tests__/setup/` so Jest does not treat it as a test suite.
 */

export type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

export function createThenableQuery<T>(result: QueryResult<T>) {
  const self: Record<string, unknown> = {};

  // Common Supabase query chain methods used in admin actions
  self.select = jest.fn((_sel?: unknown, _opts?: unknown) => self);
  self.order = jest.fn((_field?: unknown, _opts?: unknown) => self);
  self.is = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.eq = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.gte = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.lte = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.lt = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.not = jest.fn((_field?: unknown, _operator?: unknown, _value?: unknown) => self);
  self.or = jest.fn((_filters?: unknown) => self);
  self.ilike = jest.fn((_field?: unknown, _pattern?: unknown) => self);
  self.limit = jest.fn((_n?: unknown) => self);

  // Mutation helpers used in some admin actions
  self.insert = jest.fn((_values?: unknown) => self);
  self.upsert = jest.fn((_values?: unknown, _opts?: unknown) => self);
  self.update = jest.fn((_values?: unknown) => self);
  self.delete = jest.fn(() => self);

  // End-of-chain helpers
  self.single = jest.fn(() => Promise.resolve(result));
  self.maybeSingle = jest.fn(() => Promise.resolve(result));

  // Make the query awaitable: `const { data, error } = await query`
  self.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(
      onFulfilled as (value: QueryResult<T>) => unknown,
      onRejected as (reason: unknown) => unknown
    );

  return self;
}

