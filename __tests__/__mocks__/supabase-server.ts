// Minimal Supabase server client mock for testing
export const createClient = jest.fn(() => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      error: null
    })
  },
  from: jest.fn((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: {}, error: null }),
  }))
}));