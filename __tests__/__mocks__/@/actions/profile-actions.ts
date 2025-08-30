// Mock for profile actions
export const setHomeBeach = jest.fn().mockResolvedValue({
  success: true,
  data: {
    id: "test-user-id",
    home_beach_id: "test-beach-id",
    full_name: "Test User"
  }
});

export const updateProfile = jest.fn().mockResolvedValue({
  success: true,
  data: {
    id: "test-user-id",
    full_name: "Test User"
  }
});

export const getProfile = jest.fn().mockResolvedValue({
  success: true,
  data: {
    id: "test-user-id",
    home_beach_id: null,
    full_name: "Test User"
  }
});