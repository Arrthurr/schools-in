import {
  isAuthBypassEnabled,
  getMockUser,
  createMockAuthState,
} from "./authBypass";

describe("authBypass helpers", () => {
  const originalFlag = process.env.NEXT_PUBLIC_DISABLE_AUTH;

  afterEach(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = originalFlag;
  });

  it("detects when auth bypass is enabled", () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = "true";

    expect(isAuthBypassEnabled()).toBe(true);
  });

  it("detects when auth bypass is disabled", () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = "false";

    expect(isAuthBypassEnabled()).toBe(false);
  });

  it("returns the correct mock admin and provider users", () => {
    const admin = getMockUser("admin");
    const provider = getMockUser("provider");

    expect(admin.role).toBe("admin");
    expect(provider.role).toBe("provider");
    expect(admin.email).toContain("admin");
    expect(provider.email).toContain("provider");
  });

  it("builds a mock auth state with role helpers", () => {
    const adminState = createMockAuthState("admin");
    const providerState = createMockAuthState("provider");

    expect(adminState.isAdmin).toBe(true);
    expect(adminState.isProvider).toBe(false);
    expect(providerState.isProvider).toBe(true);
    expect(providerState.isAdmin).toBe(false);
    expect(providerState.user.role).toBe("provider");
  });
});
