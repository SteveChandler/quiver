/**
 * Simplified Supabase mock builder for tests
 */

// Type definitions for Supabase mock responses
interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface MockQueryMethods {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  in: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

interface MockSupabaseClient {
  from: jest.Mock;
}

export class SupabaseMockBuilder {
  private mockClient: MockSupabaseClient;

  constructor() {
    this.mockClient = this.createBaseMock();
  }

  private createBaseMock(): MockSupabaseClient {
    return {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(),
            single: jest.fn(),
          })),
          order: jest.fn(),
          in: jest.fn(),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(),
        })),
      })),
    };
  }

  withSelect<T = unknown>(
    _beachId: string,
    mockData: T,
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockOrder = jest.fn().mockResolvedValue(result);
    const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    this.mockClient.from.mockReturnValue({ select: mockSelect });
    return this;
  }

  withSelectEq<T = unknown>(
    _beachId: string,
    mockData: T,
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockEq = jest.fn().mockResolvedValue(result);
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    this.mockClient.from.mockReturnValue({ select: mockSelect });
    return this;
  }

  withSelectSingle<T = unknown>(
    _beachId: string,
    _userId: string,
    mockData: T,
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockSingle = jest.fn().mockResolvedValue(result);
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });

    this.mockClient.from.mockReturnValue({ select: mockSelect });
    return this;
  }

  withInsert<T = unknown>(
    mockData: T,
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockSingle = jest.fn().mockResolvedValue(result);
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

    // Mock additional calls for beach average rating updates
    this.mockClient.from
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      });

    return this;
  }

  withUpdate<T = unknown>(
    mockData: T,
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockSingle = jest.fn().mockResolvedValue(result);
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

    // Mock additional calls for beach average rating updates
    this.mockClient.from
      .mockReturnValueOnce({ update: mockUpdate })
      .mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      });

    return this;
  }

  withDelete(
    beachId: string,
    error: SupabaseResponse["error"] = null
  ): this {
    // Mock getting beach_id before delete
    const mockSingle = jest.fn().mockResolvedValue({
      data: { beach_id: beachId },
      error: null,
    });

    const mockSelectEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });

    // Mock delete operation
    const deleteResult = error ? { error } : { error: null };
    const mockDeleteEq = jest.fn().mockResolvedValue(deleteResult);
    const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });

    this.mockClient.from
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ delete: mockDelete })
      .mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      });

    return this;
  }

  withDeleteError(error: SupabaseResponse["error"]): this {
    // Mock error in the initial select to get beach_id
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error,
    });

    const mockSelectEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });

    this.mockClient.from.mockReturnValue({ select: mockSelect });
    return this;
  }

  withMultipleBeachStats<T = unknown>(
    _beachIds: string[],
    mockData: T[] | null = [],
    error: SupabaseResponse["error"] = null
  ): this {
    const result: SupabaseResponse<T[] | null> = error
      ? { data: null, error }
      : { data: mockData, error: null };

    const mockIn = jest.fn().mockResolvedValue(result);
    const mockSelect = jest.fn().mockReturnValue({ in: mockIn });

    this.mockClient.from.mockReturnValue({ select: mockSelect });
    return this;
  }

  build(): MockSupabaseClient {
    return this.mockClient;
  }

  reset(): this {
    this.mockClient = this.createBaseMock();
    return this;
  }
}
