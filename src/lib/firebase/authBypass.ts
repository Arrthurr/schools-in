// Temporary authentication bypass for testing Google Maps integration
// This allows testing without Firebase Authentication

export interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  role: "provider" | "admin";
}

// Mock user data for testing
const MOCK_USERS: Record<string, MockUser> = {
  admin: {
    uid: "test-admin-123",
    email: "admin@test.com",
    displayName: "Test Admin",
    role: "admin"
  },
  provider: {
    uid: "test-provider-456", 
    email: "provider@test.com",
    displayName: "Test Provider",
    role: "provider"
  }
};

// Check if authentication bypass is enabled
export const isAuthBypassEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";
};

// Get mock user for testing
export const getMockUser = (userType: "admin" | "provider" = "admin"): MockUser => {
  return MOCK_USERS[userType];
};

// Mock authentication state
export const createMockAuthState = (userType: "admin" | "provider" = "admin") => {
  return {
    user: getMockUser(userType),
    loading: false,
    error: null,
    isAuthenticated: true,
    isProvider: userType === "provider",
    isAdmin: userType === "admin"
  };
};
