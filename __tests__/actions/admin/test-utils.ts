/**
 * Shared test utilities for admin action tests
 */

export type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

export function createThenableQuery<T>(result: QueryResult<T>) {
  const self: Record<string, unknown> = {};

  self.select = jest.fn((_sel?: unknown, _opts?: unknown) => self);
  self.order = jest.fn((_field?: unknown, _opts?: unknown) => self);
  self.is = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.eq = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.insert = jest.fn((_values?: unknown) => self);
  self.update = jest.fn((_values?: unknown) => self);
  self.delete = jest.fn(() => self);
  self.single = jest.fn(() => Promise.resolve(result));

  self.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(
      onFulfilled as (value: QueryResult<T>) => unknown,
      onRejected as (reason: unknown) => unknown
    );

  return self;
}
